/**
 * Assign JIRA Tasks to Engineering Team
 * Fetches SCRUM-41+ issues from JIRA and assigns them to engineering team members
 */

const { createClient } = require('@supabase/supabase-js');
const JIRAService = require('./desktop2/main/services/JIRAService');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Engineering team members
const ENGINEERING_MEMBERS = [
  { name: 'Alice Chen', email: 'alice.chen@beachbaby.demo', id: null },
  { name: 'Bob Martinez', email: 'bob.martinez@beachbaby.demo', id: null },
  { name: 'Carol Johnson', email: 'carol.johnson@beachbaby.demo', id: null },
  { name: 'David Kim', email: 'david.kim@beachbaby.demo', id: null },
];

const ENGINEERING_TEAM_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Get a random engineering team member
 */
function getRandomEngineer() {
  return ENGINEERING_MEMBERS[Math.floor(Math.random() * ENGINEERING_MEMBERS.length)];
}

/**
 * Fetch engineering team member IDs
 */
async function fetchEngineerIds() {
  console.log('🔍 Fetching engineering team member IDs...\n');
  
  for (const member of ENGINEERING_MEMBERS) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', member.email)
      .single();
    
    if (data) {
      member.id = data.id;
      console.log(`   ✓ ${member.name}: ${member.id}`);
    } else {
      console.error(`   ✗ ${member.name}: Not found`);
    }
  }
  
  console.log('');
}

/**
 * Get the authenticated user for JIRA (you)
 */
async function getAuthenticatedUser() {
  // Try to find user with JIRA credentials
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, integration_settings')
    .not('integration_settings->jira->access_token', 'is', null)
    .limit(1);

  if (error || !users || users.length === 0) {
    console.error('❌ No user found with JIRA integration');
    console.log('💡 Please connect JIRA in the desktop app first');
    return null;
  }

  return users[0];
}

/**
 * Assign JIRA tasks to engineering team
 */
