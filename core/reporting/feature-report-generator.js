/**
 * Feature Report Generator
 * Generates feature completion, timeline, and risk assessment
 */

const BaseReportGenerator = require('./base-report-generator');

class FeatureReportGenerator extends BaseReportGenerator {
  _getReportType() {
    return 'feature';
  }

  /**
   * Fetch epic and all related stories
   */
  async _fetchData(epicKey, options) {
    this.logger.info('Fetching feature data', { epicKey });

    try {
      // Get epic details
      const epic = await this.jiraService.getIssueDetails(epicKey);

      // Get all stories/tasks under this epic
      const jql = `parent = "${epicKey}" OR "Epic Link" = "${epicKey}" ORDER BY created ASC`;
      const storiesResponse = await this.jiraService.getIssuesByJQL(jql, {
        expand: ['changelog'],
        fields: ['*all'],
        maxResults: 100
      });

      // Extract issues array from response (JIRA returns { issues: [], total: N })
      const stories = storiesResponse?.issues || storiesResponse || [];
      
      this.logger.info('Stories fetched', { 
        count: Array.isArray(stories) ? stories.length : 0,
        isArray: Array.isArray(stories)
      });

      // Intelligently extract Confluence documentation links
      // Uses AI to detect links in description, web links, and comments
      let confluenceDocs = [];
      try {
        confluenceDocs = await this._extractConfluenceLinks(epic);
        
        this.logger.info('Confluence links extracted', { 
          count: confluenceDocs.length,
          method: confluenceDocs.length > 0 ? 'AI extraction' : 'none found'
        });
        
        // If AI extraction found nothing, try fallback search
        if (confluenceDocs.length === 0 && this.confluenceService) {
          this.logger.info('No links found via AI, trying search fallback');
          const epicName = epic?.fields?.summary || epicKey;
          const searchResult = await this.confluenceService.searchPages(epicName, { limit: 3 });
          confluenceDocs = (searchResult?.results || []).map(page => ({
            url: page._links?.webui || page.url,
            title: page.title,
            description: page.excerpt?.replace(/<[^>]*>/g, '').substring(0, 150) || '',
            source: 'search'
          }));
          
          this.logger.info('Search fallback found docs', { count: confluenceDocs.length });
        }
      } catch (confError) {
        this.logger.warn('Failed to extract Confluence docs', { error: confError.message });
      }

      return {
        epicKey,
        epic,
        stories: Array.isArray(stories) ? stories : [],
        confluenceDocs,
        period: this._getPeriod(options)
      };
    } catch (error) {
      this.logger.error('Failed to fetch feature data', { error: error.message });
      return {
        epicKey,
        epic: null,
        stories: [],
        confluenceDocs: [],
        period: this._getPeriod(options),
        error: error.message
      };
    }
  }

  /**
   * Calculate feature metrics
   */
  async _calculateMetrics(data, options) {
    this.logger.info('Calculating feature metrics', { 
      epicKey: data.epicKey,
      storiesType: typeof data.stories,
      isArray: Array.isArray(data.stories),
      storiesLength: data.stories?.length
    });

    // Ensure stories is always an array
    const stories = Array.isArray(data.stories) ? data.stories : [];
    
    if (stories.length === 0) {
      this.logger.warn('No stories found for epic', { epicKey: data.epicKey });
    }

    const totalStories = stories.length;
    const completedStories = stories.filter(s => 
      s?.fields?.status?.name === 'Done' || s?.fields?.status?.name === 'Closed'
    ).length;
    
    const totalPoints = stories.reduce((sum, s) => {
      const points = s?.fields?.customfield_10000 || s?.fields?.customfield_10016 || 0;
      return sum + points;
    }, 0);
    
    const completedPoints = stories
      .filter(s => s?.fields?.status?.name === 'Done' || s?.fields?.status?.name === 'Closed')
      .reduce((sum, s) => {
        const points = s?.fields?.customfield_10000 || s?.fields?.customfield_10016 || 0;
        return sum + points;
      }, 0);

    const completionPercent = Math.round((completedStories / Math.max(totalStories, 1)) * 100);

    // Timeline analysis
    const timeline = this._analyzeTimeline(data.epic, stories);

    // Risk assessment
    const blockers = stories.filter(s => 
      s?.fields?.status?.name === 'Blocked' || s?.fields?.labels?.includes('blocked')
    );

    // Team distribution
    const teamDistribution = this._analyzeTeamDistribution(stories);

    return {
      completionPercent,
      totalStories,
      completedStories,
      inProgressStories: stories.filter(s => s?.fields?.status?.name === 'In Progress').length,
      totalPoints,
      completedPoints,
      blockers: blockers.length,
      atRisk: completionPercent < 50 && timeline.daysRemaining < 7,
      timeline,
      teamDistribution
    };
  }

