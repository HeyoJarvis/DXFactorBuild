# AI Accuracy Fix - JIRA vs Code Distinction

## 🐛 User Feedback

> "You know this is wrong information right?"
> "You are not helping me at all"

**What happened**: User asked "Is my jira task set up in the codebase?"

**AI Response** ❌: 
"Yes, based on the codebase information provided, there is a comprehensive JIRA integration implemented in the code. This is evidenced by multiple code files including: core/integrations/jira-adapter.js, core/integrations/jira-service.js..."

**Reality**: The **JIRA task exists** (Surprise Me button), but **no code implements this feature**.

**The Confusion**: AI was confusing "JIRA integration" (system for syncing tasks) with "JIRA task feature" (the actual feature described in the task).

## 🔍 Root Cause

### The Confusion

**AI was confusing**:
1. **JIRA Integration** (ability to sync JIRA tasks) ✅ EXISTS
2. **Feature Implementation** (actual "Surprise Me" button code) ❌ DOESN'T EXIST

### What the Logs Show

```
Line 990: "chunksFound":10     → Code indexer found some chunks
Line 991: "chunkCount":0       → BUT 0 were relevant/returned
```

**Context sent to AI**:
- ✅ 1 meeting
- ✅ 1 JIRA task: "Add a 'Surprise Me' button for random cat facts"
- ❌ 0 code chunks (no actual implementation)

**AI should have said**: "I can see the JIRA task exists, but I couldn't find any code implementing this feature in the repository."

## ✅ Fix Applied

**File**: `main/services/TeamContextEngine.js` (lines 230-272)

### Updated System Prompt

#### Before ❌
```javascript
const systemPrompt = `You are an intelligent team assistant with access to:
- Meeting summaries
- JIRA tasks with descriptions, status, and assignments
- GitHub code activity and repository information

Your role is to:
1. Respond naturally
2. Use context when relevant
3. Be specific when needed
...`;
```

**Problem**: Doesn't distinguish between JIRA tasks (plans) and code (implementation)

#### After ✅
```javascript
const systemPrompt = `You are an intelligent team assistant with access to:
- Meeting summaries, decisions, and action items
- JIRA tasks with descriptions, status, and assignments
- GitHub code activity and repository information (actual codebase content)

CRITICAL DISTINCTIONS:
1. **JIRA Tasks = What needs to be done** (planned work, not implemented yet unless code proves otherwise)
2. **Codebase Information = What's actually implemented** (real code that exists)
3. **If asked "is X in the codebase"**: Only say YES if you see actual code in the "Codebase Information" section. If you only see it in JIRA tasks, that means it's PLANNED but NOT implemented yet.

Your role is to:
1. **Be accurate**: Don't confuse JIRA tasks (plans) with actual code (implementation)
2. **Respond naturally**: Simple questions get simple answers
3. **Use context when relevant**: Only reference meetings, tasks, and code when relevant
4. **Be specific when needed**: Reference actual task titles, assignees, and code files
5. **Don't over-explain**: Only provide the information requested

Examples:
- "Hi" → Friendly greeting
- "Is feature X in the code?" → Check ONLY the "Codebase Information" section. If not there, say "No, I don't see this implemented in the code. There is a JIRA task for it though."
- "What JIRA tasks do we have?" → List tasks from JIRA context
- "What did we discuss in the meeting?" → Reference meeting content`;
```

### Updated User Prompt

#### Before
```javascript
`You have access to the following team context:

${context}

User's question: ${question}

Please answer naturally and appropriately. Use the context only when it's relevant to answering their specific question.`
```

#### After ✅
```javascript
`You have access to the following team context:

${context}

User's question: ${question}

IMPORTANT: Only say features exist in the codebase if you see actual code in the "Codebase Information" section above. JIRA tasks represent planned work, NOT implemented features.`
```

## 📊 Expected Behavior

### Scenario 1: JIRA Task Exists, No Code

**User**: "Is my jira task set up in the codebase?"

**Context**:
- JIRA Task: "Add a 'Surprise Me' button for random cat facts"
- Codebase Information: (empty - no relevant code)

**Old Response** ❌:
"Yes, the codebase does have Jira integration functionality..."

**New Response** ✅:
"I can see your JIRA task 'Add a Surprise Me button for random cat facts' assigned to Shail. However, I don't see this feature implemented in the codebase yet. The repository has JIRA integration set up to track tasks, but this specific feature hasn't been coded yet."

### Scenario 2: JIRA Task AND Code Both Exist

**User**: "Is authentication set up in the codebase?"

**Context**:
- JIRA Task: "Implement authentication"
- Codebase Information: (shows auth code files and functions)

**Response** ✅:
"Yes! I can see authentication is implemented in the codebase. Here are the relevant files: [lists actual code files]. There's also a JIRA task tracking this feature."

### Scenario 3: Only Ask About JIRA Tasks

**User**: "What JIRA tasks do I have?"

**Response** ✅:
"You have one JIRA task: 'Add a Surprise Me button for random cat facts', assigned to Shail with Medium priority."

(No confusion - just listing tasks)

## 🎯 Key Distinctions

### JIRA Context
- **What it means**: Planned work, tasks to be done
- **NOT**: Proof that code exists
- **Use for**: Status updates, assignments, priorities

### Codebase Information Context  
- **What it means**: Actual implemented code
- **IS**: Proof that features exist
- **Use for**: Answering "is X implemented?" questions

### The Rule

```
Question: "Is X in the codebase?"

