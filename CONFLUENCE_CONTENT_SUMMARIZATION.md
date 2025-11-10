# Confluence Content Fetching & AI Summarization

## 🎯 Feature Overview

The system now **fetches actual Confluence page content** and uses **AI to generate high-level summaries** for inclusion in reports.

### **What It Does:**

1. ✅ **Extracts Confluence links** from JIRA tickets (description, web links)
2. ✅ **Fetches actual page content** from Confluence API
3. ✅ **Strips HTML** and extracts plain text
4. ✅ **Uses AI** (Claude 3.5 Sonnet) to generate 2-3 sentence summaries
5. ✅ **Displays summaries** in reports with visual indicators

---

## 🔧 Implementation

### **1. Confluence Service Enhancements**

#### A. Extract Page ID from URL

Added method to handle various Confluence URL formats:

```javascript
/**
 * Extract page ID from various Confluence URL formats
 * @param {string} url - Confluence page URL
 * @returns {string|null} Page ID or null if not found
 */
extractPageIdFromUrl(url) {
  if (!url) return null;
  
  // Format 1: /wiki/spaces/SPACE/pages/12345/Title
  const standardMatch = url.match(/\/pages\/(\d+)/);
  if (standardMatch) {
    return standardMatch[1];
  }
  
  // Format 2: /wiki/pages/resumedraft.action?draftId=12345
  const draftMatch = url.match(/[?&]draftId=(\d+)/);
  if (draftMatch) {
    return draftMatch[1];
  }
  
  // Format 3: /wiki/pages/viewpage.action?pageId=12345
  const pageIdMatch = url.match(/[?&]pageId=(\d+)/);
  if (pageIdMatch) {
    return pageIdMatch[1];
  }
  
  this.logger.warn('Could not extract page ID from URL', { url });
  return null;
}
```

#### B. Get Page by URL

```javascript
/**
 * Get page content by URL (extracts ID and fetches)
 * @param {string} url - Confluence page URL
 * @returns {Promise<Object>} Page data with content
 */
async getPageByUrl(url) {
  const pageId = this.extractPageIdFromUrl(url);
  if (!pageId) {
    throw new Error(`Could not extract page ID from URL: ${url}`);
  }
  return this.getPage(pageId);
}
```

### **2. Feature Report Generator Enhancements**

#### A. Fetch and Summarize Content

After extracting Confluence links, the system now fetches and summarizes content:

```javascript
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
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `Summarize this Confluence documentation page in 2-3 concise sentences. Focus on the key information that would be useful for someone working on a related JIRA ticket.

Page Title: ${page.title}

Content:
${plainText.substring(0, 4000)}

Provide a clear, actionable summary.`
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
```

#### B. Enhanced Report Display

```javascript
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
```

---

## 📊 Example Output

### **Before (Just Links):**

```
📚 SUPPORTING DOCUMENTATION

1. 📎 Confluence Documentation
   https://heyjarvis-team.atlassian.net/wiki/pages/resumedraft.action?draftId=3375681
```

### **After (With AI Summary):**

```
📚 SUPPORTING DOCUMENTATION

1. 📎 Product Requirements Document ✨
   https://heyjarvis-team.atlassian.net/wiki/pages/resumedraft.action?draftId=3375681

   Summary:
   This document outlines the requirements for integrating JIRA with the
   HeyJarvis platform. Key features include OAuth authentication, real-time
   sync, and automated task creation. Success metrics focus on reducing
   context switching by 50% and achieving 80% user adoption within the first
   week.
```

---

## 🎨 Visual Indicators

- **📎** = Extracted from description via regex
- **🔗** = Explicit JIRA web link
- **🤖** = AI extracted from text
- **🔍** = Found via Confluence search
- **✨** = Content fetched and AI summarized (NEW!)

---

## 🔄 Process Flow

```
┌─────────────────────────────────────┐
│  JIRA Ticket with Confluence Link  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  1. Extract Link from Description   │
│     (Regex/AI/Web Links)            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  2. Extract Page ID from URL        │
│     - Standard: /pages/12345        │
│     - Draft: ?draftId=12345         │
│     - ViewPage: ?pageId=12345       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  3. Fetch Page Content via API      │
│     GET /wiki/rest/api/content/ID   │
│     ?expand=body.storage            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  4. Strip HTML Tags                 │
│     Extract plain text              │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  5. AI Summarization                │
│     Claude 3.5 Sonnet               │
│     Max 500 tokens                  │
│     2-3 sentence summary            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  6. Display in Report               │
│     Title ✨                        │
│     URL                              │
│     Summary (wrapped at 75 chars)   │
└─────────────────────────────────────┘
```

---

## 🚀 Benefits

### **1. Contextual Understanding**
- ✅ Users see **what the documentation is about** without clicking
- ✅ AI extracts **key information** relevant to the JIRA ticket
- ✅ **Actionable summaries** help developers quickly assess relevance

### **2. Time Savings**
- ✅ No need to open multiple Confluence pages
- ✅ Quick scan of summaries to find relevant docs
- ✅ Reduces context switching

### **3. Intelligent Summarization**
- ✅ AI focuses on **actionable information**
- ✅ 2-3 sentence summaries are **concise but comprehensive**
- ✅ Automatically adapts to different doc types

