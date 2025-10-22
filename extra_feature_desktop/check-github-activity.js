#!/usr/bin/env node

/**
 * Check GitHub activity for debugging
 */

require('dotenv').config({ path: '../.env' });
const GitHubOAuthService = require('./main/services/oauth/GitHubOAuthService');
const TeamSyncSupabaseAdapter = require('./main/services/TeamSyncSupabaseAdapter');
const winston = require('winston');
const fetch = require('node-fetch');

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

async function checkActivity() {
  try {
    console.log('\n🔍 Checking GitHub Activity\n');
    
    const supabaseAdapter = new TeamSyncSupabaseAdapter({ logger });
    const githubService = new GitHubOAuthService({ logger, supabaseAdapter });
    
    // Get token for your user
    const userId = 'e833f35b-5991-4ede-b10a-e3702e46b37b';
    const token = await githubService.getAccessToken(userId);
    
    console.log('✅ Got access token\n');
    
    // Get repositories
    console.log('📦 Fetching repositories...');
    const reposResponse = await fetch('https://api.github.com/installation/repositories?per_page=100', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    const reposData = await reposResponse.json();
    const repos = reposData.repositories || [];
    
    console.log(`Found ${repos.length} repositories:\n`);
    
    for (const repo of repos) {
      console.log(`\n📁 ${repo.full_name}`);
      console.log(`   Private: ${repo.private}`);
      console.log(`   Default branch: ${repo.default_branch}`);
      console.log(`   Updated: ${repo.updated_at}`);
      
      // Check for recent commits
      try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const commitsResponse = await fetch(
          `https://api.github.com/repos/${repo.full_name}/commits?since=${since}&per_page=10`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28'
            }
          }
        );
        
        if (commitsResponse.ok) {
          const commits = await commitsResponse.json();
          console.log(`   ✅ Commits (last 7 days): ${commits.length}`);
          if (commits.length > 0) {
            console.log(`      Latest: "${commits[0].commit.message.split('\n')[0]}" by ${commits[0].commit.author.name}`);
          }
        } else {
          const error = await commitsResponse.text();
          console.log(`   ❌ Commits: ${commitsResponse.status} ${error.substring(0, 100)}`);
        }
      } catch (error) {
        console.log(`   ❌ Commits error: ${error.message}`);
      }
      
      // Check for recent PRs
      try {
        const prsResponse = await fetch(
          `https://api.github.com/repos/${repo.full_name}/pulls?state=all&sort=updated&per_page=5`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28'
            }
          }
        );
        
        if (prsResponse.ok) {
          const prs = await prsResponse.json();
          console.log(`   ✅ Pull Requests (recent): ${prs.length}`);
          if (prs.length > 0) {
            console.log(`      Latest: #${prs[0].number} "${prs[0].title}" (${prs[0].state})`);
          }
        } else {
          const error = await prsResponse.text();
          console.log(`   ❌ PRs: ${prsResponse.status}`);
        }
      } catch (error) {
        console.log(`   ❌ PRs error: ${error.message}`);
      }
    }
    
    console.log('\n\n✅ Done!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

checkActivity();

