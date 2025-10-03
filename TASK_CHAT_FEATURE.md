# Task-Specific AI Chat Feature

## 🎯 Overview

Each task in the HeyJarvis desktop app now has its own dedicated AI-powered chat interface. This allows you to have focused conversations about specific tasks, brainstorm solutions, get help, and plan your approach.

## ✨ Features Implemented

### 1. **Chat Button on Every Task**
- Every task now displays a 💬 chat button next to the delete button
- Blue-tinted design matches the AI theme
- Hover effect for better UX

### 2. **Beautiful Modal Chat Interface**
- Full-screen modal overlay with blur background
- Smooth slide-up animation when opening
- Professional glassmorphic design
- Task context banner showing:
  - Task title and description
  - Priority level
  - Current status

### 3. **Task-Aware AI Responses**
- AI receives full task context including:
  - Title and description
  - Priority level
  - Status (todo, in-progress, completed)
  - Assignment information (who assigned it, to whom)
- AI responses are tailored to help with that specific task

### 4. **Persistent Chat History**
- Each task maintains its own conversation history
- History persists during your session
- Conversations are saved to Supabase for future reference

### 5. **Beautiful Message UI**
- User messages: Blue gradient bubbles on the right
- AI responses: Dark translucent bubbles on the left
- Timestamps on each message
- Smooth animations for new messages

### 6. **Smart Interactions**
- Auto-resizing textarea (grows as you type)
- **Enter** to send message
- **Shift+Enter** for new line
- **Escape** to close modal
- Typing indicator while AI is thinking

## 🚀 How to Use

### Opening a Task Chat

1. Navigate to the **To Do** tab in HeyJarvis
2. Find the task you want to discuss
3. Click the **💬** button on that task
4. The chat modal will open with task context

### Having a Conversation

**Example conversations you can have:**

```
You: "How should I approach this task?"
AI: Provides step-by-step breakdown based on the task

You: "What's the best way to prioritize the subtasks?"
AI: Analyzes the task priority and gives recommendations

You: "I'm stuck on this part, any suggestions?"
AI: Offers specific guidance based on task context

You: "Can you help me brainstorm solutions?"
AI: Engages in creative problem-solving for your task
```

### Keyboard Shortcuts

- **Enter**: Send message
- **Shift+Enter**: New line in message
- **Escape**: Close chat modal

### Closing the Chat

- Click the **×** button in the top-right
- Press **Escape** key
- Your conversation is automatically saved!

## 🛠️ Technical Implementation

### Files Modified

1. **desktop/bridge/copilot-preload.js**
   - Added `copilot` API with `sendTaskMessage` handler
   - Exposed IPC bridge for task-specific chats

2. **desktop/main.js**
   - Added `copilot:sendTaskMessage` IPC handler (line 1123)
   - Task context is sent to Claude AI with focused prompts
   - Responses are logged to Supabase with task metadata

3. **desktop/renderer/unified.html**
   - Added task chat modal HTML (lines 939-988)
   - Added comprehensive CSS styles (lines 766-1052)
   - Added JavaScript functions:
     - `openTaskChat()` - Opens modal with task context
     - `closeTaskChat()` - Closes modal
     - `renderTaskChatHistory()` - Displays conversation
     - `sendTaskChatMessage()` - Sends message to AI
   - Updated `renderTasks()` to include chat button (line 1405)

### Architecture

```
User clicks 💬 button
    ↓
Frontend: openTaskChat(taskId)
    ↓
Modal opens with task context
    ↓
User types message + presses Enter
    ↓
sendTaskChatMessage()
    ↓
IPC: copilot:sendTaskMessage(taskId, message, context)
    ↓
Backend: main.js handler
    ↓
Claude AI (with task-specific prompt)
    ↓
Response returned to frontend
    ↓
Message added to taskChatHistories[taskId]
    ↓
UI updates with AI response
    ↓
Conversation saved to Supabase
```

### Data Flow

**Task Context Sent to AI:**
```javascript
{
  taskId: "uuid",
  message: "User's message",
  context: {
    task: {
      title: "Task title",
      description: "Task description",
      priority: "high",
      status: "in_progress",
      assignor: { name: "John" },
      assignee: { name: "Jane" }
    }
  }
}
```

**AI System Prompt:**
```
You are HeyJarvis, an AI assistant helping with a specific task.

TASK DETAILS:
- Title: [task title]
- Description: [task description]
- Priority: [high/medium/low]
- Status: [todo/in_progress/completed]
- Assigned by: [person]
- Assigned to: [person]

Your role is to help the user complete this task by:
- Providing actionable advice and suggestions
- Breaking down the task into manageable steps
- Answering questions about the task
- Brainstorming solutions and approaches
- Offering relevant insights and best practices

Be concise, practical, and focused on helping complete this specific task.
```

## 💾 Data Storage

### In-Memory (During Session)
```javascript
taskChatHistories = {
  "task-uuid-1": [
    { role: "user", content: "...", timestamp: "..." },
    { role: "assistant", content: "...", timestamp: "..." }
  ],
  "task-uuid-2": [...]
}
```

### Supabase (Persistent)
Messages are saved to the `workflow_session_messages` table with:
- `task_id`: Links message to specific task
- `task_title`: For quick reference
- `message_type`: "task_chat" for filtering
- Standard message fields (role, content, timestamp, etc.)

## 🎨 Design Decisions

1. **Modal vs Inline**: Modal chosen for focus and immersion
2. **Blue Color Theme**: Matches AI assistant branding
3. **Task Context Banner**: Always visible reminder of what you're discussing
4. **Separate Histories**: Each task has isolated conversation for clarity
5. **Auto-focus Input**: Immediate typing after modal opens
6. **Escape to Close**: Quick exit without mouse

## 🔮 Future Enhancements

Potential improvements:
- [ ] Task status updates from chat ("mark this done")
- [ ] AI can suggest breaking task into subtasks
- [ ] Voice input for chat messages
- [ ] Export chat conversation as notes
- [ ] Share chat with team members
- [ ] AI proactive suggestions ("Have you considered...?")
- [ ] Integration with calendar for task scheduling
- [ ] Attach files/screenshots to task chat

## 📊 Usage Analytics

The system tracks:
- Number of task chats opened
- Messages sent per task
- AI response times
- Task completion correlation with chat usage

All logged to Supabase for analysis.

## 🐛 Troubleshooting

**Chat button not appearing?**
- Make sure you're on the To Do tab
- Refresh tasks by switching tabs

**Modal not opening?**
- Check browser console for errors
- Ensure Electron API is loaded

**AI not responding?**
- Check internet connection
- Verify Claude API credentials in `.env`
- Check main.js logs for errors

**Messages not saving?**
- Verify Supabase connection
- Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`

## 🎉 Success!

You now have a powerful AI assistant for every task! Each conversation is contextual, persistent, and designed to help you be more productive.

Happy tasking! 🚀