  /**
   * Analyze timeline and burndown
   */
  _analyzeTimeline(epic, stories) {
    // Ensure stories is an array
    const storiesArray = Array.isArray(stories) ? stories : [];
    
    if (!epic) {
      return {
        startDate: null,
        targetDate: null,
        daysElapsed: 0,
        daysRemaining: 0,
        onTrack: true
      };
    }

    const startDate = new Date(epic.fields.created);
    const targetDate = epic.fields.duedate 
      ? new Date(epic.fields.duedate)
      : new Date(Date.now() + 60*24*3600*1000); // 60 days default

    const today = new Date();
    const daysElapsed = Math.floor((today - startDate) / (1000*3600*24));
    const daysRemaining = Math.floor((targetDate - today) / (1000*3600*24));

    const totalPoints = storiesArray.reduce((sum, s) => {
      const points = s?.fields?.customfield_10000 || s?.fields?.customfield_10016 || 0;
      return sum + points;
    }, 0);
    
    const remainingPoints = storiesArray
      .filter(s => s?.fields?.status?.name !== 'Done' && s?.fields?.status?.name !== 'Closed')
      .reduce((sum, s) => {
        const points = s?.fields?.customfield_10000 || s?.fields?.customfield_10016 || 0;
        return sum + points;
      }, 0);

    const burndownRate = daysElapsed > 0
      ? (totalPoints - remainingPoints) / daysElapsed
      : 0;

    const projectedCompletionDays = burndownRate > 0
      ? remainingPoints / burndownRate
      : daysRemaining;

    return {
      startDate: startDate.toISOString().split('T')[0],
      targetDate: targetDate.toISOString().split('T')[0],
      daysElapsed,
      daysRemaining,
      projectedCompletionDays: Math.round(projectedCompletionDays),
      onTrack: projectedCompletionDays <= daysRemaining,
      burndownRate: parseFloat(burndownRate.toFixed(2))
    };
  }

  /**
   * Analyze team distribution across feature
   */
  _analyzeTeamDistribution(stories) {
    const distribution = {};
    if (!Array.isArray(stories)) {
      return distribution;
    }
    
    stories.forEach(story => {
      if (!story?.fields) return;
      
      const assignee = story.fields.assignee?.displayName || 'Unassigned';
      const points = story.fields.customfield_10000 || 0;
      if (!distribution[assignee]) {
        distribution[assignee] = { points: 0, stories: 0 };
      }
      distribution[assignee].points += points;
      distribution[assignee].stories += 1;
    });
    return distribution;
  }

