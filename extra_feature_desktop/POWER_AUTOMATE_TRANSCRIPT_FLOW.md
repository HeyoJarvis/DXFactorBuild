# 🤖 Power Automate: Automatic Teams Transcript to OneDrive

## Overview

This Power Automate flow automatically saves Microsoft Teams meeting transcripts (VTT format) to OneDrive after meetings end, making them available for your Team Sync Intelligence app to read and process.

## 📋 Prerequisites

1. **Microsoft 365 Account** with:
   - Teams license
   - OneDrive for Business
   - Power Automate (included in most M365 licenses)

2. **Permissions Required**:
   - `OnlineMeetings.Read.All` (to access meeting data)
   - `Files.ReadWrite` (to write to OneDrive)
   - `CallRecords.Read.All` (to know when meetings end)

## 🔧 Flow Configuration

### Method 1: Using Teams Meeting Recordings (Recommended)

This flow triggers when a Teams recording is processed and available.

#### Step-by-Step Setup:

1. **Go to Power Automate** (https://make.powerautomate.com)

2. **Create a new Automated Cloud Flow**:
   - Name: `Teams Transcript to OneDrive`
   - Trigger: `When a file is created (properties only)` (SharePoint)

3. **Configure the Trigger**:
   ```
   Site Address: [Your SharePoint site with Recordings library]
   Library Name: Recordings
   ```

4. **Add Action: Get file content**:
   ```
   Site Address: [Same as above]
   File Identifier: [File Identifier from trigger]
   ```

5. **Add Condition to check file type**:
   ```
   Condition: File Name
   Contains: .vtt
   ```

6. **If Yes - Create file in OneDrive**:
   ```
   File Name: [File name from trigger]
   File Content: [File content from Get file content]
   Folder Path: /Recordings
   ```

### Method 2: Using Graph API (Advanced)

This method directly queries the Microsoft Graph API for transcripts.

#### Create Flow with HTTP Premium Connector:

1. **Trigger**: `Recurrence`
   - Frequency: Every 30 minutes

2. **Action: HTTP - List recent meetings**:
   ```
   Method: GET
   URI: https://graph.microsoft.com/v1.0/me/onlineMeetings
   Authentication: Microsoft Entra ID OAuth
   Audience: https://graph.microsoft.com
   ```

3. **Parse JSON** to extract meeting IDs

4. **Apply to each meeting**:
   
   a. **HTTP - Get transcripts**:
   ```
   Method: GET
   URI: https://graph.microsoft.com/v1.0/communications/onlineMeetings/@{items('Apply_to_each')?['id']}/transcripts
   Authentication: Microsoft Entra ID OAuth
   ```

   b. **Condition**: Check if transcripts exist
   
   c. **If Yes - HTTP - Get transcript content**:
   ```
   Method: GET
   URI: https://graph.microsoft.com/v1.0/communications/onlineMeetings/@{items('Apply_to_each')?['id']}/transcripts/@{first(body('Parse_JSON_Transcripts')?['value'])?['id']}/content?$format=text/vtt
   Authentication: Microsoft Entra ID OAuth
   ```

   d. **Create file in OneDrive**:
   ```
   File Name: @{items('Apply_to_each')?['subject']}-Transcript-@{formatDateTime(utcNow(), 'yyyy-MM-dd')}.vtt
   File Content: @{body('Get_transcript_content')}
   Folder Path: /Recordings
   ```

## 📝 Simplified Flow (No Premium Connectors)

If you don't have premium connectors, use this simpler approach:

### Flow: Manual Transcript Upload Helper

1. **Trigger**: `For a selected file` (OneDrive)

2. **Get file content**:
   ```
   File: [Selected file]
   ```

3. **Condition**: Check if filename contains "transcript" or ends with .vtt

4. **If Yes**:
   - **Copy file**:
     ```
     Source: [Current location]
     Destination: /Recordings/
     New Name: @{triggerOutputs()?['body/Name']}
     ```

5. **Send notification**: 
   ```
   Send me an email notification
   Subject: "Transcript saved: @{triggerOutputs()?['body/Name']}"
   ```

## 🎯 Complete Premium Flow (JSON Export)

For advanced users, here's the complete JSON definition for Method 2:

```json
{
  "definition": {
    "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
    "contentVersion": "1.0.0.0",
    "triggers": {
      "Recurrence": {
        "type": "Recurrence",
        "recurrence": {
          "frequency": "Minute",
          "interval": 30
        }
      }
    },
    "actions": {
      "Get_Recent_Meetings": {
        "type": "Http",
        "inputs": {
          "method": "GET",
          "uri": "https://graph.microsoft.com/v1.0/me/onlineMeetings",
          "authentication": {
            "type": "ActiveDirectoryOAuth",
            "tenant": "@parameters('tenant_id')",
            "audience": "https://graph.microsoft.com",
            "clientId": "@parameters('client_id')",
            "secret": "@parameters('client_secret')"
          }
        },
        "runAfter": {}
      },
      "Parse_Meetings": {
        "type": "ParseJson",
        "inputs": {
          "content": "@body('Get_Recent_Meetings')",
          "schema": {
            "type": "object",
            "properties": {
              "value": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "id": { "type": "string" },
                    "subject": { "type": "string" },
                    "startDateTime": { "type": "string" },
                    "endDateTime": { "type": "string" }
                  }
                }
              }
            }
          }
        },
        "runAfter": {
          "Get_Recent_Meetings": ["Succeeded"]
        }
      },
      "Apply_to_each_meeting": {
        "type": "Foreach",
        "foreach": "@body('Parse_Meetings')?['value']",
        "actions": {
          "Check_if_meeting_ended": {
            "type": "If",
            "expression": {
              "and": [
                {
                  "less": [
                    "@items('Apply_to_each_meeting')?['endDateTime']",
                    "@utcNow()"
                  ]
                }
              ]
            },
            "actions": {
              "Get_Transcripts": {
                "type": "Http",
                "inputs": {
                  "method": "GET",
                  "uri": "https://graph.microsoft.com/v1.0/communications/onlineMeetings/@{items('Apply_to_each_meeting')?['id']}/transcripts",
                  "authentication": {
                    "type": "ActiveDirectoryOAuth",
                    "tenant": "@parameters('tenant_id')",
                    "audience": "https://graph.microsoft.com",
                    "clientId": "@parameters('client_id')",
                    "secret": "@parameters('client_secret')"
                  }
                }
              },
              "Parse_Transcripts": {
                "type": "ParseJson",
                "inputs": {
                  "content": "@body('Get_Transcripts')",
                  "schema": {
                    "type": "object",
                    "properties": {
                      "value": {
                        "type": "array"
                      }
                    }
                  }
                },
                "runAfter": {
                  "Get_Transcripts": ["Succeeded"]
                }
              },
              "Check_if_transcripts_exist": {
                "type": "If",
                "expression": {
                  "and": [
                    {
                      "greater": [
                        "@length(body('Parse_Transcripts')?['value'])",
                        0
                      ]
                    }
                  ]
                },
                "actions": {
                  "Get_Transcript_Content": {
                    "type": "Http",
                    "inputs": {
                      "method": "GET",
                      "uri": "https://graph.microsoft.com/v1.0/communications/onlineMeetings/@{items('Apply_to_each_meeting')?['id']}/transcripts/@{first(body('Parse_Transcripts')?['value'])?['id']}/content?$format=text/vtt",
                      "authentication": {
                        "type": "ActiveDirectoryOAuth",
                        "tenant": "@parameters('tenant_id')",
                        "audience": "https://graph.microsoft.com",
                        "clientId": "@parameters('client_id')",
                        "secret": "@parameters('client_secret')"
                      }
                    }
                  },
                  "Create_OneDrive_File": {
                    "type": "ApiConnection",
                    "inputs": {
                      "host": {
                        "connection": {
                          "name": "@parameters('$connections')['onedrive']['connectionId']"
                        }
                      },
                      "method": "post",
                      "body": "@body('Get_Transcript_Content')",
                      "path": "/datasets/default/files",
                      "queries": {
                        "folderPath": "/Recordings",
                        "name": "@{items('Apply_to_each_meeting')?['subject']}-Transcript-@{formatDateTime(utcNow(), 'yyyy-MM-dd-HHmm')}.vtt",
                        "queryParametersSingleEncoded": true
                      }
                    },
                    "runAfter": {
                      "Get_Transcript_Content": ["Succeeded"]
                    }
                  }
                },
                "runAfter": {
                  "Parse_Transcripts": ["Succeeded"]
                }
              }
            }
          }
        },
        "runAfter": {
          "Parse_Meetings": ["Succeeded"]
        }
      }
    }
  }
}
```

## 📁 Expected File Structure

Your Power Automate flow should create files in OneDrive with this structure:

```
OneDrive/
└── Recordings/
    ├── Project Standup-Transcript-2025-10-22-1430.vtt
    ├── Client Meeting-Transcript-2025-10-22-1530.vtt
    └── Team Sync-Transcript-2025-10-22-1630.vtt
```

### File Naming Convention

Use this format for compatibility with your app:
```
{Meeting Title}-Transcript-{Date}.vtt
```

Example:
- ✅ `Weekly Standup-Transcript-2025-10-22.vtt`
- ✅ `Client Review-Transcript.vtt`
- ✅ `standup-Transcript.vtt`
- ❌ `Meeting_Recording.mp4` (not a transcript file)

## 🔐 Azure AD App Registration (For HTTP Connector)

If using Method 2, you need to register an Azure AD app:

1. **Go to Azure Portal** → Azure Active Directory → App Registrations

2. **New Registration**:
   - Name: `Power Automate Teams Transcripts`
   - Supported account types: Single tenant
   - Redirect URI: (leave blank)

3. **API Permissions**:
   - Microsoft Graph → Delegated permissions:
     - `OnlineMeetings.Read`
     - `CallRecords.Read.All`
     - `Files.ReadWrite`
   - Click "Grant admin consent"

4. **Certificates & Secrets**:
   - New client secret
   - Copy the secret value (you'll need this in Power Automate)

5. **Copy these values for Power Automate**:
   - Application (client) ID
   - Directory (tenant) ID
   - Client secret value

## 🧪 Testing the Flow

### Test Scenario:

1. **Schedule a test meeting**:
   ```
   Title: "Power Automate Test Meeting"
   Duration: 5 minutes
   Enable: Recording + Transcription
   ```

2. **During the meeting**:
   - Start recording
   - Speak for at least 2-3 minutes
   - Stop recording and end meeting

3. **Wait for processing**:
   - ~15-30 minutes for Microsoft to process transcript

4. **Check Power Automate**:
   - Go to Power Automate → My flows
   - Check run history for your flow
   - Should show "Succeeded"

5. **Verify in OneDrive**:
   ```
   OneDrive → Recordings folder
   Should contain: "Power Automate Test Meeting-Transcript-{date}.vtt"
   ```

6. **Verify in your app**:
   - Your app will automatically detect this file during the next sync (every 15 minutes)
   - Or manually trigger: `node force-sync-meetings.js`

## 🎯 Integration with Your App

Your app's `AutomatedTranscriptService` already has the fallback logic (lines 401-518):

```javascript
// From AutomatedTranscriptService.js
async _fetchFromOneDrive(userId, meeting) {
  // 1. First checks /Recordings folder
  searchResult = await client
    .api('/me/drive/root:/Recordings:/children')
    .select('id,name,createdDateTime,file')
    .get();
  
  // 2. Filters for transcript files only
  const transcriptFiles = searchResult.value.filter(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.vtt') ||  // ✅ Your Power Automate files
           name.endsWith('.docx') ||
           name.endsWith('.txt') ||
           name.endsWith('.srt');
  });
  
  // 3. Downloads and saves to database
  // ...
}
```

## ✅ What Happens Automatically

Once set up, this is the complete workflow:

1. **Meeting ends** → Teams processes recording
2. **~20 minutes later** → Transcript ready in Teams
3. **Power Automate triggers** → Downloads VTT file
4. **Saves to OneDrive** → `/Recordings` folder
5. **Your app syncs** (every 15 min) → Detects new file
6. **Reads transcript** → Saves to database
7. **Available in Team Chat** → Searchable context! 🎉

## 🚨 Troubleshooting

### Flow Not Triggering

**Check**:
- Flow is turned ON
- Recurrence is set correctly
- Authentication is valid

**Fix**: Test manually with "Test" button

### Transcripts Not Found

**Check**:
- Meeting had recording enabled
- Transcription was enabled in Teams settings
- Enough time passed (20-30 minutes)

**Fix**: Run flow history to see specific errors

### Permission Errors

**Check**:
- Azure AD app has correct permissions
- Admin consent granted
- Client secret hasn't expired

**Fix**: Regenerate client secret and update flow

### File Not Appearing in OneDrive

**Check**:
- OneDrive connector is properly authenticated
- `/Recordings` folder exists
- You have write permissions

**Fix**: Create `/Recordings` folder manually

## 📊 Monitoring

### Check Flow Runs:
```
Power Automate → My flows → [Your flow] → Run History
```

### Check Your App Logs:
```bash
tail -f /home/sdalal/test/BeachBaby/extra_feature_desktop/logs/transcript-service.log
```

Should show:
```
INFO: Searching OneDrive for transcript
INFO: Found transcript file in OneDrive: "Meeting-Transcript.vtt"
INFO: Transcript downloaded from OneDrive
```

## 🎓 Advanced Options

### Option 1: Immediate Notification
Add a step to send yourself an email when a transcript is saved:
```
Action: Send an email (V2)
To: [Your email]
Subject: "New transcript: @{items('Apply_to_each_meeting')?['subject']}"
Body: "Transcript saved to OneDrive/Recordings/"
```

### Option 2: Copilot Notes
Also extract Copilot meeting notes:
```
Method: GET
URI: https://graph.microsoft.com/v1.0/communications/onlineMeetings/@{items('Apply_to_each_meeting')?['id']}/transcripts/@{transcriptId}
```
Then save the `recap` or `summary` fields to a separate file.

### Option 3: Teams Channel Notification
Post to a Teams channel when transcripts are ready:
```
Action: Post message in a chat or channel
Team: [Your team]
Channel: [Your channel]
Message: "📝 New transcript available: @{items('Apply_to_each_meeting')?['subject']}"
```

## 📚 Resources

- [Microsoft Graph API - Transcripts Overview](https://learn.microsoft.com/en-us/graph/api/resources/calltranscript)
- [Power Automate - HTTP Connector](https://learn.microsoft.com/en-us/connectors/http/)
- [OneDrive Connector Reference](https://learn.microsoft.com/en-us/connectors/onedrive/)
- [Teams Meeting Transcripts](https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/meeting-transcripts/overview-transcripts)

---

## 🎯 Quick Start Checklist

- [ ] Create Power Automate account
- [ ] Choose a method (1 or 2)
- [ ] Set up Azure AD app (if using Method 2)
- [ ] Create the flow in Power Automate
- [ ] Test with a sample meeting
- [ ] Verify file appears in OneDrive/Recordings
- [ ] Confirm your app detects and processes it
- [ ] Enable the flow for production use

**Estimated Setup Time**: 30-45 minutes

**Status**: Ready to automate! 🚀

