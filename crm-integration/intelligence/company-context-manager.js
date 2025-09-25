/**
 * Company Context Manager
 * 
 * Manages storage, caching, and retrieval of company intelligence data.
 * Provides a clean API for the CRM system to access company context
 * and handles persistence, versioning, and cache management.
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class CompanyContextManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Configuration
        this.config = {
            storageDir: config.storageDir || path.join(__dirname, '../company-context'),
            cacheEnabled: config.cacheEnabled !== false,
            maxCacheAge: config.maxCacheAge || 24 * 60 * 60 * 1000, // 24 hours
            autoRefresh: config.autoRefresh !== false,
            refreshInterval: config.refreshInterval || 7 * 24 * 60 * 60 * 1000, // 7 days
            ...config
        };
        
        // In-memory cache
        this.cache = new Map();
        this.cacheTimestamps = new Map();
        
        // Current company context
        this.currentContext = null;
        this.currentOrganizationId = null;
        
        console.log('📊 Company Context Manager initialized');
        console.log(`💾 Storage directory: ${this.config.storageDir}`);
        
        this._ensureStorageDirectory();
    }

    /**
     * Check if company context exists for any company
     * @returns {Promise<boolean>} True if any company context exists
     */
    async hasCompanyContext() {
        try {
            const files = await fs.readdir(this.config.storageDir);
            const contextFiles = files.filter(file => file.endsWith('_context.json'));
            return contextFiles.length > 0;
        } catch (error) {
            console.error('Error checking for company context:', error.message);
            return false;
        }
    }

    /**
     * Save company intelligence as context
     * @param {Object} intelligence - Company intelligence object from Python analysis
     * @returns {Promise<string>} Organization ID of saved context
     */
    async saveCompanyContext(intelligence) {
        try {
            if (!intelligence || !intelligence.organization_context) {
                throw new Error('Invalid intelligence object - missing organization_context');
            }

            const orgId = intelligence.organization_context.organization_id;
            const contextFile = path.join(this.config.storageDir, `${orgId}_context.json`);
            
            // Create enhanced context object
            const context = {
                ...intelligence,
                contextMetadata: {
                    savedAt: new Date().toISOString(),
                    version: '1.0',
                    lastRefresh: new Date().toISOString(),
                    refreshCount: 0,
                    source: 'company-intelligence-py'
                }
            };

            // Save to file
            await fs.writeFile(contextFile, JSON.stringify(context, null, 2));
            
            // Update cache
            if (this.config.cacheEnabled) {
                this.cache.set(orgId, context);
                this.cacheTimestamps.set(orgId, Date.now());
            }
            
            // Set as current context
            this.currentContext = context;
            this.currentOrganizationId = orgId;
            
            this.emit('contextSaved', { organizationId: orgId, context });
            console.log(`💾 Company context saved for ${intelligence.company_name} (${orgId})`);
            
            return orgId;

        } catch (error) {
            console.error('Error saving company context:', error.message);
            throw error;
        }
    }

    /**
     * Load company context by organization ID
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object|null>} Company context or null if not found
     */
    async loadCompanyContext(organizationId) {
        try {
            // Check cache first
            if (this.config.cacheEnabled && this.cache.has(organizationId)) {
                const cacheTime = this.cacheTimestamps.get(organizationId);
                const age = Date.now() - cacheTime;
                
                if (age < this.config.maxCacheAge) {
                    console.log(`📋 Loading company context from cache: ${organizationId}`);
                    return this.cache.get(organizationId);
                } else {
                    // Cache expired
                    this.cache.delete(organizationId);
                    this.cacheTimestamps.delete(organizationId);
                }
            }

            // Load from file
            const contextFile = path.join(this.config.storageDir, `${organizationId}_context.json`);
            
            try {
                const content = await fs.readFile(contextFile, 'utf8');
                const context = JSON.parse(content);
                
                // Update cache
                if (this.config.cacheEnabled) {
                    this.cache.set(organizationId, context);
                    this.cacheTimestamps.set(organizationId, Date.now());
                }
                
                console.log(`📄 Loaded company context from file: ${context.company_name} (${organizationId})`);
                return context;

            } catch (fileError) {
                if (fileError.code === 'ENOENT') {
                    console.log(`📭 No company context found for: ${organizationId}`);
                    return null;
                }
                throw fileError;
            }

        } catch (error) {
            console.error('Error loading company context:', error.message);
            return null;
        }
    }

    /**
     * Get the current company context (the active one for CRM operations)
     * @returns {Promise<Object|null>} Current company context
     */
    async getCurrentCompanyContext() {
        if (this.currentContext) {
            return this.currentContext;
        }

        // Try to find any existing context
        const contexts = await this.listAllContexts();
        if (contexts.length > 0) {
            // Load the most recently saved context
            const latest = contexts.sort((a, b) => 
                new Date(b.savedAt) - new Date(a.savedAt)
            )[0];
            
            this.currentContext = await this.loadCompanyContext(latest.organizationId);
            this.currentOrganizationId = latest.organizationId;
            
            return this.currentContext;
        }

        return null;
    }

    /**
     * Set the current company context by organization ID
     * @param {string} organizationId - Organization ID to set as current
     * @returns {Promise<Object|null>} The loaded context or null if not found
     */
    async setCurrentCompanyContext(organizationId) {
        const context = await this.loadCompanyContext(organizationId);
        if (context) {
            this.currentContext = context;
            this.currentOrganizationId = organizationId;
            this.emit('contextChanged', { organizationId, context });
            console.log(`🎯 Set current company context: ${context.company_name} (${organizationId})`);
        }
        return context;
    }

    /**
     * List all available company contexts
     * @returns {Promise<Array>} Array of context summaries
     */
    async listAllContexts() {
        try {
            const files = await fs.readdir(this.config.storageDir);
            const contextFiles = files.filter(file => file.endsWith('_context.json'));
            
            const contexts = [];
            for (const file of contextFiles) {
                try {
                    const filePath = path.join(this.config.storageDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const context = JSON.parse(content);
                    
                    contexts.push({
                        organizationId: context.organization_context.organization_id,
                        companyName: context.company_name,
                        websiteUrl: context.website_url,
                        industry: context.organization_context.industry,
                        companySize: context.organization_context.company_size,
                        savedAt: context.contextMetadata?.savedAt,
                        lastRefresh: context.contextMetadata?.lastRefresh,
                        file: file
                    });
                } catch (parseError) {
                    console.warn(`⚠️ Could not parse context file ${file}:`, parseError.message);
                }
            }
            
            return contexts;

        } catch (error) {
            console.error('Error listing company contexts:', error.message);
            return [];
        }
    }

    /**
     * Delete company context
     * @param {string} organizationId - Organization ID to delete
     * @returns {Promise<boolean>} True if deleted successfully
     */
    async deleteCompanyContext(organizationId) {
        try {
            const contextFile = path.join(this.config.storageDir, `${organizationId}_context.json`);
            await fs.unlink(contextFile);
            
            // Remove from cache
            this.cache.delete(organizationId);
            this.cacheTimestamps.delete(organizationId);
            
            // Clear current context if it was the deleted one
            if (this.currentOrganizationId === organizationId) {
                this.currentContext = null;
                this.currentOrganizationId = null;
            }
            
            this.emit('contextDeleted', { organizationId });
            console.log(`🗑️ Deleted company context: ${organizationId}`);
            
            return true;

        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`📭 Context file not found for deletion: ${organizationId}`);
                return false;
            }
            console.error('Error deleting company context:', error.message);
            throw error;
        }
    }

    /**
     * Check if a context needs refresh based on age
     * @param {string} organizationId - Organization ID to check
     * @returns {Promise<boolean>} True if refresh is needed
     */
    async needsRefresh(organizationId) {
        try {
            const context = await this.loadCompanyContext(organizationId);
            if (!context || !context.contextMetadata) {
                return true; // No metadata means old format, needs refresh
            }

            const lastRefresh = new Date(context.contextMetadata.lastRefresh);
            const age = Date.now() - lastRefresh.getTime();
            
            return age > this.config.refreshInterval;

        } catch (error) {
            console.error('Error checking refresh status:', error.message);
            return true; // Error means we should refresh
        }
    }

    /**
     * Update context metadata (e.g., after refresh)
     * @param {string} organizationId - Organization ID
     * @param {Object} updates - Metadata updates
     * @returns {Promise<boolean>} True if updated successfully
     */
    async updateContextMetadata(organizationId, updates) {
        try {
            const context = await this.loadCompanyContext(organizationId);
            if (!context) {
                return false;
            }

            // Update metadata
            context.contextMetadata = {
                ...context.contextMetadata,
                ...updates,
                lastUpdated: new Date().toISOString()
            };

            // Save back to file
            const contextFile = path.join(this.config.storageDir, `${organizationId}_context.json`);
            await fs.writeFile(contextFile, JSON.stringify(context, null, 2));
            
            // Update cache
            if (this.config.cacheEnabled) {
                this.cache.set(organizationId, context);
                this.cacheTimestamps.set(organizationId, Date.now());
            }
            
            // Update current context if it's the same
            if (this.currentOrganizationId === organizationId) {
                this.currentContext = context;
            }
            
            this.emit('contextUpdated', { organizationId, updates });
            return true;

        } catch (error) {
            console.error('Error updating context metadata:', error.message);
            return false;
        }
    }

    /**
     * Clear all company contexts (for reset functionality)
     * @returns {Promise<void>}
     */
    async clearAllContexts() {
        try {
            // Clear in-memory cache
            this.cache.clear();
            this.cacheTimestamps.clear();
            this.currentContext = null;
            this.currentOrganizationId = null;
            
            // Remove all context files
            const files = await fs.readdir(this.config.storageDir);
            const contextFiles = files.filter(file => file.endsWith('_context.json'));
            
            for (const file of contextFiles) {
                await fs.unlink(path.join(this.config.storageDir, file));
                console.log(`🗑️ Removed context file: ${file}`);
            }
            
            console.log('✅ All company contexts cleared');
            
        } catch (error) {
            console.error('❌ Error clearing contexts:', error);
            throw error;
        }
    }

    /**
     * Get context summary for CRM operations (lightweight version)
     * @param {string} organizationId - Organization ID (optional, uses current if not provided)
     * @returns {Promise<Object|null>} Context summary for CRM use
     */
    async getContextSummary(organizationId = null) {
        try {
            const context = organizationId 
                ? await this.loadCompanyContext(organizationId)
                : await this.getCurrentCompanyContext();
                
            if (!context) {
                return null;
            }

            // Return lightweight summary for CRM operations
            return {
                organizationId: context.organization_context.organization_id,
                companyName: context.company_name,
                websiteUrl: context.website_url,
                industry: context.organization_context.industry,
                subIndustry: context.organization_context.sub_industry,
                companySize: context.organization_context.company_size,
                businessModel: context.organization_context.business_model,
                salesComplexity: context.organization_context.sales_complexity,
                techSophistication: context.organization_context.tech_sophistication,
                crmSystem: context.organization_context.crm_system,
                technologyStack: {
                    crmSystem: context.technology_stack.crm_system,
                    marketingAutomation: context.technology_stack.marketing_automation,
                    communicationTools: context.technology_stack.communication_tools,
                    automationTools: context.technology_stack.automation_tools,
                    apiSophistication: context.technology_stack.api_sophistication
                },
                automationGaps: context.workflow_intelligence.automation_gaps,
                integrationNeeds: context.workflow_intelligence.integration_needs,
                processMaturity: {
                    processSophistication: context.process_maturity.process_sophistication,
                    automationLevel: context.process_maturity.automation_level,
                    changeManagementCapability: context.process_maturity.change_management_capability
                },
                marketPosition: context.market_intelligence.market_position,
                competitiveAdvantages: context.market_intelligence.competitive_advantages,
                customerPainPoints: context.market_intelligence.customer_pain_points
            };

        } catch (error) {
            console.error('Error getting context summary:', error.message);
            return null;
        }
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
        console.log('🧹 Company context cache cleared');
    }

    // Private methods

    async _ensureStorageDirectory() {
        try {
            await fs.mkdir(this.config.storageDir, { recursive: true });
        } catch (error) {
            console.error('Error creating storage directory:', error.message);
        }
    }
}

module.exports = CompanyContextManager;
