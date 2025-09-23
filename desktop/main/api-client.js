/**
 * API Client for connecting Electron app to Vercel backend
 */

const https = require('https');
const winston = require('winston');

class APIClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'https://beach-baby-vk73.vercel.app/api';
    this.timeout = options.timeout || 10000;
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'api-client' }
    });
  }

  /**
   * Make HTTP request to API
   */
  async request(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseURL}${endpoint}`;
      const urlObj = new URL(url);
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HeyJarvis-Desktop/1.0.0',
          ...options.headers
        },
        timeout: this.timeout
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(`API Error: ${res.statusCode} - ${result.error || result.message}`));
            }
          } catch (error) {
            reject(new Error(`JSON Parse Error: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request Error: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  /**
   * Get latest insights for user
   */
  async getLatestInsights(userId) {
    try {
      const result = await this.request(`/insights/latest?user_id=${encodeURIComponent(userId)}`);
      this.logger.info('Retrieved insights', { userId, count: result.insights?.length });
      return result.insights || [];
    } catch (error) {
      this.logger.error('Failed to get insights', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get recent signals for user
   */
  async getRecentSignals(userId, limit = 10) {
    try {
      const result = await this.request(`/signals/recent?user_id=${encodeURIComponent(userId)}&limit=${limit}`);
      this.logger.info('Retrieved signals', { userId, count: result.signals?.length });
      return result.signals || [];
    } catch (error) {
      this.logger.error('Failed to get signals', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Check API connectivity
   */
  async healthCheck() {
    try {
      // Simple connectivity test
      await this.request('/auth/slack');
      return true;
    } catch (error) {
      this.logger.warn('API health check failed', { error: error.message });
      return false;
    }
  }
}

module.exports = APIClient;
