/**
 * Google OAuth Handler
 * 
 * Handles OAuth 2.0 authentication flow for Google Workspace integration
 */

const http = require('http');
const url = require('url');
const winston = require('winston');
const GoogleGmailService = require('../core/integrations/google-gmail-service');

class GoogleOAuthHandler {
  constructor(options = {}) {
    this.options = {
      port: options.port || 8890, // Different port from Microsoft
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
        new winston.transports.File({ filename: 'logs/google-oauth.log' })
      ],
      defaultMeta: { service: 'google-oauth-handler' }
    });

    this.server = null;
    this.gmailService = new GoogleGmailService(options);
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
          
          if (parsedUrl.pathname === '/auth/google/callback') {
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
                const result = await this.gmailService.authenticateWithCode(code);
                
                this.logger.info('Authentication successful', {
                  email: result.account?.email
                });
                
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                  <html>
                    <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                      <h1 style="color: #34C759;">✅ Authentication Successful!</h1>
                      <p>Connected as: <strong>${result.account?.email || 'Google User'}</strong></p>
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
                      <h1 style="color: #FF3B30;">❌ Authentication Error</h1>
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
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        });

        this.server.listen(this.options.port, () => {
          this.logger.info('OAuth server started', { port: this.options.port });
          
          try {
            // Get authorization URL
            const authUrl = this.gmailService.getAuthUrl();
            
            this.logger.info('Authorization URL generated', { authUrl: authUrl.substring(0, 50) + '...' });
            
            // Store promise resolver
            this.pendingAuth = { resolve, reject };
            
            // Open browser to authorization URL
            const { shell } = require('electron');
            shell.openExternal(authUrl);
          } catch (error) {
            this.logger.error('Failed to generate auth URL', { error: error.message });
            reject(error);
            this._stopServer();
          }
        });

        // Handle server errors
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
   * Stop OAuth server
   */
  _stopServer() {
    if (this.server) {
      setTimeout(() => {
        this.server.close(() => {
          this.logger.info('OAuth server stopped');
        });
        this.server = null;
      }, 1000);
    }
  }

  /**
   * Get Gmail service instance
   */
  getGmailService() {
    return this.gmailService;
  }
}

module.exports = GoogleOAuthHandler;



