#!/usr/bin/env node

/**
 * Update desktop Supabase adapter to support assignor/assignee fields
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Updating Supabase adapter for assignment tracking...\n');

const adapterPath = path.join(__dirname, 'desktop/main/supabase-adapter.js');
let adapterCode = fs.readFileSync(adapterPath, 'utf8');

// Update createTask method to include assignor and assignee
const oldMetadata = `          workflow_metadata: {
            priority: taskData.priority || 'medium',
            description: taskData.description || null,
            tags: taskData.tags || [],
            due_date: taskData.dueDate || null,
            parent_session_id: taskData.parentSessionId || null // Link to chat that spawned this task
          },`;

const newMetadata = `          workflow_metadata: {
            priority: taskData.priority || 'medium',
            description: taskData.description || null,
            tags: taskData.tags || [],
            due_date: taskData.dueDate || null,
            parent_session_id: taskData.parentSessionId || null, // Link to chat that spawned this task
            assignor: taskData.assignor || null, // Who assigned/created the task
            assignee: taskData.assignee || null, // Who the task is assigned to
            mentioned_users: taskData.mentionedUsers || [] // All mentioned users
          },`;

if (adapterCode.includes(oldMetadata)) {
  adapterCode = adapterCode.replace(oldMetadata, newMetadata);
  console.log('✅ Updated createTask method to store assignor/assignee');
} else {
  console.log('⚠️  createTask method already updated or structure changed');
}

// Update getUserTasks to include assignment info in transformed tasks
const oldTransform = `      const tasks = (data || []).map(session => ({
        id: session.id,
        user_id: session.user_id,
        title: session.session_title,
        description: session.workflow_metadata?.description || null,
        status: session.is_completed ? 'completed' : 'todo',
        priority: session.workflow_metadata?.priority || 'medium',
        tags: session.workflow_metadata?.tags || [],
        due_date: session.workflow_metadata?.due_date || null,
        parent_session_id: session.workflow_metadata?.parent_session_id || null,
        created_at: session.started_at,
        updated_at: session.last_activity_at,
        completed_at: session.completed_at
      }));`;

const newTransform = `      const tasks = (data || []).map(session => ({
        id: session.id,
        user_id: session.user_id,
        title: session.session_title,
        description: session.workflow_metadata?.description || null,
        status: session.is_completed ? 'completed' : 'todo',
        priority: session.workflow_metadata?.priority || 'medium',
        tags: session.workflow_metadata?.tags || [],
        due_date: session.workflow_metadata?.due_date || null,
        parent_session_id: session.workflow_metadata?.parent_session_id || null,
        assignor: session.workflow_metadata?.assignor || null,
        assignee: session.workflow_metadata?.assignee || null,
        mentioned_users: session.workflow_metadata?.mentioned_users || [],
        created_at: session.started_at,
        updated_at: session.last_activity_at,
        completed_at: session.completed_at
      }));`;

if (adapterCode.includes(oldTransform)) {
  adapterCode = adapterCode.replace(oldTransform, newTransform);
  console.log('✅ Updated getUserTasks to return assignor/assignee');
} else {
  console.log('⚠️  getUserTasks transform already updated or structure changed');
}

// Update updateTask to handle assignor/assignee updates
const oldUpdateCheck = `      if (updates.priority || updates.description || updates.tags || updates.dueDate) {`;
const newUpdateCheck = `      if (updates.priority || updates.description || updates.tags || updates.dueDate || updates.assignor || updates.assignee) {`;

if (adapterCode.includes(oldUpdateCheck) && !adapterCode.includes(newUpdateCheck)) {
  adapterCode = adapterCode.replace(oldUpdateCheck, newUpdateCheck);
  
  // Add assignment field updates
  const oldUpdateFields = `        if (updates.priority) metadata.priority = updates.priority;
        if (updates.description !== undefined) metadata.description = updates.description;
        if (updates.tags) metadata.tags = updates.tags;
        if (updates.dueDate !== undefined) metadata.due_date = updates.dueDate;`;
  
  const newUpdateFields = `        if (updates.priority) metadata.priority = updates.priority;
        if (updates.description !== undefined) metadata.description = updates.description;
        if (updates.tags) metadata.tags = updates.tags;
        if (updates.dueDate !== undefined) metadata.due_date = updates.dueDate;
        if (updates.assignor !== undefined) metadata.assignor = updates.assignor;
        if (updates.assignee !== undefined) metadata.assignee = updates.assignee;`;
  
  adapterCode = adapterCode.replace(oldUpdateFields, newUpdateFields);
  console.log('✅ Updated updateTask to handle assignor/assignee changes');
} else {
  console.log('⚠️  updateTask already updated');
}

fs.writeFileSync(adapterPath, adapterCode);

console.log('\n✨ Supabase adapter updated successfully!');