async function assignJiraToEngineering() {
  console.log('🚀 Assigning JIRA tasks to Engineering Team\n');
  console.log('═'.repeat(80));
  
  // Step 1: Get engineering team member IDs
  await fetchEngineerIds();
  
  // Step 2: Get authenticated user with JIRA
  console.log('🔑 Finding user with JIRA integration...\n');
  const authUser = await getAuthenticatedUser();
  
  if (!authUser) {
    return;
  }
  
  console.log(`   ✓ Found: ${authUser.email}\n`);
  
  // Step 3: Initialize JIRA service
  console.log('🔗 Connecting to JIRA...\n');
  const jiraService = new JIRAService({
    logger: {
      info: console.log,
      error: console.error,
      warn: console.warn,
      debug: () => {} // Suppress debug logs
    },
    supabaseAdapter: { supabase }
  });
  
  const initResult = await jiraService.initialize(authUser.id);
  
  if (!initResult.connected) {
    console.error('❌ Failed to connect to JIRA:', initResult.error);
    return;
  }
  
  console.log('   ✓ Connected to JIRA\n');
  
  // Step 4: Fetch issues
  console.log('📋 Fetching JIRA issues...\n');
  
  // Use direct API call to get all project issues
  const jql = 'project = SCRUM AND key >= SCRUM-41 ORDER BY key ASC';
  console.log(`   Using JQL: ${jql}\n`);
  
  let issuesResult;
  try {
    // Use jiraCore's searchIssues method which uses the correct API
    const params = new URLSearchParams({
      jql: jql,
      maxResults: '100',
      fields: 'summary,status,assignee,priority,issuetype,description'
    });
    
    const response = await jiraService.jiraCore._makeRequest(`/rest/api/3/search/jql?${params.toString()}`);
    
    issuesResult = {
      success: true,
      issues: response.issues.map(issue => ({
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description?.content?.[0]?.content?.[0]?.text || '',
        status: issue.fields.status.name,
        priority: issue.fields.priority?.name || 'Medium',
        issueType: issue.fields.issuetype.name,
        assignee: issue.fields.assignee
      }))
    };
  } catch (error) {
    issuesResult = { success: false, error: error.message };
  }
  
  if (!issuesResult.success) {
    console.error('❌ Failed to fetch issues:', issuesResult.error);
    return;
  }
  
  const issues = issuesResult.issues || [];
  console.log(`   Found ${issues.length} issues from SCRUM-41 onwards\n`);
  
  if (issues.length === 0) {
    console.log('💡 No issues found. Try adjusting the JQL query.');
    return;
  }
  
  console.log('═'.repeat(80));
  console.log('\n📝 Assigning issues to team members...\n');
  
  let assigned = 0;
  let skipped = 0;
  
  for (const issue of issues) {
    const engineer = getRandomEngineer();
    
    console.log(`\n${issue.key}: ${issue.summary}`);
    console.log(`   Status: ${issue.status}`);
    console.log(`   → Assigning to: ${engineer.name}`);
    
    // Store task in database
    const taskData = {
      title: issue.summary,
      description: issue.description || '',
      status: mapJiraStatus(issue.status),
      external_source: 'jira',
      external_id: issue.id,
      external_url: `https://heyjarvis-team.atlassian.net/browse/${issue.key}`,
      assigned_to: engineer.id,
      created_by: authUser.id,
      metadata: {
        jira_key: issue.key,
        jira_type: issue.issueType,
        jira_priority: issue.priority,
        jira_assignee: issue.assignee?.displayName || 'Unassigned',
        assigned_engineer: engineer.name
      }
    };
    
    // Check if task already exists
    const { data: existing } = await supabase
      .from('tasks')
      .select('id')
      .eq('external_source', 'jira')
      .eq('external_id', issue.id)
      .single();
    
    let result;
    if (existing) {
      // Update existing task
      result = await supabase
        .from('tasks')
        .update({
          assigned_to: engineer.id,
          metadata: taskData.metadata
        })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (result.error) {
        console.log(`   ❌ Failed to update: ${result.error.message}`);
        skipped++;
      } else {
        console.log(`   ✅ Updated assignment (ID: ${result.data.id})`);
        assigned++;
      }
    } else {
      // Insert new task
      result = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();
      
      if (result.error) {
        console.log(`   ❌ Failed to insert: ${result.error.message}`);
        skipped++;
      } else {
        console.log(`   ✅ Created in database (ID: ${result.data.id})`);
        assigned++;
      }
    }
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log(`\n✅ Assignment complete!`);
  console.log(`   Assigned: ${assigned} tasks`);
  console.log(`   Skipped: ${skipped} tasks`);
  console.log(`   Total: ${issues.length} tasks processed\n`);
  
  // Show distribution
  console.log('📊 Assignment Distribution:');
  const distribution = {};
  ENGINEERING_MEMBERS.forEach(m => {
    distribution[m.name] = 0;
  });
  
  const { data: allTasks } = await supabase
    .from('tasks')
    .select('assigned_to, metadata')
    .eq('external_source', 'jira')
    .not('assigned_to', 'is', null);
  
  allTasks?.forEach(task => {
    const assignedName = task.metadata?.assigned_engineer;
    if (assignedName && distribution[assignedName] !== undefined) {
      distribution[assignedName]++;
    }
  });
  
  Object.entries(distribution).forEach(([name, count]) => {
    console.log(`   ${name}: ${count} tasks`);
  });
  
  console.log('\n💡 TIP: Run "node check-teams-data.js" to verify the setup');
}

/**
 * Map JIRA status to our task status
 */
function mapJiraStatus(jiraStatus) {
  const statusMap = {
    'To Do': 'pending',
    'In Progress': 'in_progress',
    'Done': 'completed',
    'Code Review': 'in_progress',
    'In Review': 'in_progress',
    'Testing': 'in_progress',
    'Blocked': 'pending'
  };
  
  return statusMap[jiraStatus] || 'pending';
}

// Run the script
assignJiraToEngineering()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

