#!/usr/bin/env node

/**
 * Update the task UI to display assignor and assignee information
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Updating UI to display assignor/assignee...\n');

const uiPath = path.join(__dirname, 'desktop/renderer/copilot-with-tasks.html');
let uiCode = fs.readFileSync(uiPath, 'utf8');

// Update the task rendering to include assignor/assignee display
const oldTaskHtml = `          \${task.description ? \`<div class="task-description">\${escapeHtml(task.description)}</div>\` : ''}
          <div class="task-meta">
            <span>Created \${formatDate(task.created_at)}</span>
          </div>`;

const newTaskHtml = `          \${task.description ? \`<div class="task-description">\${escapeHtml(task.description)}</div>\` : ''}
          <div class="task-meta">
            \${task.assignor ? \`<span class="task-assignor">👤 From: \${task.assignor.name || task.assignor.id}</span>\` : ''}
            \${task.assignee ? \`<span class="task-assignee">👉 Assigned to: \${task.assignee.name || task.assignee.id}</span>\` : ''}
            <span>Created \${formatDate(task.created_at)}</span>
          </div>`;

if (uiCode.includes(oldTaskHtml)) {
  uiCode = uiCode.replace(oldTaskHtml, newTaskHtml);
  console.log('✅ Updated task HTML to display assignor/assignee');
} else {
  console.log('⚠️  Task HTML already updated or structure changed');
}

// Add CSS for assignor/assignee styling
const cssInsertionPoint = uiCode.indexOf('      .task-meta {');
if (cssInsertionPoint > 0) {
  const newCss = `
      .task-assignor, .task-assignee {
        display: inline-block;
        margin-right: 12px;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
      }
      
      .task-assignee {
        background: rgba(34, 197, 94, 0.1);
        color: #22c55e;
      }

`;
  
  uiCode = uiCode.slice(0, cssInsertionPoint) + newCss + uiCode.slice(cssInsertionPoint);
  console.log('✅ Added CSS for assignor/assignee badges');
}

fs.writeFileSync(uiPath, uiCode);

console.log('\n✨ UI updated successfully!');
console.log('\nAssignor/assignee will now be displayed in task cards when available.');

