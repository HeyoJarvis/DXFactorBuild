# 🤖 Power Automate Templates for Team Sync Intelligence

This folder contains everything you need to automatically save Microsoft Teams meeting transcripts to OneDrive, where your Team Sync Intelligence app can read and process them.

## 📁 Files in This Folder

| File | Purpose | Time to Read |
|------|---------|--------------|
| **SETUP_INSTRUCTIONS.md** | Step-by-step setup guide | 5 min |
| **ARCHITECTURE_DIAGRAM.md** | Complete system architecture | 10 min |
| **simple-transcript-flow.json** | Ready-to-import flow template | N/A |
| **README.md** | This file | 2 min |

## 🚀 Quick Start (Choose One)

### Option 1: Automated (Recommended)
**Best for**: Production use, hands-off automation

1. Read: `SETUP_INSTRUCTIONS.md` → "3-Minute Setup"
2. Create Power Automate flow (15 minutes)
3. Test with a sample meeting
4. Enable for production

**Setup time**: 20 minutes  
**Maintenance**: None (runs automatically)

### Option 2: Button Flow
**Best for**: Testing, occasional use

1. Read: `SETUP_INSTRUCTIONS.md` → "Button Flow"
2. Create instant flow (5 minutes)
3. Run manually after meetings

**Setup time**: 5 minutes  
**Maintenance**: Manual button press after each meeting

### Option 3: Mobile App
**Best for**: Quick testing, low-tech solution

1. Install Power Automate mobile app
2. Create button with OneDrive file action
3. Copy/paste transcripts manually

**Setup time**: 2 minutes  
**Maintenance**: Manual copy/paste

## 📊 Comparison

| Feature | Automated | Button | Mobile App |
|---------|-----------|--------|------------|
| Setup complexity | Medium | Easy | Very Easy |
| Requires coding | No | No | No |
| Fully automatic | ✅ Yes | ❌ No | ❌ No |
| Premium connectors | Optional | Optional | ❌ No |
| Works offline | ✅ Yes | ⚠️ Partial | ⚠️ Partial |
| Scalable | ✅ Yes | ⚠️ Limited | ❌ No |

## 🎯 What This Solves

### The Problem:
Your app needs access to Teams meeting transcripts to provide context in Team Chat, but:
- Microsoft Graph API has limitations
- Direct API access requires complex permissions
- Not all meetings have accessible transcripts via API

### The Solution:
Power Automate bridges the gap:
1. ✅ Automatically fetches transcripts when available
2. ✅ Saves them to OneDrive (already integrated with your app)
3. ✅ Your app's existing OneDrive fallback picks them up
4. ✅ No code changes needed in your app!

## 📋 Prerequisites

Before you start, make sure you have:

- [ ] Microsoft 365 account with Teams
- [ ] OneDrive for Business
- [ ] Power Automate access (included in most M365 licenses)
- [ ] Teams Premium (for automatic transcription)
- [ ] Your app already running with Microsoft integration

## 🔧 Architecture Overview

```
Teams Meeting → Transcript → Power Automate → OneDrive → Your App → Database
    (15 min)        Ready        (30 min)      Sync     (15 min)    Available!
```

**Total time**: ~60 minutes from meeting end to availability in chat

See `ARCHITECTURE_DIAGRAM.md` for detailed flow.

## 📝 Step-by-Step Process

### 1. Setup Power Automate (One Time)

Follow `SETUP_INSTRUCTIONS.md` to:
- Create Azure AD app registration (if using HTTP connector)
- Set up Power Automate flow
- Configure OneDrive connection
- Test with sample meeting

### 2. Verify It's Working

Run the verification script:
```bash
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
node verify-power-automate-transcripts.js
```

This checks:
- ✅ OneDrive connection
- ✅ `/Recordings` folder exists
- ✅ Transcript files are being saved
- ✅ Your app can read them
- ✅ Database is being updated

### 3. Enable for Production

Once verified:
- Turn on the Power Automate flow
- Monitor for a few days
- Enjoy automatic transcripts!

## 🧪 Testing Checklist

- [ ] Power Automate flow created
- [ ] Azure AD app registered (if needed)
- [ ] Permissions granted and consented
- [ ] OneDrive `/Recordings` folder created
- [ ] Test meeting scheduled and recorded
- [ ] Flow run succeeded (check run history)
- [ ] File appears in OneDrive
- [ ] Verification script passes
- [ ] Transcript appears in app database
- [ ] Searchable in Team Chat

## ❓ Common Questions

### Q: Do I need to modify my app code?
**A**: No! Your app already has OneDrive fallback. This just ensures transcripts are there.

### Q: What if Power Automate fails?
**A**: Your app will still work. It tries Graph API first, then OneDrive fallback. This adds redundancy.

### Q: How much does this cost?
**A**: 
- Basic flows: Included in M365 E3/E5
- Premium connectors: $15/user/month (optional)
- OneDrive storage: Minimal (~10KB per transcript)

