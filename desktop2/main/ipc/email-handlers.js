/**
 * Email IPC Handlers
 *
 * Handles IPC communication for email indexing and semantic search features.
 * Provides handlers for indexing emails and querying with natural language.
 */

const { ipcMain } = require('electron');
const path = require('path');
const EmailIndexer = require(path.join(__dirname, '../../../core/intelligence/email-indexer'));
const EmailQueryEngine = require(path.join(__dirname, '../../../core/intelligence/email-query-engine'));

// Initialize services
let emailIndexer = null;
let emailQueryEngine = null;

function initializeServices() {
  if (!emailIndexer) {
    emailIndexer = new EmailIndexer({
      batchSize: 20,
      maxConcurrent: 3
    });

    // Listen to indexing events
    emailIndexer.on('start', (data) => {
      console.log('📧 Email indexing started:', data);
    });

    emailIndexer.on('statusUpdate', (data) => {
      console.log('📧 Status update:', data);
    });

    emailIndexer.on('progress', (data) => {
      console.log('📧 Progress:', data);
    });

    emailIndexer.on('complete', (data) => {
      console.log('📧 Indexing complete:', data);
    });

    emailIndexer.on('error', (data) => {
      console.error('📧 Indexing error:', data);
    });
  }

  if (!emailQueryEngine) {
    emailQueryEngine = new EmailQueryEngine({
      model: 'claude-3-haiku-20240307',
      searchThreshold: 0.3,
      searchLimit: 15
    });
  }
}

/**
 * Index emails for a user
 * Automatically indexes emails when they're fetched from inbox
 */
ipcMain.handle('email:index', async (event, { emails, userId, provider }) => {
  try {
    console.log(`📧 Indexing ${emails.length} emails for user ${userId} from ${provider}`);

    initializeServices();

    const result = await emailIndexer.indexEmails(emails, userId, provider);

    console.log(`✅ Indexed ${result.indexed} emails, skipped ${result.skipped}, failed ${result.failed}`);

    return {
      success: true,
      ...result
    };

  } catch (error) {
    console.error('❌ Email indexing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Index a single email in real-time
 * Useful for indexing new emails as they arrive
 */
ipcMain.handle('email:index-single', async (event, { email, userId, provider }) => {
  try {
    initializeServices();

    const result = await emailIndexer.indexSingleEmail(email, userId, provider);

    return {
      success: true,
      ...result
    };

  } catch (error) {
    console.error('❌ Single email indexing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Query emails with natural language
 * Returns AI-generated answer with email citations
 */
ipcMain.handle('email:query', async (event, { query, userId, filters }) => {
  try {
    console.log(`🔍 Email query: "${query}" for user ${userId}`);

    initializeServices();

    const result = await emailQueryEngine.query(query, userId, filters);

    console.log(`✅ Query completed: ${result.emails?.length || 0} emails found, confidence: ${result.confidence}`);

    return result;

  } catch (error) {
    console.error('❌ Email query failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Get email statistics for a user
 * Returns total emails, indexed count, providers, categories, etc.
 */
ipcMain.handle('email:stats', async (event, { userId }) => {
  try {
    initializeServices();

    const stats = await emailIndexer.getStats(userId);

    return {
      success: true,
      stats
    };

  } catch (error) {
    console.error('❌ Failed to get email stats:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Re-index all emails for a user
 * Clears existing index and re-indexes from scratch
 */
ipcMain.handle('email:reindex', async (event, { emails, userId, provider }) => {
  try {
    console.log(`🔄 Re-indexing ${emails.length} emails for user ${userId} from ${provider}`);

    initializeServices();

    const result = await emailIndexer.reindexEmails(emails, userId, provider);

    console.log(`✅ Re-indexed ${result.indexed} emails`);

    return {
      success: true,
      ...result
    };

  } catch (error) {
    console.error('❌ Email re-indexing failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Find emails by date range
 * Useful for finding all emails in a specific time period
 */
ipcMain.handle('email:find-by-date', async (event, { userId, dateFrom, dateTo, filters }) => {
  try {
    initializeServices();

    const emails = await emailQueryEngine.findEmailsByDateRange(
      userId,
      new Date(dateFrom),
      new Date(dateTo),
      filters
    );

    return {
      success: true,
      emails
    };

  } catch (error) {
    console.error('❌ Date range query failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Check indexing status for a user
 */
ipcMain.handle('email:indexing-status', async (event, { userId, provider }) => {
  try {
    initializeServices();

    const status = await emailIndexer.vectorStore.getIndexingStatus(userId, provider);

    return {
      success: true,
      status
    };

  } catch (error) {
    console.error('❌ Failed to get indexing status:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

console.log('📧 Email IPC handlers registered');

module.exports = {
  initializeServices
};