  /**
   * Generate summary in required format:
   * a) Description of the feature (AI summarized from JIRA)
   * b) Progress from JIRA
   * c) Supporting documentation from Confluence
   */
  async _generateBasicSummary(metrics, data) {
    const epic = data.epic;
    const epicName = epic ? epic.fields.summary : data.epicKey;
    
    // Debug logging to see what we're getting from JIRA
    this.logger.info('Epic data received', {
      hasEpic: !!epic,
      hasDescription: !!epic?.fields?.description,
      descriptionType: typeof epic?.fields?.description,
      descriptionKeys: epic?.fields?.description ? Object.keys(epic.fields.description) : [],
      firstFewChars: epic?.fields?.description ? 
        (typeof epic.fields.description === 'string' ? epic.fields.description.substring(0, 100) : 
         JSON.stringify(epic.fields.description).substring(0, 200)) : 'none'
    });
    
    // Extract description from ADF (Atlassian Document Format) or plain text
    let epicDescription = 'No description available';
    if (epic?.fields?.description) {
      const desc = epic.fields.description;
      
      // If it's ADF format (JSON object with content array)
      if (typeof desc === 'object' && desc.content) {
        epicDescription = this._extractTextFromADF(desc);
        this.logger.info('Extracted text from ADF', { length: epicDescription.length });
      } 
      // If it's plain text/markdown
      else if (typeof desc === 'string' && desc.trim().length > 0) {
        epicDescription = desc;
        this.logger.info('Using plain text description', { length: epicDescription.length });
      }
      // If description exists but is empty object or null
      else {
        this.logger.warn('Description exists but is not in expected format', { 
          type: typeof desc, 
          isNull: desc === null,
          value: desc 
        });
      }

      // Use AI to summarize the description if it exists
      if (epicDescription && epicDescription !== 'No description available' && epicDescription.length > 50) {
        this.logger.info('Sending to AI for summarization', { originalLength: epicDescription.length });
        epicDescription = await this._aiSummarize(
          epicDescription,
          `You are extracting information from a JIRA ticket for "${epicName}". Write a LONG, DETAILED explanation (at least 150 words).

EXAMPLE FORMAT (copy this style and length):
"As a developer user, the goal is to see JIRA tasks directly in the HeyJarvis app to have a unified view of work without switching between tools. The requirements include: authenticating with JIRA OAuth, displaying assigned issues in task view with status, priority, and type information, auto-syncing every 5 minutes, and filtering by project and status. Success metrics target 80% of developer users connecting JIRA within the first week and achieving a 50% reduction in context switching between apps. The target users are engineering team members who actively use JIRA for project management. The repository is located at https://github.com/sdalal/BeachBaby. Additional technical requirements include proper error handling for OAuth failures, caching of issue data to reduce API calls, and support for multiple JIRA projects within a single workspace."

Extract and write out EVERYTHING:
1. User story or feature goal (explain in detail what this is about)
2. Every single requirement and acceptance criterion (list them ALL)
3. All success metrics, KPIs, and target numbers
4. Technical specifications, implementation details, and architecture notes
5. Target users, stakeholders, and who will benefit
6. Links, repositories, documentation references, and dependencies
7. Any constraints, risks, or important context

CRITICAL REQUIREMENTS:
- Your response MUST be at least 150 words
- Write 5-8 detailed sentences minimum
- Do NOT be concise - be thorough and comprehensive
- Plain text only, NO markdown
- Do NOT write "This ticket describes..." - write the information directly

FORBIDDEN - DO NOT USE:
- ** for bold (just write normal text)
- __ for underline (just write normal text)
- # for headers (use "User Story:" as plain text)
- Any other markdown syntax

REQUIRED FORMAT:
User Story:
As a team member, I want to...

Requirements:
- Native desktop notifications
- Show task title and priority

Success Metrics:
- Faster response time
- Increased engagement

Strip out ALL ** and other markdown from your response. Output only clean plain text.`
        );
      }
    } else {
      this.logger.warn('No description field found in epic', {
        availableFields: epic?.fields ? Object.keys(epic.fields) : []
      });
    }

    let summary = '';
    
    // a) Description of the feature (AI summarized)
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary += `📋 FEATURE DESCRIPTION\n`;
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    summary += `${epicName} (${data.epicKey})\n\n`;
    summary += `${epicDescription}\n\n`;
    
    // b) Progress from JIRA
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary += `📊 PROGRESS FROM JIRA\n`;
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    summary += `Completion: ${metrics.completionPercent}% complete\n`;
    summary += `Stories: ${metrics.completedStories}/${metrics.totalStories} completed\n`;
    summary += `Story Points: ${metrics.completedPoints}/${metrics.totalPoints} delivered\n`;
    summary += `In Progress: ${metrics.inProgressStories} stories\n`;
    summary += `Blockers: ${metrics.blockers} ${metrics.blockers > 0 ? '⚠️' : ''}\n`;
    summary += `Status: ${metrics.atRisk ? '🔴 AT RISK' : '🟢 On Track'}\n`;
    
    if (metrics.timeline) {
      summary += `Timeline: ${metrics.timeline.daysRemaining} days remaining`;
      if (metrics.timeline.targetDate) {
        summary += ` (due ${metrics.timeline.targetDate})`;
      }
      summary += `\n`;
    }
    summary += `\n`;
    
    // c) Supporting documentation from Confluence
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary += `📚 SUPPORTING DOCUMENTATION\n`;
    summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    if (data.confluenceDocs && data.confluenceDocs.length > 0) {
      data.confluenceDocs.forEach((doc, idx) => {
        const title = doc.title || 'Untitled';
        const url = doc.url || '';
        const description = doc.description || '';
        const source = doc.source || 'linked';
        
        // Add emoji based on source
        const sourceEmoji = source === 'weblink' ? '🔗' :   // Explicit JIRA web link
                           source === 'regex' ? '📎' :      // Extracted from description via regex
                           source === 'search' ? '🔍' :     // Found via Confluence search
                           source === 'ai' ? '🤖' :         // AI extracted
                           '📄';                             // Default
        
        // Add indicator if content was fetched and summarized
        const contentIndicator = doc.contentFetched ? ' ✨' : '';
        summary += `${idx + 1}. ${sourceEmoji} ${title}${contentIndicator}\n`;
        if (url) {
          summary += `   ${url}\n`;
        }
        if (description) {
          const cleanDesc = description.replace(/<[^>]*>/g, '');
          summary += `\n   Summary:\n`;
          // Wrap description text at reasonable length
          const words = cleanDesc.split(' ');
          let line = '   ';
          for (const word of words) {
            if (line.length + word.length > 75) {
              summary += line + '\n';
              line = '   ' + word + ' ';
            } else {
              line += word + ' ';
            }
          }
          if (line.trim().length > 0) {
            summary += line.trim() + '\n';
          }
        }
        summary += `\n`;
      });
    } else {
      summary += `No related Confluence documentation found.\n`;
      summary += `\nTip: Add Confluence links to your JIRA ticket:\n`;
      summary += `  • Click "Link" → "Web Link" in JIRA\n`;
      summary += `  • Or paste Confluence URLs in the description\n`;
    }

    return summary;
  }

