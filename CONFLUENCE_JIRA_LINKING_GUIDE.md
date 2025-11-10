# How to Link Confluence Documentation to JIRA Tickets

There are three ways to link Confluence documentation to JIRA tickets in HeyJarvis. Each has different use cases.

## 📋 Current Implementation (Automatic Search)

**How it works:**
- When generating a report, the system automatically searches Confluence for pages that mention the JIRA ticket name
- Uses `confluenceService.searchPages(epicName, { limit: 5 })`

**Pros:**
- ✅ Automatic - no manual linking needed
- ✅ Finds related docs even if not explicitly linked

**Cons:**
- ❌ May return irrelevant results
- ❌ Relies on naming conventions
- ❌ No control over which docs appear

**Code Location:**
```javascript
// core/reporting/feature-report-generator.js (line 39-49)
// Fetch supporting Confluence documentation
let confluenceDocs = [];
if (this.confluenceService) {
  try {
    const epicName = epic?.fields?.summary || epicKey;
    const searchResult = await this.confluenceService.searchPages(epicName, { limit: 5 });
    confluenceDocs = searchResult?.results || [];
  } catch (confError) {
    this.logger.warn('Failed to fetch Confluence docs', { error: confError.message });
  }
}
```

---

## 🔗 Method 1: JIRA Web Links (Recommended)

**Best for:** Explicitly linking specific Confluence pages to JIRA tickets

### How to Add Links in JIRA:

1. Open your JIRA ticket (e.g., `PROJ-123`)
2. Click **"Link"** button (or press `L`)
3. Select **"Web Link"**
4. Enter:
   - **URL:** `https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/12345/Page+Title`
   - **Title:** "Technical Design Doc" (or any description)
5. Click **"Link"**

### Implementation in Code:

Add this method to `core/integrations/jira-service.js`:

```javascript
/**
 * Get web links (including Confluence pages) for an issue
 * @param {string} issueKeyOrId - Issue key (e.g., 'PROJ-123') or ID
 * @returns {Promise<Array>} Array of web links
 */
async getIssueWebLinks(issueKeyOrId) {
  try {
    this.logger.info('Fetching web links for issue', { issueKeyOrId });
    
    // Fetch issue with remotelinks expanded
    const response = await this._makeRequest(
      `/rest/api/3/issue/${issueKeyOrId}?fields=remotelink`
    );
    
    // Get remote links (web links)
    const remoteLinksResponse = await this._makeRequest(
      `/rest/api/3/issue/${issueKeyOrId}/remotelink`
    );
    
    // Filter for Confluence links
    const confluenceLinks = remoteLinksResponse.filter(link => {
      const url = link.object?.url || '';
      return url.includes('atlassian.net/wiki') || url.includes('confluence');
    });
    
    this.logger.info('Web links retrieved', {
      issueKey: issueKeyOrId,
      totalLinks: remoteLinksResponse.length,
      confluenceLinks: confluenceLinks.length
    });
    
    return confluenceLinks.map(link => ({
      id: link.id,
      title: link.object?.title || 'Untitled',
      url: link.object?.url,
      summary: link.object?.summary || '',
      icon: link.object?.icon?.url16x16,
      status: link.object?.status
    }));
    
  } catch (error) {
    this.logger.error('Failed to get web links', {
      issueKeyOrId,
      error: error.message
    });
    throw error;
  }
}
```

Then update `feature-report-generator.js`:

```javascript
// In _fetchData method (around line 39)
// Fetch Confluence docs linked via JIRA web links
let confluenceDocs = [];
if (this.jiraService) {
  try {
    // Method 1: Get explicitly linked Confluence pages
    const webLinks = await this.jiraService.getIssueWebLinks(epicKey);
    
    // Method 2: Also search for related pages (fallback)
    let searchResults = [];
    if (this.confluenceService && webLinks.length === 0) {
      const epicName = epic?.fields?.summary || epicKey;
      const searchResult = await this.confluenceService.searchPages(epicName, { limit: 5 });
      searchResults = searchResult?.results || [];
    }
    
    // Combine both sources
    confluenceDocs = [
      ...webLinks,
      ...searchResults.map(page => ({
        title: page.title,
        url: page._links?.webui || page.url,
        excerpt: page.excerpt,
        isLinked: false // Mark as search result, not explicit link
      }))
    ];
    
  } catch (error) {
    this.logger.warn('Failed to fetch Confluence docs', { error: error.message });
  }
}
```

