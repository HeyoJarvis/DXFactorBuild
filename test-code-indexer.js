/**
 * Test Script for Code Indexer
 * 
 * This script tests the complete code indexing workflow:
 * 1. Check availability
 * 2. Index a small repository
 * 3. Query the indexed code
 */

require('dotenv').config();
const CodeIndexer = require('./core/intelligence/code-indexer');

async function main() {
  console.log('🧪 Testing Code Indexer\n');

  try {
    // Initialize indexer
    console.log('1️⃣ Initializing Code Indexer...');
    const indexer = new CodeIndexer({
      logLevel: 'info'
    });
    console.log('✅ Indexer initialized\n');

    // Check availability
    console.log('2️⃣ Checking availability...');
    const availability = await indexer.checkAvailability();
    console.log('Availability Check:', {
      github: availability.github ? '✅' : '❌',
      openai: availability.openai ? '✅' : '❌',
      anthropic: availability.anthropic ? '✅' : '❌',
      supabase: availability.supabase ? '✅' : '❌',
      overall: availability.overall ? '✅ READY' : '❌ NOT READY'
    });
    console.log();

    if (!availability.overall) {
      console.error('❌ Code Indexer is not fully configured.');
      console.log('\nMissing configurations:');
      if (!availability.github) console.log('  - GitHub App credentials (GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY_PATH)');
      if (!availability.openai) console.log('  - OpenAI API Key (OPENAI_API_KEY)');
      if (!availability.anthropic) console.log('  - Anthropic API Key (ANTHROPIC_API_KEY)');
      if (!availability.supabase) console.log('  - Supabase credentials (SUPABASE_URL, SUPABASE_ANON_KEY)');
      console.log('\nPlease configure these in your .env file and run the database migration.');
      process.exit(1);
    }

    // Set up event listeners
    indexer.on('indexing:started', (job) => {
      console.log(`\n🚀 Indexing started: ${job.owner}/${job.repo}`);
    });

    indexer.on('indexing:progress', (job) => {
      console.log(`   ⏳ ${job.phase} (${job.progress}%)...`);
    });

    indexer.on('indexing:completed', (job) => {
      console.log(`   ✅ Completed: ${job.result.chunks} chunks in ${job.duration}ms\n`);
    });

    indexer.on('indexing:failed', (job) => {
      console.error(`   ❌ Failed: ${job.error}\n`);
    });

    // Get repository from GitHub App installation
    console.log('3️⃣ Fetching accessible repositories...');
    const repositories = await indexer.listIndexedRepositories();
    console.log(`Found ${repositories.length} previously indexed repositories`);
    
    // For testing, we'll need to specify a repository
    // You can change these values to match your setup
    const testRepo = {
      owner: process.env.TEST_REPO_OWNER || 'beachbaby',
      repo: process.env.TEST_REPO_NAME || 'HeyJarvis',
      branch: 'main'
    };

    console.log(`\n4️⃣ Indexing test repository: ${testRepo.owner}/${testRepo.repo}`);
    console.log('⚠️  This may take a few minutes depending on repository size...\n');

    const result = await indexer.indexRepository(testRepo.owner, testRepo.repo, testRepo.branch);
    
    console.log('\n📊 Indexing Results:');
    console.log(`   Files processed: ${result.files}`);
    console.log(`   Chunks created: ${result.chunks}`);
    console.log(`   Embeddings generated: ${result.embeddings}`);
    console.log(`   Chunks stored: ${result.stored}`);
    console.log(`   Duration: ${result.duration}ms`);

    // Test queries
    console.log('\n5️⃣ Testing queries...\n');

    const testQueries = [
      'What authentication methods are supported?',
      'Do we have Slack integration?',
      'What APIs are available?'
    ];

    for (const question of testQueries) {
      console.log(`❓ Question: "${question}"`);
      
      const answer = await indexer.query(question, {
        owner: testRepo.owner,
        repo: testRepo.repo
      });

      console.log(`💡 Answer (${answer.confidence} confidence):`);
      console.log(answer.answer.substring(0, 200) + '...\n');
      console.log(`📚 Sources: ${answer.sources.length} code references found`);
      console.log(`⏱️  Processing time: ${answer.processingTime}ms\n`);
      console.log('---\n');
    }

    // Get statistics
    console.log('6️⃣ Service Statistics:\n');
    const stats = indexer.getStats();
    console.log('Embedding Service:', {
      totalEmbeddings: stats.embedding.totalEmbeddings,
      cacheHitRate: stats.embedding.cacheHitRate,
      estimatedCost: `$${stats.embedding.estimatedCost.toFixed(4)}`
    });

    console.log('\n✅ All tests completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Try more queries with different questions');
    console.log('   2. Index additional repositories');
    console.log('   3. Integrate into the desktop app UI');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);

