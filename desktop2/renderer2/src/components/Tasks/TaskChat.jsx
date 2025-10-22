import { useState, useEffect, useRef } from 'react';
import './TaskChat.css';

export default function TaskChat({ task, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Sonnet 4.5');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [viewMode, setViewMode] = useState('acceptance'); // 'acceptance' or 'requirements'
  const [productRequirements, setProductRequirements] = useState(null);
  const [isGeneratingRequirements, setIsGeneratingRequirements] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingRepository, setIsEditingRepository] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDescription, setEditedDescription] = useState(task.description);
  const [editedRepository, setEditedRepository] = useState(task.repository || '');
  const [isSaving, setIsSaving] = useState(false);
  const [availableRepositories, setAvailableRepositories] = useState([]);

  const models = ['Sonnet 4.5', 'Sonnet 3.5', 'Opus 3', 'Haiku 3.5'];

  // Debug: Log task data to see what we're receiving
  useEffect(() => {
    console.log('📋 TaskChat received task data:', {
      id: task.id,
      title: task.title,
      external_source: task.external_source,
      isJiraTask: task.external_source === 'jira',
      hasDescription: !!task.description,
      descriptionType: typeof task.description,
      descriptionPreview: task.description ? 
        (typeof task.description === 'object' ? 
          JSON.stringify(task.description).substring(0, 200) : 
          task.description.substring(0, 200)) : 
        'NO DESCRIPTION',
      allTaskKeys: Object.keys(task)
    });
    
    // Check if editing is enabled
    console.log('🔧 Editing enabled?', {
      titleClickable: task.external_source === 'jira',
      descriptionClickable: task.external_source === 'jira'
    });
  }, [task]);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
    
    // Load chat history for this task
    loadChatHistory();
    
    // Load available repositories if JIRA task
    if (task.external_source === 'jira') {
      loadAvailableRepositories();
    }
  }, [task.id]);

  const loadAvailableRepositories = async () => {
    try {
      const response = await window.electronAPI.codeIndexer.listRepositories();
      if (response.success && response.repositories) {
        setAvailableRepositories(response.repositories.map(repo => repo.name));
      }
    } catch (error) {
      console.error('Failed to load repositories:', error);
    }
  };

  const saveTitle = async () => {
    if (!editedTitle.trim()) {
      alert('Title cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const response = await window.electronAPI.jira.updateIssue(task.id, {
        summary: editedTitle
      });

      if (response.success) {
        // Update local task object
        task.title = editedTitle;
        setIsEditingTitle(false);
      } else {
        alert('Failed to update title: ' + (response.error || 'Unknown error'));
        setEditedTitle(task.title); // Revert
      }
    } catch (error) {
      console.error('Failed to save title:', error);
      alert('Failed to update title');
      setEditedTitle(task.title); // Revert
    } finally {
      setIsSaving(false);
    }
  };

  const cancelTitleEdit = () => {
    setEditedTitle(task.title);
    setIsEditingTitle(false);
  };

  const hasTitleChanged = () => {
    return editedTitle !== task.title;
  };

  const convertHTMLToADF = (html) => {
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (!text || text.trim() === '') return null;
        return {
          type: 'text',
          text: text
        };
      }
      
      const tagName = node.tagName?.toLowerCase();
      
      switch (tagName) {
        case 'p':
          const pContent = Array.from(node.childNodes).map(processNode).filter(Boolean);
          return pContent.length > 0 ? { type: 'paragraph', content: pContent } : null;
        
        case 'table':
          const rows = Array.from(node.querySelectorAll('tr')).map(tr => {
            const cells = Array.from(tr.children).map(cell => {
              const cellContent = Array.from(cell.childNodes).map(processNode).filter(Boolean);
              return {
                type: cell.tagName.toLowerCase() === 'th' ? 'tableHeader' : 'tableCell',
                content: cellContent.length > 0 ? cellContent : [{ type: 'paragraph', content: [] }]
              };
            });
            return { type: 'tableRow', content: cells };
          });
          return { type: 'table', content: rows };
        
        case 'strong':
        case 'b':
          const strongText = node.textContent;
          return strongText ? {
            type: 'text',
            text: strongText,
            marks: [{ type: 'strong' }]
          } : null;
        
        case 'em':
        case 'i':
          const emText = node.textContent;
          return emText ? {
            type: 'text',
            text: emText,
            marks: [{ type: 'em' }]
          } : null;
        
        case 'code':
          const codeText = node.textContent;
          return codeText ? {
            type: 'text',
            text: codeText,
            marks: [{ type: 'code' }]
          } : null;
        
        default:
          // For unknown tags, process children
          const children = Array.from(node.childNodes).map(processNode).filter(Boolean);
          return children.length === 1 ? children[0] : (children.length > 0 ? { type: 'paragraph', content: children } : null);
      }
    };
    
    const content = Array.from(tempDiv.childNodes).map(processNode).filter(Boolean);
    
    return {
      version: 1,
      type: 'doc',
      content: content
    };
  };

  const saveDescription = async () => {
    setIsSaving(true);
    try {
      // Determine the format and convert if needed
      let descriptionToSave;
      let isADF = false;
      
      if (typeof editedDescription === 'string' && editedDescription.includes('<')) {
        // HTML string - convert to ADF
        descriptionToSave = convertHTMLToADF(editedDescription);
        isADF = true;
      } else if (typeof editedDescription === 'object') {
        // Already an ADF object
        descriptionToSave = editedDescription;
        isADF = true;
      } else {
        // Plain text string
        descriptionToSave = editedDescription;
        isADF = false;
      }
      
      console.log('💾 Saving description:', {
        type: typeof descriptionToSave,
        isADF,
        preview: isADF ? 'ADF object' : descriptionToSave.substring(0, 100)
      });
      
      const response = await window.electronAPI.jira.updateIssue(task.id, {
        descriptionADF: isADF ? descriptionToSave : null,
        description: !isADF ? descriptionToSave : null
      });

      if (response.success) {
        // Update local task object
        task.description = descriptionToSave;
        setIsEditingDescription(false);
        alert('Description updated successfully in JIRA!');
      } else {
        alert('Failed to update description: ' + (response.error || 'Unknown error'));
        setEditedDescription(task.description); // Revert
      }
    } catch (error) {
      console.error('Failed to save description:', error);
      alert('Failed to update description: ' + error.message);
      setEditedDescription(task.description); // Revert
    } finally {
      setIsSaving(false);
    }
  };

  const cancelDescriptionEdit = () => {
    setEditedDescription(task.description);
    setIsEditingDescription(false);
  };

  const hasDescriptionChanged = () => {
    return editedDescription !== task.description;
  };

  const saveRepository = async () => {
    if (editedRepository === task.repository) {
      setIsEditingRepository(false);
      return;
    }

    setIsSaving(true);
    try {
      // Update JIRA with repository link in custom field or comment
      const response = await window.electronAPI.jira.updateIssue(task.id, {
        customFields: {
          repository: editedRepository
        }
      });

      if (response.success) {
        // Update local task object
        task.repository = editedRepository;
        setIsEditingRepository(false);
      } else {
        alert('Failed to update repository: ' + (response.error || 'Unknown error'));
        setEditedRepository(task.repository || ''); // Revert
      }
    } catch (error) {
      console.error('Failed to save repository:', error);
      alert('Failed to update repository');
      setEditedRepository(task.repository || ''); // Revert
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const response = await window.electronAPI.tasks.getChatHistory(task.id);
      if (response.success && response.messages) {
        // Ensure all messages have string content
        const formattedMessages = response.messages.map(msg => ({
          role: msg.role,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: msg.timestamp
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const generateProductRequirements = async () => {
    if (productRequirements) {
      // Already generated, just switch view
      setViewMode('requirements');
      return;
    }

    setIsGeneratingRequirements(true);
    try {
      // Generate AI product requirements silently (without adding to chat history)
      // We'll call the AI directly without triggering the chat interface
      const response = await window.electronAPI.tasks.generateProductRequirements(
        task.id,
        {
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          created_at: task.created_at,
          route_to: task.route_to || 'mission-control',
          work_type: task.work_type || 'task'
        }
      );

      if (response.success) {
        setProductRequirements(response.requirements);
        setViewMode('requirements');
      }
    } catch (error) {
      console.error('Failed to generate product requirements:', error);
      // Fallback: show error message
      setProductRequirements('Failed to generate requirements. Please try again.');
    } finally {
      setIsGeneratingRequirements(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message immediately
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);

    // Show typing indicator
    setIsTyping(true);

    try {
      console.log('📤 Sending chat message for task:', { 
        taskId: task.id, 
        title: task.title,
        jiraUrl: task.jiraUrl || task.external_url,
        external_source: task.external_source
      });
      
      const response = await window.electronAPI.tasks.sendChatMessage(task.id, userMessage, {
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          created_at: task.created_at,
          route_to: task.route_to || 'mission-control', // JIRA tasks go to mission-control
          work_type: task.work_type || 'task'
        }
      });

      console.log('📥 Chat response:', response);

      if (response.success) {
        // Handle response - it might be a string or an object
        const messageContent = typeof response.message === 'string' 
          ? response.message 
          : response.message?.content || JSON.stringify(response.message);
        
        const aiMessage = {
          role: 'assistant',
          content: messageContent,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(response.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Chat error:', error);
      
      // Provide helpful error message based on error type
      let errorContent = 'Sorry, I encountered an error. Please try again.';
      if (error.message === 'Task not found') {
        errorContent = '⚠️ This JIRA task hasn\'t been synced to the database yet. Please wait a moment and try again, or refresh the task list.';
      }
      
      const errorMessage = {
        role: 'assistant',
        content: errorContent,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get priority label
  const getPriorityLabel = () => {
    const labels = {
      urgent: 'Urgent',
      high: 'High',
      medium: 'Medium',
      low: 'Low'
    };
    return labels[task.priority || 'medium'] || 'Medium';
  };

  // Convert JIRA ADF (Atlassian Document Format) to HTML
  const convertADFToHTML = (adf) => {
    if (!adf || !adf.content) return '';
    
    const processNode = (node) => {
      if (!node || !node.type) return '';
      
      switch (node.type) {
        case 'doc':
          return node.content ? node.content.map(processNode).join('') : '';
        
        case 'paragraph':
          const pContent = node.content ? node.content.map(processNode).join('') : '';
          return pContent ? `<p>${pContent}</p>` : '';
        
        case 'text':
          let text = node.text || '';
          // Apply marks (bold, italic, etc.)
          if (node.marks) {
            node.marks.forEach(mark => {
              if (mark.type === 'strong') text = `<strong>${text}</strong>`;
              if (mark.type === 'em') text = `<em>${text}</em>`;
              if (mark.type === 'code') text = `<code>${text}</code>`;
            });
          }
          return text;
        
        case 'table':
          const tableContent = node.content ? node.content.map(processNode).join('') : '';
          return `<table class="markdown-table">${tableContent}</table>`;
        
        case 'tableRow':
          const rowContent = node.content ? node.content.map(processNode).join('') : '';
          return `<tr>${rowContent}</tr>`;
        
        case 'tableHeader':
          const headerContent = node.content ? node.content.map(processNode).join('') : '';
          return `<th>${headerContent}</th>`;
        
        case 'tableCell':
          const cellContent = node.content ? node.content.map(processNode).join('') : '';
          return `<td>${cellContent}</td>`;
        
        case 'heading':
          const level = node.attrs?.level || 1;
          const headingContent = node.content ? node.content.map(processNode).join('') : '';
          return `<h${level}>${headingContent}</h${level}>`;
        
        case 'bulletList':
          const bulletItems = node.content ? node.content.map(processNode).join('') : '';
          return `<ul>${bulletItems}</ul>`;
        
        case 'orderedList':
          const orderedItems = node.content ? node.content.map(processNode).join('') : '';
          return `<ol>${orderedItems}</ol>`;
        
        case 'listItem':
          const listContent = node.content ? node.content.map(processNode).join('') : '';
          return `<li>${listContent}</li>`;
        
        case 'codeBlock':
          const codeContent = node.content ? node.content.map(processNode).join('') : '';
          return `<pre><code>${codeContent}</code></pre>`;
        
        case 'hardBreak':
          return '<br/>';
        
        default:
          // For unknown types, try to process children
          return node.content ? node.content.map(processNode).join('') : '';
      }
    };
    
    // Wrap table rows in thead/tbody based on position
    let html = processNode(adf);
    
    // Post-process: wrap first row of table in thead
    html = html.replace(
      /<table class="markdown-table">(<tr>.*?<\/tr>)/,
      '<table class="markdown-table"><thead>$1</thead><tbody>'
    );
    html = html.replace(/<\/table>/g, '</tbody></table>');
    
    return html;
  };

  // Format markdown content with proper table rendering
  const formatMarkdownContent = (content) => {
    if (!content) return '';
    
    // Check if content is ADF (JSON object)
    if (typeof content === 'object' && content.type === 'doc') {
      return convertADFToHTML(content);
    }
    
    // Otherwise treat as markdown string
    let html = content;
    
    // First, normalize line endings
    html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Convert markdown tables to HTML tables
    const lines = html.split('\n');
    let inTable = false;
    let tableLines = [];
    let result = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line is a table row (contains pipes)
      const isPipeLine = line.includes('|');
      
      if (isPipeLine && !inTable) {
        // Start of a table
        inTable = true;
        tableLines = [line];
      } else if (isPipeLine && inTable) {
        // Continue table
        tableLines.push(line);
      } else if (inTable) {
        // End of table, process it
        result.push(convertTableToHTML(tableLines));
        tableLines = [];
        inTable = false;
        result.push(line);
      } else {
        // Regular line
        result.push(line);
      }
    }
    
    // Process any remaining table
    if (inTable && tableLines.length > 0) {
      result.push(convertTableToHTML(tableLines));
    }
    
    html = result.join('\n');
    
    // Convert other markdown elements
    html = html
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');
    
    // Wrap in paragraph if not already wrapped
    if (!html.includes('<table') && !html.startsWith('<p>')) {
      html = `<p>${html}</p>`;
    }
    
    return html;
  };

  // Helper function to convert markdown table lines to HTML
  const convertTableToHTML = (lines) => {
    if (lines.length < 2) return lines.join('\n');
    
    // Parse header (first line)
    const headerCells = lines[0]
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0)
      .map(cell => `<th>${cell}</th>`)
      .join('');
    
    // Skip separator line (second line, usually |---|---|)
    // Parse data rows (remaining lines)
    const dataRows = lines.slice(2)
      .filter(line => line.trim().length > 0)
      .map(line => {
        const cells = line
          .split('|')
          .map(cell => cell.trim())
          .filter(cell => cell.length > 0)
          .map(cell => `<td>${cell}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    
    return `<table class="markdown-table"><thead><tr>${headerCells}</tr></thead><tbody>${dataRows}</tbody></table>`;
  };

  // Format requirements table with Slack items highlighted in red
  const formatRequirementsWithSlackHighlight = (markdown) => {
    if (!markdown) return '';
    
    let html = formatMarkdownContent(markdown);
    
    // Highlight rows that mention "Slack" in red
    html = html.replace(
      /<td>(.*?Slack.*?)<\/td>/gi,
      '<td><span style="color: #ff4444; font-weight: 500;">$1</span></td>'
    );
    
    // Highlight entire rows with Slack source
    html = html.replace(
      /<tr>((?:<td>.*?<\/td>)*<td>.*?Slack.*?<\/td>(?:<td>.*?<\/td>)*)<\/tr>/gi,
      (match) => {
        return match.replace(/<td>/g, '<td style="color: #ff4444;">');
      }
    );
    
    return html;
  };


  return (
    <div className="task-chat-modal">
      <div className="task-chat-container">
        {/* Header - Task Card */}
        <div className="task-chat-header">
          <div className="task-chat-card">
            <button className="task-chat-close" onClick={onClose}>×</button>
            
            <div className="task-chat-card-header">
              <div className="task-chat-app-icon">
                <img 
                  src="/JIRALOGO.png" 
                  alt="JIRA" 
                  style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                />
              </div>
              <div className="task-chat-title">
                {isEditingTitle ? (
                  <div className="task-chat-name-edit">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="task-title-input"
                      autoFocus
                      disabled={isSaving}
                      placeholder="Enter task title"
                    />
                    {hasTitleChanged() && (
                      <div className="inline-edit-actions">
                        <button 
                          className="inline-save-btn" 
                          onClick={saveTitle}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button 
                          className="inline-cancel-btn" 
                          onClick={cancelTitleEdit}
                          disabled={isSaving}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div 
                    className="task-chat-name clickable" 
                    onClick={() => task.external_source === 'jira' && setIsEditingTitle(true)}
                    title={task.external_source === 'jira' ? 'Click to edit title' : ''}
                  >
                    {task.title}
                  </div>
                )}
                <div className="task-chat-subtitle">
                  {task.epicName && (
                    <span className="task-chat-meta-item">
                      {task.epicName}
                    </span>
                  )}
                  <span className="task-chat-meta-item">
                    {task.id}
                  </span>
                  {task.external_source === 'jira' && (task.repository || isEditingRepository) && (
                    <span className="task-chat-meta-item repository-item">
                      {isEditingRepository ? (
                        <select
                          value={editedRepository}
                          onChange={(e) => setEditedRepository(e.target.value)}
                          onBlur={saveRepository}
                          className="repository-select"
                          autoFocus
                          disabled={isSaving}
                        >
                          <option value="">No repository</option>
                          {availableRepositories.map(repo => (
                            <option key={repo} value={repo}>{repo}</option>
                          ))}
                        </select>
                      ) : (
                        <span 
                          className="repository-link editable"
                          onClick={() => setIsEditingRepository(true)}
                          title="Click to change repository"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                          </svg>
                          {task.repository}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className={`task-chat-priority-badge priority-${task.priority || 'medium'}`}>
              {getPriorityLabel()}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="task-chat-messages">
          {/* Task Description / Requirements Section */}
          {(task.description || task.external_source === 'jira') && (
            <div className="task-requirements-banner">
              <div className="requirements-banner-header">
                <div className="requirements-header-left">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <span>{viewMode === 'acceptance' ? 'Acceptance Criteria' : 'Product Requirements'}</span>
                </div>
                <div className="requirements-toggle">
                  <button
                    className={`toggle-btn ${viewMode === 'acceptance' ? 'active' : ''}`}
                    onClick={() => setViewMode('acceptance')}
                  >
                    Acceptance Criteria
                  </button>
                  <button
                    className={`toggle-btn ${viewMode === 'requirements' ? 'active' : ''}`}
                    onClick={generateProductRequirements}
                    disabled={isGeneratingRequirements}
                  >
                    {isGeneratingRequirements ? 'Generating...' : 'Product Requirements'}
                  </button>
                </div>
              </div>
              <div className="requirements-content">
                {viewMode === 'acceptance' ? (
                  <div className="acceptance-criteria">
                    <div className="criteria-label">Description & Acceptance Criteria</div>
                    {isEditingDescription ? (
                      <div className="description-editor">
                        <div className="editor-hint">
                          Edit the description below. Tables and formatting will be preserved in JIRA.
                        </div>
                        <div 
                          className="description-editor-rich"
                          contentEditable
                          suppressContentEditableWarning
                          onInput={(e) => setEditedDescription(e.currentTarget.innerHTML)}
                          dangerouslySetInnerHTML={{ 
                            __html: typeof editedDescription === 'string' 
                              ? editedDescription 
                              : formatMarkdownContent(editedDescription)
                          }}
                          disabled={isSaving}
                        />
                        {hasDescriptionChanged() && (
                          <div className="description-editor-actions">
                            <button 
                              className="save-btn" 
                              onClick={saveDescription}
                              disabled={isSaving}
                            >
                              {isSaving ? 'Saving...' : 'Save to JIRA'}
                            </button>
                            <button 
                              className="cancel-btn" 
                              onClick={cancelDescriptionEdit}
                              disabled={isSaving}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ) : task.description ? (
                      <div 
                        className="criteria-text clickable" 
                        onClick={() => task.external_source === 'jira' && setIsEditingDescription(true)}
                        title={task.external_source === 'jira' ? 'Click to edit description' : ''}
                        dangerouslySetInnerHTML={{ __html: formatMarkdownContent(task.description) }}
                      />
                    ) : (
                      <div className="empty-description">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <p>No acceptance criteria defined in JIRA</p>
                        <span className="hint">Click "Product Requirements" to generate AI-powered requirements</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="product-requirements">
                    {isGeneratingRequirements ? (
                      <div className="generating-indicator">
                        <div className="spinner"></div>
                        <span>Generating product requirements from task context...</span>
                      </div>
                    ) : productRequirements ? (
                      <div className="requirements-table" dangerouslySetInnerHTML={{ 
                        __html: formatRequirementsWithSlackHighlight(productRequirements) 
                      }} />
                    ) : (
                      <div className="no-requirements">Click "Product Requirements" to generate AI analysis</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="task-chat-welcome">
              <div className="welcome-text">Let's work on this task together!</div>
              <div className="welcome-subtitle">
                I can help you brainstorm, plan, and complete this task.
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`task-message ${msg.role}`}>
                <div className="task-message-bubble">
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {isTyping && (
            <div className="task-chat-typing">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>Thinking about your task...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area with Controls */}
        <div className="task-chat-input-wrapper">
          <div className="task-chat-input-container">
            {/* Left Controls */}
            <div className="chat-input-controls-left">
              <button className="chat-control-btn" title="Add attachment">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              <button className="chat-control-btn" title="Filter">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14"></line>
                  <line x1="4" y1="10" x2="4" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12" y2="3"></line>
                  <line x1="20" y1="21" x2="20" y2="16"></line>
                  <line x1="20" y1="12" x2="20" y2="3"></line>
                  <line x1="1" y1="14" x2="7" y2="14"></line>
                  <line x1="9" y1="8" x2="15" y2="8"></line>
                  <line x1="17" y1="16" x2="23" y2="16"></line>
                </svg>
              </button>
              <button className="chat-control-btn" title="Extended search">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                  <path d="M11 8v6"></path>
                  <path d="M8 11h6"></path>
                </svg>
              </button>
            </div>

            {/* Text Input */}
            <textarea
              ref={inputRef}
              className="task-chat-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="How can I help you today?"
              rows={1}
              disabled={isTyping}
            />

            {/* Right Controls */}
            <div className="chat-input-controls-right">
              {/* Model Selector */}
              <div className="model-selector-wrapper">
                <button 
                  className="model-selector-btn"
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  title="Select model"
                >
                  <span className="model-name">{selectedModel}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {showModelDropdown && (
                  <div className="model-dropdown">
                    {models.map(model => (
                      <button
                        key={model}
                        className={`model-option ${selectedModel === model ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedModel(model);
                          setShowModelDropdown(false);
                        }}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Send Button */}
              <button 
                className="task-chat-send-btn"
                onClick={handleSend} 
                disabled={!input.trim() || isTyping}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 16 16 12 12 8"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
