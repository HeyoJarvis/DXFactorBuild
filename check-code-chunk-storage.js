/**
 * Check Code Chunk Storage Usage in Supabase
 * 
 * This script analyzes storage usage for code chunks in the vector database.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkStorage() {
  console.log('🔍 Analyzing Code Chunk Storage in Supabase...\n');

  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Get total count of chunks
    const { count: totalChunks, error: countError } = await supabase
      .from('code_chunks')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error counting chunks:', countError.message);
      return;
    }

    console.log('📊 OVERALL STATISTICS');
    console.log('=' .repeat(60));
    console.log(`Total chunks stored: ${totalChunks?.toLocaleString() || 0}`);

    if (!totalChunks || totalChunks === 0) {
      console.log('\n✅ No code chunks stored yet - database is empty');
      return;
    }

    // 2. Get sample data to estimate sizes
    const { data: sampleChunks, error: sampleError } = await supabase
      .from('code_chunks')
      .select('chunk_content, embedding, token_count, file_path, chunk_type')
      .limit(100);

    if (sampleError) {
      console.error('❌ Error fetching sample:', sampleError.message);
      return;
    }

    // Calculate average sizes from sample
    let totalContentSize = 0;
    let totalEmbeddingSize = 0;
    let totalTokens = 0;

    sampleChunks.forEach(chunk => {
      // Content size in bytes
      totalContentSize += Buffer.byteLength(chunk.chunk_content, 'utf8');
      
      // Embedding size (1536 dimensions × 4 bytes per float)
      // Note: pgvector stores as float4 (4 bytes per dimension)
      totalEmbeddingSize += 1536 * 4;
      
      // Token count
      totalTokens += chunk.token_count || 0;
    });

    const avgContentSize = totalContentSize / sampleChunks.length;
    const avgEmbeddingSize = totalEmbeddingSize / sampleChunks.length; // Should be 6144 bytes
    const avgTokens = totalTokens / sampleChunks.length;

    // Estimate total storage
    const estimatedContentSize = avgContentSize * totalChunks;
    const estimatedEmbeddingSize = avgEmbeddingSize * totalChunks;
    const estimatedMetadataSize = 200 * totalChunks; // ~200 bytes per chunk for other fields
    const estimatedTotalSize = estimatedContentSize + estimatedEmbeddingSize + estimatedMetadataSize;

    console.log(`\nAverage content size per chunk: ${formatBytes(avgContentSize)}`);
    console.log(`Average embedding size per chunk: ${formatBytes(avgEmbeddingSize)} (1536 dims × 4 bytes)`);
    console.log(`Average tokens per chunk: ${avgTokens.toFixed(0)}`);

    console.log('\n💾 ESTIMATED STORAGE USAGE');
    console.log('=' .repeat(60));
    console.log(`Content (text):           ${formatBytes(estimatedContentSize)}`);
    console.log(`Embeddings (vectors):     ${formatBytes(estimatedEmbeddingSize)}`);
    console.log(`Metadata & indexes:       ${formatBytes(estimatedMetadataSize)}`);
    console.log('─' .repeat(60));
    console.log(`TOTAL ESTIMATED:          ${formatBytes(estimatedTotalSize)}`);

    // 3. Get breakdown by repository
    const { data: repoStats, error: repoError } = await supabase
      .from('code_chunks')
      .select('repository_owner, repository_name, chunk_content, token_count');

    if (repoError) {
      console.error('❌ Error fetching repo stats:', repoError.message);
      return;
    }

    // Group by repository
    const repoMap = new Map();
    repoStats.forEach(chunk => {
      const key = `${chunk.repository_owner}/${chunk.repository_name}`;
      if (!repoMap.has(key)) {
        repoMap.set(key, {
          count: 0,
          contentSize: 0,
          tokens: 0
        });
      }
      const stats = repoMap.get(key);
      stats.count++;
      stats.contentSize += Buffer.byteLength(chunk.chunk_content, 'utf8');
      stats.tokens += chunk.token_count || 0;
    });

    console.log('\n\n📦 BREAKDOWN BY REPOSITORY');
    console.log('=' .repeat(60));
    
    // Sort by chunk count descending
    const sortedRepos = Array.from(repoMap.entries())
      .sort((a, b) => b[1].count - a[1].count);

    sortedRepos.forEach(([repo, stats]) => {
      const embeddingSize = stats.count * 1536 * 4; // 1536 dims × 4 bytes
      const totalRepoSize = stats.contentSize + embeddingSize;
      
      console.log(`\n${repo}`);
      console.log(`  Chunks:      ${stats.count.toLocaleString()}`);
      console.log(`  Content:     ${formatBytes(stats.contentSize)}`);
      console.log(`  Embeddings:  ${formatBytes(embeddingSize)}`);
      console.log(`  Total:       ${formatBytes(totalRepoSize)}`);
      console.log(`  Tokens:      ${stats.tokens.toLocaleString()}`);
    });

    // 4. Get chunk type distribution
    const { data: typeStats, error: typeError } = await supabase
      .from('code_chunks')
      .select('chunk_type');

    if (!typeError && typeStats) {
      const typeCounts = {};
      typeStats.forEach(chunk => {
        typeCounts[chunk.chunk_type] = (typeCounts[chunk.chunk_type] || 0) + 1;
      });

      console.log('\n\n🏷️  CHUNK TYPE DISTRIBUTION');
      console.log('=' .repeat(60));
      Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          const percentage = ((count / totalChunks) * 100).toFixed(1);
          console.log(`  ${type.padEnd(15)} ${count.toString().padStart(8)} chunks  (${percentage}%)`);
        });
    }

    // 5. Get indexing status
    const { data: indexingStatus, error: statusError } = await supabase
      .from('code_indexing_status')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!statusError && indexingStatus && indexingStatus.length > 0) {
      console.log('\n\n📈 INDEXING STATUS');
      console.log('=' .repeat(60));
      indexingStatus.forEach(status => {
        const repo = `${status.repository_owner}/${status.repository_name}`;
        console.log(`\n${repo} (${status.repository_branch})`);
        console.log(`  Status:    ${status.status}`);
        console.log(`  Files:     ${status.indexed_files}/${status.total_files}`);
        console.log(`  Chunks:    ${status.indexed_chunks}/${status.total_chunks}`);
        console.log(`  Progress:  ${status.progress_percentage}%`);
        if (status.duration_ms) {
          console.log(`  Duration:  ${(status.duration_ms / 1000).toFixed(2)}s`);
        }
        if (status.completed_at) {
          console.log(`  Completed: ${new Date(status.completed_at).toLocaleString()}`);
        }
      });
    }

    // 6. Supabase limits info
    console.log('\n\n⚠️  SUPABASE FREE TIER LIMITS');
    console.log('=' .repeat(60));
    console.log('Database size limit: 500 MB');
    console.log('Current estimated usage: ' + formatBytes(estimatedTotalSize));
    const percentUsed = ((estimatedTotalSize / (500 * 1024 * 1024)) * 100).toFixed(2);
    console.log(`Percentage of free tier: ${percentUsed}%`);
    
    if (percentUsed > 80) {
      console.log('\n⚠️  WARNING: Approaching free tier limit!');
    } else if (percentUsed > 50) {
      console.log('\n⚠️  Note: Over 50% of free tier used');
    } else {
      console.log('\n✅ Well within free tier limits');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the check
checkStorage().then(() => {
  console.log('\n✅ Storage analysis complete\n');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

