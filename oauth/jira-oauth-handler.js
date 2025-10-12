/**
 * JIRA OAuth Handler
 * 
 * Handles OAuth 2.0 authentication flow for JIRA integration
 */

const http = require('http');
const url = require('url');
const winston = require('winston');
const JIRAService = require('../core/integrations/jira-service');

class JIRAOAuthHandler {
  constructor(options = {}) {
    this.options = {
      port: options.port || 8890,
      logLevel: options.logLevel || 'info',
      ...options
    };

    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/jira-oauth.log' })
      ],
      defaultMeta: { service: 'jira-oauth-handler' }
    });

    this.server = null;
    this.jiraService = new JIRAService(options);
    this.pendingAuth = null;
  }

  /**
   * Start OAuth flow
   */
  async startAuthFlow() {
    return new Promise((resolve, reject) => {
      try {
        // Start local server to catch callback
        this.server = http.createServer(async (req, res) => {
          const parsedUrl = url.parse(req.url, true);
          
          if (parsedUrl.pathname === '/auth/jira/callback') {
            const { code, error, error_description } = parsedUrl.query;
            
            if (error) {
              this.logger.error('OAuth error', { error, error_description });
              
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #FF3B30;">❌ Authentication Failed</h1>
                    <p>${error_description || error}</p>
                    <p style="color: #666;">You can close this window.</p>
                  </body>
                </html>
              `);
              
              if (this.pendingAuth) {
                this.pendingAuth.reject(new Error(error_description || error));
                this.pendingAuth = null;
              }
              
              this._stopServer();
              return;
            }
            
            if (code) {
              try {
                // Exchange code for token
                const result = await this.jiraService.authenticateWithCode(code);
                
                this.logger.info('Authentication successful', {
                  cloudId: result.cloud_id,
                  siteUrl: result.site_url
                });
                
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                  <html>
                    <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                      <h1 style="color: #34C759;">✅ Authentication Successful!</h1>
                      <p>Connected to: <strong>${result.site_url || 'JIRA'}</strong></p>
                      <p style="color: #666;">You can close this window and return to HeyJarvis.</p>
                      <script>
                        setTimeout(() => window.close(), 3000);
                      </script>
                    </body>
                  </html>
                `);
                
                if (this.pendingAuth) {
                  this.pendingAuth.resolve(result);
                  this.pendingAuth = null;
                }
                
                this._stopServer();
                
              } catch (error) {
                this.logger.error('Token exchange failed', { error: error.message });
                
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`
                  <html>
                    <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                      <h1 style="color: #FF3B30;">❌ Authentication Failed</h1>
                      <p>${error.message}</p>
                      <p style="color: #666;">You can close this window.</p>
                    </body>
                  </html>
                `);
                
                if (this.pendingAuth) {
                  this.pendingAuth.reject(error);
                  this.pendingAuth = null;
                }
                
                this._stopServer();
              }
            }
          }
        });

        this.server.listen(this.options.port, () => {
          this.logger.info('OAuth server started', { port: this.options.port });

          // Get authorization URL and open in browser
          const authUrl = this.jiraService.getAuthorizationUrl();
          
          this.logger.info('Opening authorization URL in browser');
          
          // Store pending auth promise
          this.pendingAuth = { resolve, reject };
          
          // Open URL in default browser
          const open = require('open');
          open(authUrl).catch(err => {
            this.logger.error('Failed to open browser', { error: err.message });
            reject(new Error('Failed to open browser. Please manually navigate to: ' + authUrl));
          });
        });

        this.server.on('error', (error) => {
          this.logger.error('OAuth server error', { error: error.message });
          reject(error);
        });

      } catch (error) {
        this.logger.error('Failed to start auth flow', { error: error.message });
        reject(error);
      }
    });
  }

  /**
   * Stop the OAuth server
   */
  _stopServer() {
    if (this.server) {
      this.server.close(() => {
        this.logger.info('OAuth server stopped');
      });
      this.server = null;
    }
  }

  /**
   * Get the JIRA service instance
   */
  getJIRAService() {
    return this.jiraService;
  }
}

module.exports = JIRAOAuthHandler;

