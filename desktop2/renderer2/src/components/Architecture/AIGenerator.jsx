import { useState } from 'react';
import { getTemplateList, getTemplate } from './templates';
import './AIGenerator.css';

export default function AIGenerator({ onGenerate, onLoadTemplate }) {
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const templates = getTemplateList();

  const handleGenerate = async () => {
    if (!description.trim()) return;

    setIsGenerating(true);

    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Parse description for technologies
    const parsed = parseDescription(description);
    onGenerate(parsed);

    setIsGenerating(false);
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    const template = getTemplate(templateId);
    if (template) {
      onLoadTemplate(template);
    }
  };

  return (
    <div className="ai-generator">
      <div className="generator-header">
        <h3 className="generator-title">AI Generator</h3>
        <p className="generator-subtitle">Describe your architecture</p>
      </div>

      {/* Template Selection */}
      <div className="generator-section">
        <div className="section-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          Templates
        </div>
        <div className="template-list">
          {templates.map(template => (
            <button
              key={template.id}
              className={`template-item ${selectedTemplate === template.id ? 'selected' : ''}`}
              onClick={() => handleTemplateSelect(template.id)}
            >
              <div className="template-name">{template.name}</div>
              <div className="template-description">{template.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* AI Description */}
      <div className="generator-section">
        <div className="section-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          Describe Architecture
        </div>
        <textarea
          className="generator-textarea"
          placeholder="Example: A React frontend that connects to a Node.js backend API, which stores data in PostgreSQL. The system uses Redis for caching and RabbitMQ for async jobs."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={8}
        />
        <button
          className="generate-btn"
          onClick={handleGenerate}
          disabled={!description.trim() || isGenerating}
        >
          {isGenerating ? (
            <>
              <div className="spinner"></div>
              Generating...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              Generate Diagram
            </>
          )}
        </button>
      </div>

      {/* Tips */}
      <div className="generator-tips">
        <div className="tips-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          Tips
        </div>
        <ul className="tips-list">
          <li>Mention specific technologies (React, Node.js, PostgreSQL)</li>
          <li>Use "Kubernetes cluster" or "EKS" to create grouped containers</li>
          <li>Say "3 services" or "microservices" to generate multiple service nodes</li>
          <li>Include "AWS", "VPC", or "region" for cloud groupings</li>
          <li>Mention "load balancer" for traffic distribution</li>
          <li>You can drag nodes and resize containers after generation</li>
        </ul>
      </div>
    </div>
  );
}

// Mock AI parsing logic with container/group support
function parseDescription(description) {
  const lower = description.toLowerCase();
  const nodes = [];
  const edges = [];
  let nodeId = 0;

  // Check for container patterns (AWS, Kubernetes, VPC, etc.)
  const hasKubernetes = lower.includes('kubernetes') || lower.includes('k8s') || lower.includes('eks') || lower.includes('cluster');
  const hasAWS = lower.includes('aws') || lower.includes('vpc') || lower.includes('region');
  const hasMicroservices = lower.includes('microservice') || lower.includes('service');
  
  // Extract numbers (for "3 services", "2 replicas", etc.)
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

  // If Kubernetes/EKS cluster detected, create group node
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
  }

  // If AWS/VPC detected, create region/VPC group
  if (hasAWS && !hasKubernetes) {
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

  // Detect and create service nodes if microservices pattern
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
            label: capitalizeFirst(keyword.replace(/[-.]/g, ' ')),
            technology: capitalizeFirst(keyword),
            category: category,
            description: `${capitalizeFirst(keyword)} component`
          },
          parentNode: (hasKubernetes || hasAWS) && category !== 'frontend' ? 'group-0' : undefined,
          extent: (hasKubernetes || hasAWS) && category !== 'frontend' ? 'parent' : undefined
        });
        nodeId++;
      }
    });
  });

  // Create intelligent connections
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
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

