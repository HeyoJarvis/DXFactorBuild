/**
 * Authentication Middleware for HeyJarvis API
 * 
 * This middleware handles:
 * 1. JWT token validation
 * 2. Session management with Supabase
 * 3. User context injection
 * 4. Rate limiting per user
 */

const jwt = require('jsonwebtoken');
const SupabaseClient = require('../../data/storage/supabase-client');

class AuthMiddleware {
  constructor() {
    this.supabase = new SupabaseClient();
    this.jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-key';
  }

  /**
   * Verify JWT token and validate session
   */
  async authenticate(req, res, next) {
    try {
      // Get token from header, query, or body
      const token = this.extractToken(req);
      
      if (!token) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'NO_TOKEN' 
        });
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, this.jwtSecret);
      } catch (jwtError) {
        return res.status(401).json({ 
          error: 'Invalid token',
          code: 'INVALID_TOKEN' 
        });
      }

      // Check if this is a fallback token (no database)
      if (decoded.fallback) {
        console.log('Using fallback authentication (no database)');
        
        // Create minimal user object from JWT
        req.user = {
          id: decoded.slackUserId,
          email: decoded.email,
          name: decoded.name,
          is_active: true,
          fallback: true
        };
        req.userId = decoded.slackUserId;
        req.session = { fallback: true };
      } else {
        // Validate session in database
        const sessionData = await this.supabase.validateSession(token);
        
        if (!sessionData || !sessionData.user) {
          return res.status(401).json({ 
            error: 'Session expired or invalid',
            code: 'INVALID_SESSION' 
          });
        }

        // Check if user is active
        if (!sessionData.user.is_active) {
          return res.status(403).json({ 
            error: 'Account deactivated',
            code: 'ACCOUNT_INACTIVE' 
          });
        }

        // Attach user and session to request
        req.user = sessionData.user;
        req.session = sessionData.session;
        req.userId = sessionData.user.id;
      }

      next();

    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ 
        error: 'Authentication service error',
        code: 'AUTH_ERROR' 
      });
    }
  }

  /**
   * Optional authentication - continues if no token provided
   */
  async optionalAuth(req, res, next) {
    try {
      const token = this.extractToken(req);
      
      if (token) {
        // Try to authenticate, but don't fail if invalid
        try {
          const decoded = jwt.verify(token, this.jwtSecret);
          const sessionData = await this.supabase.validateSession(token);
          
          if (sessionData && sessionData.user && sessionData.user.is_active) {
            req.user = sessionData.user;
            req.session = sessionData.session;
            req.userId = sessionData.user.id;
          }
        } catch (error) {
          // Continue without authentication
          console.log('Optional auth failed, continuing without user:', error.message);
        }
      }

      next();

    } catch (error) {
      console.error('Optional authentication error:', error);
      next(); // Continue even on error
    }
  }

  /**
   * Extract token from various sources
   */
  extractToken(req) {
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Check query parameter
    if (req.query.token) {
      return req.query.token;
    }

    // Check body
    if (req.body && req.body.token) {
      return req.body.token;
    }

    // Check cookies
    if (req.cookies && req.cookies.heyjarvis_session) {
      return req.cookies.heyjarvis_session;
    }

    return null;
  }

  /**
   * Require specific user role
   */
  requireRole(allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'NO_USER' 
        });
      }

      const userRole = req.user.context?.role;
      
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_ROLE',
          required: allowedRoles,
          current: userRole 
        });
      }

      next();
    };
  }

  /**
   * Rate limiting per user
   */
  rateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100, // limit each user to 100 requests per windowMs
      message = 'Too many requests from this user'
    } = options;

    const requests = new Map();

    return (req, res, next) => {
      const userId = req.userId || req.ip;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries
      for (const [key, timestamps] of requests.entries()) {
        const validTimestamps = timestamps.filter(time => time > windowStart);
        if (validTimestamps.length === 0) {
          requests.delete(key);
        } else {
          requests.set(key, validTimestamps);
        }
      }

      // Get current user's requests
      const userRequests = requests.get(userId) || [];
      const validRequests = userRequests.filter(time => time > windowStart);

      if (validRequests.length >= max) {
        return res.status(429).json({
          error: message,
          code: 'RATE_LIMIT_EXCEEDED',
          resetTime: new Date(Math.min(...validRequests) + windowMs)
        });
      }

      // Add current request
      validRequests.push(now);
      requests.set(userId, validRequests);

      next();
    };
  }

  /**
   * Logout - invalidate session
   */
  async logout(req, res) {
    try {
      const token = this.extractToken(req);
      
      if (token) {
        await this.supabase.invalidateSession(token);
      }

      // Clear cookie if present
      res.clearCookie('heyjarvis_session');

      res.json({ 
        success: true,
        message: 'Logged out successfully' 
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ 
        error: 'Logout failed',
        code: 'LOGOUT_ERROR' 
      });
    }
  }

  /**
   * Refresh session
   */
  async refresh(req, res) {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        return res.status(401).json({ 
          error: 'No token provided',
          code: 'NO_TOKEN' 
        });
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, this.jwtSecret);
      } catch (jwtError) {
        return res.status(401).json({ 
          error: 'Invalid token',
          code: 'INVALID_TOKEN' 
        });
      }

      // Handle fallback tokens
      if (decoded.fallback) {
        // Generate new fallback token
        const newToken = jwt.sign(
          { 
            slackUserId: decoded.slackUserId,
            email: decoded.email,
            name: decoded.name,
            fallback: true
          },
          this.jwtSecret,
          { expiresIn: '7d' }
        );

        return res.json({
          success: true,
          token: newToken,
          fallback: true,
          user: {
            id: decoded.slackUserId,
            email: decoded.email,
            name: decoded.name
          }
        });
      }

      // Handle database tokens
      const sessionData = await this.supabase.validateSession(token);
      
      if (!sessionData) {
        return res.status(401).json({ 
          error: 'Invalid session',
          code: 'INVALID_SESSION' 
        });
      }

      // Generate new JWT token
      const newToken = jwt.sign(
        { 
          userId: sessionData.user.id, 
          email: sessionData.user.email,
          slackUserId: sessionData.user.auth_id 
        },
        this.jwtSecret,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        token: newToken,
        user: {
          id: sessionData.user.id,
          email: sessionData.user.email,
          name: sessionData.user.name,
          avatar_url: sessionData.user.avatar_url
        }
      });

    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({ 
        error: 'Token refresh failed',
        code: 'REFRESH_ERROR' 
      });
    }
  }
}

// Create singleton instance
const authMiddleware = new AuthMiddleware();

module.exports = {
  authenticate: authMiddleware.authenticate.bind(authMiddleware),
  optionalAuth: authMiddleware.optionalAuth.bind(authMiddleware),
  requireRole: authMiddleware.requireRole.bind(authMiddleware),
  rateLimit: authMiddleware.rateLimit.bind(authMiddleware),
  logout: authMiddleware.logout.bind(authMiddleware),
  refresh: authMiddleware.refresh.bind(authMiddleware)
};
