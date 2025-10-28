/**
 * Create PM-focused JIRA tickets for BeachBaby/HeyJarvis
 * 
 * This script:
 * 1. Authenticates with JIRA via OAuth
 * 2. Prompts for project details
 * 3. Creates 10 product-focused tickets
 */

const readline = require('readline');
const JIRAService = require('./core/integrations/jira-service');
const JIRAOAuthHandler = require('./oauth/jira-oauth-handler');
require('dotenv').config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🎯 BeachBaby/HeyJarvis - PM Ticket Creator              ║');
  console.log('║  Creating 10 Product Management focused JIRA tickets     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Get project details from command line or prompt
    console.log('📋 Step 1: Project Configuration\n');
    
    let projectKey, siteUrl;
    
    if (process.argv[2] && process.argv[3]) {
      // Use command line arguments
      projectKey = process.argv[2];
      siteUrl = process.argv[3];
      console.log('Using command line arguments...');
    } else {
      // Prompt user
      console.log('Usage: node create-pm-jira-tickets.js [PROJECT_KEY] [SITE_URL]');
      console.log('Example: node create-pm-jira-tickets.js JARVIS your-company.atlassian.net\n');
      
      projectKey = await question('Enter your JIRA Project Key (e.g., JARVIS, BB, PROJ): ');
      siteUrl = await question('Enter your JIRA Site URL (e.g., your-company.atlassian.net): ');
    }
    
    // Clean up site URL
    const cleanSiteUrl = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const fullSiteUrl = `https://${cleanSiteUrl}`;
    
    console.log(`\n✅ Project: ${projectKey}`);
    console.log(`✅ Site: ${fullSiteUrl}\n`);

    // Step 2: Authenticate with JIRA
    console.log('🔐 Step 2: JIRA Authentication\n');
    console.log('Opening browser for OAuth login...');
    console.log('Please authorize the app in your browser.\n');

    const oauthHandler = new JIRAOAuthHandler({
      clientId: process.env.JIRA_CLIENT_ID,
      clientSecret: process.env.JIRA_CLIENT_SECRET,
      redirectUri: process.env.JIRA_REDIRECT_URI,
      port: 8892
    });

    const authResult = await oauthHandler.startAuthFlow();
    console.log('✅ Authentication successful!\n');

    // Step 3: Use the authenticated JIRA Service from OAuth handler
    console.log('🚀 Step 3: Creating JIRA Issues\n');
    
    // Use the already-authenticated service from the OAuth handler
    const jiraService = oauthHandler.jiraService;

    // Define PM-focused issues
    const issues = [
      {
        summary: 'User Authentication Persistence Issues',
        description: `**User Story**
As a user, I want my login session to persist when I close and reopen the app, so that I don't have to re-authenticate every time.

**Current Behavior**
Users are getting logged out when they close the desktop application and must re-enter credentials on every launch.

**Expected Behavior**
- Session tokens should persist securely in local storage
- Users remain authenticated across app restarts
- Tokens refresh automatically before expiration

**Impact**
- Poor user experience
- Increased friction in daily usage
- Higher support tickets for "login issues"

**Business Value**
Improved user retention and reduced churn from authentication friction.

Repository: https://github.com/sdalal/BeachBaby`,
        issueType: 'Task',
        priority: 'High',
        labels: ['user-experience', 'authentication', 'retention']
      },
      {
        summary: 'Task Management Integration with JIRA',
        description: `**User Story**
As a developer user, I want to see my JIRA tasks directly in the HeyJarvis app, so that I have a unified view of my work without switching between tools.

**Requirements**
- Authenticate with JIRA OAuth
- Display assigned issues in task view
- Show issue status, priority, and type
- Auto-sync every 5 minutes
- Filter by project and status

**Success Metrics**
- 80% of developer users connect JIRA within first week
- 50% reduction in context switching between apps
- Positive feedback on unified task view

**Target Users**
Engineering team members who actively use JIRA for project management.

Repository: https://github.com/sdalal/BeachBaby`,
        issueType: 'Task',
        priority: 'High',
        labels: ['integration', 'jira', 'developer-experience']
      },
      {
        summary: 'Desktop Notifications for Critical Tasks',
        description: `**User Story**
As a team member, I want to receive desktop notifications for high-priority task assignments, so that I can respond quickly to urgent requests even when the app is minimized.

**Requirements**
- Native desktop notifications on macOS, Windows, Linux
- Show task title, priority, and assignee
- Click notification to open task detail
- Configurable notification settings
- Respect OS "Do Not Disturb" mode

**User Feedback**
"I miss important assignments because I don't check the app constantly"
"Would love to get pinged when something urgent comes up"

**Success Metrics**
- Faster response time to high-priority tasks
- Increased user engagement with task features

Repository: https://github.com/sdalal/BeachBaby`,
        issueType: 'Task',
        priority: 'Medium',
        labels: ['notifications', 'user-experience', 'engagement']
      },
      {
        summary: 'Conversation History Not Saving in Task Chat',
        description: `**Bug Report**

**What's Happening**
Users report that their task-specific chat conversations disappear when they close and reopen the app.

**Steps to Reproduce**
1. Open a task
2. Have a conversation in task chat
3. Close the application
4. Reopen and navigate to the same task
5. Chat history is gone

**Impact**
- Loss of important context and decisions
- Users frustrated by data loss
- Reduced trust in the platform

**User Quote**
"I had a whole conversation about requirements that's now gone. Can't rely on this feature."

**Priority Justification**
Data loss is a critical issue affecting user trust and feature adoption.

Repository: https://github.com/sdalal/BeachBaby`,
        issueType: 'Task',
        priority: 'High',
        labels: ['bug', 'data-loss', 'task-chat', 'critical']
      },
      {
        summary: 'GitHub Issue Integration for Developer Workflow',
        description: `**Feature Request**

**User Story**
As a developer, I want to see both JIRA tickets and GitHub issues in one place, so that I can track all my work regardless of the source system.

**Background**
Many engineering teams use GitHub Issues for open-source projects and internal tools, while using JIRA for main product work. Developers need to check multiple places.

**Proposed Solution**
- Add GitHub OAuth integration
- Fetch issues assigned to authenticated user
- Display alongside JIRA tasks with source badge
- Add filter: "JIRA only", "GitHub only", "All"
- Show repo name and labels

**Success Criteria**
- Unified view of all developer tasks
- Reduce time spent context switching
- Support for top 3 issue sources (JIRA, GitHub, eventually Linear)

**Market Research**
Competitors like Linear and Height offer multi-source task aggregation as a key differentiator.

Repository: https://github.com/sdalal/BeachBaby`,
        issueType: 'Task',
        priority: 'Medium',
        labels: ['feature-request', 'github', 'integration', 'developer-experience']
      },
      {
        summary: 'Improve Onboarding Flow for New Users',
        description: `**Initiative**

**Problem Statement**
Current onboarding has a 60% drop-off rate between signup and first successful action. Users report confusion about what to do after creating an account.

**Proposed Improvements**
1. Add progressive disclosure wizard
2. Guide users through first integration setup
3. Show example tasks/data before connection
4. Add "Skip for now" option with demo mode
5. Contextual help tooltips

**User Feedback Examples**
- "Not sure what I'm supposed to do after logging in"
- "Too many empty states, nothing to click on"
- "Wish there was a tutorial or sample data"

**Success Metrics**
- Reduce onboarding drop-off from 60% to 30%
- Increase "time to first value" completion by 40%
- Improve NPS score in first-week users

**Business Impact**
Better onboarding directly impacts conversion rate and customer acquisition cost.

Repository: https://github.com/sdalal/BeachBaby`,
        issueType: 'Epic',
        labels: ['onboarding', 'user-experience', 'conversion', 'growth']
      },
      {
        summary: 'Performance Issues with Large Task Lists',
        description: `**Bug Report**

**Symptom**
Users with >100 tasks experience slow load times (5-10 seconds) when opening the Tasks view.

**Impact**
- Frustrating user experience for power users
- Perception of "buggy" or "slow" app
- Affects our most engaged users (power users)

**User Feedback**
"The app freezes when I open my tasks"
"Takes forever to load, considering switching back to JIRA directly"

**Technical Note**
Appears to be related to loading all tasks at once without pagination. Frontend rendering lag visible with large datasets.

**Proposed Solution**
- Implement pagination (20 tasks per page)
- Add infinite scroll or "Load More"
- Cache frequently accessed tasks
- Add loading skeleton for better perceived performance

**Priority Justification**
Affects our most valuable users (high engagement = high retention value)

Repository: https://github.com/sdalal/BeachBaby`,
        issueType: 'Task',
        priority: 'High',
        labels: ['performance', 'bug', 'power-users', 'scalability']
      },
      {
        summary: 'Code Search Functionality for Developers',
        description: `**Feature Request**

**User Story**
As a developer, I want to search across all indexed repositories from within HeyJarvis, so that I can quickly find code examples and understand how features are implemented.

**Use Cases**
1. Find where a specific function is used
2. Search for API endpoint implementations
3. Locate configuration examples
4. Understand code patterns in codebase

**Requirements**
- Full-text search with syntax highlighting
- File path and line number display
- Preview of surrounding code context
- Support regex and case-sensitive search
- "Open in GitHub" link for each result

**Competitive Analysis**
GitHub Copilot Workspace and Cursor offer similar in-editor search. This would differentiate HeyJarvis for dev teams.

**Success Metrics**
- 70% of developer users use search weekly
- Average 5+ searches per active user per week
- Positive feedback on developer productivity

Repository: https://github.com/sdalal/BeachBaby`,
        issueType: 'Task',
        priority: 'Medium',
        labels: ['feature-request', 'code-search', 'developer-experience', 'productivity']
      },
      {
        summary: 'UI Responsiveness Issues on Arc Reactor Component',
        description: `**Bug Report**

**What's Broken**
The Arc Reactor radial menu doesn't respond to clicks on certain display resolutions, particularly 4K displays.

**User Impact**
- Core navigation feature is unusable for some users
- Affects users with high-resolution displays (often power users with premium hardware)
- Creates perception of poor quality

**Affected Users**
Estimated 15-20% of desktop users based on analytics data showing 4K display usage.

**User Quote**
"The menu looks cool but I literally can't click anything. Using a 4K monitor."

**Priority Justification**
Blocks primary navigation for a significant user segment. Critical for usability.

**Workaround**
Users can use keyboard shortcuts, but this isn't discoverable or obvious.

Repository: https://github.com/sdalal/BeachBaby`,
        issueType: 'Task',
        priority: 'High',
        labels: ['bug', 'ui', 'accessibility', 'critical']
      },
      {
        summary: 'Meeting Scheduler with Calendar Integration',
        description: `**Feature Request**

**User Story**
As a team lead, I want to schedule meetings directly from task discussions, so that I can quickly coordinate with team members without leaving the app.

**Background**
User research shows that 40% of task conversations lead to a meeting being scheduled. Current workflow requires switching to Outlook/Google Calendar.

**Requirements**
- Integrate with Google Calendar and Microsoft Outlook
- Suggest meeting times based on participant availability
- Auto-generate meeting title from task context
- Include task link in meeting description
- Send calendar invites to participants

**User Feedback**
"Would be great to just click 'Schedule Meeting' right from the chat"
"Always have to switch apps to set up meetings about tasks"

**Success Metrics**
- 30% of tasks with >3 messages result in scheduled meeting
- Reduce time from "let's meet" to actual calendar invite by 80%
- Increase meeting preparation quality (context included)

**Market Validation**
Similar features in Notion, ClickUp, and Asana drive significant engagement.

Repository: https://github.com/sdalal/BeachBaby`,
        issueType: 'Task',
        priority: 'Medium',
        labels: ['feature-request', 'calendar', 'meetings', 'collaboration', 'integration']
      }
    ];

    // Create each issue
    const createdIssues = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const issueNum = i + 1;
      
      try {
        console.log(`[${issueNum}/10] Creating: ${issue.summary}...`);
        
        // Don't include priority for Epic issues
        const issueData = { ...issue };
        if (issue.issueType === 'Epic') {
          delete issueData.priority;
        }
        
        const result = await jiraService.createIssue(projectKey, issueData);
        
        if (result.success) {
          createdIssues.push({
            key: result.issue_key,
            url: result.url,
            summary: issue.summary
          });
          console.log(`  ✅ Created: ${result.issue_key}`);
          console.log(`  🔗 ${result.url}\n`);
          successCount++;
        } else {
          console.log(`  ❌ Failed to create issue\n`);
          failCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}\n`);
        failCount++;
      }
    }

    // Summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  📊 Summary                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    console.log(`✅ Successfully created: ${successCount} issues`);
    console.log(`❌ Failed: ${failCount} issues\n`);

    if (createdIssues.length > 0) {
      console.log('📋 Created Issues:\n');
      createdIssues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.key}] ${issue.summary}`);
        console.log(`   ${issue.url}\n`);
      });
    }

    console.log('🎉 Done! Your JIRA project is now populated with PM-focused tickets.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

