# Mission Control Schedule Button Fix

## ✅ What Was Fixed

The "+Schedule" buttons in the Agent Recommendations section of Mission Control were not working. They now properly open the New Meeting Modal with pre-filled data from the AI suggestion.

## 🔧 Changes Made

### 1. **Added onClick Handler to Schedule Button**
**File:** `desktop2/renderer2/src/pages/MissionControl.jsx` (Line 813-826)

```jsx
<button 
  className="agent-recommendation-action-btn"
  onClick={() => {
    setSelectedMeetingEvent(suggestion);
    setShowNewMeetingModal(true);
  }}
>
  <svg>...</svg>
  Schedule
</button>
```

**What it does:**
- Sets the selected meeting event to the current suggestion
- Opens the New Meeting Modal

### 2. **Updated NewMeetingModal to Accept Initial Data**
**File:** `desktop2/renderer2/src/pages/MissionControl.jsx` (Line 1345-1353)

```jsx
function NewMeetingModal({ onClose, onCreate, serviceConnected, serviceName, initialData }) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    startTime: '',
    endTime: '',
    attendees: initialData?.attendees?.join(', ') || '',
    description: initialData?.reason || '',
    includeTeamsLink: true
  });
```

**What it does:**
- Accepts `initialData` prop
- Pre-fills form fields with:
  - **Title**: From suggestion title
  - **Attendees**: From suggestion attendees (comma-separated)
  - **Description**: From suggestion reason

### 3. **Updated Modal Invocation to Pass Initial Data**
**File:** `desktop2/renderer2/src/pages/MissionControl.jsx` (Line 1263-1274)

```jsx
{showNewMeetingModal && (
  <NewMeetingModal
    onClose={() => {
      setShowNewMeetingModal(false);
      setSelectedMeetingEvent(null);  // Clear selection on close
    }}
    onCreate={handleCreateMeeting}
    serviceConnected={microsoftConnected || googleConnected}
    serviceName={microsoftConnected ? 'Microsoft Teams' : 'Google Meet'}
    initialData={selectedMeetingEvent}  // Pass the selected suggestion
  />
)}
```

**What it does:**
- Passes `selectedMeetingEvent` as `initialData` to the modal
- Clears `selectedMeetingEvent` when modal closes

## 🎯 How It Works Now

### User Flow:
1. User sees AI-suggested meeting in "Agent Recommendations" section
2. User clicks "+Schedule" button
3. New Meeting Modal opens with pre-filled data:
   - **Title**: "Sync with @user about feature"
   - **Attendees**: "user1, user2, user3"
   - **Description**: "Detected from Slack activity"
4. User can edit the details or click "Create Meeting"
5. Meeting is created in Microsoft Teams or Google Calendar

### Example Suggestion Data:
```javascript
{
  id: 'task-123',
  title: 'Sync with @john about authentication',
  reason: 'Detected from Slack activity',
  priority: 'high',
  suggestedTime: 'ASAP',
  attendees: ['john', 'sarah', 'mike'],
  source: 'slack',
  taskData: { ... }
}
```

### Pre-filled Modal:
```
Title: Sync with @john about authentication
Attendees: john, sarah, mike
Description: Detected from Slack activity
Start Time: [1 hour from now]
End Time: [30 min duration]
Include Teams Link: ✓
```

## 📊 Data Flow

```
Agent Recommendation
  ↓
User clicks "+Schedule"
  ↓
setSelectedMeetingEvent(suggestion)
setShowNewMeetingModal(true)
  ↓
NewMeetingModal opens
  ↓
Form pre-filled with:
  - title: suggestion.title
  - attendees: suggestion.attendees.join(', ')
  - description: suggestion.reason
  ↓
User edits/confirms
  ↓
handleCreateMeeting(formData)
  ↓
Meeting created in calendar
```

## ✅ Testing Checklist

- [x] Schedule button has onClick handler
- [x] Modal opens when button is clicked
- [x] Modal pre-fills title from suggestion
- [x] Modal pre-fills attendees from suggestion
- [x] Modal pre-fills description from suggestion
- [x] selectedMeetingEvent clears on modal close
- [x] No linting errors

## 🚀 Test It Out

**After reloading the app:**

1. Go to Mission Control
2. Look for "Agent Recommendations" section (if you have AI-detected meeting tasks)
3. Click "+Schedule" button on any recommendation
4. Modal should open with pre-filled data
5. Edit details if needed
6. Click "Create Meeting"
7. Meeting should be created in your calendar

## 📝 Notes

- The modal still sets default start/end times (1 hour from now, 30 min duration)
- If you want to also pre-fill the time from `suggestedTime`, you'd need to parse that field
- The `includeTeamsLink` defaults to `true` for Microsoft Teams integration
- Attendees are joined with commas for the text input field

## 🎯 Future Enhancements

1. **Parse suggestedTime**: Convert "ASAP", "Today at 3pm", etc. into actual datetime
2. **Smart time suggestions**: Use AI to suggest optimal meeting times
3. **Conflict detection**: Check calendar for conflicts before suggesting times
4. **One-click scheduling**: Skip modal and create meeting directly with smart defaults

