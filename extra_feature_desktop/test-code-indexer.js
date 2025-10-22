/**
 * Test Script for Code Indexer Integration
 * Run with: node test-code-indexer.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const CodeIndexer = require('../core/intelligence/code-indexer');

async function testCodeIndexer() {
  console.log('\n🧪 Testing Code Indexer Integration\n');
  console.log('=' .repeat(60));

  // Step 1: Check environment variables
  console.log('\n1️⃣  Checking Environment Variables...\n');
  
  const requiredVars = {
    'GITHUB_APP_ID': process.env.GITHUB_APP_ID,
    'GITHUB_APP_INSTALLATION_ID': process.env.GITHUB_APP_INSTALLATION_ID,
    'GITHUB_APP_PRIVATE_KEY_PATH': process.env.GITHUB_APP_PRIVATE_KEY_PATH,
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing',
    'ANTHROPIC_API_KEY': process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Missing',
    'SUPABASE_URL': process.env.SUPABASE_URL,
    'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'
  };

  let allConfigured = true;
  for (const [key, value] of Object.entries(requiredVars)) {
    const status = value && value !== '✗ Missing' ? '✅' : '❌';
    console.log(`   ${status} ${key}: ${value === '✓ Set' ? value : (value || '✗ Missing')}`);
    if (status === '❌') allConfigured = false;
  }

  if (!allConfigured) {
    console.log('\n❌ Missing required environment variables!');
    console.log('   Please check your .env file.\n');
    process.exit(1);
  }

  console.log('\n✅ All environment variables configured!\n');

  // Step 2: Initialize Code Indexer
  console.log('2️⃣  Initializing Code Indexer...\n');
  
  let indexer;
  try {
    indexer = new CodeIndexer({
      logLevel: 'info'
    });
    console.log('✅ Code Indexer initialized successfully!\n');
  } catch (error) {
    console.error('❌ Failed to initialize Code Indexer:', error.message);
    process.exit(1);
  }

  // Step 3: Test GitHub connection
  console.log('3️⃣  Testing GitHub Connection...\n');
  
  try {
    const octokit = await indexer.fileFetcher._getOctokit();
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation();
    
    console.log(`✅ Connected to GitHub! Found ${data.repositories.length} accessible repositories:\n`);
    
    data.repositories.slice(0, 5).forEach((repo, i) => {
      console.log(`   ${i + 1}. ${repo.full_name} (${repo.language || 'Unknown'})`);
    });
    
    if (data.repositories.length > 5) {
      console.log(`   ... and ${data.repositories.length - 5} more\n`);
    } else {
      console.log('');
    }
  } catch (error) {
    console.error('❌ Failed to connect to GitHub:', error.message);
    console.error('   Check your GitHub App credentials.\n');
    process.exit(1);
  }

  // Step 4: Test Supabase connection
  console.log('4️⃣  Testing Supabase Connection...\n');
  
  try {
    await indexer.vectorStore.supabase
      .from('code_chunks')
      .select('id')
      .limit(1);
    
    console.log('✅ Connected to Supabase!\n');
  } catch (error) {
    console.error('❌ Failed to connect to Supabase:', error.message);
    
    if (error.message.includes('relation "code_chunks" does not exist')) {
      console.error('\n⚠️  Database tables not found!');
      console.error('   You need to run the migration first:');
      console.error('   1. Go to https://app.supabase.com/project/ydbujcuddfgiubjjajuq/sql/new');
      console.error('   2. Run migrations/002_code_vector_store.sql\n');
    }
    
    process.exit(1);
  }

  // Step 5: Test OpenAI connection
  console.log('5️⃣  Testing OpenAI Connection...\n');
  
  try {
    const testEmbedding = await indexer.embeddingService.generateEmbedding('test');
    console.log(`✅ Connected to OpenAI! (Generated ${testEmbedding.length}-dim embedding)\n`);
  } catch (error) {
    console.error('❌ Failed to connect to OpenAI:', error.message);
    console.error('   Check your OpenAI API key and billing.\n');
    process.exit(1);
  }

  // Step 6: Test Anthropic connection
  console.log('6️⃣  Testing Anthropic Connection...\n');
  
  try {
    const testAnswer = await indexer.queryEngine._callClaude(
      'Say "hello" in one word',
      'You are a helpful assistant. Respond with exactly one word.'
    );
    console.log(`✅ Connected to Anthropic! (Test response: "${testAnswer.trim()}")\n`);
  } catch (error) {
    console.error('❌ Failed to connect to Anthropic:', error.message);
    console.error('   Check your Anthropic API key.\n');
    process.exit(1);
  }

  // Summary
  console.log('=' .repeat(60));
  console.log('\n🎉 All Tests Passed! Code Indexer is ready to use.\n');
  console.log('Next steps:');
  console.log('1. Run the database migration if you haven\'t already');
  console.log('2. Start your app: npm run dev');
  console.log('3. Use window.electronAPI.codeIndexer.* in your frontend\n');
  console.log('See CODE_INDEXER_SETUP.md for usage examples.\n');
}

// Run tests
testCodeIndexer().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});

