/**
 * Check SCRUM-43 issue details
 */

const JIRAOAuthHandler = require('./oauth/jira-oauth-handler');
require('dotenv').config();

async function checkIssue() {
  console.log('\n🔍 Checking SCRUM-43...\n');

  try {
    const oauthHandler = new JIRAOAuthHandler({
      clientId: process.env.JIRA_CLIENT_ID,
      clientSecret: process.env.JIRA_CLIENT_SECRET,
      redirectUri: process.env.JIRA_REDIRECT_URI,
      port: 8892
    });

    await oauthHandler.startAuthFlow();
    console.log('✅ Authenticated\n');

    const jiraService = oauthHandler.jiraService;

    // Get SCRUM-43 details
    const issue = await jiraService._makeRequest('/rest/api/3/issue/SCRUM-43');
    
    console.log('Issue Key:', issue.key);
    console.log('Summary:', issue.fields.summary);
    console.log('Type:', issue.fields.issuetype.name);
    console.log('Status:', issue.fields.status.name);
    console.log('URL:', `https://heyjarvis-team.atlassian.net/browse/${issue.key}`);
    console.log('\nNote: This is an Epic, which typically appears in the Epics panel,');
    console.log('not in the sprint backlog with regular tasks.\n');

    console.log('To view it:');
    console.log('1. Click on the "Roadmap" tab or');
    console.log('2. Use the Epics panel on the left side of your board\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkIssue();


