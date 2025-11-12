# Report Generation Enhancement - Confluence Links & File Upload

## 📋 Overview

Enhanced the Feature Report generation system to accept additional context sources:
1. **User-provided Confluence page URLs** - Add specific Confluence documentation
2. **File uploads** - Upload PDF, DOCX, TXT, MD files for additional context

## ✅ What Was Implemented

### 1. **Document Processing Service** (`desktop2/main/services/DocumentProcessor.js`)
- Extracts text from PDF files using `pdf-parse`
- Extracts text from DOCX files using `mammoth`
- Supports TXT and MD files natively
- Validates file types and sizes (max 10MB)
- Returns structured results with word counts and error handling

**Key Methods:**
- `extractTextFromFile(file)` - Extract text from a single file
- `processFiles(files)` - Batch process multiple files
- `validateFile(file, options)` - Validate file before processing

### 2. **Frontend UI Updates** (`ReportsCarousel.jsx`)

**New State Variables:**
```javascript
const [confluenceLinks, setConfluenceLinks] = useState([]);
const [uploadedFiles, setUploadedFiles] = useState([]);
const [confluenceLinkInput, setConfluenceLinkInput] = useState('');
```

**New Features:**
- **Confluence Link Input**: Text input with "Add" button to collect multiple Confluence URLs
- **File Upload**: Multi-file input supporting PDF, DOC, DOCX, TXT, MD
- **Visual Chips**: Display added links and files as removable chips
- **Validation**: 
  - Confluence URLs must contain "atlassian.net/wiki" or "confluence"
  - Files limited to 10MB each
  - Only allowed file types accepted

**User Flow:**
1. Enter epic key (required)
2. Optionally add Confluence page URLs (press Enter or click Add)
3. Optionally upload context files
4. Click "Generate Report"

### 3. **CSS Styling** (`ReportsCarousel.css`)

Added styles for:
- `.input-with-button` - Inline input with button layout
- `.add-link-btn` - Styled "Add" button for Confluence links
- `.link-chips` / `.file-chips` - Chip container layout
- `.chip` - Individual chip styling with hover effects
- `.chip-remove` - Remove button with hover effects
- `.file-input` - Styled file input with custom file selector button

### 4. **Backend Enhancement** (`core/reporting/feature-report-generator.js`)

**Updated `_fetchData()` method:**
- Processes `options.additionalConfluenceLinks` array
- Fetches full Confluence page content using `confluenceService.getPageById()`
- Extracts page ID from Confluence URLs
- Processes `options.uploadedFiles` array using `DocumentProcessor`
- Returns enhanced data object with `confluenceDocs` and `uploadedDocuments`

**New Helper Method:**
```javascript
_extractPageIdFromUrl(url) {
  // Extracts page ID from Confluence URL
  // Format: https://domain.atlassian.net/wiki/spaces/SPACE/pages/123456/Page+Title
}
```

**Updated `_generateBasicSummary()` method:**
- Added new section "📎 UPLOADED CONTEXT FILES"
- Displays filename, size, word count, and preview for each uploaded file
- Shows error messages for failed file processing
- Added emoji indicator (👤) for user-provided Confluence links

**Enhanced AI Summarization:**
- Includes content from user-provided Confluence pages (up to 1000 chars each)
- Includes content from uploaded files (up to 1000 chars each)
- AI prompt updated to incorporate additional context sources
- Provides richer, more comprehensive summaries

### 5. **NPM Dependencies**

Added to `desktop2/package.json`:
```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0"
  }
}
```

## 🎯 Usage Example

### Frontend (User Interaction)
```javascript
// User adds Confluence links
setConfluenceLinks([
  'https://company.atlassian.net/wiki/spaces/PROJ/pages/123456/Feature-Spec',
  'https://company.atlassian.net/wiki/spaces/PROJ/pages/789012/Technical-Design'
]);

// User uploads files
handleFileUpload([
  { name: 'requirements.pdf', size: 245760, type: 'application/pdf', content: 'base64...' },
  { name: 'design-doc.docx', size: 102400, type: 'application/vnd...', content: 'base64...' }
]);

// Generate report with additional context
const options = {
  additionalConfluenceLinks: confluenceLinks,
  uploadedFiles: uploadedFiles
};
await window.electronAPI.reporting.generateReport('feature', 'PROJ-123', options);
```