  _getEntityName(data) {
    return data.epic ? data.epic.fields.summary : data.epicKey;
  }

  /**
   * Extract plain text from Atlassian Document Format (ADF)
   * ADF is a JSON structure used by JIRA for rich text content
   * This extracts ALL text content regardless of formatting
   */
  _extractTextFromADF(adfContent) {
    if (!adfContent) {
      return '';
    }

    // If it's already a string, return it
    if (typeof adfContent === 'string') {
      return adfContent;
    }

    // If it doesn't have content array, try to stringify and extract
    if (!adfContent.content) {
      return JSON.stringify(adfContent);
    }

    let text = '';
    let inListItem = false;

    const processNode = (node, depth = 0) => {
      if (!node) return;

      // Text nodes - the actual content
      if (node.type === 'text') {
        text += node.text || '';
        return;
      }

      // Process content array if it exists
      if (node.content && Array.isArray(node.content)) {
        // Add spacing for paragraphs
        if (node.type === 'paragraph') {
          node.content.forEach(child => processNode(child, depth));
          text += '\n';
        }
        // Add spacing for headings
        else if (node.type === 'heading') {
          node.content.forEach(child => processNode(child, depth));
          text += '\n\n';
        }
        // List items
        else if (node.type === 'listItem') {
          text += '• ';
          node.content.forEach(child => processNode(child, depth + 1));
        }
        // Ordered/bullet lists
        else if (node.type === 'orderedList' || node.type === 'bulletList') {
          node.content.forEach(child => processNode(child, depth));
          text += '\n';
        }
        // Code blocks
        else if (node.type === 'codeBlock') {
          node.content.forEach(child => processNode(child, depth));
          text += '\n';
        }
        // Tables
        else if (node.type === 'table') {
          node.content.forEach(child => processNode(child, depth));
          text += '\n';
        }
        else if (node.type === 'tableRow') {
          node.content.forEach(child => processNode(child, depth));
          text += '\n';
        }
        else if (node.type === 'tableCell' || node.type === 'tableHeader') {
          node.content.forEach(child => processNode(child, depth));
          text += ' | ';
        }
        // Blockquotes
        else if (node.type === 'blockquote') {
          node.content.forEach(child => processNode(child, depth));
          text += '\n';
        }
        // Any other node with content
        else {
          node.content.forEach(child => processNode(child, depth));
        }
      }

      // Handle hard breaks
      if (node.type === 'hardBreak') {
        text += '\n';
      }

      // Handle mentions, emojis, etc. - extract any text attributes
      if (node.attrs && node.attrs.text) {
        text += node.attrs.text;
      }
    };

    // Process all top-level content
    adfContent.content.forEach(node => processNode(node));

    // Clean up the text
    return text
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .trim();
  }

