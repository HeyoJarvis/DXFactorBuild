/**
 * Confluence API Service
 * 
 * Integrates with Atlassian Confluence for documentation:
 * - Create and update pages
 * - Upload attachments
 * - Manage spaces
 * - Convert markdown to Confluence storage format
 * 
 * Features:
 * 1. Uses existing JIRA OAuth tokens (same Atlassian account)
 * 2. AI-powered content generation
 * 3. Markdown to Confluence format conversion
 * 4. Automatic code block formatting
 * 5. Architecture diagram embedding
 */

const fetch = require('node-fetch');
const winston = require('winston');
const EventEmitter = require('events');

class ConfluenceService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      logLevel: options.logLevel || 'info',
      ...options
    };

    // Initialize logger
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/confluence-service.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ],
      defaultMeta: { service: 'confluence-service' }
    });

    // Authentication state (shared with JIRA)
    this.accessToken = null;
    this.cloudId = null;
    this.siteUrl = null;

    this.logger.info('Confluence Service initialized');
  }

  /**
   * Set authentication tokens (from JIRA OAuth)
   */
  setTokens({ accessToken, cloudId, siteUrl }) {
    this.accessToken = accessToken;
    this.cloudId = cloudId;
    this.siteUrl = siteUrl;
    
    this.logger.info('Tokens configured', {
      cloudId: cloudId,
      siteUrl: siteUrl,
      hasToken: !!accessToken
    });
  }

  /**
   * Make authenticated API request
   */
  async _makeRequest(endpoint, options = {}) {
    if (!this.accessToken || !this.cloudId) {
      throw new Error('Not authenticated. Set tokens first.');
    }

    // Use the new v2 API base URL
    const url = `https://api.atlassian.com/ex/confluence/${this.cloudId}${endpoint}`;
    
    this.logger.info('Making Confluence API request', { url, method: options.method || 'GET' });
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error('API request failed', {
        endpoint,
        url,
        status: response.status,
        error: errorText
      });
      throw new Error(`Confluence API error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Get all spaces accessible to the user
   */
  async getSpaces() {
    try {
      this.logger.info('Fetching Confluence spaces');
      
      // Use the v2 API (the old v1 API is deprecated)
      const data = await this._makeRequest('/wiki/api/v2/spaces?limit=100');
      
      this.logger.info('Spaces fetched', { count: data.results?.length || 0 });
      
      return data.results || [];
    } catch (error) {
      this.logger.error('Failed to fetch spaces', { error: error.message });
      throw error;
    }
  }

  /**
   * Convert markdown to Confluence storage format (XHTML)
   */
  _convertMarkdownToStorage(markdown) {
    // Basic markdown to Confluence storage format conversion
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || 'text';
      return `<ac:structured-macro ac:name="code">
        <ac:parameter ac:name="language">${language}</ac:parameter>
        <ac:plain-text-body><![CDATA[${code.trim()}]]></ac:plain-text-body>
      </ac:structured-macro>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Lists
    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${html}</p>`;

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');

    return html;
  }

  /**
   * Create a new Confluence page
   */
  async createPage({ spaceKey, title, content, parentId = null }) {
    try {
      // spaceKey is actually the spaceId (numeric) from the frontend
      const spaceId = spaceKey;
      
      this.logger.info('Creating Confluence page', { spaceId, title });

      // Convert markdown to Confluence storage format
      const storageContent = this._convertMarkdownToStorage(content);

      // Use v2 API format - spaceId must be a number
      const pageData = {
        spaceId: parseInt(spaceId), // Ensure it's a number
        status: 'current',
        title: title,
        body: {
          representation: 'storage',
          value: storageContent
        }
      };

      // Add parent if specified
      if (parentId) {
        pageData.parentId = parentId;
      }

      this.logger.info('Creating page with data:', pageData);

      const data = await this._makeRequest('/wiki/api/v2/pages', {
        method: 'POST',
        body: JSON.stringify(pageData)
      });

      this.logger.info('Page created successfully', {
        pageId: data.id,
        title: data.title
      });

      // Get the page URL from the response
      const pageUrl = data._links?.webui ? `${this.siteUrl}${data._links.webui}` : `${this.siteUrl}/wiki/pages/${data.id}`;

      return {
        id: data.id,
        title: data.title,
        url: pageUrl,
        spaceKey: spaceId
      };
    } catch (error) {
      this.logger.error('Failed to create page', {
        error: error.message,
        spaceKey,
        title
      });
      throw error;
    }
  }

  /**
   * Update an existing Confluence page
   */
  async updatePage({ pageId, title, content, version }) {
    try {
      this.logger.info('Updating Confluence page', { pageId, title });

      // Convert markdown to Confluence storage format
      const storageContent = this._convertMarkdownToStorage(content);

      const pageData = {
        type: 'page',
        title: title,
        body: {
          storage: {
            value: storageContent,
            representation: 'storage'
          }
        },
        version: {
          number: version + 1
        }
      };

      const data = await this._makeRequest(`/wiki/rest/api/content/${pageId}`, {
        method: 'PUT',
        body: JSON.stringify(pageData)
      });

      this.logger.info('Page updated successfully', {
        pageId: data.id,
        version: data.version.number
      });

      return {
        id: data.id,
        title: data.title,
        url: `${this.siteUrl}/wiki${data._links.webui}`,
        version: data.version.number
      };
    } catch (error) {
      this.logger.error('Failed to update page', {
        error: error.message,
        pageId
      });
      throw error;
    }
  }

  /**
   * Search for pages by title
   */
  async searchPages(query, spaceKey = null) {
    try {
      this.logger.info('Searching Confluence pages', { query, spaceKey });

      let cql = `title ~ "${query}"`;
      if (spaceKey) {
        cql += ` AND space = ${spaceKey}`;
      }

      const data = await this._makeRequest(`/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}`);

      this.logger.info('Search complete', { count: data.results?.length || 0 });

      return data.results || [];
    } catch (error) {
      this.logger.error('Search failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get page by ID
   */
  async getPage(pageId) {
    try {
      this.logger.info('Fetching page', { pageId });

      const data = await this._makeRequest(`/wiki/rest/api/content/${pageId}?expand=body.storage,version,space`);

      return {
        id: data.id,
        title: data.title,
        content: data.body?.storage?.value || '',
        version: data.version?.number || 1,
        spaceKey: data.space?.key || null,
        url: `${this.siteUrl}/wiki${data._links.webui}`
      };
    } catch (error) {
      this.logger.error('Failed to fetch page', { error: error.message, pageId });
      throw error;
    }
  }

  /**
   * Upload attachment to a page
   */
  async uploadAttachment({ pageId, fileName, fileData, contentType }) {
    try {
      this.logger.info('Uploading attachment', { pageId, fileName });

      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', fileData, { filename: fileName, contentType });

      const response = await fetch(
        `https://api.atlassian.com/ex/confluence/${this.cloudId}/wiki/rest/api/content/${pageId}/child/attachment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'X-Atlassian-Token': 'no-check',
            ...form.getHeaders()
          },
          body: form
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      this.logger.info('Attachment uploaded', {
        attachmentId: data.results?.[0]?.id,
        fileName
      });

      return data.results?.[0] || null;
    } catch (error) {
      this.logger.error('Failed to upload attachment', {
        error: error.message,
        pageId,
        fileName
      });
      throw error;
    }
  }
}

module.exports = ConfluenceService;

