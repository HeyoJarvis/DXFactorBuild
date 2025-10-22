# AI Response Balance Fix

## 🐛 User Feedback

> "Why is my hi giving all this information. It doesnt make sense"

**Problem**: User says "Hi" and gets a huge detailed response dumping all context (meetings, JIRA tasks, code) instead of a simple greeting.

## 🔍 Root Cause

### Over-Aggressive Prompt

The previous AI prompt was too aggressive:

```
IMPORTANT: Don't just describe capabilities - use the actual context provided to give 
specific, detailed answers about what's happening with the team, projects, and work.

Question: Hi

Please provide a specific, detailed answer using the meeting information, JIRA task 
details, and code context provided above. Reference actual meetings, tasks, and 
details from the context.
```

This made the AI think "Hi" means "tell me everything about the team!"

## ✅ Fix Applied

**File**: `main/services/TeamContextEngine.js` (lines 230-267)

### Before ❌ - Over-Aggressive
```javascript
const systemPrompt = `...
IMPORTANT: Don't just describe capabilities - use the actual context provided to give 
specific, detailed answers about what's happening with the team, projects, and work.`;

messages: [{
  content: `Team Context:
${context}

Question: ${question}

Please provide a specific, detailed answer using the meeting information, JIRA task 
details, and code context provided above. Reference actual meetings, tasks, and 
details from the context.`
}]
```

**Result**: AI dumps all context for simple greetings

### After ✅ - Balanced

```javascript
const systemPrompt = `You are an intelligent team assistant with access to comprehensive team information including:
- Meeting summaries, decisions, and action items
- JIRA tasks with descriptions, status, and assignments
- GitHub code activity and repository information

Your role is to:
1. **Respond naturally**: Answer the user's question appropriately - simple questions get simple answers
2. **Use context when relevant**: Only reference meetings, tasks, and code when they're relevant to the question
3. **Be conversational**: Greetings get greetings, questions get answers
4. **Be specific when needed**: When asked about work, reference actual task titles, assignees, and details
5. **Don't over-explain**: Only provide the information the user is asking for

Examples:
- "Hi" or "Hello" → Give a friendly greeting and briefly mention you have context available if they need it
- "What's the status?" → Use the context to give specific details about meetings, tasks, and progress
- "What did we discuss in the meeting?" → Reference actual meeting content
- "What are the JIRA tasks?" → List specific tasks with details`;

messages: [{
  content: `You have access to the following team context:

${context}

User's question: ${question}

Please answer naturally and appropriately. Use the context only when it's relevant to answering their specific question.`
}]
```

**Result**: AI responds appropriately to the actual question

## 📊 Expected Behavior

### Simple Greeting

**User**: "Hi"

**Before Fix** ❌:
```
Hi! Based on the available context, I can see that this appears to be an AI startup 
team with some interesting developments in progress. Let me break down what I know:

From the most recent meeting (10/18/2025 standup):
- The founders Avinash and Shail are working with Ryan on an enterprise AI adoption product
- They've identified Deloitte as their initial pilot customer
- They're specifically targeting consulting firms as their first market
[... 500 more words ...]
```

**After Fix** ✅:
```
Hi! I'm here to help with your team's work. I have access to recent meetings, JIRA 
tasks, and code information. What would you like to know?
```

### Specific Question

**User**: "What JIRA tasks are assigned to Shail?"

**Before & After** ✅ (both work):
```
Based on the JIRA context, Shail has one active task:

- "Add a 'Surprise Me' button for cat facts"
  Status: In Progress
  Priority: Medium
  Project: Web Platform

This task is currently being worked on.
```

### Status Question

**User**: "What's the status?"

**Before & After** ✅ (both work):
```
Here's a quick status update:

Meeting Updates:
- Most recent meeting was the 10/18/2025 standup where the team discussed targeting 
  Deloitte as a pilot customer for the enterprise AI product

JIRA Tasks:
- 1 active task assigned to Shail (in progress)

The team is actively working on both business development and product features.
```

## 🎯 AI Response Guidelines

### When to Use Minimal Context

**Triggers**:
- Greetings: "Hi", "Hello", "Hey"
- Simple acknowledgments: "Thanks", "OK"
- Small talk: "How are you?", "What's up?"

**Response**: Friendly, brief, mention context availability

### When to Use Full Context

**Triggers**:
- Status questions: "What's the status?", "Any updates?"
- Specific queries: "What did we discuss?", "What tasks are open?"
- Named references: "What's Shail working on?", "Tell me about the meeting"

**Response**: Use relevant context, be specific

### Balance Principle

> **The AI should match the user's energy and intent**
> - Casual question → Casual answer
> - Detailed question → Detailed answer
> - Greeting → Greeting

## ✅ Status

**FIXED** - AI now responds appropriately:

1. ✅ Simple greetings get simple responses
2. ✅ Context used only when relevant to question
3. ✅ Detailed questions still get detailed answers
4. ✅ Natural conversation flow maintained
5. ✅ Examples provided to guide AI behavior

### Impact

- **User experience**: No more overwhelming data dumps for simple messages
- **Conversation flow**: More natural, appropriate responses
- **Context usage**: Still rich and detailed when actually needed
- **Flexibility**: Works for both casual chat and detailed queries

---

**Fix Date**: October 21, 2025
**Issue**: AI dumping all context for simple greetings
**Resolution**: Balanced prompt with examples and "respond naturally" guidance

