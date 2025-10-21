#!/usr/bin/env node
/**
 * Test IPC Handler Registration
 * 
 * This script simulates the IPC handler registration to see if there are any errors
 */

require('dotenv').config();
const { ipcMain } = require('electron');

console.log('\n🧪 Testing IPC Handler Registration\n');
console.log('=' .repeat(60));

// Mock logger
const logger = {
  info: (...args) => console.log('ℹ️ ', ...args),
  error: (...args) => console.error('❌', ...args),
  warn: (...args) => console.warn('⚠️ ', ...args),
  debug: (...args) => console.log('🔍', ...args)
};

// Mock services
const services = {
  auth: {
    currentUser: {
      id: 'test-user-123'
    }
  },
  dbAdapter: {
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { integration_settings: {} } })
          })
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null })
        })
      })
    }
  },
  microsoft: {}
};

console.log('\n1️⃣  Loading mission-control-handlers...\n');

try {
  const registerMissionControlHandlers = require('./desktop2/main/ipc/mission-control-handlers');
  console.log('✅ Module loaded successfully');
  
  console.log('\n2️⃣  Registering handlers...\n');
  registerMissionControlHandlers(services, logger);
  
  console.log('\n3️⃣  Checking if handlers are registered...\n');
  
  // Try to get the list of registered IPC handlers
  const handlers = ipcMain._events || {};
  console.log('Registered IPC events:', Object.keys(handlers));
  
  if (handlers['microsoft:authenticate']) {
    console.log('✅ microsoft:authenticate handler is registered');
  } else {
    console.log('❌ microsoft:authenticate handler NOT found');
  }
  
} catch (error) {
  console.error('\n❌ Error during test:', error.message);
  console.error(error.stack);
  process.exit(1);
}

console.log('\n' + '='.repeat(60) + '\n');

