# 🎯 Microsoft Teams Auto-Recording Setup Guide

## Overview

This guide helps IT administrators enable automatic recording for Teams meetings to ensure Copilot transcripts are always generated. This is crucial for the automatic meeting notes feature in Team Sync Intelligence.

---

## ⚠️ Prerequisites

### 1. Microsoft 365 Licensing
- **Microsoft 365 E3/E5** or **Business Premium**
- **Microsoft 365 Copilot add-on** ($30/user/month)
- **Teams Premium** (optional, but recommended for advanced features)

### 2. Admin Permissions
- **Global Administrator** or **Teams Administrator** role
- Access to [Microsoft Teams Admin Center](https://admin.teams.microsoft.com)
- PowerShell admin access (for scripted setup)

---

## 🚀 Method 1: Teams Admin Center (Recommended)

### Step 1: Access Meeting Policies

1. Go to [Microsoft Teams Admin Center](https://admin.teams.microsoft.com)
2. Sign in with your admin credentials
3. Navigate to **Meetings** → **Meeting policies**

### Step 2: Create or Edit Policy

**Option A: Edit Global Policy (applies to all users)**
1. Click on **Global (Org-wide default)**
2. Scroll to **Recording & transcription** section

**Option B: Create Custom Policy (for specific users)**
1. Click **+ Add** to create a new policy
2. Give it a name (e.g., "Auto-Recording Policy")
3. Scroll to **Recording & transcription** section

### Step 3: Configure Recording Settings

Enable the following settings:

| Setting | Value | Description |
|---------|-------|-------------|
| **Cloud recording** | On | Allows meetings to be recorded to cloud |
| **Transcription** | On | Enables automatic transcription |
| **Recordings automatically expire** | On (optional) | Auto-delete old recordings after X days |
| **Default expiration time** | 120 days | How long to keep recordings |
| **Store recordings outside your country/region** | Off | For compliance |

### Step 4: Save and Assign

1. Click **Save** at the bottom
2. If you created a custom policy:
   - Go to **Users** → **Manage users**
   - Select users who need auto-recording
   - Click **Edit settings**
   - Under **Meeting policy**, select your custom policy
   - Click **Apply**

### Step 5: Verify Policy Application

- Policy changes take **4-48 hours** to propagate
- Check in Teams client: **Settings** → **Permissions** → **Recordings**

---

## 🔧 Method 2: PowerShell (For IT Automation)

### Step 1: Install Teams PowerShell Module

```powershell
# Install the module (run as administrator)
Install-Module -Name MicrosoftTeams -Force -AllowClobber

# Update to latest version
Update-Module -Name MicrosoftTeams
```

### Step 2: Connect to Teams

```powershell
# Connect to Microsoft Teams
Connect-MicrosoftTeams

# You'll be prompted to sign in with admin credentials
```

### Step 3: Configure Global Policy

```powershell
# Enable cloud recording and transcription for all users
Set-CsTeamsMeetingPolicy -Identity Global `
  -AllowCloudRecording $true `
  -AllowTranscription $true `
  -LiveCaptionsEnabledType EnabledUserOverride `
  -RecordingStorageMode Stream

# Verify the policy
Get-CsTeamsMeetingPolicy -Identity Global | Select-Object AllowCloudRecording, AllowTranscription
```

### Step 4: Create Custom Policy (Optional)

```powershell
# Create a new policy for specific users
New-CsTeamsMeetingPolicy -Identity "AutoRecordPolicy" `
  -AllowCloudRecording $true `
  -AllowTranscription $true `
  -LiveCaptionsEnabledType EnabledUserOverride `
  -RecordingStorageMode Stream

# Apply to specific users
Grant-CsTeamsMeetingPolicy -Identity "user@company.com" -PolicyName "AutoRecordPolicy"

# Apply to multiple users
$users = @("user1@company.com", "user2@company.com", "user3@company.com")
foreach ($user in $users) {
    Grant-CsTeamsMeetingPolicy -Identity $user -PolicyName "AutoRecordPolicy"
}

# Apply to all users in a group
$groupMembers = Get-AzureADGroupMember -ObjectId "GROUP-OBJECT-ID"
foreach ($member in $groupMembers) {
    Grant-CsTeamsMeetingPolicy -Identity $member.UserPrincipalName -PolicyName "AutoRecordPolicy"
}
```

### Step 5: Verify Assignments

```powershell
# Check policy for specific user
Get-CsUserPolicyAssignment -Identity "user@company.com" -PolicyType TeamsMeetingPolicy

# List all users with a specific policy
Get-CsOnlineUser | Where-Object {$_.TeamsMeetingPolicy -eq "AutoRecordPolicy"} | Select-Object DisplayName, UserPrincipalName
```

---

## 🎯 Method 3: Automatic Recording Triggers

For advanced scenarios, you can configure automatic recording start:

### Option A: Meeting Organizer Settings

1. Open **Teams** → **Calendar**
2. Create or edit a meeting
3. Click **Meeting options**
4. Under **Recording**, select:
   - ✅ **Automatically record meeting**
   - ✅ **Allow transcription**
5. Save the meeting

### Option B: Template Policies

```powershell
# Create meeting template with auto-recording
$template = @{
    AllowCloudRecording = $true
    AllowTranscription = $true
    AutoRecordingEnabled = $true
}

# Apply template to policy
Set-CsTeamsMeetingPolicy -Identity "AutoRecordPolicy" @template
```

---

## 📋 Verification Checklist

After implementing auto-recording, verify:

- [ ] **Cloud recording is enabled** in Teams Admin Center
- [ ] **Transcription is enabled** in policy settings
- [ ] **Policy is assigned** to correct users/groups
- [ ] **Users can see recording option** in Teams meetings
- [ ] **Test meeting** is recorded automatically
- [ ] **Transcript appears** in meeting chat after recording
- [ ] **Copilot notes** are available via Graph API
- [ ] **App successfully fetches** transcripts

---

## 🔍 Troubleshooting

### Recording Not Starting Automatically

**Possible Causes:**
1. Policy not yet propagated (wait 4-48 hours)
2. User doesn't have recording permissions
3. Meeting is external (external participants restrictions)
4. Storage quota exceeded

**Solution:**
```powershell
# Check user's effective policy
Get-CsUserPolicyAssignment -Identity "user@company.com" -PolicyType TeamsMeetingPolicy

# Force policy refresh
Grant-CsTeamsMeetingPolicy -Identity "user@company.com" -PolicyName $null
Grant-CsTeamsMeetingPolicy -Identity "user@company.com" -PolicyName "AutoRecordPolicy"
```

### Transcripts Not Available

**Possible Causes:**
1. Transcription not enabled in policy
2. Meeting language not supported
3. Copilot license not assigned
4. Recording too short (< 1 minute)

**Solution:**
```powershell
# Verify transcription is enabled
Get-CsTeamsMeetingPolicy -Identity Global | Select-Object AllowTranscription

# Enable transcription
Set-CsTeamsMeetingPolicy -Identity Global -AllowTranscription $true
```

### Copilot Notes Not Found

**Possible Causes:**
1. No Copilot license
2. Copilot not enabled for organization
3. Recording still processing
4. Graph API permissions missing

**Solution:**
1. Verify Copilot license: Microsoft 365 Admin Center → **Billing** → **Licenses**
2. Check Graph API permissions in Azure AD app registration
3. Wait 5-15 minutes after recording ends for processing
4. Check app has `OnlineMeetingTranscript.Read.All` permission

---

## 📊 Monitoring & Compliance

### Check Recording Usage

```powershell
# Get recording statistics
$recordings = Get-CsOnlineMeetingRecording -StartDate (Get-Date).AddDays(-30)
$recordings | Group-Object OrganizerPrincipalName | Select-Object Name, Count
```

### Storage Management

```powershell
# Check storage quota
Get-SPOSite | Select-Object Url, StorageUsageCurrent, StorageQuota

# Set recording expiration
Set-CsTeamsMeetingPolicy -Identity Global `
  -AllowCloudRecording $true `
  -RecordingStorageMode Stream `
  -RecordingsAutomaticExpiryTime 120  # Days
```

---

## 🔐 Security & Compliance Considerations

### Data Residency
- Recordings stored in OneDrive/SharePoint in user's region
- May be subject to data residency requirements
- Check Microsoft 365 data location settings

### Access Control
- Only meeting participants can access recordings by default
- Can restrict via SharePoint permissions
- Consider DLP policies for sensitive meetings

### Retention Policies
```powershell
# Set organization-wide retention
Set-CsTeamsMeetingPolicy -Identity Global `
  -RecordingsAutomaticExpiryTime 120  # 120 days

# For compliance, disable auto-expiry
Set-CsTeamsMeetingPolicy -Identity Global `
  -RecordingsAutomaticExpiryTime -1  # Never expire
```

---

## 📞 Support & Resources

### Microsoft Documentation
- [Teams meeting policies](https://docs.microsoft.com/en-us/microsoftteams/meeting-policies-in-teams)
- [Teams cloud recording](https://docs.microsoft.com/en-us/microsoftteams/cloud-recording)
- [Teams PowerShell reference](https://docs.microsoft.com/en-us/powershell/module/teams/)

### Common Issues
- **Policy not applied**: Wait 4-48 hours or force refresh
- **No recording button**: Check user's assigned policy
- **Storage full**: Increase SharePoint quota or enable auto-expiry
- **External meetings**: May require different policy settings

### Getting Help
1. Check [Microsoft Teams Admin Center](https://admin.teams.microsoft.com) → **Health** → **Service health**
2. Open support ticket in Microsoft 365 Admin Center
3. Contact your Microsoft account team for licensing questions

---

## ✅ Quick Start Checklist for IT Admins

- [ ] Verify Microsoft 365 Copilot licenses are assigned
- [ ] Enable cloud recording in Teams meeting policy
- [ ] Enable transcription in Teams meeting policy
- [ ] Apply policy to target users or groups
- [ ] Wait 4-48 hours for policy propagation
- [ ] Test with a sample meeting
- [ ] Verify transcript appears in meeting chat
- [ ] Confirm app can fetch transcripts via API
- [ ] Document policy for organization
- [ ] Train users on recording requirements

---

## 🎓 User Training Tips

**For End Users:**
- Inform users that meetings will be auto-recorded
- Remind them to announce recording at meeting start (legal requirement in some regions)
- Show them how to access recordings (Teams → Calendar → Meeting → Recording)
- Explain Copilot transcript features
- Provide privacy guidelines

**Email Template:**
```
Subject: Automatic Meeting Recording Now Enabled

Hi Team,

We've enabled automatic recording for Teams meetings to improve our meeting documentation and enable AI-powered summaries.

What this means:
- ✅ Your important meetings will be automatically recorded
- ✅ Transcripts will be generated with Copilot
- ✅ AI summaries with key decisions and action items
- ✅ Better meeting follow-up and accountability

What you need to do:
- 📢 Announce at the start: "This meeting is being recorded"
- 🔴 Ensure recording indicator is visible
- 📝 Check transcripts after meeting in Teams chat
- 🎯 Mark important meetings in the Team Sync Intelligence app

Questions? Contact IT Support.

Best regards,
IT Team
```

---

## 📈 Rollout Recommendations

### Phase 1: Pilot (Week 1-2)
- Enable for 10-20 pilot users
- Test various meeting scenarios
- Gather feedback
- Verify transcript quality

### Phase 2: Department Rollout (Week 3-4)
- Enable for entire department (50-100 users)
- Monitor adoption and issues
- Provide training sessions
- Document common issues

### Phase 3: Organization-Wide (Week 5+)
- Enable for all users
- Ongoing support and training
- Monitor storage usage
- Optimize policies based on usage

---

## 🔄 Maintenance & Updates

### Monthly Tasks
- Review storage usage
- Check recording compliance
- Update policies for new users
- Review access logs

### Quarterly Tasks
- Audit transcript access
- Update retention policies
- Review licensing costs
- Plan capacity upgrades

### Annual Tasks
- Review security policies
- Update compliance documentation
- Re-train users
- Evaluate new features

---

**Last Updated:** 2024-01-17
**Version:** 1.0
**Maintained by:** Team Sync Intelligence Team