---

## 🏷️ Method 2: JIRA Custom Field (Most Flexible)

**Best for:** Storing multiple Confluence page IDs or URLs in a structured way

### Setup:

1. **Create Custom Field in JIRA:**
   - Go to JIRA Settings → Issues → Custom Fields
   - Click "Create Custom Field"
   - Choose "Text Field (multi-line)" or "URL Field"
   - Name it: "Confluence Documentation"
   - Add to relevant screens

2. **Add Confluence URLs to Tickets:**
   - Open a JIRA ticket
   - Find the "Confluence Documentation" field
   - Enter URLs (one per line):
     ```
     https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/12345/Design
     https://your-domain.atlassian.net/wiki/spaces/SPACE/pages/67890/API-Spec
     ```

### Implementation:

```javascript
// In feature-report-generator.js _fetchData method
// Fetch Confluence docs from custom field
let confluenceDocs = [];
if (epic?.fields?.customfield_10050) { // Replace with your custom field ID
  const confluenceUrls = epic.fields.customfield_10050
    .split('\n')
    .filter(url => url.trim().length > 0);
  
  // Fetch page details from Confluence
  for (const url of confluenceUrls) {
    try {
      // Extract page ID from URL
      const pageIdMatch = url.match(/pages\/(\d+)/);
      if (pageIdMatch && this.confluenceService) {
        const pageId = pageIdMatch[1];
        const page = await this.confluenceService.getPage(pageId);
        confluenceDocs.push({
          title: page.title,
          url: page._links.webui,
          excerpt: page.body?.view?.value?.substring(0, 200),
          isLinked: true
        });
      }
    } catch (error) {
      this.logger.warn('Failed to fetch Confluence page', { url, error: error.message });
    }
  }
}
```

---

## 📎 Method 3: Confluence "Related Pages" (Automatic)

**Best for:** Bidirectional linking from Confluence to JIRA

### How it Works:

Confluence has a feature to automatically link pages to JIRA issues:

1. **In Confluence page editor:**
   - Type `/jira` to insert JIRA macro
   - Select "JIRA Issue/Filter"
   - Enter JIRA key (e.g., `PROJ-123`)
   - The page now references the JIRA ticket

2. **Fetch from JIRA:**
   - JIRA API can return pages that reference the issue

### Implementation:

Add this to `confluence-service.js`:

```javascript
/**
 * Get Confluence pages that reference a JIRA issue
 * @param {string} issueKey - JIRA issue key (e.g., 'PROJ-123')
 * @returns {Promise<Array>} Array of Confluence pages
 */
async getPagesReferencingJiraIssue(issueKey) {
  try {
    this.logger.info('Searching for pages referencing JIRA issue', { issueKey });
    
    // Search for pages containing the JIRA key
    const searchResult = await this.searchPages(issueKey, {
      limit: 10,
      cql: `text ~ "${issueKey}"`
    });
    
    return searchResult?.results || [];
    
  } catch (error) {
    this.logger.error('Failed to search for pages', {
      issueKey,
      error: error.message
    });
    throw error;
  }
}
```

---

## 🎯 Recommended Approach: Hybrid Strategy

Use **Method 1 (JIRA Web Links)** as primary, with **Method 3 (Search)** as fallback:

```javascript
// In feature-report-generator.js _fetchData method
async _fetchData(epicKey, options) {
  // ... fetch epic and stories ...
  
  // Fetch Confluence docs (hybrid approach)
  let confluenceDocs = [];
  
  try {
    // 1. Try to get explicitly linked pages (JIRA Web Links)
    if (this.jiraService.getIssueWebLinks) {
      const webLinks = await this.jiraService.getIssueWebLinks(epicKey);
      confluenceDocs = webLinks.map(link => ({
        ...link,
        linkType: 'explicit' // Mark as explicitly linked
      }));
      
      this.logger.info('Found explicitly linked Confluence pages', { 
        count: confluenceDocs.length 
      });
    }
    
    // 2. If no explicit links, search for related pages
    if (confluenceDocs.length === 0 && this.confluenceService) {
      const epicName = epic?.fields?.summary || epicKey;
      const searchResult = await this.confluenceService.searchPages(epicName, { 
        limit: 5 
      });
      
      confluenceDocs = (searchResult?.results || []).map(page => ({
        title: page.title,
        url: page._links?.webui || page.url,
        excerpt: page.excerpt,
        linkType: 'search' // Mark as search result
      }));
      
      this.logger.info('Found Confluence pages via search', { 
        count: confluenceDocs.length 
      });
    }
    
  } catch (confError) {
    this.logger.warn('Failed to fetch Confluence docs', { 
      error: confError.message 
    });
  }
  
  return {
    epicKey,
    epic,
    stories,
    confluenceDocs,
    period: this._getPeriod(options)
  };
}
```

