#!/usr/bin/env node

/**
 * Add PKCE support to Microsoft Graph Service
 */

const fs = require('fs');
const path = require('path');

const GRAPH_SERVICE_FILE = path.join(__dirname, '../core/integrations/microsoft-graph-service.js');

console.log('🔧 Adding PKCE support to Microsoft Graph Service...\n');

let content = fs.readFileSync(GRAPH_SERVICE_FILE, 'utf8');

// Add crypto import at the top
if (!content.includes("const crypto = require('crypto')")) {
  content = content.replace(
    "const winston = require('winston');",
    "const winston = require('winston');\nconst crypto = require('crypto');"
  );
  console.log('✅ Added crypto import');
}

// Add PKCE properties to constructor
if (!content.includes('this.codeVerifier')) {
  content = content.replace(
    'this.accessToken = null;\n    this.tokenExpiry = null;',
    `this.accessToken = null;
    this.tokenExpiry = null;
    this.codeVerifier = null;
    this.codeChallenge = null;`
  );
  console.log('✅ Added PKCE properties to constructor');
}

// Add PKCE helper methods before getAuthUrl
const pkceMethods = `
  /**
   * Generate PKCE code verifier and challenge
   */
  _generatePKCE() {
    // Generate random code verifier (43-128 characters)
    this.codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Generate code challenge (SHA256 hash of verifier)
    this.codeChallenge = crypto
      .createHash('sha256')
      .update(this.codeVerifier)
      .digest('base64url');
    
    this.logger.debug('PKCE generated', {
      verifierLength: this.codeVerifier.length,
      challengeLength: this.codeChallenge.length
    });
  }
`;

if (!content.includes('_generatePKCE()')) {
  content = content.replace(
    '  /**\n   * Get authorization URL for OAuth flow\n   */',
    pkceMethods + '\n  /**\n   * Get authorization URL for OAuth flow\n   */'
  );
  console.log('✅ Added PKCE generation method');
}

// Update getAuthUrl to include PKCE
const oldGetAuthUrl = `  getAuthUrl(state = null) {
    const authCodeUrlParameters = {
      scopes: this.options.scopes,
      redirectUri: this.options.redirectUri,
      state: state || Date.now().toString()
    };

    return this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
  }`;

const newGetAuthUrl = `  getAuthUrl(state = null) {
    // Generate PKCE parameters
    this._generatePKCE();
    
    const authCodeUrlParameters = {
      scopes: this.options.scopes,
      redirectUri: this.options.redirectUri,
      state: state || Date.now().toString(),
      codeChallenge: this.codeChallenge,
      codeChallengeMethod: 'S256'
    };

    return this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
  }`;

if (!content.includes('codeChallenge: this.codeChallenge')) {
  content = content.replace(oldGetAuthUrl, newGetAuthUrl);
  console.log('✅ Updated getAuthUrl to include PKCE');
}

// Update authenticateWithCode to include code verifier
const oldAuthWithCode = `  async authenticateWithCode(code) {
    try {
      const tokenRequest = {
        code,
        scopes: this.options.scopes,
        redirectUri: this.options.redirectUri
      };

      const response = await this.msalClient.acquireTokenByCode(tokenRequest);`;

const newAuthWithCode = `  async authenticateWithCode(code) {
    try {
      const tokenRequest = {
        code,
        scopes: this.options.scopes,
        redirectUri: this.options.redirectUri,
        codeVerifier: this.codeVerifier
      };

      const response = await this.msalClient.acquireTokenByCode(tokenRequest);`;

if (!content.includes('codeVerifier: this.codeVerifier')) {
  content = content.replace(oldAuthWithCode, newAuthWithCode);
  console.log('✅ Updated authenticateWithCode to include code verifier');
}

fs.writeFileSync(GRAPH_SERVICE_FILE, content);

console.log('\n✅ PKCE support successfully added!');
console.log('\n📝 What was added:');
console.log('   - crypto module import');
console.log('   - PKCE code verifier and challenge generation');
console.log('   - Code challenge in authorization URL');
console.log('   - Code verifier in token exchange');
console.log('\n📝 Next steps:');
console.log('   1. Restart HeyJarvis');
console.log('   2. Try authenticating again');
console.log('   3. PKCE error should be resolved!\n');
