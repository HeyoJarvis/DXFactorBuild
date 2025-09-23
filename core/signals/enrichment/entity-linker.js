/**
 * Entity Linker - Links signals to relevant entities (companies, products, people, technologies)
 * 
 * Features:
 * 1. Named Entity Recognition (NER)
 * 2. Entity linking to knowledge base
 * 3. Confidence scoring
 * 4. Context-aware entity extraction
 * 5. Competitive relationship mapping
 */

const natural = require('natural');
const compromise = require('compromise');
const winston = require('winston');

class EntityLinker {
  constructor(options = {}) {
    this.options = {
      confidenceThreshold: 0.6,
      maxEntitiesPerSignal: 20,
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'entity-linker' }
    });
    
    // Entity knowledge base - in production, this would be a proper database
    this.knowledgeBase = {
      companies: new Map(),
      products: new Map(),
      people: new Map(),
      technologies: new Map(),
      locations: new Map()
    };
    
    // Initialize with common tech companies and products
    this.initializeKnowledgeBase();
    
    // Compiled regex patterns for entity detection
    this.patterns = this.compilePatterns();
  }
  
  /**
   * Extract and link entities from signal content
   */
  async extractEntities(signal, userContext = {}) {
    try {
      const text = `${signal.title} ${signal.summary} ${signal.content || ''}`;
      const entities = [];
      
      this.logger.debug('Extracting entities from signal', {
        signal_id: signal.id,
        text_length: text.length
      });
      
      // Use compromise.js for basic NER
      const doc = compromise(text);
      
      // Extract different entity types
      const companyEntities = await this.extractCompanies(doc, text, userContext);
      const productEntities = await this.extractProducts(doc, text, userContext);
      const peopleEntities = await this.extractPeople(doc, text);
      const techEntities = await this.extractTechnologies(doc, text);
      const locationEntities = await this.extractLocations(doc, text);
      
      entities.push(...companyEntities);
      entities.push(...productEntities);
      entities.push(...peopleEntities);
      entities.push(...techEntities);
      entities.push(...locationEntities);
      
      // Filter by confidence and limit count
      const filteredEntities = entities
        .filter(entity => entity.confidence >= this.options.confidenceThreshold)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.options.maxEntitiesPerSignal);
      
      // Calculate relevance scores based on user context
      const scoredEntities = this.scoreEntityRelevance(filteredEntities, userContext);
      
      this.logger.info('Entity extraction completed', {
        signal_id: signal.id,
        total_entities: entities.length,
        filtered_entities: filteredEntities.length,
        high_confidence: filteredEntities.filter(e => e.confidence > 0.8).length
      });
      
      return scoredEntities;
      
    } catch (error) {
      this.logger.error('Entity extraction failed', {
        signal_id: signal.id,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Extract company entities
   */
  async extractCompanies(doc, text, userContext) {
    const entities = [];
    
    // Extract organizations using compromise.js
    const orgs = doc.organizations().out('array');
    
    for (const orgName of orgs) {
      const normalized = this.normalizeEntityName(orgName);
      const confidence = this.calculateCompanyConfidence(orgName, text, userContext);
      
      if (confidence > 0.3) {
        const entity = {
          type: 'company',
          name: orgName,
          normalized_name: normalized,
          confidence,
          context: this.extractEntityContext(orgName, text),
          relevance: 0 // Will be calculated later
        };
        
        // Check if it's in our knowledge base
        const knownCompany = this.knowledgeBase.companies.get(normalized);
        if (knownCompany) {
          entity.kb_id = knownCompany.id;
          entity.industry = knownCompany.industry;
          entity.is_competitor = knownCompany.is_competitor;
          entity.confidence += 0.2; // Boost confidence for known entities
        }
        
        entities.push(entity);
      }
    }
    
    // Also check for companies mentioned in user's competitive context
    if (userContext.competitors) {
      for (const competitor of userContext.competitors) {
        const mentions = this.findMentions(competitor, text);
        if (mentions.length > 0) {
          entities.push({
            type: 'company',
            name: competitor,
            normalized_name: this.normalizeEntityName(competitor),
            confidence: 0.9, // High confidence for known competitors
            context: mentions[0].context,
            relevance: 1.0, // Maximum relevance for competitors
            is_competitor: true,
            mentions: mentions.length
          });
        }
      }
    }
    
    return this.deduplicateEntities(entities);
  }
  
  /**
   * Extract product entities
   */
  async extractProducts(doc, text, userContext) {
    const entities = [];
    
    // Look for product-related patterns
    const productPatterns = [
      /\b([A-Z][a-zA-Z0-9\s]{2,20})\s+(app|software|platform|service|tool|API|SDK)\b/gi,
      /\b(new|latest|updated)\s+([A-Z][a-zA-Z0-9\s]{2,20})\b/gi,
      /\b([A-Z][a-zA-Z0-9\s]{2,20})\s+(version|v\d+|\d+\.\d+)\b/gi
    ];
    
    for (const pattern of productPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const productName = match[1] || match[2];
        if (productName && productName.length > 2) {
          const confidence = this.calculateProductConfidence(productName, text);
          
          if (confidence > 0.4) {
            entities.push({
              type: 'product',
              name: productName.trim(),
              normalized_name: this.normalizeEntityName(productName),
              confidence,
              context: this.extractEntityContext(productName, text),
              relevance: 0,
              pattern_matched: pattern.source
            });
          }
        }
      }
    }
    
    // Check user's own products
    if (userContext.our_products) {
      for (const product of userContext.our_products) {
        const mentions = this.findMentions(product.name, text);
        if (mentions.length > 0) {
          entities.push({
            type: 'product',
            name: product.name,
            normalized_name: this.normalizeEntityName(product.name),
            confidence: 0.95,
            context: mentions[0].context,
            relevance: 1.0,
            is_our_product: true,
            mentions: mentions.length
          });
        }
      }
    }
    
    return this.deduplicateEntities(entities);
  }
  
  /**
   * Extract people entities
   */
  async extractPeople(doc, text) {
    const entities = [];
    
    // Extract people using compromise.js
    const people = doc.people().out('array');
    
    for (const personName of people) {
      const confidence = this.calculatePersonConfidence(personName, text);
      
      if (confidence > 0.5) {
        entities.push({
          type: 'person',
          name: personName,
          normalized_name: this.normalizeEntityName(personName),
          confidence,
          context: this.extractEntityContext(personName, text),
          relevance: 0
        });
      }
    }
    
    // Look for executive titles
    const executivePatterns = [
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+),?\s+(CEO|CTO|CFO|COO|VP|President|Founder)\b/gi,
      /\b(CEO|CTO|CFO|COO|VP|President|Founder)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/gi
    ];
    
    for (const pattern of executivePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const personName = match[1] || match[2];
        const title = match[2] || match[1];
        
        if (personName && title) {
          entities.push({
            type: 'person',
            name: personName.trim(),
            normalized_name: this.normalizeEntityName(personName),
            confidence: 0.8,
            context: this.extractEntityContext(personName, text),
            relevance: 0.7, // Executives are generally relevant
            title: title,
            is_executive: true
          });
        }
      }
    }
    
    return this.deduplicateEntities(entities);
  }
  
  /**
   * Extract technology entities
   */
  async extractTechnologies(doc, text) {
    const entities = [];
    
    // Common technology terms and frameworks
    const techKeywords = [
      'AI', 'ML', 'machine learning', 'artificial intelligence', 'blockchain',
      'kubernetes', 'docker', 'react', 'vue', 'angular', 'node.js', 'python',
      'java', 'go', 'rust', 'typescript', 'javascript', 'aws', 'azure', 'gcp',
      'tensorflow', 'pytorch', 'api', 'rest', 'graphql', 'microservices'
    ];
    
    const textLower = text.toLowerCase();
    
    for (const tech of techKeywords) {
      const mentions = this.findMentions(tech, text, true); // Case insensitive
      if (mentions.length > 0) {
        entities.push({
          type: 'technology',
          name: tech,
          normalized_name: tech.toLowerCase(),
          confidence: 0.7,
          context: mentions[0].context,
          relevance: 0,
          mentions: mentions.length
        });
      }
    }
    
    return this.deduplicateEntities(entities);
  }
  
  /**
   * Extract location entities
   */
  async extractLocations(doc, text) {
    const entities = [];
    
    // Extract places using compromise.js
    const places = doc.places().out('array');
    
    for (const placeName of places) {
      const confidence = this.calculateLocationConfidence(placeName, text);
      
      if (confidence > 0.6) {
        entities.push({
          type: 'location',
          name: placeName,
          normalized_name: this.normalizeEntityName(placeName),
          confidence,
          context: this.extractEntityContext(placeName, text),
          relevance: 0
        });
      }
    }
    
    return entities;
  }
  
  /**
   * Calculate confidence score for company entities
   */
  calculateCompanyConfidence(name, text, userContext) {
    let confidence = 0.5; // Base confidence
    
    // Boost for proper capitalization
    if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(name)) {
      confidence += 0.2;
    }
    
    // Boost for common company suffixes
    if (/\b(Inc|LLC|Corp|Ltd|Co|Company)\b/i.test(name)) {
      confidence += 0.2;
    }
    
    // Boost for competitive context
    if (userContext.competitors?.some(comp => 
      comp.toLowerCase().includes(name.toLowerCase()) || 
      name.toLowerCase().includes(comp.toLowerCase())
    )) {
      confidence += 0.3;
    }
    
    // Boost for multiple mentions
    const mentions = this.findMentions(name, text).length;
    confidence += Math.min(0.2, mentions * 0.05);
    
    return Math.min(1.0, confidence);
  }
  
  /**
   * Calculate confidence score for product entities
   */
  calculateProductConfidence(name, text) {
    let confidence = 0.4;
    
    // Boost for product-related context
    const productContext = /\b(launch|release|update|version|feature|beta|alpha)\b/i;
    if (productContext.test(text)) {
      confidence += 0.3;
    }
    
    // Boost for proper naming
    if (/^[A-Z][a-zA-Z0-9\s]*$/.test(name)) {
      confidence += 0.2;
    }
    
    return Math.min(1.0, confidence);
  }
  
  /**
   * Calculate confidence score for person entities
   */
  calculatePersonConfidence(name, text) {
    let confidence = 0.5;
    
    // Boost for proper name format
    if (/^[A-Z][a-z]+\s[A-Z][a-z]+$/.test(name)) {
      confidence += 0.2;
    }
    
    // Boost for executive context
    const executiveContext = /\b(CEO|CTO|CFO|COO|VP|President|Founder|executive|leader)\b/i;
    if (executiveContext.test(text)) {
      confidence += 0.3;
    }
    
    return Math.min(1.0, confidence);
  }
  
  /**
   * Calculate confidence score for location entities
   */
  calculateLocationConfidence(name, text) {
    let confidence = 0.6;
    
    // Boost for known major cities/countries
    const majorLocations = ['New York', 'San Francisco', 'London', 'Tokyo', 'Singapore', 'USA', 'UK', 'China', 'India'];
    if (majorLocations.includes(name)) {
      confidence += 0.2;
    }
    
    return Math.min(1.0, confidence);
  }
  
  /**
   * Score entity relevance based on user context
   */
  scoreEntityRelevance(entities, userContext) {
    return entities.map(entity => {
      let relevance = entity.relevance || 0;
      
      // High relevance for competitors and our products
      if (entity.is_competitor || entity.is_our_product) {
        relevance = Math.max(relevance, 0.9);
      }
      
      // Boost relevance for technologies we use
      if (entity.type === 'technology' && userContext.technologies?.includes(entity.name)) {
        relevance += 0.4;
      }
      
      // Boost for entities in our focus areas
      if (userContext.focus_areas) {
        const focusMatch = userContext.focus_areas.some(area => 
          entity.name.toLowerCase().includes(area.toLowerCase()) ||
          area.toLowerCase().includes(entity.name.toLowerCase())
        );
        if (focusMatch) relevance += 0.3;
      }
      
      // Boost for executives (leadership changes are important)
      if (entity.is_executive) {
        relevance += 0.2;
      }
      
      entity.relevance = Math.min(1.0, relevance);
      return entity;
    });
  }
  
  /**
   * Find mentions of an entity in text
   */
  findMentions(entityName, text, caseInsensitive = false) {
    const mentions = [];
    const flags = caseInsensitive ? 'gi' : 'g';
    const regex = new RegExp(`\\b${this.escapeRegex(entityName)}\\b`, flags);
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + entityName.length + 50);
      
      mentions.push({
        position: match.index,
        context: text.substring(start, end).trim()
      });
    }
    
    return mentions;
  }
  
  /**
   * Extract context around entity mention
   */
  extractEntityContext(entityName, text, contextLength = 100) {
    const index = text.toLowerCase().indexOf(entityName.toLowerCase());
    if (index === -1) return '';
    
    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(text.length, index + entityName.length + contextLength / 2);
    
    return text.substring(start, end).trim();
  }
  
  /**
   * Normalize entity name for comparison
   */
  normalizeEntityName(name) {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Remove duplicate entities
   */
  deduplicateEntities(entities) {
    const seen = new Map();
    const unique = [];
    
    for (const entity of entities) {
      const key = `${entity.type}:${entity.normalized_name}`;
      const existing = seen.get(key);
      
      if (!existing || entity.confidence > existing.confidence) {
        seen.set(key, entity);
      }
    }
    
    return Array.from(seen.values());
  }
  
  /**
   * Add entity to knowledge base
   */
  addToKnowledgeBase(type, entity) {
    if (!this.knowledgeBase[type]) {
      this.knowledgeBase[type] = new Map();
    }
    
    const normalized = this.normalizeEntityName(entity.name);
    this.knowledgeBase[type].set(normalized, entity);
    
    this.logger.debug('Entity added to knowledge base', {
      type,
      name: entity.name,
      normalized
    });
  }
  
  /**
   * Initialize knowledge base with common entities
   */
  initializeKnowledgeBase() {
    // Common tech companies
    const techCompanies = [
      { name: 'Google', industry: 'Technology', is_competitor: true },
      { name: 'Microsoft', industry: 'Technology', is_competitor: true },
      { name: 'Amazon', industry: 'Technology', is_competitor: true },
      { name: 'Apple', industry: 'Technology', is_competitor: true },
      { name: 'Meta', industry: 'Technology', is_competitor: true },
      { name: 'Netflix', industry: 'Technology', is_competitor: false },
      { name: 'Salesforce', industry: 'Technology', is_competitor: false },
      { name: 'Adobe', industry: 'Technology', is_competitor: false }
    ];
    
    for (const company of techCompanies) {
      this.addToKnowledgeBase('companies', {
        ...company,
        id: this.normalizeEntityName(company.name)
      });
    }
  }
  
  /**
   * Compile regex patterns for entity detection
   */
  compilePatterns() {
    return {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      url: /https?:\/\/[^\s]+/g,
      version: /v?\d+\.\d+(\.\d+)?/g,
      money: /\$[\d,]+(\.\d{2})?[MBK]?/g
    };
  }
  
  /**
   * Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * Get knowledge base statistics
   */
  getKnowledgeBaseStats() {
    const stats = {};
    
    for (const [type, entities] of Object.entries(this.knowledgeBase)) {
      stats[type] = entities.size;
    }
    
    return {
      ...stats,
      total_entities: Object.values(stats).reduce((sum, count) => sum + count, 0)
    };
  }
}

module.exports = EntityLinker;
