/**
 * RSS Adapter - Handles RSS and Atom feed ingestion
 * 
 * Features:
 * 1. RSS/Atom feed parsing
 * 2. Content extraction and cleaning
 * 3. Duplicate detection
 * 4. Feed validation and error handling
 */

const Parser = require('rss-parser');
const BaseAdapter = require('../base-adapter');

class RSSAdapter extends BaseAdapter {
  constructor(source, options = {}) {
    super(source, options);
    
    this.parser = new Parser({
      timeout: this.source.polling_config.timeout_seconds * 1000,
      maxRedirects: 5,
      headers: {
        'User-Agent': this.options.userAgent
      },
      customFields: {
        feed: ['language', 'copyright', 'managingEditor'],
        item: ['content', 'content:encoded', 'summary', 'description', 'author', 'creator']
      }
    });
    
    this.seenItems = new Set(); // Simple deduplication
    this.lastBuildDate = null;
  }
  
  /**
   * Poll RSS feed for new items
   */
  async poll() {
    try {
      this.logger.info('Polling RSS feed', { url: this.source.url });
      
      const feed = await this.parser.parseURL(this.source.url);
      
      if (!feed || !feed.items) {
        throw new Error('Invalid RSS feed: no items found');
      }
      
      this.logger.debug('Feed parsed successfully', {
        title: feed.title,
        total_items: feed.items.length,
        last_build_date: feed.lastBuildDate
      });
      
      // Check if feed has been updated since last poll
      if (this.lastBuildDate && feed.lastBuildDate) {
        const feedDate = new Date(feed.lastBuildDate);
        if (feedDate <= this.lastBuildDate) {
          this.logger.debug('Feed not updated since last poll');
          return {
            items: [],
            feed_info: {
              title: feed.title,
              last_build_date: feed.lastBuildDate,
              total_items: feed.items.length,
              new_items: 0
            }
          };
        }
      }
      
      // Process items
      const newItems = await this.processItems(feed.items);
      
      // Update last build date
      if (feed.lastBuildDate) {
        this.lastBuildDate = new Date(feed.lastBuildDate);
      }
      
      return {
        items: newItems,
        feed_info: {
          title: feed.title,
          description: feed.description,
          link: feed.link,
          language: feed.language,
          last_build_date: feed.lastBuildDate,
          total_items: feed.items.length,
          new_items: newItems.length
        }
      };
      
    } catch (error) {
      this.logger.error('RSS polling failed', {
        error: error.message,
        url: this.source.url
      });
      
      // Enhance error with context
      if (error.code === 'ENOTFOUND') {
        error.message = `RSS feed not found: ${this.source.url}`;
      } else if (error.code === 'ETIMEDOUT') {
        error.message = `RSS feed timeout: ${this.source.url}`;
      } else if (error.message.includes('Invalid XML')) {
        error.message = `Invalid RSS/XML format: ${this.source.url}`;
      }
      
      throw error;
    }
  }
  
  /**
   * Process RSS items and filter for new content
   */
  async processItems(items) {
    const config = this.source.extraction_config;
    const maxItems = this.source.polling_config.max_items_per_poll;
    const newItems = [];
    
    // Sort items by date (newest first)
    const sortedItems = items
      .filter(item => item && item.link)
      .sort((a, b) => {
        const dateA = new Date(a.pubDate || a.isoDate || 0);
        const dateB = new Date(b.pubDate || b.isoDate || 0);
        return dateB - dateA;
      })
      .slice(0, maxItems);
    
    for (const item of sortedItems) {
      try {
        // Check for duplicates
        const itemKey = this.generateItemKey(item);
        if (this.seenItems.has(itemKey)) {
          this.logger.debug('Skipping duplicate item', { 
            title: item.title,
            link: item.link 
          });
          continue;
        }
        
        // Check if item is within deduplication window
        const itemDate = new Date(item.pubDate || item.isoDate || Date.now());
        const windowHours = config.dedup_window_hours;
        const cutoffDate = new Date(Date.now() - windowHours * 60 * 60 * 1000);
        
        if (itemDate < cutoffDate) {
          this.logger.debug('Skipping old item outside dedup window', {
            title: item.title,
            date: itemDate,
            cutoff: cutoffDate
          });
          continue;
        }
        
        // Extract and clean content
        const processedItem = await this.extractItemContent(item);
        
        if (processedItem) {
          newItems.push(processedItem);
          this.seenItems.add(itemKey);
          
          // Limit seen items set size to prevent memory issues
          if (this.seenItems.size > 10000) {
            const itemsArray = Array.from(this.seenItems);
            this.seenItems = new Set(itemsArray.slice(-5000)); // Keep last 5000
          }
        }
        
      } catch (error) {
        this.logger.warn('Error processing RSS item', {
          error: error.message,
          item_title: item.title,
          item_link: item.link
        });
      }
    }
    
    this.logger.info('RSS items processed', {
      total_items: sortedItems.length,
      new_items: newItems.length,
      duplicates_skipped: sortedItems.length - newItems.length
    });
    
    return newItems;
  }
  
