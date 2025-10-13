/**
 * Diagnostic script to check vector search is working
 * Tests actual similarity scores and database RPC function
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const EmbeddingService = require('./core/intelligence/embedding-service');

async function diagnose() {
  console.log('🔍 Diagnosing Vector Search\n');

  // Initialize services
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const embeddingService = new EmbeddingService();

  // Step 1: Check what's in the database
  console.log('1️⃣ Checking database contents...');
  const { data: chunks, error: countError } = await supabase
    .from('code_chunks')
    .select('repository_owner, repository_name, file_path, chunk_content', { count: 'exact' })
    .eq('repository_owner', 'HeyoJarvis')
    .eq('repository_name', 'BeachBaby')
    .limit(5);

  if (countError) {
    console.error('❌ Database error:', countError.message);
    return;
  }

  console.log(`✅ Found chunks in database`);
  console.log(`   Sample chunks:`);
  chunks.forEach((chunk, i) => {
    console.log(`   ${i + 1}. ${chunk.file_path} - ${chunk.chunk_content.substring(0, 60)}...`);
  });

  // Step 2: Test embedding generation
  console.log('\n2️⃣ Generating query embedding...');
  const testQuery = 'What does this repository do?';
  const queryEmbedding = await embeddingService.generateEmbedding(testQuery);
  console.log(`✅ Query embedding generated (${queryEmbedding.length} dimensions)`);

  // Step 3: Check if RPC function exists
  console.log('\n3️⃣ Testing RPC function...');
  try {
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('search_code_chunks', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: 0.1,  // Very low threshold to see ANY results
        match_count: 5,
        filter_owner: 'HeyoJarvis',
        filter_repo: 'BeachBaby',
        filter_language: null
      });

    if (rpcError) {
      console.error('❌ RPC function error:', rpcError.message);
      console.log('\n💡 The search_code_chunks function might not exist in your database.');
      console.log('   Run this SQL in Supabase SQL Editor:');
      console.log('\n```sql');
      console.log(`
CREATE OR REPLACE FUNCTION search_code_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_owner text DEFAULT NULL,
  filter_repo text DEFAULT NULL,
  filter_language text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  repository_owner text,
  repository_name text,
  repository_branch text,
  file_path text,
  file_language text,
  chunk_content text,
  chunk_type text,
  chunk_name text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    code_chunks.id,
    code_chunks.repository_owner,
    code_chunks.repository_name,
    code_chunks.repository_branch,
    code_chunks.file_path,
    code_chunks.file_language,
    code_chunks.chunk_content,
    code_chunks.chunk_type,
    code_chunks.chunk_name,
    1 - (code_chunks.embedding <=> query_embedding) AS similarity
  FROM code_chunks
  WHERE (filter_owner IS NULL OR code_chunks.repository_owner = filter_owner)
    AND (filter_repo IS NULL OR code_chunks.repository_name = filter_repo)
    AND (filter_language IS NULL OR code_chunks.file_language = filter_language)
    AND 1 - (code_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY code_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
      `.trim());
      console.log('```\n');
      return;
    }

    console.log(`✅ RPC function works!`);
    console.log(`   Found ${rpcData.length} results with threshold 0.1`);
    
    if (rpcData.length > 0) {
      console.log(`   Top results:`);
      rpcData.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.file_path} (similarity: ${(result.similarity * 100).toFixed(1)}%)`);
        console.log(`      ${result.chunk_content.substring(0, 80)}...`);
      });
    } else {
      console.log('   ⚠️  No results even with 0.1 threshold!');
      console.log('   This suggests an issue with:');
      console.log('   1. Embedding dimension mismatch (should be 1536)');
      console.log('   2. Embeddings not properly stored');
      console.log('   3. Query embedding format issue');
    }

    // Step 4: Test with different thresholds
    console.log('\n4️⃣ Testing different similarity thresholds...');
    for (const threshold of [0.1, 0.3, 0.5, 0.7]) {
      const { data: thresholdData } = await supabase
        .rpc('search_code_chunks', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: threshold,
          match_count: 10,
          filter_owner: 'HeyoJarvis',
          filter_repo: 'BeachBaby',
          filter_language: null
        });

      console.log(`   Threshold ${threshold}: ${thresholdData.length} results`);
    }

    // Step 5: Recommendation
    console.log('\n📊 Diagnosis Complete!\n');
    if (rpcData.length > 0) {
      const avgSimilarity = rpcData.reduce((sum, r) => sum + r.similarity, 0) / rpcData.length;
      console.log(`✅ Vector search is working`);
      console.log(`   Average similarity score: ${(avgSimilarity * 100).toFixed(1)}%`);
      
      if (avgSimilarity < 0.5) {
        console.log('\n💡 Recommendation: Lower the similarity threshold');
        console.log('   Current threshold: 0.5 (50%)');
        console.log(`   Suggested threshold: ${Math.max(0.2, avgSimilarity - 0.1).toFixed(2)} (${(Math.max(0.2, avgSimilarity - 0.1) * 100).toFixed(0)}%)`);
        console.log('\n   Edit core/intelligence/code-query-engine.js line 26:');
        console.log(`   searchThreshold: options.searchThreshold || ${Math.max(0.2, avgSimilarity - 0.1).toFixed(2)},`);
      }
    } else {
      console.log('❌ Vector search is not working properly');
      console.log('   Check the RPC function SQL above');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error.stack);
  }
}

diagnose().catch(console.error);

