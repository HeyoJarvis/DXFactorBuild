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
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [connectedRepo, setConnectedRepo] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingRepository, setIsEditingRepository] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDescription, setEditedDescription] = useState(task.description);
  const [editedRepository, setEditedRepository] = useState(task.repository || '');
  const [isSaving, setIsSaving] = useState(false);
  const [availableRepositories, setAvailableRepositories] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);
  const descriptionEditorRef = useRef(null);
  const cursorPositionRef = useRef(null);

  // Architecture diagram state
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [diagramPositions, setDiagramPositions] = useState({}); // Store custom positions per message
  
  // Path selector modal state
  const [showPathSelector, setShowPathSelector] = useState(false);
  const [pathInput, setPathInput] = useState('');
  const [pendingRepo, setPendingRepo] = useState(null);

  // Confluence documentation modal state
  const [showConfluenceModal, setShowConfluenceModal] = useState(false);
  const [confluenceSpaces, setConfluenceSpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [confluenceConnected, setConfluenceConnected] = useState(false);
  
  // Code analysis state for documentation
  const [docSourceRepo, setDocSourceRepo] = useState('');
  const [docSourcePath, setDocSourcePath] = useState('');
  const [isAnalyzingCode, setIsAnalyzingCode] = useState(false);

  const models = ['Sonnet 4.5', 'Sonnet 3.5', 'Opus 3', 'Haiku 3.5'];

  // Check Confluence connection on mount
  useEffect(() => {
    const checkConfluence = async () => {
      try {
        const result = await window.electronAPI.confluence.checkConnection();
        console.log('📊 Confluence connection check result:', result);
        setConfluenceConnected(result.connected);
        
        if (!result.connected) {
          console.log('⚠️ Confluence not connected:', result.message || result.error);
        } else {
          console.log('✅ Confluence ready! Site URL:', result.siteUrl);
        }
      } catch (error) {
        console.error('❌ Failed to check Confluence connection:', error);
      }
    };
    checkConfluence();
  }, []);

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
    // Focus input on mount without causing page scroll
    try {
      inputRef.current?.focus({ preventScroll: true });
    } catch (_) {
      inputRef.current?.focus();
    }
    
    // Load chat history for this task
    loadChatHistory();
    
    // Load available repositories if JIRA task
    if (task.external_source === 'jira') {
      loadAvailableRepositories();
    }
  }, [task.id]);

  // Load current logged-in user for header chip
  useEffect(() => {
    const loadUser = async () => {
      try {
        if (window.electronAPI?.auth?.getCurrentUser) {
          const result = await window.electronAPI.auth.getCurrentUser();
          setCurrentUser(result?.user || result || null);
        } else {
          const cached = localStorage.getItem('heyjarvis.currentUser');
          if (cached) setCurrentUser(JSON.parse(cached));
        }
      } catch (_) {}
    };
    loadUser();
  }, []);

  const loadAvailableRepositories = async () => {
    try {
      console.log('🔄 TaskChat: Loading available repositories...');
      const response = await window.electronAPI.codeIndexer.listRepositories();
      console.log('📦 TaskChat: Repository response:', response);

      if (response.success && response.repositories) {
        // Use full_name (owner/repo format) instead of just name
        const repoNames = response.repositories.map(repo => repo.full_name);
        setAvailableRepositories(repoNames);
        console.log('✅ TaskChat: Loaded', repoNames.length, 'repositories:', repoNames);
      } else {
        console.error('❌ TaskChat: Failed to load repositories:', response.error);
      }
    } catch (error) {
      console.error('💥 TaskChat: Error loading repositories:', error);
    }
  };

  const saveTitle = async () => {
    if (!editedTitle.trim()) {
      alert('Title cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      // CRITICAL: Use JIRA key (external_key) not the database UUID (id)
      // Task IDs from database are UUIDs like cfac5763-a1d6-44d6-b5b3-6a892090bb94
      // JIRA keys are like PROJ-123
      const jiraKey = task.external_key || task.jira_key || task.id;
      
      console.log('🔧 Updating JIRA issue:', {
        taskId: task.id,
        jiraKey: jiraKey,
        title: editedTitle
      });

      const response = await window.electronAPI.jira.updateIssue(jiraKey, {
        summary: editedTitle
      });

      if (response.success) {
        // Update local task object
        task.title = editedTitle;
        setIsEditingTitle(false);
      } else {
        const errorMsg = response.error || 'Unknown error';
        console.error('Failed to update title:', errorMsg);
        alert(`Failed to update title: ${errorMsg}\n\nMake sure:\n1. You're connected to JIRA\n2. You have permission to edit this issue\n3. The issue exists\n\nTask ID: ${task.id}\nJIRA Key: ${jiraKey}`);
        setEditedTitle(task.title); // Revert
      }
    } catch (error) {
      console.error('Failed to save title:', error);
      const errorMsg = error.message || error;
      const jiraKey = task.external_key || task.jira_key || task.id;
      alert(`Failed to update title: ${errorMsg}\n\nMake sure:\n1. You're connected to JIRA\n2. You have permission to edit this issue\n3. The issue exists\n\nTask ID: ${task.id}\nJIRA Key: ${jiraKey}`);
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
      // CRITICAL: Use JIRA key (external_key) not the database UUID (id)
      const jiraKey = task.external_key || task.jira_key || task.id;
      
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
        taskId: task.id,
        jiraKey: jiraKey,
        type: typeof descriptionToSave,
        isADF,
        preview: isADF ? 'ADF object' : descriptionToSave.substring(0, 100)
      });
      
      const response = await window.electronAPI.jira.updateIssue(jiraKey, {
        descriptionADF: isADF ? descriptionToSave : null,
        description: !isADF ? descriptionToSave : null
      });

      if (response.success) {
        // Update local task object
        task.description = descriptionToSave;
        setIsEditingDescription(false);
        alert('Description updated successfully in JIRA!');
      } else {
        const errorMsg = response.error || 'Unknown error';
        console.error('Failed to update description:', errorMsg);
        alert(`Failed to update description: ${errorMsg}\n\nTask ID: ${task.id}\nJIRA Key: ${jiraKey}`);
        setEditedDescription(task.description); // Revert
      }
    } catch (error) {
      console.error('Failed to save description:', error);
      const jiraKey = task.external_key || task.jira_key || task.id;
      alert(`Failed to update description: ${error.message}\n\nTask ID: ${task.id}\nJIRA Key: ${jiraKey}`);
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

  // Save cursor position in contentEditable
  const saveCursorPosition = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && descriptionEditorRef.current) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(descriptionEditorRef.current);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      cursorPositionRef.current = preCaretRange.toString().length;
    }
  };

  // Restore cursor position in contentEditable
  const restoreCursorPosition = () => {
    if (cursorPositionRef.current === null || !descriptionEditorRef.current) return;
    
    const selection = window.getSelection();
    const range = document.createRange();
    let charCount = 0;
    let found = false;

    const traverseNodes = (node) => {
      if (found) return;
      
      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent.length;
        if (charCount + textLength >= cursorPositionRef.current) {
          range.setStart(node, cursorPositionRef.current - charCount);
          range.collapse(true);
          found = true;
          return;
        }
        charCount += textLength;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          traverseNodes(node.childNodes[i]);
          if (found) return;
        }
      }
    };

    traverseNodes(descriptionEditorRef.current);
    
    if (found) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  // Handle description input with cursor preservation
  const handleDescriptionInput = (e) => {
    saveCursorPosition();
    setEditedDescription(e.currentTarget.innerHTML);
  };

  // Restore cursor after state update
  useEffect(() => {
    if (isEditingDescription && descriptionEditorRef.current) {
      restoreCursorPosition();
    }
  }, [editedDescription, isEditingDescription]);

  const saveRepository = async () => {
    if (editedRepository === task.repository) {
      setIsEditingRepository(false);
      return;
    }

    setIsSaving(true);
    try {
      // CRITICAL: Use JIRA key (external_key) not the database UUID (id)
      const jiraKey = task.external_key || task.jira_key || task.id;
      
      console.log('🔗 Updating repository:', {
        taskId: task.id,
        jiraKey: jiraKey,
        repository: editedRepository
      });

      // Update JIRA with repository link in custom field or comment
      const response = await window.electronAPI.jira.updateIssue(jiraKey, {
        customFields: {
          repository: editedRepository
        }
      });

      if (response.success) {
        // Update local task object
        task.repository = editedRepository;
        setIsEditingRepository(false);
      } else {
        const errorMsg = response.error || 'Unknown error';
        console.error('Failed to update repository:', errorMsg);
        alert(`Failed to update repository: ${errorMsg}\n\nTask ID: ${task.id}\nJIRA Key: ${jiraKey}`);
        setEditedRepository(task.repository || ''); // Revert
      }
    } catch (error) {
      console.error('Failed to save repository:', error);
      const jiraKey = task.external_key || task.jira_key || task.id;
      alert(`Failed to update repository: ${error.message}\n\nTask ID: ${task.id}\nJIRA Key: ${jiraKey}`);
      setEditedRepository(task.repository || ''); // Revert
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    // Auto-scroll to bottom within the messages container only (no page scroll)
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
    } else {
      // Fallback (should not trigger window scroll due to preventScroll focus)
      messagesEndRef.current?.scrollIntoView({ block: 'nearest' });
    }
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
    const currentRepo = connectedRepo; // Capture current repo for this request
    
    // Check for /architecture command
    if (userMessage.toLowerCase().startsWith('/architecture') || userMessage.toLowerCase().startsWith('/arch')) {
      await handleArchitectureCommand(userMessage);
      return;
    }
    
    setInput('');
    setConnectedRepo(null); // Clear repo connection for next request

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
        external_source: task.external_source,
        connectedRepo: currentRepo
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
        },
        repository: currentRepo // Pass the repository to the backend
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleArchitectureCommand = async (message) => {
    // Clear input
    setInput('');
    
    // Add user message
    const newUserMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);

    // Show typing indicator
    setIsTyping(true);

    try {
      // Extract description (everything after /architecture or /arch)
      const description = message.replace(/^\/(architecture|arch)\s*/i, '').trim();
      
      if (!description) {
        // If no description provided, show help
        const helpMessage = {
          role: 'assistant',
          content: `🏗️ **Architecture Diagram Generator**\n\n**Generate from description:**\n\`/architecture <description>\`\n\n**Example:**\n\`/architecture A React frontend that connects to a Node.js backend API, which stores data in PostgreSQL. The system uses Redis for caching.\`\n\n**Generate from GitHub repository:**\n\`/arch from github <owner/repo>\`\n\n**Example:**\n\`/arch from github facebook/react\`\n\`/arch from github vercel/next.js\`\n\n**Tips:**\n• Mention specific technologies (React, Node.js, PostgreSQL, etc.)\n• Use "Kubernetes cluster" or "EKS" to create grouped containers\n• Say "3 services" or "microservices" to generate multiple service nodes\n• Include "AWS", "VPC", or "region" for cloud groupings\n• Mention "load balancer" for traffic distribution`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, helpMessage]);
        setIsTyping(false);
        return;
      }

      // Check if this is a GitHub analysis request
      const githubMatch = description.match(/^from\s+github\s+([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?:\s+(\S+))?/i);
      
      if (githubMatch) {
        await handleGithubArchitectureAnalysis(githubMatch[1], githubMatch[2], githubMatch[3]);
        return;
      }

      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Parse the architecture description
      const parsed = parseArchitectureDescription(description);
      
      // Create a visual response with the diagram data
      const diagramResponse = {
        role: 'assistant',
        content: `✅ **Architecture Diagram Generated!**\n\nI've created an architecture diagram with:\n• ${parsed.nodes.length} components\n• ${parsed.edges.length} connections\n\n**Components:**\n${parsed.nodes.filter(n => n.type !== 'group').map(n => `• ${n.data.label} (${n.type})`).join('\n')}\n\nThis diagram has been visualized above. You can:\n• Ask me to modify specific components\n• Request to add more services\n• Change connections between components\n• Export the diagram\n\n*To make changes, just describe what you'd like adjusted!*`,
        timestamp: new Date().toISOString(),
        architectureDiagram: parsed // Store the diagram data
      };
      
      setMessages(prev => [...prev, diagramResponse]);
    } catch (error) {
      console.error('Architecture generation error:', error);
      const errorMessage = {
        role: 'assistant',
        content: '❌ Sorry, I encountered an error generating the architecture diagram. Please try again with a different description.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleGithubArchitectureAnalysis = async (owner, repo, branch = 'main', path = '') => {
    console.log('🏗️ handleGithubArchitectureAnalysis called', { owner, repo, branch, path });
    setIsTyping(true);
    
    try {
      const pathDisplay = path ? ` (${path})` : '';
      // Show analyzing message
      const analyzingMessage = {
        role: 'assistant',
        content: `🔍 **Analyzing GitHub Repository**\n\nFetching and analyzing: \`${owner}/${repo}${pathDisplay}\` (${branch} branch)\n\nThis may take a moment as I scan the codebase...`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, analyzingMessage]);

      // Call the code indexer to analyze architecture
      const result = await window.electronAPI.codeIndexer.analyzeArchitecture({
        owner,
        repo,
        branch,
        path: path || ''  // Pass the path parameter
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to analyze repository');
      }

      // Convert the analysis result to architecture diagram format
      const diagramData = convertAnalysisToArchitecture(result, owner, repo);

      const pathInfo = path ? `\n**Path:** \`/${path}\`` : '';
      // Create success response with diagram
      const successMessage = {
        role: 'assistant',
        content: `✅ **Architecture Analysis Complete!**\n\n**Repository:** \`${owner}/${repo}\`\n**Branch:** \`${branch}\`${pathInfo}\n\n**Detected Technologies:**\n${result.technologies?.map(t => `• ${t.name} ${t.version ? `(${t.version})` : ''}`).join('\n') || '• No technologies detected'}\n\n**Architecture Components:**\n• ${diagramData.nodes.length} components identified\n• ${diagramData.edges.length} connections mapped\n\n**Component Breakdown:**\n${diagramData.nodes.filter(n => n.type !== 'group').map(n => `• ${n.data.label} (${n.type})`).join('\n')}\n\nThe architecture diagram has been generated above. You can:\n• Ask me to explain specific components\n• Request modifications to the diagram\n• Export the diagram for documentation`,
        timestamp: new Date().toISOString(),
        architectureDiagram: diagramData
      };

      setMessages(prev => [...prev, successMessage]);

    } catch (error) {
      console.error('GitHub architecture analysis error:', error);
      const errorMessage = {
        role: 'assistant',
        content: `❌ **Analysis Failed**\n\nCouldn't analyze the repository \`${owner}/${repo}\`${path ? ` (path: ${path})` : ''}.\n\n**Error:** ${error.message}\n\n**Possible reasons:**\n• Repository doesn't exist or is private\n• Path doesn't exist in the repository\n• GitHub API rate limit reached\n• Code indexer not configured\n• Network connection issue\n\nTry:\n• Checking the repository and path are correct\n• Using a public repository\n• Configuring GitHub credentials in Settings`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const convertAnalysisToArchitecture = (analysis, owner, repo) => {
    const nodes = [];
    const edges = [];
    const groups = []; // New: container groups
    const nodeMap = new Map();
    let nodeId = 0;

    // Extract and filter only the most important components
    const technologies = analysis.technologies || [];
    const components = analysis.components || [];
    const connections = analysis.connections || [];
    
    // Simplified grouping - only 3 main groups
    const groupedItems = {
      client: [],
      server: [],
      external: []
    };

    // Collect all items
    const allItems = [
      ...components.map(c => ({ ...c, isComponent: true })),
      ...technologies.filter(t => !components.some(c => c.name === t.name)).map(t => ({ ...t, isComponent: false }))
    ];

    // Group items into 3 clear categories
    allItems.forEach((item) => {
      const type = item.type || 'service';
      
      if (['frontend', 'desktop', 'build-tool'].includes(type)) {
        groupedItems.client.push(item);
      } else if (['backend', 'service', 'library'].includes(type)) {
        groupedItems.server.push(item);
      } else if (['database', 'cache', 'search', 'integration', 'ai'].includes(type)) {
        groupedItems.external.push(item);
      }
    });

    // Layout configuration for clean, spacious design
    const layout = {
      groupWidth: 320,
      groupHeight: 500,  // Increased height to fit all nodes
      groupGap: 100,
      nodeWidth: 260,    // Wider nodes (80% of group width)
      nodeHeight: 55,    // Slightly smaller height
      nodeGap: 12,       // Smaller gap between nodes
      paddingX: 30,      // Horizontal padding
      paddingTop: 50,    // Top padding (below title)
      titleHeight: 45    // Space for title + underline
    };

    // Calculate positions for 3 groups horizontally
    const totalWidth = (layout.groupWidth * 3) + (layout.groupGap * 2);
    const startX = (1200 - totalWidth) / 2;
    const startY = 80;

    // Create the 3 main groups
    const groupConfigs = [
      { key: 'client', label: 'Client Application', x: startX, color: '#e3f2fd' },
      { key: 'server', label: 'Server Application', x: startX + layout.groupWidth + layout.groupGap, color: '#e8f5e9' },
      { key: 'external', label: 'External Services', x: startX + (layout.groupWidth + layout.groupGap) * 2, color: '#fff3e0' }
    ];

    groupConfigs.forEach((groupConfig) => {
      const items = groupedItems[groupConfig.key];
      if (items.length === 0) return;

      // Calculate actual height needed based on number of items
      const contentHeight = items.length * (layout.nodeHeight + layout.nodeGap) - layout.nodeGap + layout.paddingTop + 30;
      const groupHeight = Math.max(layout.groupHeight, contentHeight);

      // Create group container
      groups.push({
        id: `group-${groupConfig.key}`,
        label: groupConfig.label,
        x: groupConfig.x,
        y: startY,
        width: layout.groupWidth,
        height: groupHeight,
        color: groupConfig.color
      });

      // Position nodes inside group (centered horizontally)
      items.forEach((item, idx) => {
        const nodeX = groupConfig.x + (layout.groupWidth - layout.nodeWidth) / 2;  // Center the node
        const nodeY = startY + layout.paddingTop + (idx * (layout.nodeHeight + layout.nodeGap));

        const nodeData = {
          id: `node-${nodeId++}`,
          type: item.type,
          group: groupConfig.key,
          position: { x: nodeX, y: nodeY },
          data: {
            label: item.displayName || item.name,
            technology: item.name,
            category: item.type,
            description: item.version ? `v${item.version}` : '',
            isComponent: item.isComponent
          }
        };
        
        nodes.push(nodeData);
        nodeMap.set(item.name, nodeData.id);
      });
    });

    // Simplified connections - just show main data flow between groups
    // Client → Server (one arrow between groups)
    const clientNodes = nodes.filter(n => n.group === 'client');
    const serverNodes = nodes.filter(n => n.group === 'server');
    const externalNodes = nodes.filter(n => n.group === 'external');

    // Single arrow: Client → Server
    if (clientNodes.length > 0 && serverNodes.length > 0) {
      edges.push({
        id: 'e-client-server',
        source: clientNodes[0].id,
        target: serverNodes[0].id,
        label: 'Request',
        type: 'group-connection'
      });
    }

    // Single arrow: Server → External
    if (serverNodes.length > 0 && externalNodes.length > 0) {
      edges.push({
        id: 'e-server-external',
        source: serverNodes[0].id,
        target: externalNodes[0].id,
        label: 'External APIs',
        type: 'group-connection'
      });
    }

    return { nodes, edges, groups };
  };

  const detectComponentType = (name) => {
    const lower = (name || '').toLowerCase();
    
    if (lower.includes('frontend') || lower.includes('client') || lower.includes('ui') || 
        lower.includes('web') || lower.includes('app')) {
      return 'frontend';
    }
    if (lower.includes('backend') || lower.includes('server') || lower.includes('api')) {
      return 'backend';
    }
    if (lower.includes('database') || lower.includes('db') || lower.includes('storage')) {
      return 'database';
    }
    if (lower.includes('infrastructure') || lower.includes('deploy') || lower.includes('docker')) {
      return 'infrastructure';
    }
    
    return 'backend'; // Default
  };

  // Architecture description parser (simplified version from AIGenerator)
  const parseArchitectureDescription = (description) => {
    const lower = description.toLowerCase();
    const nodes = [];
    const edges = [];
    let nodeId = 0;

    // Check for container patterns
    const hasKubernetes = lower.includes('kubernetes') || lower.includes('k8s') || lower.includes('eks') || lower.includes('cluster');
    const hasAWS = lower.includes('aws') || lower.includes('vpc') || lower.includes('region');
    const hasMicroservices = lower.includes('microservice') || lower.includes('service');
    
    // Extract numbers
    const serviceCountMatch = lower.match(/(\d+)\s+service/);
    const serviceCount = serviceCountMatch ? parseInt(serviceCountMatch[1]) : 0;

    // Technology detection
    const techMap = {
      frontend: ['react', 'vue', 'angular', 'nextjs', 'svelte', 'frontend', 'ui'],
      backend: ['node.js', 'nodejs', 'python', 'java', 'go', 'ruby', 'php', 'express', 'django', 'flask', 'backend', 'api'],
      database: ['postgresql', 'postgres', 'mysql', 'mongodb', 'mongo', 'redis', 'elasticsearch', 'database', 'db'],
      infrastructure: ['docker', 'nginx', 'kafka', 'rabbitmq', 'queue'],
      loadbalancer: ['load balancer', 'loadbalancer', 'lb', 'alb', 'nlb']
    };

    let currentX = 100;
    let currentY = 100;

    // Create group nodes if needed
    if (hasKubernetes) {
      nodes.push({
        id: `group-${nodeId++}`,
        type: 'group',
        position: { x: 50, y: 50 },
        style: { width: 600, height: 400 },
        data: {
          label: 'Kubernetes Cluster',
          badge: 'EKS',
          color: '#FF9900',
          backgroundColor: 'rgba(255, 153, 0, 0.05)',
          description: 'Managed Kubernetes cluster'
        }
      });
      currentX = 150;
      currentY = 150;
    } else if (hasAWS) {
      nodes.push({
        id: `group-${nodeId++}`,
        type: 'group',
        position: { x: 50, y: 50 },
        style: { width: 700, height: 500 },
        data: {
          label: 'AWS Region',
          badge: 'us-east-1',
          color: '#FF9900',
          backgroundColor: 'rgba(255, 153, 0, 0.03)',
          description: 'Amazon VPC'
        }
      });
      currentX = 150;
      currentY = 150;
    }

    // Create service nodes for microservices
    if (hasMicroservices && serviceCount > 0) {
      for (let i = 0; i < serviceCount; i++) {
        nodes.push({
          id: `service-${nodeId++}`,
          type: 'service',
          position: { 
            x: currentX + (i * 150), 
            y: currentY + 100 
          },
          data: {
            label: `Service ${i + 1}`,
            replicas: 2
          },
          parentNode: hasKubernetes ? 'group-0' : undefined,
          extent: hasKubernetes ? 'parent' : undefined
        });
      }
    }

    // Detect technologies and create nodes
    Object.entries(techMap).forEach(([category, keywords]) => {
      keywords.forEach(keyword => {
        if (lower.includes(keyword)) {
          const x = currentX + (nodeId % 3) * 200;
          const y = currentY + Math.floor(nodeId / 3) * 150;
          
          const nodeType = category === 'loadbalancer' ? 'loadbalancer' : category;
          
          nodes.push({
            id: `node-${nodeId}`,
            type: nodeType,
            position: { x, y },
            data: {
              label: keyword.charAt(0).toUpperCase() + keyword.slice(1).replace(/[-.]/g, ' '),
              technology: keyword.charAt(0).toUpperCase() + keyword.slice(1),
              category: category,
              description: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} component`
            },
            parentNode: (hasKubernetes || hasAWS) && category !== 'frontend' ? 'group-0' : undefined,
            extent: (hasKubernetes || hasAWS) && category !== 'frontend' ? 'parent' : undefined
          });
          nodeId++;
        }
      });
    });

    // Create connections
    const frontendNodes = nodes.filter(n => n.type === 'frontend');
    const backendNodes = nodes.filter(n => n.type === 'backend' || n.type === 'service');
    const dbNodes = nodes.filter(n => n.type === 'database');
    const lbNodes = nodes.filter(n => n.type === 'loadbalancer');

    // Connect load balancer -> backend
    lbNodes.forEach(lb => {
      backendNodes.forEach(backend => {
        edges.push({
          id: `e${edges.length}`,
          source: lb.id,
          target: backend.id,
          animated: true,
          label: 'HTTP'
        });
      });
    });

    // Connect frontend -> backend (or load balancer)
    frontendNodes.forEach(frontend => {
      if (lbNodes.length > 0) {
        edges.push({
          id: `e${edges.length}`,
          source: frontend.id,
          target: lbNodes[0].id,
          animated: true,
          label: 'REST API'
        });
      } else if (backendNodes.length > 0) {
        edges.push({
          id: `e${edges.length}`,
          source: frontend.id,
          target: backendNodes[0].id,
          animated: true,
          label: 'REST API'
        });
      }
    });

    // Connect backend -> database
    backendNodes.forEach(backend => {
      dbNodes.forEach(db => {
        edges.push({
          id: `e${edges.length}`,
          source: backend.id,
          target: db.id,
          animated: true,
          label: 'SQL'
        });
      });
    });

    return { nodes, edges };
  };

  // Confluence Documentation Functions
  const handleOpenConfluenceModal = async () => {
    if (!confluenceConnected) {
      alert('Please connect to JIRA first to enable Confluence documentation. Go to Settings to connect.');
      return;
    }

    setShowConfluenceModal(true);
    setDocTitle(task.title || '');
    setDocContent('');
    
    // Set default repo if connected
    if (connectedRepo) {
      setDocSourceRepo(connectedRepo);
    } else {
      setDocSourceRepo('');
    }
    setDocSourcePath('');
    
    // Load Confluence spaces
    try {
      console.log('📂 Loading Confluence spaces...');
      const result = await window.electronAPI.confluence.getSpaces();
      console.log('📂 Confluence spaces result:', result);
      
      if (result.success) {
        setConfluenceSpaces(result.spaces);
        if (result.spaces.length > 0) {
          setSelectedSpace(result.spaces[0].id); // Use ID instead of key
        }
        console.log('✅ Loaded', result.spaces.length, 'Confluence spaces');
      } else {
        console.error('❌ Failed to load spaces:', result.error);
        alert('Failed to load Confluence spaces: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Exception loading Confluence spaces:', error);
      alert('Error loading Confluence spaces. Check console for details.');
    }
  };

  const handleGenerateDocumentation = async () => {
    // Validate that a repository is selected
    if (!docSourceRepo) {
      alert('Please select a repository to analyze for documentation.');
      return;
    }

    setIsGeneratingDoc(true);
    setIsAnalyzingCode(true);
    
    try {
      const [owner, repo] = docSourceRepo.split('/');
      
      console.log('🔍 Analyzing codebase for documentation...', {
        owner,
        repo,
        path: docSourcePath || 'entire repo'
      });

      // Step 1: Analyze the codebase using the architecture analyzer
      const analysisResult = await window.electronAPI.codeIndexer.analyzeArchitecture({
        owner,
        repo,
        branch: 'main',
        path: docSourcePath || ''
      });

      setIsAnalyzingCode(false);

      if (!analysisResult.success) {
        throw new Error(analysisResult.error || 'Code analysis failed');
      }

      console.log('✅ Code analysis complete:', analysisResult);

      // Step 2: Extract useful information from the analysis
      const { technologies, components, connections } = analysisResult.data || {};
      
      const techStack = technologies?.map(t => `${t.name} (${t.version || 'detected'})`).join(', ') || 'Not detected';
      const componentList = components?.map(c => `- ${c.name} (${c.type})`).join('\n') || 'No components detected';
      
      // Extract task description
      let taskDescText = 'No description provided';
      if (task.description) {
        if (typeof task.description === 'string') {
          taskDescText = task.description;
        } else if (typeof task.description === 'object' && task.description.content) {
          taskDescText = JSON.stringify(task.description.content).substring(0, 500);
        }
      }
      
      // Build a comprehensive prompt with real code analysis
      const pathInfo = docSourcePath ? ` (focusing on ${docSourcePath})` : ' (entire repository)';
      const prompt = `Generate comprehensive technical documentation based on REAL codebase analysis.

**Task Information:**
Title: "${task.title}"
Description: ${taskDescText}

**Codebase Analyzed:**
Repository: ${docSourceRepo}${pathInfo}

**Detected Technologies:**
${techStack}

**Detected Components:**
${componentList}

**Your Task:**
Create detailed technical documentation in markdown format with these sections:

1. **Overview**
   - What this codebase/feature does
   - Key capabilities and purpose

2. **Architecture**
   - High-level architecture overview
   - Main components and their responsibilities
   - How components interact

3. **Technical Stack**
   - List all detected technologies
   - Version information where available
   - Why each technology was chosen (infer from usage patterns)

4. **Implementation Details**
   - Key files and directories
   - Important code patterns observed
   - Configuration and setup requirements

5. **API/Interfaces** (if applicable)
   - Endpoints, functions, or modules exposed
   - Input/output specifications

6. **Development Guide**
   - How to set up the development environment
   - How to run/test the code
   - Common development workflows

7. **Dependencies**
   - External libraries and services
   - Integration points

Be specific and technical. Reference actual technologies and components detected. Use markdown formatting (headers, lists, code blocks). Make this client-ready and professional.`;

      console.log('🤖 Generating documentation with AI from code analysis...');
      
      // Step 3: Generate documentation using AI with code context
      const response = await window.electronAPI.tasks.sendChatMessage(task.id, prompt, {
        model: selectedModel,
        attachedFiles: [],
        connectedRepo: docSourceRepo
      });

      console.log('📝 AI documentation response:', response);

      // Handle both 'response' and 'message' fields
      const generatedDoc = response.response || response.message;
      
      if (response.success && generatedDoc) {
        // Add a header note about the source
        const docWithHeader = `> **Documentation generated from:** ${docSourceRepo}${pathInfo}\n> **Generated on:** ${new Date().toLocaleDateString()}\n\n${generatedDoc}`;
        
        setDocContent(docWithHeader);
        console.log('✅ Documentation generated successfully from codebase analysis');
      } else {
        throw new Error(response.error || 'AI generation failed');
      }
      
    } catch (error) {
      console.error('❌ Failed to generate documentation:', error);
      const errorMsg = error.message || error.toString();
      
      if (errorMsg.includes('socket hang up') || errorMsg.includes('timeout')) {
        alert('AI request timed out. The modal will stay open - you can try again or write documentation manually.');
      } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
        alert('Repository or path not found. Please check your repository and path selection.');
      } else {
        alert('Failed to generate documentation: ' + errorMsg);
      }
    } finally {
      setIsGeneratingDoc(false);
      setIsAnalyzingCode(false);
    }
  };

  const handleUploadToConfluence = async () => {
    if (!selectedSpace) {
      alert('Please select a Confluence space.');
      return;
    }

    if (!docTitle.trim()) {
      alert('Please enter a document title.');
      return;
    }

    if (!docContent.trim()) {
      alert('Please generate or enter documentation content.');
      return;
    }

    setIsUploadingDoc(true);

    try {
      const result = await window.electronAPI.confluence.createPage({
        spaceKey: selectedSpace,
        title: docTitle,
        content: docContent
      });

      if (result.success) {
        // Add success message to chat
        const successMessage = {
          role: 'assistant',
          content: `✅ **Documentation Uploaded to Confluence!**\n\n**Page:** ${result.page.title}\n**URL:** ${result.page.url}\n\nYour documentation has been successfully created in Confluence space ${selectedSpace}.`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, successMessage]);

        // Close modal
        setShowConfluenceModal(false);
        setDocTitle('');
        setDocContent('');
      } else {
        alert('Failed to upload to Confluence: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to upload to Confluence:', error);
      alert('Failed to upload to Confluence. Please try again.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp'
    ];

    const validFiles = files.filter(file => {
      const isValid = allowedTypes.includes(file.type);
      if (!isValid) {
        alert(`File type not supported: ${file.name}\nSupported: PDF, Excel, CSV, Word, PowerPoint, Images`);
      }
      return isValid;
    });

    if (validFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...validFiles]);
    }
  };

  // Remove attached file
  const removeAttachedFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle GitHub repo selection
  const handleRepoSelect = async (repo) => {
    setShowRepoSelector(false);
    // Set the connected repository for this chat request
    setConnectedRepo(repo);
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

  // Source icon (Slack or JIRA)
  const sourceIcon = task.external_source === 'jira' ? '/JIRALOGO.png' : '/Slack_icon_2019.svg.png';

  // User display helpers
  const userName =
    currentUser?.name || currentUser?.fullName || currentUser?.username ||
    task.user?.name || task.user?.fullName || task.assignee?.name || 'User';
  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const second = parts[1]?.[0] || '';
    return (first + second).toUpperCase() || first.toUpperCase() || 'U';
  };

  // Drag and drop handlers for architecture diagram
  const handleNodeMouseDown = (e, nodeId, messageId) => {
    e.preventDefault();
    const svgRect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    const nodeKey = `${messageId}-${nodeId}`;
    const currentPos = diagramPositions[nodeKey] || { x: 0, y: 0 };
    
    setDraggedNode({ nodeId, messageId });
    setDragOffset({
      x: (e.clientX - svgRect.left) - currentPos.x,
      y: (e.clientY - svgRect.top) - currentPos.y
    });
  };

  const handleMouseMove = (e, messageId) => {
    if (!draggedNode || draggedNode.messageId !== messageId) return;
    
    const svgRect = e.currentTarget.getBoundingClientRect();
    const nodeKey = `${messageId}-${draggedNode.nodeId}`;
    
    const newX = e.clientX - svgRect.left - dragOffset.x;
    const newY = e.clientY - svgRect.top - dragOffset.y;
    
    setDiagramPositions(prev => ({
      ...prev,
      [nodeKey]: { x: newX, y: newY }
    }));
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
  };

  // Get node position (custom or default)
  const getNodePosition = (node, messageId) => {
    const nodeKey = `${messageId}-${node.id}`;
    return diagramPositions[nodeKey] || node.position;
  };

  // Helper functions for architecture diagram colors
  const getNodeColor = (type) => {
    const colors = {
      frontend: 'rgba(59, 130, 246, 0.1)',    // Blue
      desktop: 'rgba(99, 102, 241, 0.1)',     // Indigo
      backend: 'rgba(16, 185, 129, 0.1)',     // Green
      library: 'rgba(14, 165, 233, 0.1)',     // Sky
      database: 'rgba(245, 158, 11, 0.1)',    // Amber
      cache: 'rgba(249, 115, 22, 0.1)',       // Orange
      search: 'rgba(234, 179, 8, 0.1)',       // Yellow
      infrastructure: 'rgba(139, 92, 246, 0.1)', // Purple
      integration: 'rgba(236, 72, 153, 0.1)', // Pink
      ai: 'rgba(168, 85, 247, 0.1)',          // Violet
      'build-tool': 'rgba(6, 182, 212, 0.1)', // Cyan
      'state-management': 'rgba(20, 184, 166, 0.1)', // Teal
      testing: 'rgba(132, 204, 22, 0.1)',     // Lime
      loadbalancer: 'rgba(236, 72, 153, 0.1)',
      service: 'rgba(16, 185, 129, 0.1)'
    };
    return colors[type] || 'rgba(156, 163, 175, 0.1)';
  };

  const getNodeStroke = (type) => {
    const strokes = {
      frontend: '#3b82f6',      // Blue
      desktop: '#6366f1',       // Indigo
      backend: '#10b981',       // Green
      library: '#0ea5e9',       // Sky
      database: '#f59e0b',      // Amber
      cache: '#f97316',         // Orange
      search: '#eab308',        // Yellow
      infrastructure: '#8b5cf6', // Purple
      integration: '#ec4899',   // Pink
      ai: '#a855f7',            // Violet
      'build-tool': '#06b6d4',  // Cyan
      'state-management': '#14b8a6', // Teal
      testing: '#84cc16',       // Lime
      loadbalancer: '#ec4899',
      service: '#10b981'
    };
    return strokes[type] || '#9ca3af';
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

  const getAcceptanceCount = (html) => {
    if (!html) return 0;
    try {
      const tbodyMatch = html.match(/<tbody[\s\S]*?<\/tbody>/i);
      const body = tbodyMatch ? tbodyMatch[0] : html;
      const matches = body.match(/<tr[\s\S]*?<\/tr>/gi);
      return matches ? matches.length : 0;
    } catch (_) {
      return 0;
    }
  };

  const hasRequirementsTable = (html) => /<table[\s\S]*?<\/table>/i.test(html || '');


  return (
    <div className="task-chat-modal">
      <div className="task-chat-container">
        {/* Header - Task Card (sticky in modal layout) */}
        <div className="task-chat-header">
          <div className="task-chat-card">
            <button className="task-chat-close" onClick={onClose}>×</button>
            
            <div className="task-chat-card-header">
              {/* Left: Icon + Title + Meta Row */}
              <div className="task-card-left">
                <div className="task-title-row with-gap-under">
                  <div className="task-chat-app-icon">
                    <img 
                      src={sourceIcon}
                      alt={task.external_source === 'jira' ? 'Jira' : 'Slack'} 
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
                  </div>
                </div>

                {/* Meta Row: Scrum key, date, user */}
                <div className="task-meta-row">
                  {task.external_key && (
                    <span className="chip chip-key">Scrum #{task.external_key}</span>
                  )}
                  <span className="chip chip-date">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    {formatDate(task.created_at)}
                  </span>
                  <span className="task-user">
                    <span className="task-user-avatar">{getInitials(userName)}</span>
                    <span className="task-user-name">{userName}</span>
                  </span>
                  <span className={`chip priority-chip priority-${task.priority || 'medium'}`}>{getPriorityLabel()}</span>
                  {task.external_source === 'jira' && (task.repository || isEditingRepository) && (
                    <span className="chip repository-item">
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

              {/* Right side now empty (priority moved to meta row) */}
              <div className="task-card-right"></div>
            </div>
            
          </div>
        </div>

        {/* Messages */}
        <div className="task-chat-messages" ref={messagesContainerRef}>
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
                          ref={descriptionEditorRef}
                          className="description-editor-rich"
                          contentEditable
                          suppressContentEditableWarning
                          onInput={handleDescriptionInput}
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
                      <div className="criteria-table-wrapper">
                        <div 
                          className="criteria-text clickable"
                          onClick={() => task.external_source === 'jira' && setIsEditingDescription(true)}
                          title={task.external_source === 'jira' ? 'Click to edit description' : ''}
                          dangerouslySetInnerHTML={{ __html: formatMarkdownContent(task.description) }}
                        />
                        {hasRequirementsTable(formatMarkdownContent(task.description)) && (
                          <div className="criteria-footer">
                            <button className="view-all-criteria" onClick={() => setShowRequirementsModal(true)}>
                              {`Click to view all ${getAcceptanceCount(formatMarkdownContent(task.description))} acceptance criteria`}
                              <span className="dots">•••</span>
                              <span className="arrow">→</span>
                            </button>
                          </div>
                        )}
                      </div>
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
                {msg.architectureDiagram && (
                  <div className="architecture-diagram-preview">
                    <div className="diagram-preview-header">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                      </svg>
                      <span>Architecture Diagram</span>
                      <span className="diagram-hint">Drag nodes to reposition</span>
                    </div>
                    <div className="diagram-preview-content-fullwidth">
                      <svg 
                        viewBox="0 0 1200 700" 
                        className="diagram-svg-fullwidth"
                        onMouseMove={(e) => handleMouseMove(e, msg.timestamp)}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      >
                        {/* Group container boxes */}
                        {msg.architectureDiagram.groups && msg.architectureDiagram.groups.map(group => (
                          <g key={group.id}>
                            {/* Group background */}
                            <rect
                              x={group.x}
                              y={group.y}
                              width={group.width}
                              height={group.height}
                              rx="8"
                              fill={group.color}
                              stroke="#d1d5db"
                              strokeWidth="2"
                            />
                            {/* Group title */}
                            <text
                              x={group.x + group.width / 2}
                              y={group.y + 24}
                              textAnchor="middle"
                              fill="#374151"
                              fontSize="16"
                              fontWeight="700"
                            >
                              {group.label}
                            </text>
                            {/* Title underline */}
                            <line
                              x1={group.x + 20}
                              y1={group.y + 35}
                              x2={group.x + group.width - 20}
                              y2={group.y + 35}
                              stroke="#d1d5db"
                              strokeWidth="1"
                            />
                          </g>
                        ))}

                        {/* Render edges first (so they appear behind nodes) */}
                        {msg.architectureDiagram.edges.map(edge => {
                          const sourceNode = msg.architectureDiagram.nodes.find(n => n.id === edge.source);
                          const targetNode = msg.architectureDiagram.nodes.find(n => n.id === edge.target);
                          if (!sourceNode || !targetNode) return null;
                          
                          const sourcePos = getNodePosition(sourceNode, msg.timestamp);
                          const targetPos = getNodePosition(targetNode, msg.timestamp);
                          
                          const nodeWidth = 260;
                          const nodeHeight = 55;
                          
                          // Calculate connection points (right of source → left of target)
                          const x1 = sourcePos.x + nodeWidth;
                          const y1 = sourcePos.y + nodeHeight / 2;
                          const x2 = targetPos.x;
                          const y2 = targetPos.y + nodeHeight / 2;
                          
                          return (
                            <g key={edge.id}>
                              <line
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke="#9ca3af"
                                strokeWidth="2"
                                markerEnd="url(#arrowhead)"
                              />
                              {edge.label && (
                                <text
                                  x={(x1 + x2) / 2}
                                  y={y1 - 8}
                                  textAnchor="middle"
                                  fill="#6b7280"
                                  fontSize="12"
                                  fontWeight="500"
                                >
                                  {edge.label}
                                </text>
                              )}
                            </g>
                          );
                        })}
                        
                        {/* Render nodes */}
                        {msg.architectureDiagram.nodes.filter(n => n.type !== 'group').map(node => {
                          const position = getNodePosition(node, msg.timestamp);
                          const isDragging = draggedNode?.nodeId === node.id && draggedNode?.messageId === msg.timestamp;
                          
                          return (
                            <g 
                              key={node.id}
                              className={`diagram-node ${isDragging ? 'dragging' : ''}`}
                              style={{ cursor: 'move' }}
                            >
                              <rect
                                x={position.x}
                                y={position.y}
                                width="260"
                                height="55"
                                rx="6"
                                fill="white"
                                stroke="#d1d5db"
                                strokeWidth={isDragging ? "2" : "1.5"}
                                onMouseDown={(e) => handleNodeMouseDown(e, node.id, msg.timestamp)}
                                style={{ cursor: 'move' }}
                              />
                              <text
                                x={position.x + 130}
                                y={position.y + 28}
                                textAnchor="middle"
                                fill="#1f2937"
                                fontSize="14"
                                fontWeight="600"
                                pointerEvents="none"
                              >
                                {node.data.label.length > 22 ? node.data.label.substring(0, 20) + '...' : node.data.label}
                              </text>
                              {node.data.description && (
                                <text
                                  x={position.x + 130}
                                  y={position.y + 42}
                                  textAnchor="middle"
                                  fill="#9ca3af"
                                  fontSize="11"
                                  fontWeight="400"
                                  pointerEvents="none"
                                >
                                  {node.data.description}
                                </text>
                              )}
                            </g>
                          );
                        })}
                        
                        {/* Arrow marker definition */}
                        <defs>
                          <marker
                            id="arrowhead"
                            markerWidth="10"
                            markerHeight="10"
                            refX="9"
                            refY="3"
                            orient="auto"
                          >
                            <polygon points="0 0, 10 3, 0 6" fill="#86868b" />
                          </marker>
                        </defs>
                      </svg>
                    </div>
                    <div className="diagram-preview-footer">
                      <div className="diagram-legend">
                        <div className="legend-title">Legend:</div>
                        <div className="legend-items">
                          <div className="legend-item">
                            <div className="legend-color" style={{ background: getNodeColor('frontend'), border: `2px solid ${getNodeStroke('frontend')}` }}></div>
                            <span>Frontend</span>
                          </div>
                          <div className="legend-item">
                            <div className="legend-color" style={{ background: getNodeColor('backend'), border: `2px solid ${getNodeStroke('backend')}` }}></div>
                            <span>Backend</span>
                          </div>
                          <div className="legend-item">
                            <div className="legend-color" style={{ background: getNodeColor('database'), border: `2px solid ${getNodeStroke('database')}` }}></div>
                            <span>Database</span>
                          </div>
                          <div className="legend-item">
                            <div className="legend-color" style={{ background: getNodeColor('integration'), border: `2px solid ${getNodeStroke('integration')}` }}></div>
                            <span>Integration</span>
                          </div>
                          <div className="legend-item">
                            <div className="legend-color" style={{ background: getNodeColor('ai'), border: `2px solid ${getNodeStroke('ai')}` }}></div>
                            <span>AI/ML</span>
                          </div>
                          <div className="legend-item">
                            <svg width="40" height="2" style={{ marginRight: '8px' }}>
                              <line x1="0" y1="1" x2="40" y2="1" stroke="#86868b" strokeWidth="2" />
                            </svg>
                            <span>Data Flow</span>
                          </div>
                          <div className="legend-item">
                            <svg width="40" height="2" style={{ marginRight: '8px' }}>
                              <line x1="0" y1="1" x2="40" y2="1" stroke="#86868b" strokeWidth="2" strokeDasharray="5,5" />
                            </svg>
                            <span>API Call</span>
                          </div>
                        </div>
                      </div>
                      <div className="diagram-actions">
                        <button 
                          className="diagram-action-btn"
                          onClick={() => {
                            // Copy diagram data to clipboard
                            navigator.clipboard.writeText(JSON.stringify(msg.architectureDiagram, null, 2));
                            alert('Diagram data copied to clipboard!');
                          }}
                          title="Copy diagram JSON"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                          Export
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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

        {/* Full Acceptance Criteria Modal */}
        {showRequirementsModal && (
          <div className="requirements-modal-backdrop" onClick={() => setShowRequirementsModal(false)}>
            <div className="requirements-modal" onClick={(e) => e.stopPropagation()}>
              <div className="requirements-modal-header">
                <div>
                  <div className="requirements-modal-title">Acceptance Criteria</div>
                  <div className="criteria-label" style={{ marginTop: 4 }}>User stories for: {task.title}</div>
                </div>
                <button className="modal-btn" onClick={() => setShowRequirementsModal(false)}>Close</button>
              </div>
              <div className="requirements-modal-body">
                {isEditingDescription ? (
                  <div className="description-editor">
                    <div className="editor-hint">
                      Edit the description below. Tables and formatting will be preserved in JIRA.
                    </div>
                    <div 
                      ref={descriptionEditorRef}
                      className="description-editor-rich"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={handleDescriptionInput}
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
                          onClick={async () => { await saveDescription(); }}
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
                ) : (
                  <div 
                    className="criteria-text"
                    dangerouslySetInnerHTML={{ __html: formatMarkdownContent(task.description) }}
                  />
                )}
              </div>
              <div className="requirements-modal-actions">
                {task.external_source === 'jira' && !isEditingDescription && (
                  <button className="modal-btn" onClick={() => setIsEditingDescription(true)}>Edit Criteria</button>
                )}
                <button className="modal-btn primary" onClick={() => setShowRequirementsModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Input Area with Controls */}
        <div className="task-chat-input-wrapper">
          {/* Attached Files Display */}
          {attachedFiles.length > 0 && (
            <div className="attached-files-container">
              {attachedFiles.map((file, index) => (
                <div key={index} className="attached-file">
                  <span className="file-icon">📎</span>
                  <span className="file-name">{file.name}</span>
                  <button
                    className="remove-file-btn"
                    onClick={() => removeAttachedFile(index)}
                    title="Remove file"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* Repository Selector Modal */}
          {showRepoSelector && (
            <div className="repo-selector-modal">
              <div className="repo-selector-header">
                <span>Select Repository</span>
                <button onClick={() => setShowRepoSelector(false)}>×</button>
              </div>
              <div className="repo-selector-list">
                {availableRepositories.length > 0 ? (
                  availableRepositories.map(repo => (
                    <div key={repo} className="repo-option-container">
                    <button
                      className="repo-option"
                      onClick={() => handleRepoSelect(repo)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                      </svg>
                        <span className="repo-name">{repo}</span>
                    </button>
                      <button
                        className="repo-arch-btn"
                        onClick={() => {
                          console.log('🔘 Architecture button clicked for repo:', repo);
                          const [owner, repoName] = repo.split('/');
                          setPendingRepo({ owner, repoName });
                          setPathInput('');
                          setShowPathSelector(true);
                          setShowRepoSelector(false);
                        }}
                        title="Generate architecture diagram"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7"></rect>
                          <rect x="14" y="3" width="7" height="7"></rect>
                          <rect x="14" y="14" width="7" height="7"></rect>
                          <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="no-repos">
                    <p>No repositories found</p>
                    <span>Index repositories in Settings to use this feature</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="task-chat-input-container">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp"
              multiple
              style={{ display: 'none' }}
            />

            {/* Left Controls */}
            <div className="chat-input-controls-left">
              <button
                className="chat-control-btn"
                title="Add files (PDF, Excel, CSV, Word, PowerPoint, Images)"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              <button
                className={`chat-control-btn ${connectedRepo ? 'active-repo' : ''}`}
                title={connectedRepo ? `Connected: ${connectedRepo}` : "Connect to GitHub repository"}
                onClick={() => {
                  if (!showRepoSelector) {
                    // Load repositories when opening the modal
                    loadAvailableRepositories();
                  }
                  setShowRepoSelector(!showRepoSelector);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
              </button>
              <button
                className={`chat-control-btn ${confluenceConnected ? 'confluence-connected' : ''}`}
                title={confluenceConnected ? "Create Confluence documentation" : "Connect to JIRA to enable Confluence"}
                onClick={handleOpenConfluenceModal}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </button>
            </div>

            {/* Text Input Area - Now with connection status */}
            <div className="task-chat-input-area">
              {/* Connection Status Display */}
              {connectedRepo && (
                <div className="repo-connection-status">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                  </svg>
                  <span>Connected: {connectedRepo}</span>
                  <button
                    className="disconnect-repo-btn"
                    onClick={() => setConnectedRepo(null)}
                    title="Disconnect repository"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Text Input */}
              <textarea
                ref={inputRef}
                className="task-chat-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="How can I help you today?"
                rows={3}
                disabled={isTyping}
              />
            </div>

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

      {/* Path Selector Modal */}
      {showPathSelector && (
        <div className="modal-overlay" onClick={() => setShowPathSelector(false)}>
          <div className="path-selector-modal" onClick={(e) => e.stopPropagation()}>
            <div className="path-selector-header">
              <h3>Select Path to Analyze</h3>
              <button
                className="close-modal-btn"
                onClick={() => setShowPathSelector(false)}
              >
                ×
              </button>
    </div>
            
            <div className="path-selector-content">
              <p className="path-selector-description">
                Enter a specific folder path to analyze, or leave empty to analyze the entire repository.
              </p>
              
              <input
                type="text"
                className="path-input"
                placeholder="e.g., desktop2, src/components, backend/services"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleGithubArchitectureAnalysis(
                      pendingRepo.owner,
                      pendingRepo.repoName,
                      'main',
                      pathInput.trim()
                    );
                    setShowPathSelector(false);
                  }
                }}
                autoFocus
              />
              
              <div className="path-examples">
                <strong>Examples:</strong>
                <ul>
                  <li><code>desktop2</code> - Analyze desktop application folder</li>
                  <li><code>src/components</code> - Analyze React components</li>
                  <li><code>backend/services</code> - Analyze backend services</li>
                  <li><em>(empty)</em> - Analyze entire repository</li>
                </ul>
              </div>
            </div>
            
            <div className="path-selector-actions">
              <button
                className="path-cancel-btn"
                onClick={() => setShowPathSelector(false)}
              >
                Cancel
              </button>
              <button
                className="path-analyze-btn"
                onClick={() => {
                  handleGithubArchitectureAnalysis(
                    pendingRepo.owner,
                    pendingRepo.repoName,
                    'main',
                    pathInput.trim()
                  );
                  setShowPathSelector(false);
                }}
              >
                Analyze Architecture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confluence Documentation Modal */}
      {showConfluenceModal && (
        <div className="modal-overlay" onClick={() => setShowConfluenceModal(false)}>
          <div className="confluence-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confluence-modal-header">
              <h3>📝 Create Confluence Documentation</h3>
              <button
                className="close-modal-btn"
                onClick={() => setShowConfluenceModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="confluence-modal-content">
              {/* Confluence Space Selector */}
              <div className="form-group">
                <label>Confluence Space</label>
                <select
                  className="confluence-space-select"
                  value={selectedSpace}
                  onChange={(e) => setSelectedSpace(e.target.value)}
                >
                  {confluenceSpaces.length === 0 ? (
                    <option value="">Loading spaces...</option>
                  ) : (
                    confluenceSpaces.map((space) => (
                      <option key={space.id} value={space.id}>
                        {space.name} ({space.key})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Document Title */}
              <div className="form-group">
                <label>Document Title</label>
                <input
                  type="text"
                  className="doc-title-input"
                  placeholder="Enter documentation title..."
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
              </div>

              {/* Code Source Selection */}
              <div className="form-group code-source-section">
                <label>📂 Source Code to Document</label>
                <div className="code-source-inputs">
                  <select
                    className="doc-repo-select"
                    value={docSourceRepo}
                    onChange={(e) => setDocSourceRepo(e.target.value)}
                  >
                    <option value="">Select a repository...</option>
                    {availableRepositories.map((repo) => (
                      <option key={repo} value={repo}>
                        {repo}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="doc-path-input"
                    placeholder="Optional: specific folder (e.g., desktop2, src/api)"
                    value={docSourcePath}
                    onChange={(e) => setDocSourcePath(e.target.value)}
                  />
                </div>
                <p className="code-source-hint">
                  {docSourceRepo ? (
                    <>
                      ✅ Will analyze: <strong>{docSourceRepo}</strong>
                      {docSourcePath && <> / <strong>{docSourcePath}</strong></>}
                    </>
                  ) : (
                    '⚠️ Select a repository to enable AI documentation generation'
                  )}
                </p>
              </div>

              {/* Generate Documentation Button */}
              <div className="form-group">
                <button
                  className="generate-doc-btn"
                  onClick={handleGenerateDocumentation}
                  disabled={isGeneratingDoc || !docSourceRepo}
                >
                  {isAnalyzingCode ? (
                    <>
                      <span className="spinner"></span>
                      Analyzing codebase...
                    </>
                  ) : isGeneratingDoc ? (
                    <>
                      <span className="spinner"></span>
                      Generating documentation...
                    </>
                  ) : (
                    <>
                      🔍 Analyze Code & Generate Documentation
                    </>
                  )}
                </button>
                <p className="generate-doc-hint">
                  {docSourceRepo ? (
                    <>AI will analyze the selected codebase and generate comprehensive technical documentation based on real code</>
                  ) : (
                    <>Please select a repository above to enable AI generation</>
                  )}
                </p>
              </div>

              {/* Document Content */}
              <div className="form-group">
                <label>
                  Documentation Content (Markdown)
                  {docContent && (
                    <span className="char-count">{docContent.length} characters</span>
                  )}
                </label>
                <textarea
                  className="doc-content-textarea"
                  placeholder="Enter documentation content in markdown format...&#10;&#10;You can:&#10;• Generate it with AI (click button above)&#10;• Write it manually&#10;• Edit the AI-generated content"
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  rows={15}
                />
              </div>

              {/* Markdown Hint */}
              <div className="markdown-hint">
                <strong>Markdown Support:</strong>
                <code># Headers</code>, <code>**bold**</code>, <code>*italic*</code>, 
                <code>`code`</code>, <code>```code blocks```</code>, 
                <code>[links](url)</code>, <code>* lists</code>
              </div>
            </div>
            
            <div className="confluence-modal-actions">
              <button
                className="confluence-cancel-btn"
                onClick={() => setShowConfluenceModal(false)}
              >
                Cancel
              </button>
              <button
                className="confluence-upload-btn"
                onClick={handleUploadToConfluence}
                disabled={isUploadingDoc || !selectedSpace || !docTitle.trim() || !docContent.trim()}
              >
                {isUploadingDoc ? (
                  <>
                    <span className="spinner"></span>
                    Uploading...
                  </>
                ) : (
                  <>
                    📤 Upload to Confluence
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