### Backend (Report Generation)
```javascript
// FeatureReportGenerator processes additional context
const data = await _fetchData(epicKey, options);
// data now includes:
// - confluenceDocs: [...auto-detected, ...user-provided]
// - uploadedDocuments: [{ filename, content, wordCount, success }]

// AI summarization includes all context
const summary = await _generateBasicSummary(metrics, data);
// Summary includes sections for:
// - Feature Description (with AI-enhanced content from all sources)
// - Progress from JIRA
// - Supporting Documentation (Confluence)
// - Uploaded Context Files
```

## 📊 Report Output Format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 FEATURE DESCRIPTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Epic Name] (PROJ-123)

[AI-enhanced description incorporating JIRA description, 
Confluence pages, and uploaded files]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 PROGRESS FROM JIRA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Completion: 65% complete
Stories: 13/20 completed
Story Points: 45/70 delivered
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 SUPPORTING DOCUMENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 🔗 Feature Specification
   https://company.atlassian.net/wiki/...
   
2. 👤 Technical Design Document
   https://company.atlassian.net/wiki/...
   
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📎 UPLOADED CONTEXT FILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 📄 requirements.pdf
   Size: 240.0 KB | Words: 3,450
   Preview: The system shall provide real-time notifications...

2. 📄 design-doc.docx
   Size: 100.0 KB | Words: 2,100
   Preview: Architecture Overview: The application follows...
```

## 🔒 Security & Validation

### File Upload Security
- **File Type Whitelist**: Only `.pdf`, `.doc`, `.docx`, `.txt`, `.md` allowed
- **Size Limit**: 10MB per file
- **Content Validation**: Files validated before processing
- **Error Handling**: Failed files don't break report generation

### Confluence URL Validation
- **URL Format Check**: Must contain "atlassian.net/wiki" or "confluence"
- **Page ID Extraction**: Validates URL structure
- **Graceful Degradation**: Invalid URLs still included as links

### Data Transfer
- **Base64 Encoding**: Files converted to base64 for IPC transfer
- **Structured Format**: Consistent data structure across layers
- **Error Propagation**: Errors captured and reported to user

## 🚀 Benefits

1. **Richer Context**: AI summaries now incorporate multiple information sources
2. **Flexibility**: Users can provide additional context beyond JIRA
3. **Documentation Integration**: Seamless Confluence integration
4. **File Support**: Accept external documents (specs, designs, requirements)
5. **Better Reports**: More comprehensive and accurate feature reports
6. **User Control**: Users decide what additional context to include

## 🔧 Technical Details

### File Processing Flow
```
User Upload → Frontend Validation → Base64 Encoding → IPC Transfer →
Backend DocumentProcessor → Text Extraction → Report Generator →
AI Summarization → Final Report
```

### Confluence Integration Flow
```
User URL Input → Frontend Validation → IPC Transfer → 
Backend FeatureReportGenerator → Page ID Extraction →
ConfluenceService.getPageById() → Content Extraction →
AI Summarization → Final Report
```

## 📝 Future Enhancements

Potential improvements:
- Support for additional file formats (Excel, PowerPoint)
- OCR for scanned PDFs
- Automatic Confluence page suggestions based on epic content
- File content search and highlighting
- Caching of processed files
- Batch file upload with progress indicator
- Drag-and-drop file upload
- Preview of uploaded file content before report generation

## 🐛 Known Limitations

1. `.doc` files (legacy Word format) not supported - users must convert to `.docx`
2. File content limited to 1000 characters per source in AI context (to manage token limits)
3. Confluence page content extraction depends on page permissions
4. Large files (>10MB) rejected - users must split or compress
5. No support for password-protected PDFs

## ✅ Testing Checklist

- [x] File upload validation (type, size)
- [x] PDF text extraction
- [x] DOCX text extraction
- [x] TXT/MD file reading
- [x] Confluence URL validation
- [x] Confluence page fetching
- [x] Report generation with additional context
- [x] AI summarization with multiple sources
- [x] Error handling for failed files
- [x] UI chip display and removal
- [x] Modal state management
- [x] CSS styling and responsiveness

## 📦 Files Modified

1. `desktop2/main/services/DocumentProcessor.js` (NEW)
2. `desktop2/renderer2/src/components/MissionControl/carousels/ReportsCarousel.jsx`
3. `desktop2/renderer2/src/components/MissionControl/carousels/ReportsCarousel.css`
4. `core/reporting/feature-report-generator.js`
5. `desktop2/package.json` (dependencies)

## 🎉 Summary

This enhancement transforms the report generation system from a JIRA-only data source to a flexible, multi-source context aggregator. Users can now provide rich additional context through Confluence pages and uploaded documents, resulting in more comprehensive and accurate feature reports powered by AI summarization.

