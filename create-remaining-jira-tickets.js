/**
 * Create the remaining 5 JIRA tickets
 */

const JIRAOAuthHandler = require('./oauth/jira-oauth-handler');
require('dotenv').config();

async function createRemainingTickets() {
  console.log('\n🚀 Creating Remaining 5 JIRA Tickets...\n');

  try {
    const projectKey = 'SCRUM';
    const siteUrl = 'https://heyjarvis-team.atlassian.net';

    // Authenticate
    console.log('🔐 Authenticating...\n');
    const oauthHandler = new JIRAOAuthHandler({
      clientId: process.env.JIRA_CLIENT_ID,
      clientSecret: process.env.JIRA_CLIENT_SECRET,
      redirectUri: process.env.JIRA_REDIRECT_URI,
      port: 8892
    });

    await oauthHandler.startAuthFlow();
    console.log('✅ Authenticated!\n');

    const jiraService = oauthHandler.jiraService;

    // Define the 5 remaining issues (changed from Feature to Task)
    const issues = [
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

    console.log('📝 Creating 5 remaining tickets...\n');

    const createdIssues = [];

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const issueNum = i + 1;
      
      try {
        console.log(`[${issueNum}/5] Creating: ${issue.summary}...`);
        
        const result = await jiraService.createIssue(projectKey, issue);
        
        if (result.success) {
          createdIssues.push({
            key: result.issue_key,
            url: result.url,
            summary: issue.summary
          });
          console.log(`  ✅ Created: ${result.issue_key}`);
          console.log(`  🔗 ${result.url}\n`);
        }

        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.log(`  ❌ Error: ${error.message}\n`);
      }
    }

    // Summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  📊 Summary                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    console.log(`✅ Successfully created: ${createdIssues.length} issues\n`);

    if (createdIssues.length > 0) {
      console.log('📋 New Issues:\n');
      createdIssues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.key}] ${issue.summary}`);
        console.log(`   ${issue.url}\n`);
      });
    }

    console.log('🎉 All 10 tickets now created in JIRA!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

createRemainingTickets();