### **4. Graceful Degradation**
- ✅ Falls back to first 200 chars if AI fails
- ✅ Shows original link if fetch fails
- ✅ Never breaks report generation

---

## 🧪 Testing

### **Test Case 1: Draft Page URL**

**Input:**
```
https://heyjarvis-team.atlassian.net/wiki/pages/resumedraft.action?draftId=3375681
```

**Expected:**
1. Page ID extracted: `3375681`
2. Content fetched from Confluence API
3. AI summary generated
4. Report shows: `Title ✨` with summary

### **Test Case 2: Standard Page URL**

**Input:**
```
https://company.atlassian.net/wiki/spaces/ENG/pages/12345/API+Design
```

**Expected:**
1. Page ID extracted: `12345`
2. Content fetched
3. AI summary generated
4. Report shows summary

### **Test Case 3: Multiple Pages**

**Input:**
- 2 Confluence links in JIRA description

**Expected:**
- Both pages fetched in parallel (`Promise.all`)
- Both summarized
- Both displayed with ✨ indicator

### **Test Case 4: Fetch Failure**

**Input:**
- Invalid page ID or unauthorized access

**Expected:**
- Error logged
- Original link returned without summary
- Report generation continues

---

## 📝 Configuration

### **AI Model**

Change the model in `feature-report-generator.js`:

```javascript
const message = await this.anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022', // Change this
  max_tokens: 500, // Adjust summary length
  // ...
});
```

### **Summary Length**

Adjust max tokens for longer/shorter summaries:

```javascript
max_tokens: 500, // Default: ~2-3 sentences
// 300 = 1-2 sentences
// 800 = 3-5 sentences
```

### **Content Limit**

Adjust how much content is sent to AI:

```javascript
${plainText.substring(0, 4000)} // Default: first 4000 chars
// Increase for longer docs
// Decrease to save API costs
```

---

## 🐛 Troubleshooting

### **Issue: No summary generated**

**Check:**
1. Is `ANTHROPIC_API_KEY` set in `.env`?
2. Check logs for "Summarizing Confluence page with AI"
3. Check for AI errors in logs

**Fallback:**
- System will use first 200 chars of content

### **Issue: "Could not extract page ID from URL"**

**Cause:**
- URL format not recognized

**Solution:**
- Add new regex pattern to `extractPageIdFromUrl`
- Or use explicit web links in JIRA

### **Issue: "Failed to fetch Confluence page content"**

**Causes:**
1. Page doesn't exist
2. Unauthorized (OAuth scopes missing)
3. Draft page not published

**Solution:**
- Check Confluence OAuth scopes include `read:content:confluence`
- Publish draft pages before linking

---

## 📊 Performance

### **Typical Timings**

- **Page Fetch:** 200-500ms per page
- **AI Summarization:** 1-3 seconds per page
- **Total (1 page):** ~2-4 seconds
- **Total (3 pages):** ~2-4 seconds (parallel fetch)

### **Optimization**

1. **Parallel Processing:** Uses `Promise.all` to fetch multiple pages simultaneously
2. **Content Limit:** Only sends first 4000 chars to AI
3. **Caching:** Consider caching summaries for frequently accessed pages

---

## 🎓 Best Practices

### **For Users:**

1. **Link relevant docs** - Only link docs that are actually useful
2. **Keep docs updated** - AI summarizes current content
3. **Use descriptive titles** - Helps AI generate better summaries

### **For Developers:**

1. **Monitor API costs** - Each summary uses ~500 tokens
2. **Check logs** - Extensive logging for debugging
3. **Handle errors gracefully** - Never let Confluence issues break reports
4. **Consider caching** - Cache summaries for popular pages

---

## 🚀 Future Enhancements

### **Potential Improvements:**

1. **Smart Caching** - Cache summaries for 24 hours
2. **Relevance Scoring** - AI scores how relevant each doc is to the ticket
3. **Key Sections** - Extract specific sections (Requirements, API, etc.)
4. **Multi-language** - Summarize docs in different languages
5. **Visual Summaries** - Include diagrams/screenshots
6. **Update Detection** - Notify when linked docs are updated

---

## 📈 Success Metrics

Track these to measure effectiveness:

- **Fetch Success Rate:** % of pages successfully fetched
- **Summary Quality:** User feedback on summary usefulness
- **Time Savings:** Reduced time spent reading full docs
- **API Costs:** Anthropic API usage for summaries
- **Error Rate:** % of fetch/summarization failures

---

## 🎉 Summary

The Confluence content summarization system:

✅ **Fetches actual page content** from Confluence API  
✅ **Uses AI** to generate concise, actionable summaries  
✅ **Displays summaries** directly in reports  
✅ **Handles all URL formats** (standard, draft, viewpage)  
✅ **Gracefully degrades** if fetch/AI fails  
✅ **Parallel processing** for multiple pages  
✅ **Visual indicators** show which docs have summaries  

Users now get **high-level overviews** of Confluence documentation **without leaving the report**! 🎊

---

## 📁 Files Modified

1. **`core/integrations/confluence-service.js`**
   - Added `extractPageIdFromUrl(url)` method
   - Added `getPageByUrl(url)` method

2. **`core/reporting/feature-report-generator.js`**
   - Added content fetching and AI summarization in `_extractConfluenceLinks`
   - Enhanced report display with summaries and ✨ indicator
   - Added text wrapping for readable summaries