---

## 🚀 Quick Start: Add Web Links Support Now

### Step 1: Add method to JIRA service

Add this to `/Users/jarvis/Code/DXProj/BeachBaby/core/integrations/jira-service.js`:

```javascript
/**
 * Get remote links (web links) for an issue
 */
async getIssueRemoteLinks(issueKeyOrId) {
  try {
    this.logger.info('Fetching remote links', { issueKeyOrId });
    const response = await this._makeRequest(
      `/rest/api/3/issue/${issueKeyOrId}/remotelink`
    );
    return response || [];
  } catch (error) {
    this.logger.error('Failed to get remote links', { error: error.message });
    return [];
  }
}
```

### Step 2: Update desktop wrapper

Add proxy method to `/Users/jarvis/Code/DXProj/BeachBaby/desktop2/main/services/JIRAService.js`:

```javascript
async getIssueRemoteLinks(issueKeyOrId) {
  if (!this.isConnected()) {
    throw new Error('JIRA not connected');
  }
  return this.jiraCore.getIssueRemoteLinks(issueKeyOrId);
}
```

### Step 3: Update report generator

Modify `/Users/jarvis/Code/DXProj/BeachBaby/core/reporting/feature-report-generator.js`:

```javascript
// Around line 39, replace the Confluence search with:
let confluenceDocs = [];

// Try to get web links first
try {
  const remoteLinks = await this.jiraService.getIssueRemoteLinks(epicKey);
  
  // Filter for Confluence links
  confluenceDocs = remoteLinks
    .filter(link => {
      const url = link.object?.url || '';
      return url.includes('atlassian.net/wiki') || url.includes('confluence');
    })
    .map(link => ({
      title: link.object?.title || 'Untitled',
      url: link.object?.url,
      excerpt: link.object?.summary || '',
      linkType: 'explicit'
    }));
    
  this.logger.info('Found linked Confluence pages', { count: confluenceDocs.length });
  
} catch (error) {
  this.logger.warn('Failed to fetch web links', { error: error.message });
}

// Fallback to search if no explicit links
if (confluenceDocs.length === 0 && this.confluenceService) {
  try {
    const epicName = epic?.fields?.summary || epicKey;
    const searchResult = await this.confluenceService.searchPages(epicName, { limit: 5 });
    confluenceDocs = (searchResult?.results || []).map(page => ({
      title: page.title,
      url: page._links?.webui || page.url,
      excerpt: page.excerpt,
      linkType: 'search'
    }));
  } catch (confError) {
    this.logger.warn('Failed to search Confluence', { error: confError.message });
  }
}
```

---

## 📊 Comparison

| Method | Setup Effort | Accuracy | Maintenance | Best For |
|--------|--------------|----------|-------------|----------|
| **Web Links** | Low | High | Low | Explicit documentation links |
| **Custom Field** | Medium | High | Medium | Structured multi-doc linking |
| **Search** | None | Medium | None | Auto-discovery |
| **Hybrid** | Low | High | Low | Production use (recommended) |

---

## 🎓 Best Practices

1. **Use Web Links for primary docs** - Design specs, API docs, architecture
2. **Use Search as fallback** - Catches related docs not explicitly linked
3. **Add visual indicators** - Show users which docs are explicitly linked vs. discovered
4. **Cache results** - Confluence API calls can be slow
5. **Handle errors gracefully** - Don't fail report generation if Confluence is down

---

## 🔍 Testing

### Test Web Links:
1. Open a JIRA ticket in your browser
2. Add a web link to a Confluence page
3. Generate a report for that ticket
4. Verify the Confluence page appears in "Supporting Documentation"

### Test Search Fallback:
1. Create a JIRA ticket without web links
2. Create a Confluence page that mentions the ticket key
3. Generate a report
4. Verify the page is found via search

