import { useState, useEffect, useRef } from 'react';
import './TaskDetailView.css';

/**
 * TaskDetailView - Split layout with chat (left) and JIRA card (right)
 * 
 * Layout:
 * - Left 40%: Full chat interface with message history
 * - Right 60%: JIRA ticket info + acceptance criteria table
 * - Close button to return to carousel
 */
export default function TaskDetailView({ task, user, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [connectedRepo, setConnectedRepo] = useState(null);
  const [showRepoSelector, setShowRepoSelector] = useState(false);
  const [availableRepositories, setAvailableRepositories] = useState([]);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isACCollapsed, setIsACCollapsed] = useState(false);
  const [isJiraPanelCollapsed, setIsJiraPanelCollapsed] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedAssignee, setEditedAssignee] = useState('');
  const [editedDueDate, setEditedDueDate] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isACEditMode, setIsACEditMode] = useState(false);
  const [editedAC, setEditedAC] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedMessageContent, setEditedMessageContent] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, [task.id]);

  // Load acceptance criteria from task description
  useEffect(() => {
    loadAcceptanceCriteria();
  }, [task.id, task.description]);

  // Initialize edit fields when task changes
  useEffect(() => {
    setEditedTitle(task.title || task.session_title || '');
    setEditedAssignee(user?.name || 'John Doe');
    setEditedDueDate(task.dueDate || 'Nov 12, 2025');
    setIsEditMode(false);
    setHasUnsavedChanges(false);
  }, [task.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const response = await window.electronAPI.tasks.getChatHistory(task.id);
      if (response.success) {
        setMessages(response.messages || []);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  // Parse acceptance criteria from JIRA description
  const loadAcceptanceCriteria = () => {
    try {
      console.log('Loading AC for task:', task.external_key || task.id);
      
      // Try to parse AC from task description
      const parsedAC = parseAcceptanceCriteriaFromDescription(task.description);
      
      if (parsedAC.length > 0) {
        console.log('Parsed AC from description:', parsedAC);
        setAcceptanceCriteria(parsedAC);
      } else {
        // Default empty state if no AC found
        console.log('No AC found in description, using empty state');
        setAcceptanceCriteria([]);
      }
    } catch (error) {
      console.error('Failed to parse acceptance criteria:', error);
      setAcceptanceCriteria([]);
    }
  };

  // Parse acceptance criteria from JIRA ADF or plain text
  const parseAcceptanceCriteriaFromDescription = (description) => {
    if (!description) return [];

    let criteria = [];
    
    // If description is ADF format
    if (typeof description === 'object' && description.content) {
      criteria = parseACFromADF(description);
    } 
    // If description is plain text
    else if (typeof description === 'string') {
      criteria = parseACFromText(description);
    }

    return criteria;
  };

  // Parse AC from JIRA ADF format (looking for tables)
  const parseACFromADF = (adf) => {
    const criteria = [];
    let acId = 1;

    const findTables = (node) => {
      if (!node) return;

      // Look for tables in ADF
      if (node.type === 'table') {
        console.log('Found table in ADF:', node);
        const rows = node.content || [];
        console.log('Table has', rows.length, 'rows');
        
        // Extract cell text helper
        const getCellText = (cell) => {
          if (!cell || !cell.content) return '';
          return cell.content.map(c => {
            if (c.type === 'paragraph' && c.content) {
              return c.content.map(t => t.text || '').join('');
            }
            return '';
          }).join('');
        };

        // Check if this is a vertical AC table (label | value format)
        // Each AC has 3 rows: "As A" row, "I want To" row, "So That" row
        let currentAC = { role: '', want: '', so: '' };
        let rowsProcessed = 0;
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (row.type === 'tableRow' && row.content && row.content.length >= 2) {
            const label = getCellText(row.content[0]).trim().toLowerCase();
            const value = getCellText(row.content[1]).trim();
            
            console.log('Row', i, '- Label:', label, 'Value:', value);
            
            if (label.includes('as a') || label === 'as a') {
              // Start of new AC
              if (rowsProcessed > 0 && (currentAC.role || currentAC.want)) {
                criteria.push({
                  id: acId++,
                  completed: false,
                  role: currentAC.role,
                  want: currentAC.want,
                  so: currentAC.so
                });
              }
              currentAC = { role: value, want: '', so: '' };
              rowsProcessed = 1;
            } else if (label.includes('i want') || label.includes('want')) {
              currentAC.want = value;
              rowsProcessed++;
            } else if (label.includes('so that') || label.includes('so')) {
              currentAC.so = value;
              rowsProcessed++;
            }
          }
        }
        
        // Add the last AC
        if (rowsProcessed > 0 && (currentAC.role || currentAC.want)) {
          criteria.push({
            id: acId++,
            completed: false,
            role: currentAC.role,
            want: currentAC.want,
            so: currentAC.so
          });
        }
      }

      // Recursively search for tables
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(findTables);
      }
    };

    findTables(adf);
    console.log('Parsed', criteria.length, 'acceptance criteria from ADF:', criteria);
    return criteria;
  };

  // Parse AC from plain text (looking for patterns)
  const parseACFromText = (text) => {
    const criteria = [];
    let acId = 1;

    // Look for "AS A ... I WANT TO ... SO THAT ..." patterns
    const acPattern = /AS A\s+(.+?)\s+I WANT TO\s+(.+?)\s+SO THAT\s+(.+?)(?=AS A|$)/gis;
    const matches = text.matchAll(acPattern);

    for (const match of matches) {
      criteria.push({
        id: acId++,
        completed: false, // Default to not completed for plain text
        role: match[1].trim(),
        want: match[2].trim(),
        so: match[3].trim()
      });
    }

    return criteria;
  };

  const loadAvailableRepositories = async () => {
    try {
      const result = await window.electronAPI?.codeIndexer?.listIndexedRepositories?.();
      if (result?.success) {
        setAvailableRepositories(result.repositories.map(r => r.full_name));
      }
    } catch (error) {
      console.error('Failed to load repositories:', error);
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
    setIsTyping(true);

    try {
      const response = await window.electronAPI.tasks.sendChatMessage(task.id, userMessage, {
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          route_to: task.route_to || 'mission-control',
          work_type: task.work_type || 'task'
        },
        repository: connectedRepo
      });

      if (response.success) {
        const aiMessage = {
          role: 'assistant',
          content: response.message,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMessage]);
        setConnectedRepo(null); // Clear repo after sending
      }
    } catch (error) {
      console.error('Failed to send message:', error);
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

  // Handle AC checkbox toggle (immediate save)
  const handleACToggle = async (id) => {
    const updatedAC = acceptanceCriteria.map(ac => 
      ac.id === id ? { ...ac, completed: !ac.completed } : ac
    );
    setAcceptanceCriteria(updatedAC);
    
    // Also update editedAC if in edit mode
    if (isACEditMode) {
      setEditedAC(updatedAC);
    } else {
      // Save immediately if not in edit mode
      await saveAcceptanceCriteriaToJira(updatedAC);
    }
  };

  // Start editing AC
  const startEditingAC = () => {
    setEditedAC(JSON.parse(JSON.stringify(acceptanceCriteria))); // Deep copy
    setIsACEditMode(true);
  };

  // Cancel AC editing
  const cancelACEdit = () => {
    setEditedAC([]);
    setIsACEditMode(false);
  };

  // Save AC changes
  const saveACChanges = async () => {
    setAcceptanceCriteria(editedAC);
    await saveAcceptanceCriteriaToJira(editedAC);
    setIsACEditMode(false);
    setEditedAC([]);
  };

  // Handle AC field edit (only updates local state)
  const handleACFieldChange = (id, field, value) => {
    const updatedAC = editedAC.map(ac => 
      ac.id === id ? { ...ac, [field]: value } : ac
    );
    setEditedAC(updatedAC);
  };

  // Test JIRA connection
  const testJiraConnection = async () => {
    try {
      console.log('Testing JIRA connection...');
      const health = await window.electronAPI.jira.healthCheck();
      console.log('JIRA health check result:', health);
      alert(`JIRA Status: ${health.status}\nSite: ${health.siteUrl || 'N/A'}`);
    } catch (error) {
      console.error('JIRA health check failed:', error);
      alert(`JIRA health check failed: ${error.message}`);
    }
  };

  // Save all JIRA changes
  const saveAllJiraChanges = async () => {
    setIsSaving(true);
    try {
      // First check JIRA connection
      console.log('Checking JIRA connection before update...');
      const health = await window.electronAPI.jira.healthCheck();
      console.log('JIRA health:', health);
      
      if (health.status !== 'healthy' && health.status !== 'connected') {
        alert(`JIRA is not connected. Status: ${health.status}. Please connect JIRA first.`);
        setIsSaving(false);
        return;
      }

      const issueKey = task.external_key || task.metadata?.jira_key;
      console.log('Task data:', { 
        external_key: task.external_key, 
        metadata: task.metadata,
        title: task.title 
      });
      
      if (!issueKey) {
        console.warn('No JIRA issue key found');
        alert('No JIRA issue key found for this task. Cannot update JIRA.');
        setIsSaving(false);
        return;
      }

      const updateData = {};
      
      // Add all changed fields (pass fields directly, not wrapped)
      if (editedTitle !== (task.title || task.session_title)) {
        updateData.summary = editedTitle;
        console.log('Updating title to:', editedTitle);
      }
      
      if (editedAssignee !== (user?.name || 'John Doe')) {
        updateData.assignee = editedAssignee;
        console.log('Updating assignee to:', editedAssignee);
      }
      
      if (editedDueDate !== (task.dueDate || 'Nov 12, 2025')) {
        // Convert date to YYYY-MM-DD format
        const dateText = editedDueDate.replace('Due ', '');
        const date = new Date(dateText);
        if (!isNaN(date.getTime())) {
          updateData.duedate = date.toISOString().split('T')[0];
          console.log('Updating due date to:', updateData.duedate);
        }
      }

      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        console.log('📤 Sending JIRA update:', { issueKey, updateData });
        const result = await window.electronAPI.jira.updateIssue(issueKey, updateData);
        
        console.log('📥 JIRA update result:', result);
        
        if (result && result.success) {
          console.log('✅ JIRA updated successfully:', issueKey);
          alert(`Successfully updated ${issueKey} in JIRA!`);
          setHasUnsavedChanges(false);
          setIsEditMode(false);
        } else {
          console.error('❌ Failed to update JIRA:', result?.error || 'Unknown error');
          alert(`Failed to update JIRA: ${result?.error || 'Unknown error'}`);
        }
      } else {
        console.log('No changes to save');
        alert('No changes detected');
        setIsEditMode(false);
      }
    } catch (error) {
      console.error('💥 Exception saving to JIRA:', error);
      alert(`Error saving to JIRA: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle field changes
  const handleFieldChange = (field, value) => {
    setHasUnsavedChanges(true);
    if (field === 'title') setEditedTitle(value);
    if (field === 'assignee') setEditedAssignee(value);
    if (field === 'duedate') setEditedDueDate(value);
  };

  // Save acceptance criteria to JIRA
  const saveAcceptanceCriteriaToJira = async (criteria) => {
    setIsSaving(true);
    try {
      // Helper function to create text with optional strike-through
      const createText = (text, strikethrough = false) => {
        const textNode = { type: 'text', text };
        if (strikethrough) {
          textNode.marks = [{ type: 'strike' }];
        }
        return textNode;
      };

      // Convert criteria back to ADF table format for JIRA
      const adfTable = {
        type: 'table',
        content: [
          // Header row
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Field' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Value' }] }] }
            ]
          },
          // Data rows for each AC (with strike-through if completed)
          ...criteria.flatMap(ac => [
            {
              type: 'tableRow',
              content: [
                { 
                  type: 'tableCell', 
                  content: [{ 
                    type: 'paragraph', 
                    content: [createText('AS A', ac.completed)] 
                  }] 
                },
                { 
                  type: 'tableCell', 
                  content: [{ 
                    type: 'paragraph', 
                    content: [createText(ac.role, ac.completed)] 
                  }] 
                }
              ]
            },
            {
              type: 'tableRow',
              content: [
                { 
                  type: 'tableCell', 
                  content: [{ 
                    type: 'paragraph', 
                    content: [createText('I WANT TO', ac.completed)] 
                  }] 
                },
                { 
                  type: 'tableCell', 
                  content: [{ 
                    type: 'paragraph', 
                    content: [createText(ac.want, ac.completed)] 
                  }] 
                }
              ]
            },
            {
              type: 'tableRow',
              content: [
                { 
                  type: 'tableCell', 
                  content: [{ 
                    type: 'paragraph', 
                    content: [createText('SO THAT', ac.completed)] 
                  }] 
                },
                { 
                  type: 'tableCell', 
                  content: [{ 
                    type: 'paragraph', 
                    content: [createText(ac.so, ac.completed)] 
                  }] 
                }
              ]
            }
          ])
        ]
      };

      // Update JIRA issue description with new AC table
      const issueKey = task.external_key || task.metadata?.jira_key;
      if (issueKey) {
        console.log('📤 Updating AC in JIRA:', issueKey);
        console.log('Current task description:', task.description);
        
        // Build the new description with updated AC table
        const newDescription = {
          type: 'doc',
          version: 1,
          content: [
            ...task.description.content.filter(node => !isAcceptanceCriteriaTable(node)),
            adfTable
          ]
        };
        
        console.log('New description ADF:', JSON.stringify(newDescription, null, 2));
        
        // Pass descriptionADF directly (not wrapped in fields)
        const result = await window.electronAPI.jira.updateIssue(issueKey, {
          descriptionADF: newDescription
        });
        
        console.log('📥 JIRA AC update result:', result);
        
        if (result && result.success) {
          console.log('✅ Acceptance criteria saved to JIRA:', issueKey);
          alert(`Successfully updated acceptance criteria in ${issueKey}!`);
        } else {
          console.error('❌ Failed to save AC to JIRA:', result?.error);
          alert(`Failed to save AC to JIRA: ${result?.error || 'Unknown error'}`);
        }
      } else {
        console.warn('No JIRA issue key found for task');
        alert('No JIRA issue key found - cannot save to JIRA');
      }
    } catch (error) {
      console.error('Failed to save acceptance criteria:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatMarkdownContent = (content) => {
    if (!content) return null;
    
    // If it's already a string, return it as text
    if (typeof content === 'string') return content;
    
    // Handle JIRA ADF (Atlassian Document Format) - return JSX
    if (content.content && Array.isArray(content.content)) {
      return null; // Will be handled by renderADF
    }
    
    return String(content);
  };

  // Check if a table is an acceptance criteria table
  const isAcceptanceCriteriaTable = (node) => {
    if (node.type !== 'table') return false;
    
    // Check if table has header row with AC-related columns
    const firstRow = node.content?.[0];
    if (firstRow?.type === 'tableRow' && firstRow.content) {
      const headerTexts = firstRow.content.map(cell => {
        const cellType = cell.type;
        const cellContent = cell.content;
        
        if (cellContent) {
          return cellContent.map(c => {
            if (c.type === 'paragraph' && c.content) {
              return c.content.map(t => t.text || '').join('').toLowerCase();
            }
            return '';
          }).join('');
        }
        return '';
      });
      
      console.log('Table header texts:', headerTexts);
      
      // Check for AC-related headers
      const hasACHeaders = headerTexts.some(text => 
        text.includes('as a') || 
        text.includes('as') ||
        text.includes('i want') || 
        text.includes('want') ||
        text.includes('so that') ||
        text.includes('acceptance criteria') ||
        text.includes('criteria')
      );
      
      console.log('Is AC table?', hasACHeaders);
      return hasACHeaders;
    }
    
    return false;
  };

  const renderADF = (adf) => {
    if (!adf || !adf.content) return <p>No description provided</p>;

    const renderNode = (node, index) => {
      if (!node) return null;

      if (node.type === 'text') {
        return node.text || '';
      }

      if (node.type === 'paragraph') {
        return (
          <p key={index} style={{ marginBottom: '12px' }}>
            {node.content?.map((child, idx) => renderNode(child, idx))}
          </p>
        );
      }

      if (node.type === 'heading') {
        const level = node.attrs?.level || 1;
        const Tag = `h${level}`;
        return (
          <Tag key={index} style={{ marginTop: '16px', marginBottom: '8px', fontWeight: 600 }}>
            {node.content?.map((child, idx) => renderNode(child, idx))}
          </Tag>
        );
      }

      if (node.type === 'bulletList') {
        return (
          <ul key={index} style={{ marginBottom: '12px', paddingLeft: '24px' }}>
            {node.content?.map((item, idx) => renderNode(item, idx))}
          </ul>
        );
      }

      if (node.type === 'orderedList') {
        return (
          <ol key={index} style={{ marginBottom: '12px', paddingLeft: '24px' }}>
            {node.content?.map((item, idx) => renderNode(item, idx))}
          </ol>
        );
      }

      if (node.type === 'listItem') {
        return (
          <li key={index} style={{ marginBottom: '4px' }}>
            {node.content?.map((child, idx) => renderNode(child, idx))}
          </li>
        );
      }

      if (node.type === 'table') {
        // Skip acceptance criteria tables - they're rendered separately below
        if (isAcceptanceCriteriaTable(node)) {
          return null;
        }
        
        return (
          <table key={index} className="jira-table editable-table">
            <tbody>
              {node.content?.map((row, idx) => renderNode(row, idx))}
            </tbody>
          </table>
        );
      }

      if (node.type === 'tableRow') {
        return (
          <tr key={index}>
            {node.content?.map((cell, idx) => renderNode(cell, idx))}
          </tr>
        );
      }

      if (node.type === 'tableHeader') {
        return (
          <th key={index}>
            {node.content?.map((child, idx) => renderNode(child, idx))}
          </th>
        );
      }

      if (node.type === 'tableCell') {
        return (
          <td 
            key={index}
            contentEditable={true}
            suppressContentEditableWarning={true}
            onBlur={(e) => {
              // TODO: Save cell changes to backend
              console.log('Cell edited:', e.target.textContent);
            }}
          >
            {node.content?.map((child, idx) => renderNode(child, idx))}
          </td>
        );
      }

      if (node.type === 'codeBlock') {
        return (
          <pre key={index} style={{ background: '#f3f4f6', padding: '12px', borderRadius: '6px', overflow: 'auto' }}>
            <code>{node.content?.map((child, idx) => renderNode(child, idx))}</code>
          </pre>
        );
      }

      if (node.content && Array.isArray(node.content)) {
        return node.content.map((child, idx) => renderNode(child, idx));
      }

      return null;
    };

    return <div className="adf-content">{adf.content.map((node, idx) => renderNode(node, idx))}</div>;
  };


  return (
    <div className={`task-detail-view ${isJiraPanelCollapsed ? 'jira-collapsed' : ''}`}>
      {/* Header with Back Button and Generate Report */}
      <div className="task-detail-header">
        <button className="back-to-tasks-btn" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>Back to tasks</span>
        </button>
        <button className="generate-report-header-btn" onClick={() => setShowReportModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          Generate Report
        </button>
      </div>

      {/* Left Side: JIRA Card */}
      <div className={`detail-jira-panel ${isJiraPanelCollapsed ? 'collapsed' : ''}`}>
        {/* Collapse Toggle Button */}
        <button 
          className="jira-panel-collapse-btn" 
          onClick={() => setIsJiraPanelCollapsed(!isJiraPanelCollapsed)}
          title={isJiraPanelCollapsed ? "Expand JIRA panel" : "Collapse JIRA panel"}
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ transform: isJiraPanelCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        {!isJiraPanelCollapsed && (
          <>
            {/* JIRA Info Card */}
            <div className="jira-info-card">
          {/* JIRA Card Header with Logo and Edit/Save Button */}
          <div className="jira-card-header">
            <div className="jira-header-left">
              <svg className="jira-logo" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.34V4.35a2.35 2.35 0 0 0-2.35-2.35h-8.12zm-4.35 6.35c0 2.4 1.94 4.34 4.34 4.34h1.79v1.7c0 2.4 1.94 4.34 4.34 4.34v-8.03a2.35 2.35 0 0 0-2.35-2.35H7.18zm-4.35 6.34c0 2.4 1.95 4.35 4.35 4.35h1.78v1.78c0 2.4 1.95 4.35 4.35 4.35v-8.13a2.35 2.35 0 0 0-2.35-2.35H2.83z" fill="#2684FF"/>
              </svg>
              <div className="jira-key-badge">{task.external_key || task.id}</div>
              <div className={`jira-status-badge status-${(task.status || 'todo').toLowerCase().replace(/\s+/g, '-')}`}>
                {task.status || 'TO DO'}
              </div>
            </div>
            
            {/* Test JIRA Connection Button (temporary) */}
            <button 
              className="jira-edit-btn"
              onClick={testJiraConnection}
              style={{ marginRight: '8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
              </svg>
              Test JIRA
            </button>

            {/* Edit/Save Button */}
            <button 
              className={`jira-edit-btn ${isEditMode ? 'save-mode' : ''}`}
              onClick={() => {
                if (isEditMode && hasUnsavedChanges) {
                  saveAllJiraChanges();
                } else {
                  setIsEditMode(!isEditMode);
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
                    <circle cx="12" cy="12" r="10"></circle>
                  </svg>
                  Saving...
                </>
              ) : isEditMode ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Save Changes
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Edit
                </>
              )}
            </button>
          </div>

          {/* JIRA Title - Editable in Edit Mode */}
          {isEditMode ? (
            <input
              type="text"
              className="jira-card-title-input"
              value={editedTitle}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="Task title"
            />
          ) : (
            <h1 className="jira-card-title">
              {editedTitle || task.title || task.session_title}
            </h1>
          )}

          {/* JIRA Metadata - Editable in Edit Mode */}
          <div className="jira-card-meta">
            <div className="meta-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              {isEditMode ? (
                <input
                  type="text"
                  className="meta-input"
                  value={editedAssignee}
                  onChange={(e) => handleFieldChange('assignee', e.target.value)}
                  placeholder="Assignee"
                />
              ) : (
                <span>{editedAssignee}</span>
              )}
            </div>
            <div className="meta-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              {isEditMode ? (
                <input
                  type="text"
                  className="meta-input"
                  value={editedDueDate}
                  onChange={(e) => handleFieldChange('duedate', e.target.value)}
                  placeholder="Due date"
                />
              ) : (
                <span>Due {editedDueDate}</span>
              )}
            </div>
            <div className="meta-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>Created 2 days ago</span>
            </div>
          </div>
        </div>

        {/* Acceptance Criteria - Editable with Save/Cancel */}
        {acceptanceCriteria.length > 0 && (
          <div className="acceptance-criteria-section">
            <div className="ac-header">
              <div className="ac-header-left" onClick={() => setIsACCollapsed(!isACCollapsed)}>
                <h2>Acceptance Criteria</h2>
                <span className="ac-count">
                  {acceptanceCriteria.filter(ac => ac.completed).length} of {acceptanceCriteria.length} completed
                </span>
              </div>
              <div className="ac-header-actions">
                {isACEditMode ? (
                  <>
                    <button className="ac-action-btn save-btn" onClick={saveACChanges} disabled={isSaving}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Save
                    </button>
                    <button className="ac-action-btn cancel-btn" onClick={cancelACEdit} disabled={isSaving}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className="ac-action-btn edit-btn" onClick={startEditingAC}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit
                  </button>
                )}
                <button className="ac-collapse-btn" onClick={() => setIsACCollapsed(!isACCollapsed)}>
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    style={{ transform: isACCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </div>

            {!isACCollapsed && (
              <div className="ac-cards">
                {(isACEditMode ? editedAC : acceptanceCriteria).map((ac, index) => (
                <div key={ac.id} className={`ac-card ${ac.completed ? 'completed' : ''}`}>
                  <div className="ac-card-header">
                    <input 
                      type="checkbox" 
                      checked={ac.completed}
                      onChange={() => handleACToggle(ac.id)}
                      className="ac-checkbox" 
                      id={`ac-${ac.id}`}
                    />
                  </div>
                  
                  <div className="ac-card-content">
                    <div className="ac-section">
                      <label className="ac-label">AS A</label>
                      {isACEditMode ? (
                        <input
                          type="text"
                          className="ac-input"
                          value={ac.role}
                          onChange={(e) => handleACFieldChange(ac.id, 'role', e.target.value)}
                        />
                      ) : (
                        <div className="ac-value">{ac.role}</div>
                      )}
                    </div>

                    <div className="ac-section">
                      <label className="ac-label">I WANT TO</label>
                      {isACEditMode ? (
                        <input
                          type="text"
                          className="ac-input"
                          value={ac.want}
                          onChange={(e) => handleACFieldChange(ac.id, 'want', e.target.value)}
                        />
                      ) : (
                        <div className="ac-value">{ac.want}</div>
                      )}
                    </div>

                    <div className="ac-section">
                      <label className="ac-label">SO THAT</label>
                      {isACEditMode ? (
                        <input
                          type="text"
                          className="ac-input"
                          value={ac.so}
                          onChange={(e) => handleACFieldChange(ac.id, 'so', e.target.value)}
                        />
                      ) : (
                        <div className="ac-value">{ac.so}</div>
                      )}
                    </div>
                  </div>
                </div>
                ))}
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* Right Side: Chat */}
      <div className="detail-chat-panel">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="no-messages">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <p>No messages yet</p>
              <span>Start a conversation about this task</span>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`message message-${msg.role} ${msg.isReport ? 'message-report' : ''}`}>
                {msg.isReport && editingMessageId !== msg.id && (
                  <div className="message-actions">
                    <button 
                      className="edit-message-btn"
                      onClick={() => {
                        setEditingMessageId(msg.id);
                        setEditedMessageContent(msg.content);
                      }}
                      title="Edit report"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                  </div>
                )}
                {editingMessageId === msg.id ? (
                  <div className="message-edit-container">
                    <textarea
                      className="message-edit-textarea"
                      value={editedMessageContent}
                      onChange={(e) => setEditedMessageContent(e.target.value)}
                      rows={15}
                      autoFocus
                    />
                    <div className="message-edit-actions">
                      <button 
                        className="save-message-btn"
                        onClick={async () => {
                          // Update the message locally
                          setMessages(prev => prev.map(m => 
                            m.id === msg.id ? { ...m, content: editedMessageContent } : m
                          ));
                          
                          // Save to backend
                          try {
                            await window.electronAPI.tasks.updateChatMessage(task.id, msg.id, editedMessageContent);
                          } catch (error) {
                            console.error('Failed to save message:', error);
                          }
                          
                          setEditingMessageId(null);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Save
                      </button>
                      <button 
                        className="cancel-message-btn"
                        onClick={() => {
                          setEditingMessageId(null);
                          setEditedMessageContent('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="message-content">{msg.content}</div>
                )}
              </div>
            ))
          )}
          {isTyping && (
            <div className="message message-assistant">
              <div className="message-content typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          {connectedRepo && (
            <div className="repo-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
              </svg>
              {connectedRepo}
              <button onClick={() => setConnectedRepo(null)}>×</button>
            </div>
          )}
          
          <div className="input-controls">
            <div className="control-buttons-left">
              {/* GitHub Code Indexer Button */}
              <button
                className={`control-btn ${connectedRepo ? 'active' : ''}`}
                onClick={() => {
                  if (!showRepoSelector) loadAvailableRepositories();
                  setShowRepoSelector(!showRepoSelector);
                }}
                title="Connect to GitHub repository for code context"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
                <span>Code</span>
              </button>

              {/* Confluence Documentation Button */}
              <button
                className="control-btn"
                onClick={async () => {
                  try {
                    const result = await window.electronAPI.confluence.checkConnection();
                    if (result.connected) {
                      alert('Confluence is connected! Documentation context will be included in your chat.');
                    } else {
                      alert('Confluence is not connected. Please connect Confluence in settings.');
                    }
                  } catch (error) {
                    console.error('Confluence check failed:', error);
                    alert('Failed to check Confluence connection');
                  }
                }}
                title="Include Confluence documentation context"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span>Docs</span>
              </button>
            </div>
            
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this task..."
              rows={2}
              disabled={isTyping}
            />
            
            <button className="send-btn" onClick={handleSend} disabled={!input.trim() || isTyping}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>

          {showRepoSelector && (
            <div className="repo-selector">
              <div className="repo-selector-header">
                <span>Select Repository</span>
                <button onClick={() => setShowRepoSelector(false)}>×</button>
              </div>
              {availableRepositories.map(repo => (
                <button
                  key={repo}
                  className="repo-option"
                  onClick={() => {
                    setConnectedRepo(repo);
                    setShowRepoSelector(false);
                  }}
                >
                  {repo}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Generation Modal */}
      {showReportModal && (
        <div className="report-modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="report-modal-compact" onClick={(e) => e.stopPropagation()}>
            <h4>Generate Report</h4>
            <p className="modal-task-info">
              {task.external_key || task.id} - {task.title || task.session_title}
            </p>
            <div className="report-type-buttons">
              <button onClick={async () => {
                const entityId = user?.email || 'user@company.com';
                setShowReportModal(false);
                setIsTyping(true);
                
                try {
                  const result = await window.electronAPI.reporting.generateReport('person', entityId, {});
                  if (result.success) {
                    // Add report as an assistant message in the chat
                    const reportMessage = {
                      id: Date.now(),
                      role: 'assistant',
                      content: result.report.summary,
                      timestamp: new Date().toISOString(),
                      isReport: true
                    };
                    setMessages(prev => [...prev, reportMessage]);
                    
                    // Save to backend
                    await window.electronAPI.tasks.sendChatMessage(task.id, result.report.summary, 'report');
                  } else {
                    const errorMessage = {
                      id: Date.now(),
                      role: 'assistant',
                      content: `❌ Failed to generate report: ${result.error}`,
                      timestamp: new Date().toISOString()
                    };
                    setMessages(prev => [...prev, errorMessage]);
                  }
                } catch (error) {
                  const errorMessage = {
                    id: Date.now(),
                    role: 'assistant',
                    content: `❌ Error generating report: ${error.message}`,
                    timestamp: new Date().toISOString()
                  };
                  setMessages(prev => [...prev, errorMessage]);
                } finally {
                  setIsTyping(false);
                }
              }}>
                👤 Person Report
              </button>
              <button onClick={async () => {
                const entityId = task.external_key || task.externalKey || task.id;
                setShowReportModal(false);
                setIsTyping(true);
                
                try {
                  const result = await window.electronAPI.reporting.generateReport('feature', entityId, {});
                  if (result.success) {
                    // Add report as an assistant message in the chat
                    const reportMessage = {
                      id: Date.now(),
                      role: 'assistant',
                      content: result.report.summary,
                      timestamp: new Date().toISOString(),
                      isReport: true
                    };
                    setMessages(prev => [...prev, reportMessage]);
                    
                    // Save to backend
                    await window.electronAPI.tasks.sendChatMessage(task.id, result.report.summary, 'report');
                  } else {
                    const errorMessage = {
                      id: Date.now(),
                      role: 'assistant',
                      content: `❌ Failed to generate report: ${result.error}`,
                      timestamp: new Date().toISOString()
                    };
                    setMessages(prev => [...prev, errorMessage]);
                  }
                } catch (error) {
                  const errorMessage = {
                    id: Date.now(),
                    role: 'assistant',
                    content: `❌ Error generating report: ${error.message}`,
                    timestamp: new Date().toISOString()
                  };
                  setMessages(prev => [...prev, errorMessage]);
                } finally {
                  setIsTyping(false);
                }
              }}>
                🎯 Feature Report
              </button>
            </div>
            <button className="modal-cancel" onClick={() => setShowReportModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

