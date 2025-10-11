/**
 * Code Chunker
 * 
 * Splits source code files into semantic chunks for embedding and indexing.
 * Preserves context and extracts metadata for better search results.
 * 
 * Features:
 * 1. Parse code into functions, classes, and modules
 * 2. Keep chunks within 500-1000 tokens
 * 3. Preserve imports and context
 * 4. Extract metadata (names, types, exports)
 * 5. Handle multiple programming languages
 */

const winston = require('winston');

class CodeChunker {
  constructor(options = {}) {
    this.options = {
      logLevel: options.logLevel || 'info',
      minChunkSize: options.minChunkSize || 100, // tokens
      maxChunkSize: options.maxChunkSize || 1000, // tokens
      overlapSize: options.overlapSize || 50, // tokens
      ...options
    };

    this.logger = winston.createLogger({
      level: this.options.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/code-chunker.log' })
      ],
      defaultMeta: { service: 'code-chunker' }
    });

    this.logger.info('Code Chunker initialized');
  }

  /**
   * Estimate token count (rough approximation)
   * @private
   */
  _estimateTokens(text) {
    // Rough estimate: ~4 chars per token for code
    return Math.ceil(text.length / 4);
  }

  /**
   * Extract imports/requires from code
   * @private
   */
  _extractImports(code, language) {
    const imports = [];
    
    if (language === 'javascript' || language === 'typescript') {
      // Match import statements
      const importRegex = /import\s+.*?from\s+['"].*?['"];?/g;
      const requireRegex = /(?:const|let|var)\s+.*?=\s*require\(['"].*?['"]\);?/g;
      
      const importMatches = code.match(importRegex) || [];
      const requireMatches = code.match(requireRegex) || [];
      
      imports.push(...importMatches, ...requireMatches);
    } else if (language === 'python') {
      // Match import statements
      const importRegex = /^(?:import|from)\s+.+$/gm;
      const matches = code.match(importRegex) || [];
      imports.push(...matches);
    }
    
    return imports.join('\n');
  }

  /**
   * Parse JavaScript/TypeScript code into chunks
   * @private
   */
  _chunkJavaScript(file) {
    const { content, path } = file;
    const chunks = [];
    
    // Extract imports for context
    const imports = this._extractImports(content, file.language);
    
    // Regex patterns for functions and classes
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{[^]*?\n\}/g;
    const arrowFunctionRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[^]*?\n\};?/g;
    const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{[^]*?\n\}/g;
    
    let match;
    
    // Extract functions
    while ((match = functionRegex.exec(content)) !== null) {
      const functionCode = match[0];
      const functionName = match[1];
      const tokens = this._estimateTokens(functionCode);
      
      if (tokens >= this.options.minChunkSize) {
        chunks.push({
          content: imports + '\n\n' + functionCode,
          type: 'function',
          name: functionName,
          tokens: tokens + this._estimateTokens(imports),
          startLine: content.substring(0, match.index).split('\n').length,
          language: file.language
        });
      }
    }
    
    // Extract arrow functions
    while ((match = arrowFunctionRegex.exec(content)) !== null) {
      const functionCode = match[0];
      const functionName = match[1];
      const tokens = this._estimateTokens(functionCode);
      
      if (tokens >= this.options.minChunkSize) {
        chunks.push({
          content: imports + '\n\n' + functionCode,
          type: 'function',
          name: functionName,
          tokens: tokens + this._estimateTokens(imports),
          startLine: content.substring(0, match.index).split('\n').length,
          language: file.language
        });
      }
    }
    
    // Extract classes
    while ((match = classRegex.exec(content)) !== null) {
      const classCode = match[0];
      const className = match[1];
      const tokens = this._estimateTokens(classCode);
      
      if (tokens <= this.options.maxChunkSize) {
        chunks.push({
          content: imports + '\n\n' + classCode,
          type: 'class',
          name: className,
          tokens: tokens + this._estimateTokens(imports),
          startLine: content.substring(0, match.index).split('\n').length,
          language: file.language
        });
      } else {
        // Class is too large, chunk it into methods
        const methodChunks = this._chunkLargeClass(classCode, className, imports, file.language);
        chunks.push(...methodChunks);
      }
    }
    
    // If no chunks found or very small file, create one chunk for entire file
    if (chunks.length === 0 && this._estimateTokens(content) < this.options.maxChunkSize) {
      chunks.push({
        content: content,
        type: 'file',
        name: path.split('/').pop(),
        tokens: this._estimateTokens(content),
        startLine: 1,
        language: file.language
      });
    }
    
    return chunks;
  }

  /**
   * Chunk large class into methods
   * @private
   */
  _chunkLargeClass(classCode, className, imports, language) {
    const chunks = [];
    const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{[^]*?\n  \}/g;
    
    let match;
    while ((match = methodRegex.exec(classCode)) !== null) {
      const methodCode = match[0];
      const methodName = match[1];
      const tokens = this._estimateTokens(methodCode);
      
      if (tokens >= this.options.minChunkSize) {
        chunks.push({
          content: imports + '\n\n// From class: ' + className + '\n' + methodCode,
          type: 'method',
          name: `${className}.${methodName}`,
          tokens: tokens + this._estimateTokens(imports),
          startLine: classCode.substring(0, match.index).split('\n').length,
          language: language
        });
      }
    }
    
    return chunks;
  }

  /**
   * Parse Python code into chunks
   * @private
   */
  _chunkPython(file) {
    const { content, path } = file;
    const chunks = [];
    
    // Extract imports
    const imports = this._extractImports(content, file.language);
    
    // Regex patterns for functions and classes
    const functionRegex = /^(?:async\s+)?def\s+(\w+)\s*\([^)]*\):[^]*?(?=\n(?:def|class|\Z))/gm;
    const classRegex = /^class\s+(\w+)(?:\([^)]*\))?:[^]*?(?=\n(?:def|class|\Z))/gm;
    
    let match;
    
    // Extract functions
    while ((match = functionRegex.exec(content)) !== null) {
      const functionCode = match[0];
      const functionName = match[1];
      const tokens = this._estimateTokens(functionCode);
      
      if (tokens >= this.options.minChunkSize) {
        chunks.push({
          content: imports + '\n\n' + functionCode,
          type: 'function',
          name: functionName,
          tokens: tokens + this._estimateTokens(imports),
          startLine: content.substring(0, match.index).split('\n').length,
          language: file.language
        });
      }
    }
    
    // Extract classes
    while ((match = classRegex.exec(content)) !== null) {
      const classCode = match[0];
      const className = match[1];
      const tokens = this._estimateTokens(classCode);
      
      if (tokens <= this.options.maxChunkSize) {
        chunks.push({
          content: imports + '\n\n' + classCode,
          type: 'class',
          name: className,
          tokens: tokens + this._estimateTokens(imports),
          startLine: content.substring(0, match.index).split('\n').length,
          language: file.language
        });
      }
    }
    
    // If no chunks found, create one for entire file
    if (chunks.length === 0 && this._estimateTokens(content) < this.options.maxChunkSize) {
      chunks.push({
        content: content,
        type: 'file',
        name: path.split('/').pop(),
        tokens: this._estimateTokens(content),
        startLine: 1,
        language: file.language
      });
    }
    
    return chunks;
  }

  /**
   * Generic chunking for other languages (split by lines)
   * @private
   */
  _chunkGeneric(file) {
    const { content, path } = file;
    const chunks = [];
    const lines = content.split('\n');
    
    let currentChunk = [];
    let currentTokens = 0;
    
    for (const line of lines) {
      const lineTokens = this._estimateTokens(line);
      
      if (currentTokens + lineTokens > this.options.maxChunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          content: currentChunk.join('\n'),
          type: 'block',
          name: `${path}:${chunks.length + 1}`,
          tokens: currentTokens,
          startLine: 1,
          language: file.language
        });
        
        // Start new chunk with overlap
        const overlapLines = Math.floor(this.options.overlapSize / (currentTokens / currentChunk.length));
        currentChunk = currentChunk.slice(-overlapLines);
        currentTokens = this._estimateTokens(currentChunk.join('\n'));
      }
      
      currentChunk.push(line);
      currentTokens += lineTokens;
    }
    
    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        type: 'block',
        name: `${path}:${chunks.length + 1}`,
        tokens: currentTokens,
        startLine: 1,
        language: file.language
      });
    }
    
    return chunks;
  }

  /**
   * Chunk a single file
   * @param {Object} file - File object with content, path, language
   * @returns {Array} Array of chunks
   */
  chunkFile(file) {
    try {
      this.logger.debug('Chunking file', {
        path: file.path,
        language: file.language,
        size: file.content.length
      });

      let chunks;
      
      if (file.language === 'javascript' || file.language === 'typescript') {
        chunks = this._chunkJavaScript(file);
      } else if (file.language === 'python') {
        chunks = this._chunkPython(file);
      } else {
        chunks = this._chunkGeneric(file);
      }

      // Add file metadata to all chunks
      chunks = chunks.map((chunk, index) => ({
        ...chunk,
        filePath: file.path,
        chunkIndex: index,
        totalChunks: chunks.length
      }));

      this.logger.debug('File chunked', {
        path: file.path,
        chunks: chunks.length,
        totalTokens: chunks.reduce((sum, c) => sum + c.tokens, 0)
      });

      return chunks;

    } catch (error) {
      this.logger.error('Failed to chunk file', {
        path: file.path,
        error: error.message
      });
      
      // Return entire file as single chunk on error
      return [{
        content: file.content,
        type: 'file',
        name: file.path.split('/').pop(),
        filePath: file.path,
        tokens: this._estimateTokens(file.content),
        startLine: 1,
        language: file.language,
        chunkIndex: 0,
        totalChunks: 1
      }];
    }
  }

  /**
   * Chunk multiple files
   * @param {Array} files - Array of file objects
   * @returns {Array} Array of all chunks from all files
   */
  chunkFiles(files) {
    this.logger.info('Chunking files', { fileCount: files.length });
    
    const startTime = Date.now();
    const allChunks = [];
    
    for (const file of files) {
      const chunks = this.chunkFile(file);
      allChunks.push(...chunks);
    }
    
    const processingTime = Date.now() - startTime;
    
    this.logger.info('Files chunked', {
      files: files.length,
      chunks: allChunks.length,
      totalTokens: allChunks.reduce((sum, c) => sum + c.tokens, 0),
      processingTimeMs: processingTime
    });
    
    return allChunks;
  }
}

module.exports = CodeChunker;

