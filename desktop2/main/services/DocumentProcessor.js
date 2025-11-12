/**
 * Document Processor Service
 * Extracts text content from various document formats (PDF, DOCX, TXT, MD)
 * Used for report generation with uploaded file context
 */

const pdf = require('pdf-parse');
const mammoth = require('mammoth');

class DocumentProcessor {
  constructor(logger = console) {
    this.logger = logger;
  }

  /**
   * Extract text from a single file based on its type
   * @param {Object} file - File object with name, content (base64), type, size
   * @returns {Promise<string>} Extracted text content
   */
  async extractTextFromFile(file) {
    const { name, content, type } = file;
    
    try {
      // Convert base64 to buffer (remove data:mime;base64, prefix if present)
      const base64Data = content.includes(',') ? content.split(',')[1] : content;
      const buffer = Buffer.from(base64Data, 'base64');
      
      this.logger.info('Extracting text from file', { 
        filename: name, 
        size: buffer.length,
        type 
      });

      // PDF files
      if (name.toLowerCase().endsWith('.pdf')) {
        const data = await pdf(buffer);
        this.logger.info('PDF text extracted', { 
          filename: name, 
          pages: data.numpages,
          textLength: data.text.length 
        });
        return data.text;
      } 
      
      // DOCX files
      else if (name.toLowerCase().endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer });
        this.logger.info('DOCX text extracted', { 
          filename: name, 
          textLength: result.value.length 
        });
        return result.value;
      } 
      
      // Plain text and markdown files
      else if (name.toLowerCase().endsWith('.txt') || name.toLowerCase().endsWith('.md')) {
        const text = buffer.toString('utf-8');
        this.logger.info('Text file extracted', { 
          filename: name, 
          textLength: text.length 
        });
        return text;
      } 
      
      // DOC files (legacy format - not fully supported)
      else if (name.toLowerCase().endsWith('.doc')) {
        throw new Error('.doc files are not supported. Please convert to .docx format.');
      }
      
      else {
        throw new Error(`Unsupported file type: ${name}`);
      }
    } catch (error) {
      this.logger.error('Failed to extract text from file', { 
        filename: name, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Process multiple files and extract text from each
   * @param {Array} files - Array of file objects
   * @returns {Promise<Array>} Array of results with filename, content, wordCount, or error
   */
  async processFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      return [];
    }

    this.logger.info('Processing multiple files', { count: files.length });

    const results = [];
    
    for (const file of files) {
      try {
        const text = await this.extractTextFromFile(file);
        const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
        
        results.push({
          filename: file.name,
          content: text,
          wordCount,
          size: file.size,
          success: true
        });
        
        this.logger.info('File processed successfully', { 
          filename: file.name, 
          wordCount 
        });
      } catch (error) {
        results.push({
          filename: file.name,
          error: error.message,
          success: false
        });
        
        this.logger.warn('File processing failed', { 
          filename: file.name, 
          error: error.message 
        });
      }
    }

    this.logger.info('File processing complete', { 
      total: files.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    return results;
  }

  /**
   * Validate file before processing
   * @param {Object} file - File object
   * @param {Object} options - Validation options (maxSize, allowedTypes)
   * @returns {Object} { valid: boolean, error?: string }
   */
  validateFile(file, options = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['.pdf', '.docx', '.txt', '.md']
    } = options;

    // Check file size
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File too large: ${file.name} (max ${(maxSize / 1024 / 1024).toFixed(1)}MB)`
      };
    }

    // Check file type
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(ext)) {
      return {
        valid: false,
        error: `Invalid file type: ${file.name}. Allowed: ${allowedTypes.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Validate multiple files
   * @param {Array} files - Array of file objects
   * @param {Object} options - Validation options
   * @returns {Object} { valid: Array, invalid: Array }
   */
  validateFiles(files, options = {}) {
    const valid = [];
    const invalid = [];

    for (const file of files) {
      const result = this.validateFile(file, options);
      if (result.valid) {
        valid.push(file);
      } else {
        invalid.push({ file, error: result.error });
      }
    }

    return { valid, invalid };
  }
}

module.exports = DocumentProcessor;

