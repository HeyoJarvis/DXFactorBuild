# 🔍 HeyJarvis Fact-Checker

The HeyJarvis Fact-Checker uses AI vision to detect suspicious claims on your screen and highlights them with **soft, clickable overlays**.

---

## ✨ Features

### 🎨 Visual Highlights
- **Soft Red Overlays**: Semi-transparent highlights that don't obscure content
- **Gentle Pulsing**: Smooth animations to draw attention without being distracting
- **Numbered**: Each claim is numbered for easy reference
- **Auto-Fade**: Highlights automatically disappear after 15 seconds

### 🖱️ Interactive
- **Click to Expand**: Click any highlight to see full details
- **Modal Details**: Shows suspicious claim, issue explanation, fact-check, and confidence level
- **Close Options**: Press ESC or click the close button
- **Click-Through**: Background remains clickable - only highlights are interactive

### 🧠 AI-Powered Analysis
- Uses **Claude Sonnet 4.5** (latest vision model)
- Detects:
  - Misleading statistics
  - Fake testimonials
  - Scam patterns
  - Factual errors
  - Manipulative language
- Provides confidence levels: High, Medium, Low
- Overall risk assessment

---

## 🚀 How to Use

### Activation
1. Press the global hotkey (default: **Cmd+Shift+Space**)
2. Type `"check"`, `"fact check"`, or `"jarvis check"`
3. Press Enter

### What Happens
1. **Screen Capture**: Grabs the current screen
2. **AI Analysis**: Claude analyzes the image for suspicious claims
3. **Overlay Display**: 
   - ✅ If clean: Chat message confirms "All Clear"
   - 🚨 If suspicious: Soft red highlights appear on screen

### Interaction
- **View Summary**: Bottom bar shows total claims and risk level
- **Click Highlights**: Numbered highlights are clickable
- **Read Details**: Modal shows:
  - 📝 Original claim (quoted)
  - ⚠️ What's wrong
  - ✓ Fact-check information
  - 🎯 Confidence level
- **Close**: Press ESC or click "Close" button

---

## 🎯 Example Use Cases

### 📧 Email Verification
Check if an email is a phishing attempt:
- Detects fake urgency ("Your account will be closed!")
- Identifies suspicious links
- Flags impersonation attempts

### 📰 News Article Analysis
Verify claims in articles:
- Detects misleading statistics
- Flags unverified claims
- Identifies bias indicators

### 💬 Social Media Posts
Check viral content:
- Detects fake testimonials
- Identifies manipulated images
- Flags misinformation

### 🛒 Product Reviews
Verify authenticity:
- Detects fake reviews
- Identifies scam patterns
- Flags unrealistic claims

---

## 🛠️ Technical Details

### Architecture
```
User triggers check
    ↓
Screen captured (desktopCapturer)
    ↓
Image sent to Claude Vision API
    ↓
AI analyzes for suspicious claims
    ↓
Overlay window created (transparent, click-through)
    ↓
Highlights distributed across screen
    ↓
User clicks highlight → Modal appears
    ↓
Auto-fade after 15s
```

### Key Components
- **FactCheckerService**: Main service class
  - `captureAndCheck()`: Capture screen and analyze
  - `analyzeImageWithAI()`: Send to Claude Vision
  - `showOverlayWithHighlights()`: Display results
  - `generateClickableOverlayHTML()`: Create overlay UI
- **Overlay Window**: Transparent Electron BrowserWindow
  - Full-screen overlay
  - Click-through background
  - Interactive highlights
  - Auto-close timeout

### AI Prompt Engineering
The fact-checker uses a specialized prompt that:
- Instructs Claude to look for specific scam patterns
- Requests JSON-formatted responses
- Asks for confidence levels
- Provides context about common deception tactics

### Visual Design
- **Soft Red**: `rgba(255, 59, 48, 0.08)` background
- **Border**: `rgba(255, 59, 48, 0.3)` with 2px width
- **Hover Effect**: Scales to 1.05x with stronger border
- **Pulsing**: Opacity oscillates between 0.7 and 1.0
- **High-Confidence Claims**: Stronger pulse and 3px border

---

## 🔒 Privacy & Security

### Data Handling
- Screen captures are **temporary** (not saved to disk)
- Images are base64-encoded and sent directly to Claude API
- No data is stored or logged
- Analysis happens in real-time

### API Usage
- Uses your ANTHROPIC_API_KEY from `.env`
- Requires Claude API access
- Costs ~$0.01-0.05 per check (depending on screen content)

### Permissions
- Requires screen recording permission (macOS)
- Electron's `desktopCapturer` API
- Transparent overlay window

---

## ⚙️ Configuration

### Environment Variables
```bash
ANTHROPIC_API_KEY=sk-ant-...    # Required
NODE_ENV=development            # Optional (enables debug logging)
```

### Customization
In `desktop/main/fact-checker-service.js`:
- **Model**: Change `model: 'claude-sonnet-4-20250514'`
- **Auto-Close Timer**: Modify timeout in `showOverlayWithHighlights()`
- **Highlight Colors**: Edit CSS in `generateClickableOverlayHTML()`
- **Confidence Thresholds**: Adjust AI prompt

---

## 🐛 Troubleshooting

### "Screen capture failed"
- **Issue**: Permission denied
- **Fix**: Grant screen recording permission in System Preferences → Privacy

### "API key not found"
- **Issue**: Missing `ANTHROPIC_API_KEY`
- **Fix**: Add to `.env` file in project root

### Overlay doesn't appear
- **Issue**: Window creation failed
- **Fix**: Check console logs for errors; ensure Electron has proper permissions

### Highlights in wrong positions
- **Issue**: Multi-monitor setup
- **Fix**: Currently optimized for primary display; secondary displays may have offset issues

### No claims detected on suspicious content
- **Issue**: AI missed the content
- **Fix**: Claude Vision is good but not perfect; try rephrasing or use a clearer screenshot

---

## 📊 Performance

- **Capture Time**: ~100-200ms
- **AI Analysis**: ~2-5 seconds (depends on screen complexity)
- **Overlay Render**: ~50-100ms
- **Total Time**: ~2-6 seconds from activation to display

---

## 🚀 Future Enhancements

### Planned Features
- [ ] **Text Selection Mode**: Select specific text instead of full screen
- [ ] **History**: View past fact-checks
- [ ] **Batch Mode**: Check multiple screens at once
- [ ] **Confidence Tuning**: Adjust sensitivity
- [ ] **Multi-Monitor Support**: Better handling of multiple displays
- [ ] **Export Results**: Save fact-check reports
- [ ] **Real-Time Mode**: Continuous monitoring

### Advanced Ideas
- [ ] **Custom Rulesets**: Define your own detection patterns
- [ ] **Integration with Browser**: Check web pages directly
- [ ] **Collaborative Mode**: Share fact-checks with team
- [ ] **Learning Mode**: Improve detection based on feedback

---

## 📚 Related Documentation

- [Anthropic Claude Vision API](https://docs.anthropic.com/claude/docs/vision)
- [Electron desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer)
- [HeyJarvis Architecture](./README.md)

---

## 🎉 Credits

Built with:
- **Claude Sonnet 4.5** (Anthropic) - AI vision analysis
- **Electron** - Desktop framework
- **Node.js** - Backend runtime

---

**Last Updated**: October 3, 2025  
**Version**: 1.0.0
