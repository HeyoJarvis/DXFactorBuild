#!/usr/bin/env node

/**
 * Add Microsoft 365 approval system to HeyJarvis
 * - Integrates workflow approver
 * - Adds IPC handlers
 * - Adds UI components
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Adding Microsoft 365 approval system...\n');

// 1. Add approval UI to unified.html
console.log('📝 Step 1: Adding approval UI to unified.html...');
const HTML_FILE = path.join(__dirname, '../desktop/renderer/unified.html');
let htmlContent = fs.readFileSync(HTML_FILE, 'utf8');

const approvalUI = fs.readFileSync(
  path.join(__dirname, '../desktop/renderer/microsoft-approval-ui.html'),
  'utf8'
);

if (!htmlContent.includes('ms-approval-modal')) {
  // Add before closing </body>
  htmlContent = htmlContent.replace('</body>', approvalUI + '\n</body>');
  fs.writeFileSync(HTML_FILE, htmlContent);
  console.log('✅ Approval UI added to unified.html');
} else {
  console.log('⏭️  Approval UI already exists');
}

// 2. Add IPC handlers to preload script
console.log('\n📝 Step 2: Adding approval IPC handlers to preload...');
const PRELOAD_FILE = path.join(__dirname, '../desktop/bridge/copilot-preload.js');
let preloadContent = fs.readFileSync(PRELOAD_FILE, 'utf8');

const approvalHandlers = `
  // Microsoft 365 approval handlers
  approveMicrosoftAction: (approvalId, edits) => ipcRenderer.invoke('microsoft:approveAction', approvalId, edits),
  rejectMicrosoftAction: (approvalId) => ipcRenderer.invoke('microsoft:rejectAction', approvalId),
  onMicrosoftApprovalRequest: (callback) => {
    ipcRenderer.on('microsoft:approval-request', (event, approval) => callback(approval));
  },`;

if (!preloadContent.includes('approveMicrosoftAction')) {
  // Add to electronAPI object
  preloadContent = preloadContent.replace(
    /  \/\/ Microsoft 365 API\n  microsoft: \{/,
    `  // Microsoft 365 API\n  microsoft: {${approvalHandlers}`
  );
  fs.writeFileSync(PRELOAD_FILE, preloadContent);
  console.log('✅ Approval handlers added to preload');
} else {
  console.log('⏭️  Approval handlers already exist');
}

// 3. Create integration instructions for main.js
console.log('\n📝 Step 3: Creating integration instructions...');

const instructions = `
# Microsoft 365 Approval System Integration

## What Was Added:

1. ✅ WorkflowActionApprover class (core/automation/workflow-action-approver.js)
2. ✅ Approval UI components (added to unified.html)
3. ✅ IPC handlers (added to copilot-preload.js)

## Next Steps - Add to main.js:

### 1. Import the approver at the top of main.js:

\`\`\`javascript
const WorkflowActionApprover = require('../core/automation/workflow-action-approver');
\`\`\`

### 2. Initialize in initializeServices() function:

\`\`\`javascript
// Initialize workflow action approver
workflowApprover = new WorkflowActionApprover({
  logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
});

// Listen for approval requests and forward to UI
workflowApprover.on('approval_requested', (approval) => {
  if (mainWindow) {
    mainWindow.webContents.send('microsoft:approval-request', approval);
  }
});

// Listen for approved actions and execute them
workflowApprover.on('action_approved', async ({ type, data, workflow }) => {
  try {
    if (type === 'calendar_event') {
      const result = await microsoftOAuthHandler.getGraphService().createCalendarEvent(data);
      console.log('✅ Calendar event created:', result.event.id);
    } else if (type === 'email') {
      const result = await microsoftOAuthHandler.getGraphService().sendEmail(data);
      console.log('✅ Email sent');
    }
  } catch (error) {
    console.error('❌ Failed to execute approved action:', error);
  }
});

console.log('✅ Workflow action approver initialized');
\`\`\`

### 3. Add IPC handlers in setupMicrosoftIPCHandlers():

\`\`\`javascript
// Approve action
ipcMain.handle('microsoft:approveAction', async (event, approvalId, edits) => {
  try {
    if (!workflowApprover) {
      return { success: false, error: 'Approver not initialized' };
    }
    
    await workflowApprover.approveAction(approvalId, edits);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to approve action:', error);
    return { success: false, error: error.message };
  }
});

// Reject action
ipcMain.handle('microsoft:rejectAction', async (event, approvalId) => {
  try {
    if (!workflowApprover) {
      return { success: false, error: 'Approver not initialized' };
    }
    
    await workflowApprover.rejectApproval(approvalId);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to reject action:', error);
    return { success: false, error: error.message };
  }
});
\`\`\`

### 4. Integrate with Slack workflow detection:

When a workflow is detected that needs calendar/email, request approval:

\`\`\`javascript
// In your Slack message handler
if (needsCalendarEvent) {
  const suggestedEvent = {
    subject: "Meeting about " + workflow.title,
    startTime: extractedDateTime,
    endTime: calculateEndTime(extractedDateTime, 30),
    attendees: extractedEmails,
    isOnlineMeeting: true,
    body: workflow.description
  };
  
  await workflowApprover.requestCalendarApproval(workflow, suggestedEvent);
}

if (needsEmail) {
  const suggestedEmail = {
    to: extractedEmails,
    subject: "Task Assignment: " + workflow.title,
    body: generateEmailBody(workflow),
    importance: workflow.priority === 'urgent' ? 'high' : 'normal'
  };
  
  await workflowApprover.requestEmailApproval(workflow, suggestedEmail);
}
\`\`\`

## How It Works:

1. **Workflow Detection**: Slack message is analyzed
2. **AI Determines**: Needs calendar event or email
3. **Request Approval**: Shows modal to user with preview
4. **User Reviews**: Can edit subject, body, attendees
5. **User Approves**: Action is executed via Microsoft Graph API
6. **Confirmation**: User sees success message

## Testing:

1. Send a Slack message: "Schedule a meeting with john@company.com tomorrow at 2pm to discuss the API"
2. HeyJarvis detects it needs a calendar event
3. Approval modal appears with pre-filled details
4. Review and click "Approve & Send"
5. Calendar event is created in Outlook!
`;

fs.writeFileSync(
  path.join(__dirname, '../MICROSOFT_APPROVAL_INTEGRATION.md'),
  instructions
);

console.log('✅ Integration instructions created');

console.log('\n🎉 Microsoft 365 approval system added!');
console.log('\n📝 Next steps:');
console.log('   1. Read: MICROSOFT_APPROVAL_INTEGRATION.md');
console.log('   2. Add the code snippets to main.js');
console.log('   3. Restart HeyJarvis');
console.log('   4. Test with a Slack message!\n');