  /**
   * Extract content from RSS item
   */
  async extractItemContent(item) {
    // Get content from various possible fields
    let content = item['content:encoded'] || 
                 item.content || 
                 item.summary || 
                 item.description || 
                 '';
    
    // Clean HTML if present
    if (content && content.includes('<')) {
      content = this.stripHtml(content);
    }
    
    // Validate content length
    const config = this.source.extraction_config;
    if (content.length < config.min_content_length) {
      this.logger.debug('Item content too short', {
        title: item.title,
        content_length: content.length,
        min_required: config.min_content_length
      });
      return null;
    }
    
    // Extract summary if not provided
    let summary = item.summary || item.description || '';
    if (!summary && content) {
      summary = this.generateSummary(content);
    }
    
    // Clean and validate
    const title = this.cleanText(item.title);
    if (!title || title.length < 10) {
      this.logger.debug('Item title too short or missing', { title });
      return null;
    }
    
    return {
      title,
      summary: this.cleanText(summary),
      content: this.cleanText(content),
      url: item.link || item.guid,
      published_at: item.pubDate || item.isoDate,
      author: item.author || item.creator || item['dc:creator'] || '',
      
      // RSS-specific metadata
      guid: item.guid,
      categories: item.categories || [],
      
      // Source metadata
      feed_title: item.feed?.title,
      feed_link: item.feed?.link
    };
  }
  
  /**
   * Generate unique key for item deduplication
   */
  generateItemKey(item) {
    // Use GUID if available, otherwise URL, otherwise title + date
    if (item.guid) {
      return `guid:${item.guid}`;
    }
    
    if (item.link) {
      return `url:${item.link}`;
    }
    
    const date = item.pubDate || item.isoDate || '';
    return `title:${item.title}:${date}`;
  }
  
  /**
   * Strip HTML tags from content
   */
  stripHtml(html) {
    if (!html) return '';
    
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')   // Remove styles
      .replace(/<[^>]+>/g, ' ')                         // Remove HTML tags
      .replace(/&nbsp;/g, ' ')                          // Replace &nbsp;
      .replace(/&amp;/g, '&')                           // Replace &amp;
      .replace(/&lt;/g, '<')                            // Replace &lt;
      .replace(/&gt;/g, '>')                            // Replace &gt;
      .replace(/&quot;/g, '"')                          // Replace &quot;
      .replace(/&#39;/g, "'")                           // Replace &#39;
      .replace(/\s+/g, ' ')                             // Normalize whitespace
      .trim();
  }
  
  /**
   * Generate summary from content
   */
  generateSummary(content, maxLength = 300) {
    if (!content) return '';
    
    // Take first few sentences up to maxLength
    const sentences = content.split(/[.!?]+/);
    let summary = '';
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;
      
      if (summary.length + trimmed.length + 1 <= maxLength) {
        summary += (summary ? ' ' : '') + trimmed + '.';
      } else {
        break;
      }
    }
    
    return summary || content.substring(0, maxLength) + '...';
  }
  
  /**
   * Validate RSS feed URL and structure
   */
  async validateFeed() {
    try {
      const feed = await this.parser.parseURL(this.source.url);
      
      const validation = {
        is_valid: true,
        feed_type: this.detectFeedType(feed),
        title: feed.title,
        description: feed.description,
        item_count: feed.items?.length || 0,
        last_build_date: feed.lastBuildDate,
        language: feed.language,
        issues: []
      };
      
      // Check for common issues
      if (!feed.title) {
        validation.issues.push('Feed missing title');
      }
      
      if (!feed.items || feed.items.length === 0) {
        validation.issues.push('Feed contains no items');
      }
      
      if (feed.items) {
        const itemsWithoutLinks = feed.items.filter(item => !item.link && !item.guid);
        if (itemsWithoutLinks.length > 0) {
          validation.issues.push(`${itemsWithoutLinks.length} items missing links/GUIDs`);
        }
      }
      
      return validation;
      
    } catch (error) {
      return {
        is_valid: false,
        error: error.message,
        issues: ['Feed parsing failed']
      };
    }
  }
  
  /**
   * Detect feed type (RSS vs Atom)
   */
  detectFeedType(feed) {
    if (feed.feedUrl && feed.feedUrl.includes('atom')) return 'atom';
    if (feed.generator && feed.generator.toLowerCase().includes('atom')) return 'atom';
    if (feed.link && typeof feed.link === 'object') return 'atom'; // Atom links are objects
    return 'rss';
  }
  
  /**
   * Get feed statistics
   */
  getStats() {
    return {
      ...super.getStatus(),
      seen_items_count: this.seenItems.size,
      last_build_date: this.lastBuildDate,
      feed_type: 'rss'
    };
  }
}

module.exports = RSSAdapter;