  /**
   * Intelligently extract Confluence documentation links from JIRA ticket
   * Uses AI to detect links in description, web links, and comments
   * @param {Object} epic - JIRA epic/issue object
   * @returns {Promise<Array>} Array of Confluence documentation links
   */
  async _extractConfluenceLinks(epic) {
    try {
      this.logger.info('Extracting Confluence links intelligently', { epicKey: epic.key });

      // 1. Get web links (explicit links added via JIRA UI)
      const remoteLinks = await this.jiraService.getIssueRemoteLinks(epic.key);
      
      this.logger.info('Remote links fetched', { 
        count: remoteLinks.length,
        links: remoteLinks.map(l => l.object?.url || 'no-url')
      });
      
      // 2. Extract description text (from ADF or plain text)
      let descriptionText = '';
      if (epic.fields?.description) {
        const desc = epic.fields.description;
        this.logger.info('Description field found', {
          type: typeof desc,
          isObject: typeof desc === 'object',
          hasContent: desc?.content ? true : false,
          isString: typeof desc === 'string'
        });
        
        if (typeof desc === 'object' && desc.content) {
          descriptionText = this._extractTextFromADF(desc);
          this.logger.info('Extracted text from ADF', { 
            length: descriptionText.length,
            preview: descriptionText.substring(0, 200)
          });
        } else if (typeof desc === 'string') {
          descriptionText = desc;
          this.logger.info('Using plain text description', { 
            length: descriptionText.length,
            preview: descriptionText.substring(0, 200)
          });
        }
      } else {
        this.logger.warn('No description field found in epic', {
          hasFields: !!epic.fields,
          availableFields: epic.fields ? Object.keys(epic.fields) : []
        });
      }

      // 3. Combine all text sources for AI analysis
      const combinedText = `
JIRA Ticket: ${epic.key}
Title: ${epic.fields.summary}

Description:
${descriptionText}

Web Links:
${remoteLinks.map(link => `- ${link.object?.title || 'Untitled'}: ${link.object?.url || ''}`).join('\n')}
      `.trim();

      // 4. Use AI to intelligently extract Confluence links
      if (this.anthropic && combinedText.length > 50) {
        this.logger.info('Using AI to extract Confluence links', { textLength: combinedText.length });

        try {
          const message = await this.anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1000,
            messages: [{
            role: 'user',
            content: `Analyze this JIRA ticket and extract ALL Confluence documentation links.

${combinedText}

Instructions:
1. Find ALL Confluence URLs - look for ANY URL containing "atlassian.net/wiki" including:
   - Standard pages: /wiki/spaces/SPACE/pages/12345/Title
   - Draft pages: /wiki/pages/resumedraft.action?draftId=12345
   - Display pages: /wiki/display/SPACE/Page+Title
   - Any other /wiki/ URLs
2. Extract URLs from:
   - Description text (may be embedded in sentences like "Document Link: https://...")
   - Web Links section
   - Markdown links like [text](url)
   - Plain URLs anywhere in the text
3. For each URL found, extract:
   - The COMPLETE URL (including query parameters like ?draftId=)
   - A descriptive title (from link text, or infer from context, or use "Confluence Documentation")
   - Brief description of what the doc is about (if mentioned in context)

Return ONLY a JSON array in this exact format:
[
  {
    "url": "https://domain.atlassian.net/wiki/pages/resumedraft.action?draftId=3375681",
    "title": "Design Document",
    "description": "Technical design and specifications"
  }
]

If NO Confluence links found, return: []

CRITICAL: 
- Include the FULL URL with all query parameters
- Do NOT skip URLs just because they look like drafts or have unusual formats
- Return ONLY the JSON array, no other text or markdown formatting`
          }]
        });

          const aiResponse = message.content[0]?.text || '[]';
          
          // Parse AI response
          try {
            // Extract JSON from response (AI might add markdown formatting)
            const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const extractedLinks = JSON.parse(jsonMatch[0]);
              
              if (extractedLinks.length > 0) {
                this.logger.info('AI extracted Confluence links', { 
                  count: extractedLinks.length,
                  links: extractedLinks.map(l => l.url)
                });
                
                return extractedLinks;
              }
            }
          } catch (parseError) {
            this.logger.warn('Failed to parse AI response', { 
              error: parseError.message,
              response: aiResponse.substring(0, 200)
            });
          }
        } catch (aiError) {
          this.logger.warn('AI extraction failed, will use regex fallback', { 
            error: aiError.message 
          });
        }
      }

      // 5. Fallback: Manual extraction from web links
      const manualLinks = remoteLinks
        .filter(link => {
          const url = link.object?.url || '';
          return url.includes('atlassian.net/wiki') || url.includes('confluence');
        })
        .map(link => ({
          url: link.object?.url,
          title: link.object?.title || 'Untitled',
          description: link.object?.summary || '',
          source: 'weblink'
        }));

      this.logger.info('Manual extraction from web links', { count: manualLinks.length });
      
      // 6. Additional fallback: Regex extraction from description text
      // This catches URLs that AI might have missed
      this.logger.info('Starting regex extraction', {
        descriptionLength: descriptionText.length,
        hasDescription: descriptionText.length > 0,
        descriptionPreview: descriptionText.substring(0, 300)
      });
      
      const urlRegex = /https?:\/\/[^\s<>"]+?atlassian\.net\/wiki[^\s<>"]*/gi;
      const regexMatches = descriptionText.match(urlRegex) || [];
      
      this.logger.info('Regex matches found', {
        count: regexMatches.length,
        matches: regexMatches
      });
      
      const regexLinks = regexMatches.map(url => {
        // Clean up URL (remove trailing punctuation)
        const cleanUrl = url.replace(/[.,;:!?)\]]+$/, '');
        
        // Try to infer title from URL
        let title = 'Confluence Documentation';
        const pageMatch = cleanUrl.match(/pages\/(\d+)\/([^/?]+)/);
        if (pageMatch && pageMatch[2]) {
          title = decodeURIComponent(pageMatch[2].replace(/\+/g, ' '));
        }
        
        return {
          url: cleanUrl,
          title,
          description: '',
          source: 'regex'
        };
      });
      
      this.logger.info('Regex extraction from description', { 
        count: regexLinks.length,
        links: regexLinks.map(l => l.url)
      });
      
      // Combine manual and regex links, removing duplicates
      const allLinks = [...manualLinks, ...regexLinks];
      const uniqueLinks = allLinks.filter((link, index, self) =>
        index === self.findIndex(l => l.url === link.url)
      );
      
      this.logger.info('Total links after fallback', { count: uniqueLinks.length });
      
      // 7. Fetch actual Confluence page content and summarize with AI
      const linksWithContent = await Promise.all(uniqueLinks.map(async (link) => {
        try {
          if (!this.confluenceService) {
            return link; // Return link without content if no Confluence service
          }
          
          this.logger.info('Fetching Confluence page content', { url: link.url });
          
          // Fetch the actual page content
          const page = await this.confluenceService.getPageByUrl(link.url);
          
          // Strip HTML tags from content
          const plainText = page.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          
          this.logger.info('Confluence page fetched', { 
            title: page.title,
            contentLength: plainText.length 
          });
          
          // Use AI to summarize the content
          let summary = '';
          if (this.anthropic && plainText.length > 100) {
            try {
              this.logger.info('Summarizing Confluence page with AI', { 
                title: page.title,
                contentLength: plainText.length 
              });
              
              const message = await this.anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 2000,
                temperature: 0.7,
                messages: [{
                  role: 'user',
                  content: `Extract ALL information from this Confluence page titled "${page.title}". Write a LONG, DETAILED summary (at least 150 words, 5-8 sentences).

${plainText.substring(0, 6000)}

EXAMPLE OF GOOD OUTPUT (copy this style and length):
"The GitHub Apps integration automates codebase indexing by connecting to repositories through OAuth authentication. The implementation requires webhook configuration for real-time updates, background job processing for large repositories, and caching mechanisms to reduce API rate limit consumption. Key technical specifications include support for multiple programming languages through tree-sitter parsers, incremental indexing to handle repository updates efficiently, and semantic search capabilities using vector embeddings. The system must handle repositories up to 100MB in size with indexing completion within 5 minutes for typical codebases. Security requirements mandate encrypted storage of OAuth tokens, audit logging of all repository access, and compliance with GitHub's API usage guidelines."

Extract and explain EVERYTHING in detail:
- Main topic and purpose (explain thoroughly)
- ALL technical specifications and requirements
- Implementation details and architecture
- Important context and background information
- Actionable items, next steps, or deliverables
- Any constraints, dependencies, or risks mentioned

CRITICAL REQUIREMENTS:
- Your response MUST be at least 150 words
- Write 5-8 detailed sentences minimum
- Do NOT be concise - be thorough and comprehensive
- Plain text only, NO markdown
- Do NOT write "This page describes..." - write the information directly`
                }]
              });
              
              summary = message.content[0]?.text || '';
              
              this.logger.info('AI summary generated', { 
                title: page.title,
                summaryLength: summary.length 
              });
              
            } catch (aiError) {
              this.logger.warn('AI summarization failed for Confluence page', { 
                error: aiError.message,
                title: page.title 
              });
              // Use first 200 chars as fallback
              summary = plainText.substring(0, 200) + '...';
            }
          } else {
            // Use first 200 chars if content is short or no AI
            summary = plainText.substring(0, 200) + (plainText.length > 200 ? '...' : '');
          }
          
          return {
            ...link,
            title: page.title, // Use actual page title
            description: summary,
            contentFetched: true
          };
          
        } catch (fetchError) {
          this.logger.warn('Failed to fetch Confluence page content', { 
            error: fetchError.message,
            url: link.url 
          });
          // Return original link if fetch fails
          return link;
        }
      }));
      
      this.logger.info('Confluence content fetched and summarized', { 
        total: linksWithContent.length,
        withContent: linksWithContent.filter(l => l.contentFetched).length
      });
      
      return linksWithContent;

    } catch (error) {
      this.logger.error('Failed to extract Confluence links', { 
        error: error.message,
        epicKey: epic?.key
      });
      return [];
    }
  }
}

module.exports = FeatureReportGenerator;

