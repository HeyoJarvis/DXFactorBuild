#!/usr/bin/env node
/**
 * Test Microsoft Authentication Fix
 * 
 * This script verifies that the Microsoft OAuth configuration is correct
 * and helps diagnose any remaining issues.
 */

const MicrosoftOAuthHandler = require('./oauth/microsoft-oauth-handler');
const winston = require('winston');
require('dotenv').config();

// Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} ${level}: ${message} ${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

async function testMicrosoftAuth() {
  console.log('\n🔍 Testing Microsoft Authentication Configuration\n');
  console.log('=' .repeat(60));

  // 1. Check environment variables
  console.log('\n1️⃣  Checking Environment Variables...\n');
  
  const requiredEnvVars = {
    'MICROSOFT_CLIENT_ID': process.env.MICROSOFT_CLIENT_ID,
    'MICROSOFT_CLIENT_SECRET': process.env.MICROSOFT_CLIENT_SECRET,
    'MICROSOFT_REDIRECT_URI': process.env.MICROSOFT_REDIRECT_URI
  };

  let envVarsOk = true;
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (value) {
      console.log(`   ✅ ${key}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`   ❌ ${key}: NOT SET`);
      envVarsOk = false;
    }
  }

  if (!envVarsOk) {
    console.log('\n❌ Missing required environment variables!');
    console.log('   Please check your .env file.\n');
    process.exit(1);
  }

  // 2. Check redirect URI port
  console.log('\n2️⃣  Checking Redirect URI Configuration...\n');
  
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  const portMatch = redirectUri.match(/:(\d+)\//);
  
  if (portMatch) {
    const port = portMatch[1];
    console.log(`   ✅ Redirect URI port: ${port}`);
    
    if (port === '8890') {
      console.log(`   ✅ Port matches expected value (8890)`);
    } else {
      console.log(`   ⚠️  Port is ${port}, expected 8890`);
      console.log(`   This may cause issues. Update MICROSOFT_REDIRECT_URI in .env`);
    }
  } else {
    console.log(`   ❌ Could not parse port from redirect URI`);
  }

  // 3. Check port availability
  console.log('\n3️⃣  Checking Port Availability...\n');
  
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    const { stdout } = await execPromise('lsof -ti:8890');
    const pids = stdout.trim().split('\n').filter(Boolean);
    
    if (pids.length > 0) {
      console.log(`   ⚠️  Port 8890 is in use by ${pids.length} process(es):`);
      
      for (const pid of pids) {
        try {
          const { stdout: psOut } = await execPromise(`ps -p ${pid} -o comm=`);
          console.log(`      - PID ${pid}: ${psOut.trim()}`);
        } catch (err) {
          console.log(`      - PID ${pid}: (process info unavailable)`);
        }
      }
      
      console.log('\n   This is normal if the Electron app is running.');
      console.log('   If authentication fails, try restarting the app.');
    } else {
      console.log(`   ✅ Port 8890 is available`);
    }
  } catch (error) {
    console.log(`   ✅ Port 8890 is available`);
  }

  // 4. Test OAuth handler initialization
  console.log('\n4️⃣  Testing OAuth Handler Initialization...\n');
  
  try {
    const oauthHandler = new MicrosoftOAuthHandler({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      redirectUri: process.env.MICROSOFT_REDIRECT_URI,
      port: 8890,
      logger
    });
    
    console.log('   ✅ OAuth handler initialized successfully');
    
    // Test getting auth URL (without starting server)
    try {
      const authUrl = await oauthHandler.graphService.getAuthUrl();
      console.log('   ✅ Auth URL generation works');
      console.log(`   📝 Auth URL: ${authUrl.substring(0, 80)}...`);
      
      // Check if PKCE parameters are in URL
      if (authUrl.includes('code_challenge') && authUrl.includes('code_challenge_method')) {
        console.log('   ✅ PKCE parameters present in auth URL');
      } else {
        console.log('   ⚠️  PKCE parameters missing - this may cause issues');
      }
    } catch (error) {
      console.log(`   ❌ Auth URL generation failed: ${error.message}`);
    }
  } catch (error) {
    console.log(`   ❌ OAuth handler initialization failed: ${error.message}`);
  }

  // 5. Summary and recommendations
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 Summary and Next Steps:\n');
  
  console.log('✅ Code fixes applied:');
  console.log('   - Port mismatch fixed (now using 8890)');
  console.log('   - Timeout protection added (2 minutes)');
  console.log('   - Better error handling for port conflicts');
  
  console.log('\n⚠️  Azure Portal Configuration Required:');
  console.log('   1. Go to https://portal.azure.com');
  console.log('   2. Navigate to App registrations');
  console.log('   3. Find app: ffd462f1-9c7d-42d9-9696-4c0e4a54132a');
  console.log('   4. Configure as Single Page Application (SPA) or Mobile app');
  console.log('   5. Add redirect URI: http://localhost:8890/auth/microsoft/callback');
  console.log('   6. Enable public client flows');
  console.log('   7. Grant admin consent for API permissions');
  
  console.log('\n📖 For detailed instructions, see:');
  console.log('   FIX_TEAMS_AUTH_TIMEOUT.md');
  
  console.log('\n🧪 To test authentication:');
  console.log('   1. Restart the Electron app');
  console.log('   2. Go to Settings');
  console.log('   3. Click "Connect" under Microsoft Teams');
  console.log('   4. Complete the OAuth flow in your browser');
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Run the test
testMicrosoftAuth().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});