### Q: Can I use this for past meetings?
**A**: Only if transcripts were enabled during recording. Microsoft doesn't retroactively generate transcripts.

### Q: What about Copilot notes?
**A**: If you have Teams Premium, the flow can also save Copilot meeting notes. See `SETUP_INSTRUCTIONS.md` for details.

### Q: Is this secure?
**A**: Yes! Everything stays within your M365 tenant:
- OAuth authentication
- User-scoped permissions
- No external services
- Compliant with your org's data policies

## 🐛 Troubleshooting

### Flow Not Running
1. Check flow is turned ON
2. Verify recurrence settings
3. Check run history for errors

### No Transcripts Found
1. Verify transcription was enabled in meeting
2. Wait 30+ minutes after meeting ends
3. Check Graph API permissions

### Files Not in OneDrive
1. Create `/Recordings` folder manually
2. Check OneDrive connector authentication
3. Verify you have write permissions

### App Not Reading Files
1. Run verification script
2. Check app sync logs
3. Manually trigger sync: `node force-sync-meetings.js`

See `SETUP_INSTRUCTIONS.md` for detailed troubleshooting.

## 📚 Additional Resources

### Microsoft Documentation:
- [Power Automate Overview](https://learn.microsoft.com/en-us/power-automate/)
- [Microsoft Graph - Transcripts](https://learn.microsoft.com/en-us/graph/api/resources/calltranscript)
- [Teams Meeting Transcription](https://support.microsoft.com/en-us/office/view-live-transcription-in-microsoft-teams-meetings-dc1a8f23-2e20-4684-885e-2152e06a4a8b)

### Your App Documentation:
- `../TRANSCRIPT_SOLUTION.md` - How transcripts work in your app
- `../AutomatedTranscriptService.js` - Transcript fetching logic
- `../WEBHOOK_SETUP_GUIDE.md` - Alternative webhook approach

## 🎓 Learning Path

**Beginner** (Never used Power Automate):
1. Start with mobile app approach (2 min setup)
2. Test with one meeting
3. Graduate to button flow (5 min setup)
4. Once comfortable, create automated flow

**Intermediate** (Some Power Automate experience):
1. Follow `SETUP_INSTRUCTIONS.md` → "3-Minute Setup"
2. Use standard connectors (no premium needed)
3. Test with sample meeting
4. Enable for production

**Advanced** (Want full control):
1. Read `ARCHITECTURE_DIAGRAM.md` fully
2. Set up Azure AD app with custom permissions
3. Use HTTP Premium connector for Graph API
4. Add custom logic (e.g., filter by meeting type)
5. Implement error handling and notifications

## 🚢 Production Deployment

### Before Going Live:

1. **Test thoroughly**:
   - Run 3-5 test meetings
   - Verify all transcripts saved correctly
   - Check app is reading them properly

2. **Configure monitoring**:
   - Enable Power Automate email notifications on failure
   - Set up alerts for your app's sync service
   - Create dashboard to track transcript processing

3. **Document for your team**:
   - Where transcripts are stored
   - How to access them manually if needed
   - Who to contact if something breaks

4. **Set retention policies**:
   - How long to keep transcripts in OneDrive
   - Database backup strategy
   - Compliance with your org's data policies

### Ongoing Maintenance:

- **Weekly**: Check Power Automate run history
- **Monthly**: Review OneDrive storage usage
- **Quarterly**: Verify Azure AD app client secret expiration
- **Yearly**: Review and update permissions as needed

## 🎉 Success Metrics

Once running successfully, you should see:

- ✅ 95%+ of recorded meetings have transcripts
- ✅ Transcripts available within 60 minutes of meeting end
- ✅ Zero manual intervention required
- ✅ Users getting accurate context in Team Chat
- ✅ Improved AI response quality for meeting-related questions

## 🤝 Contributing

Found an improvement? Have a better flow template?

1. Test your changes thoroughly
2. Document what you changed and why
3. Update relevant documentation
4. Share with the team!

## 📞 Support

**Issues with Power Automate Setup?**
- Check `SETUP_INSTRUCTIONS.md` troubleshooting section
- Review Power Automate run history for specific errors
- Contact your M365 admin for permission issues

**Issues with App Integration?**
- Run `node verify-power-automate-transcripts.js`
- Check app logs: `tail -f logs/transcript-service.log`
- Review `../TRANSCRIPT_SOLUTION.md` for app-specific troubleshooting

---

## 🎯 Quick Command Reference

```bash
# Verify Power Automate integration
node verify-power-automate-transcripts.js

# Manually trigger transcript sync
node force-sync-meetings.js

# Check existing transcripts in database
node check-meeting-notes.js

# View recent meeting data
node check-existing-meetings.js

# Test Microsoft Graph connection
node fetch-meeting-content.js

# Check sync logs
tail -f logs/transcript-service.log
```

---

**Ready to get started?** Open `SETUP_INSTRUCTIONS.md` and follow the 3-Minute Setup! 🚀

