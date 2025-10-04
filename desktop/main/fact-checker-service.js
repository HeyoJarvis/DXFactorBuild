/**
 * Fact-Checker Service
 * 
 * Uses Claude Vision API to analyze screenshots and detect suspicious claims
 * Displays red highlights over questionable content
 */

const { desktopCapturer, screen, BrowserWindow } = require('electron');
const AIAnalyzer = require('../../core/signals/enrichment/ai-analyzer');
const winston = require('winston');

class FactCheckerService {
  constructor(options = {}) {
    this.options = {
      model: 'claude-sonnet-4-20250514', // Vision-capable model
      logLevel: 'info',
      ...options
    };
    
    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'fact-checker' }
    });
    
    this.aiAnalyzer = new AIAnalyzer();
    this.overlayWindow = null;
  }

  /**
   * Capture screen region and fact-check
   */
  async captureAndCheck(region = null) {
    try {
      this.logger.info('Starting fact-check screen capture');
      
      // Get current screen
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.bounds;
      
      // Capture screen
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 } // Reasonable size for AI
      });
      
      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }
      
      const screenshot = sources[0].thumbnail;
      const imageData = screenshot.toPNG();
      const base64Image = imageData.toString('base64');
      
      this.logger.info('Screen captured, sending to AI for analysis');
      
      // Send to Claude Vision API for fact-checking
      const analysis = await this.analyzeImage(base64Image);
      
      this.logger.info('Fact-check complete', {
        suspicious: analysis.hasSuspiciousContent,
        claims: analysis.claims?.length || 0
      });
      
      return analysis;
      
    } catch (error) {
      this.logger.error('Fact-check failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze image using Claude Vision API
   */
  async analyzeImage(imageBase64) {
    try {
      const prompt = `You are a fact-checker analyzing content on a screen. Identify any suspicious, misleading, or potentially false claims.

For each suspicious claim you find:
1. Quote the exact text
2. Explain why it's suspicious
3. Rate confidence: low/medium/high
4. Provide brief fact-check

Respond in JSON format:
{
  "hasSuspiciousContent": true/false,
  "overallRisk": "low|medium|high",
  "claims": [
    {
      "text": "exact quote from image",
      "issue": "what's wrong with it",
      "confidence": "low|medium|high",
      "factCheck": "brief correction or context",
      "boundingBox": { "x": 0, "y": 0, "width": 0, "height": 0 } // approximate location
    }
  ],
  "summary": "overall assessment"
}

If nothing suspicious is found, return:
{
  "hasSuspiciousContent": false,
  "overallRisk": "low",
  "claims": [],
  "summary": "No suspicious claims detected"
}`;

      const response = await this.aiAnalyzer.anthropic.messages.create({
        model: this.options.model,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }]
      });

      const analysisText = response.content[0].text;
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        this.logger.warn('Could not parse AI response as JSON');
        return {
          hasSuspiciousContent: false,
          overallRisk: 'low',
          claims: [],
          summary: 'Analysis completed but could not parse results'
        };
      }

      return JSON.parse(jsonMatch[0]);
      
    } catch (error) {
      this.logger.error('Image analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Show overlay with clickable highlights
   */
  async showOverlayWithHighlights(analysis) {
    try {
      if (this.overlayWindow) {
        this.overlayWindow.close();
      }
      
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.bounds;
      
      this.overlayWindow = new BrowserWindow({
        width,
        height,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        hasShadow: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });
      
      // Make window click-through for background, but capture clicks on highlights
      this.overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      
      const overlayHtml = this.generateClickableOverlayHTML(analysis, width, height);
      this.overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml)}`);
      
      // Auto-close after 15 seconds
      setTimeout(() => {
        this.closeOverlay();
      }, 15000);
      
      this.logger.info('Overlay displayed with highlights', {
        claims: analysis.claims.length
      });
      
    } catch (error) {
      this.logger.error('Failed to show overlay', { error: error.message });
    }
  }

  /**
   * Generate HTML for clickable overlay
   */
  generateClickableOverlayHTML(analysis, screenWidth, screenHeight) {
    // Distribute highlights across screen
    const highlights = analysis.claims.map((claim, index) => {
      // Calculate position (spread across screen)
      const cols = 3;
      const rows = Math.ceil(analysis.claims.length / cols);
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      const x = (screenWidth / (cols + 1)) * (col + 1) - 150;
      const y = (screenHeight / (rows + 1)) * (row + 1) - 50;
      const width = 300;
      const height = 100;
      
      return { ...claim, x, y, width, height, index: index + 1 };
    });
    
    const highlightElements = highlights.map(h => `
      <div class="highlight ${h.confidence}" 
           style="left: ${h.x}px; top: ${h.y}px; width: ${h.width}px; height: ${h.height}px;"
           onclick="showTooltip(${h.index})">
        <span class="highlight-number">${h.index}</span>
      </div>
    `).join('');
    
    const tooltips = highlights.map(h => `
      <div class="tooltip" id="tooltip-${h.index}">
        <div class="tooltip-header">
          <span class="tooltip-number">🚨 Claim ${h.index}</span>
          <button class="close-tooltip" onclick="hideTooltip(${h.index})">✕</button>
        </div>
        <div class="tooltip-quote">"${h.text.substring(0, 150)}${h.text.length > 150 ? '...' : ''}"</div>
        <div class="tooltip-section">
          <strong>⚠️ Issue:</strong>
          <p>${h.issue}</p>
        </div>
        <div class="tooltip-section">
          <strong>✓ Fact-Check:</strong>
          <p>${h.factCheck}</p>
        </div>
        <div class="tooltip-footer">
          <span class="confidence-badge confidence-${h.confidence}">${h.confidence} confidence</span>
        </div>
      </div>
    `).join('');
    
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      width: 100vw;
      height: 100vh;
      background: transparent;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    .highlight {
      position: absolute;
      background: rgba(255, 59, 48, 0.08);
      border: 2px solid rgba(255, 59, 48, 0.3);
      border-radius: 12px;
      cursor: pointer;
      pointer-events: auto;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: gentlePulse 3s ease-in-out infinite;
    }
    
    .highlight:hover {
      background: rgba(255, 59, 48, 0.15);
      border-color: rgba(255, 59, 48, 0.6);
      transform: scale(1.05);
      box-shadow: 0 8px 24px rgba(255, 59, 48, 0.2);
    }
    
    .highlight.high {
      border-width: 3px;
      animation: strongPulse 2s ease-in-out infinite;
    }
    
    .highlight-number {
      font-size: 48px;
      font-weight: 700;
      color: rgba(255, 59, 48, 0.6);
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .highlight:hover .highlight-number {
      color: rgba(255, 59, 48, 0.9);
    }
    
    @keyframes gentlePulse {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    
    @keyframes strongPulse {
      0%, 100% { opacity: 0.8; box-shadow: 0 0 0 rgba(255, 59, 48, 0.4); }
      50% { opacity: 1; box-shadow: 0 0 20px rgba(255, 59, 48, 0.6); }
    }
    
    .tooltip {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(20, 20, 20, 0.98);
      color: white;
      padding: 0;
      border-radius: 16px;
      font-size: 14px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      pointer-events: auto;
      display: none;
      z-index: 10000;
      backdrop-filter: blur(20px);
    }
    
    .tooltip.show {
      display: block;
      animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translate(-50%, -45%);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%);
      }
    }
    
    .tooltip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .tooltip-number {
      font-size: 16px;
      font-weight: 600;
    }
    
    .close-tooltip {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    
    .close-tooltip:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.1);
    }
    
    .tooltip-quote {
      padding: 20px 24px;
      font-style: italic;
      color: #ff3b30;
      border-left: 3px solid #ff3b30;
      margin: 20px 24px;
      background: rgba(255, 59, 48, 0.1);
      border-radius: 8px;
    }
    
    .tooltip-section {
      padding: 16px 24px;
    }
    
    .tooltip-section strong {
      display: block;
      margin-bottom: 8px;
      color: #a8a8a8;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .tooltip-section p {
      line-height: 1.6;
      color: #e0e0e0;
    }
    
    .tooltip-footer {
      padding: 16px 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: flex-end;
    }
    
    .confidence-badge {
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .confidence-high {
      background: rgba(255, 59, 48, 0.2);
      color: #ff3b30;
    }
    
    .confidence-medium {
      background: rgba(255, 149, 0, 0.2);
      color: #ff9500;
    }
    
    .confidence-low {
      background: rgba(255, 204, 0, 0.2);
      color: #ffcc00;
    }
    
    .close-all-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(20, 20, 20, 0.9);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 12px 24px;
      border-radius: 24px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      pointer-events: auto;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
    }
    
    .close-all-btn:hover {
      background: rgba(40, 40, 40, 0.95);
      transform: scale(1.05);
    }
    
    .summary-bar {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(20, 20, 20, 0.9);
      color: white;
      padding: 16px 32px;
      border-radius: 16px;
      font-size: 14px;
      pointer-events: auto;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    
    .risk-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 8px;
      font-weight: 600;
      margin-left: 8px;
    }
    
    .risk-high { background: rgba(255, 59, 48, 0.2); color: #ff3b30; }
    .risk-medium { background: rgba(255, 149, 0, 0.2); color: #ff9500; }
    .risk-low { background: rgba(52, 199, 89, 0.2); color: #34c759; }
  </style>
</head>
<body>
  ${highlightElements}
  ${tooltips}
  
  <button class="close-all-btn" onclick="window.close()">Close (ESC)</button>
  
  <div class="summary-bar">
    <span>${analysis.claims.length} suspicious claim${analysis.claims.length > 1 ? 's' : ''} detected</span>
    <span class="risk-badge risk-${analysis.overallRisk}">${analysis.overallRisk.toUpperCase()} RISK</span>
  </div>
  
  <script>
    function showTooltip(index) {
      // Hide all tooltips
      document.querySelectorAll('.tooltip').forEach(t => t.classList.remove('show'));
      // Show clicked tooltip
      document.getElementById('tooltip-' + index).classList.add('show');
    }
    
    function hideTooltip(index) {
      document.getElementById('tooltip-' + index).classList.remove('show');
    }
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openTooltip = document.querySelector('.tooltip.show');
        if (openTooltip) {
          openTooltip.classList.remove('show');
        } else {
          window.close();
        }
      }
    });
  </script>
</body>
</html>
    `;
  }

  /**
   * Close overlay window
   */
  closeOverlay() {
    if (this.overlayWindow) {
      this.overlayWindow.close();
      this.overlayWindow = null;
      this.logger.info('Overlay closed');
    }
  }
}

module.exports = FactCheckerService;