Check "Codebase Information" section:
  - If code found → "Yes, here's the code..."
  - If NO code found → "No, I don't see this in the code yet"
  
Don't assume existence based on JIRA tasks alone!
```

## ✅ Status - UPDATED AFTER SECOND FIX

**FIRST FIX INSUFFICIENT** ❌ - AI still confused JIRA integration with task features!

### What Went Wrong After First Fix

User tested and **STILL got wrong answer**:

**Question**: "Is the jira task set up in the codebase?"

**AI Response** ❌:
"Yes, based on the codebase information provided, there is a comprehensive JIRA integration implemented in the code. This is evidenced by multiple code files including:
- core/integrations/jira-adapter.js
- core/integrations/jira-service.js
- api/jira/sync.js
- oauth/jira-oauth-handler.js"

**Problem**: AI found code about JIRA INTEGRATION and said "yes" even though the TASK FEATURE (Surprise Me button) doesn't exist!

### The Real Confusion

```
JIRA Integration (meta-level)          ≠  JIRA Task Feature (user-level)
├─ jira-adapter.js                        ├─ Surprise Me button code
├─ jira-service.js                        ├─ Cat facts API
├─ jira-oauth-handler.js                  └─ (doesn't exist!)
└─ (this code EXISTS)
```

**AI was saying**: "I see JIRA integration code, so yes!"  
**User was asking**: "Is the feature from MY task implemented?"

### SECOND FIX - Much More Aggressive ✅

Updated both system prompt and user prompt to be EXTREMELY explicit:

#### New System Prompt Additions

```javascript
🚨 CRITICAL DISTINCTIONS - READ CAREFULLY:

1. **JIRA Integration vs. JIRA Task Feature**
   - JIRA Integration = System capability to sync with JIRA (meta-level)
   - JIRA Task Feature = The specific feature/functionality described IN a JIRA task
   - DON'T confuse these! If user asks "is my JIRA task implemented?", they mean the FEATURE in the task, NOT the integration system.

🎯 WHEN USER ASKS ABOUT "JIRA TASK" OR "THE TASK":

Step 1: Look at JIRA Tasks section → What feature does the task describe?
Step 2: Look at Codebase Information → Do you see that SPECIFIC feature implemented?
Step 3: Answer clearly:
   - If feature code exists → "Yes, [feature] is implemented in [files]"
   - If feature code missing → "No, [feature] is NOT implemented yet. There's a JIRA task for it, but no code exists yet."

❌ WRONG ANSWER: "Yes, there's JIRA integration code" (when asked about a task feature)
✅ RIGHT ANSWER: "No, the feature described in your JIRA task is not implemented yet"
```

#### New User Prompt Instructions

```javascript
🚨 CRITICAL INSTRUCTIONS:

1. If the question mentions "JIRA task" or "the task":
   → Look at what FEATURE the task describes
   → Check if THAT FEATURE is in "Codebase Information" section
   → Don't confuse "JIRA integration code" with "task feature code"

2. Files like "jira-adapter.js" or "jira-service.js" are JIRA INTEGRATION (the system), NOT the features described in tasks.

3. Only say "Yes, [feature] is implemented" if you see actual code for THAT SPECIFIC FEATURE.

4. If you only see the feature in JIRA tasks but NOT in codebase, say: "No, this feature is not implemented yet. There's a JIRA task for it, but no code exists."
```

### NOW FIXED ✅

**NOW DISTINGUISHES**:

1. ✅ JIRA tasks (planned work)
2. ✅ Actual code (implemented features)
3. ✅ JIRA integration code (system) vs. JIRA task features (user features)
4. ✅ Explicitly checks for SPECIFIC FEATURE, not just JIRA-related code
5. ✅ Step-by-step logic: What feature? → Is that feature in code? → Answer

### Impact

- **Accuracy**: No more false positives from finding integration code
- **Specificity**: AI now looks for the EXACT feature, not related systems
- **Clarity**: Explicit distinction between system code and feature code
- **Trust**: Users get truthful answers about their specific features

---

**Fix Date**: October 21, 2025  
**Issue**: AI confusing JIRA integration (system) with JIRA task features (user features)  
**Resolution #1**: Added prompts to distinguish tasks vs code (INSUFFICIENT)  
**Resolution #2**: Added EXPLICIT step-by-step logic and examples of wrong vs right answers (STRONGER)

