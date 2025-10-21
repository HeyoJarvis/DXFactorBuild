/**
 * Test script for semantic parser integration
 * Run: node desktop2/test-semantic-parser.js
 */

const SemanticParserService = require('./main/services/SemanticParserService');

// Simple logger
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

async function testSemanticParser() {
  console.log('🧪 Testing Semantic Parser Integration\n');

  const parser = new SemanticParserService(logger);

  // Test 1: Simple code search
  console.log('Test 1: Simple code search query');
  const test1 = await parser.parseIntent({
    query: 'Where is authentication handled?',
    repository: 'HeyoJarvis/Mark-I'
  });
  console.log('Result:', JSON.stringify(test1, null, 2));
  console.log('\n---\n');

  // Test 2: With JIRA ticket context
  console.log('Test 2: Query with JIRA ticket');
  const test2 = await parser.parseIntent({
    query: 'How does the login flow work?',
    repository: 'HeyoJarvis/Mark-I',
    ticketKey: 'PROJ-123',
    ticketSummary: 'Implement OAuth authentication',
    ticketDescription: 'Add OAuth2 flow for user authentication using auth service'
  });
  console.log('Result:', JSON.stringify(test2, null, 2));
  console.log('\n---\n');

  // Test 3: Enriched query
  console.log('Test 3: Enrich query with semantic understanding');
  const test3 = await parser.enrichQuery(
    'Find bugs in the payment processing code',
    'HeyoJarvis/Mark-I',
    {
      language: 'javascript',
      recentFiles: ['services/payment.js', 'lib/stripe.js']
    }
  );
  console.log('Result:', JSON.stringify(test3, null, 2));
  console.log('\n---\n');

  // Test 4: Check availability
  console.log('Test 4: Check semantic parser availability');
  const test4 = await parser.checkAvailability();
  console.log('Result:', JSON.stringify(test4, null, 2));

  console.log('\n✅ All tests complete!');
}

testSemanticParser().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
