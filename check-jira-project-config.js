/**
 * Check JIRA Project Configuration
 * Retrieves available issue types, priorities, and other metadata
 */

const JIRAOAuthHandler = require('./oauth/jira-oauth-handler');
require('dotenv').config();

async function checkProjectConfig() {
  console.log('\n🔍 Checking JIRA Project Configuration...\n');

  try {
    // Authenticate
    console.log('Authenticating...');
    const oauthHandler = new JIRAOAuthHandler({
      clientId: process.env.JIRA_CLIENT_ID,
      clientSecret: process.env.JIRA_CLIENT_SECRET,
      redirectUri: process.env.JIRA_REDIRECT_URI,
      port: 8892
    });

    await oauthHandler.startAuthFlow();
    console.log('✅ Authenticated\n');

    const jiraService = oauthHandler.jiraService;
    const projectKey = 'SCRUM';

    // Get project details
    console.log(`📋 Fetching project details for ${projectKey}...\n`);
    
    const projectUrl = `/rest/api/3/project/${projectKey}`;
    const project = await jiraService._makeRequest(projectUrl);
    
    console.log('Project Name:', project.name);
    console.log('Project Key:', project.key);
    console.log('Project Type:', project.projectTypeKey);
    console.log('\n');

    // Get issue types for this project
    console.log('📝 Available Issue Types:');
    if (project.issueTypes) {
      project.issueTypes.forEach(type => {
        console.log(`  - ${type.name} (ID: ${type.id})`);
        if (type.subtask) console.log(`    └─ (Subtask type)`);
      });
    }
    console.log('\n');

    // Get create metadata for the project
    console.log('🔧 Checking field configurations...');
    const metaUrl = `/rest/api/3/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes.fields`;
    const metadata = await jiraService._makeRequest(metaUrl);
    
    if (metadata.projects && metadata.projects[0]) {
      const projectMeta = metadata.projects[0];
      
      console.log('\n📋 Issue Types with Available Fields:\n');
      projectMeta.issuetypes.forEach(issueType => {
        if (!issueType.subtask) {
          console.log(`\n  ${issueType.name} (${issueType.id}):`);
          
          // Check for priority field
          if (issueType.fields.priority) {
            console.log('    ✅ Priority field available');
            if (issueType.fields.priority.allowedValues) {
              console.log('       Available priorities:');
              issueType.fields.priority.allowedValues.forEach(p => {
                console.log(`         - ${p.name}`);
              });
            }
          } else {
            console.log('    ❌ Priority field NOT available');
          }
          
          // Check for labels
          if (issueType.fields.labels) {
            console.log('    ✅ Labels field available');
          }
          
          // Check for description
          if (issueType.fields.description) {
            console.log('    ✅ Description field available');
          }
        }
      });
    }

    console.log('\n\n✅ Configuration check complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', await error.response.text());
    }
  } finally {
    process.exit(0);
  }
}

checkProjectConfig();


