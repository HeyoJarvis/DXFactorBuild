/**
 * Architecture Diagram Templates
 * Pre-built templates for common architecture patterns
 */

export const templates = {
  'three-tier': {
    name: 'Three-Tier Web Application',
    description: 'Classic web application with presentation, business logic, and data layers',
    nodes: [
      {
        id: 'frontend',
        type: 'frontend',
        position: { x: 250, y: 50 },
        data: { 
          label: 'React Frontend', 
          technology: 'React',
          category: 'frontend',
          description: 'User interface layer'
        }
      },
      {
        id: 'backend',
        type: 'backend',
        position: { x: 250, y: 200 },
        data: { 
          label: 'Node.js API', 
          technology: 'Node.js',
          category: 'backend',
          description: 'Business logic and API endpoints'
        }
      },
      {
        id: 'database',
        type: 'database',
        position: { x: 250, y: 350 },
        data: { 
          label: 'PostgreSQL', 
          technology: 'PostgreSQL',
          category: 'database',
          description: 'Data persistence layer'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'frontend', target: 'backend', animated: true, label: 'HTTP/REST' },
      { id: 'e2', source: 'backend', target: 'database', animated: true, label: 'SQL' }
    ]
  },
  
  'microservices': {
    name: 'Microservices Architecture',
    description: 'Distributed system with multiple independent services',
    nodes: [
      {
        id: 'api-gateway',
        type: 'infrastructure',
        position: { x: 400, y: 50 },
        data: { 
          label: 'API Gateway', 
          technology: 'Kong',
          category: 'infrastructure',
          description: 'Entry point for all requests'
        }
      },
      {
        id: 'auth-service',
        type: 'backend',
        position: { x: 150, y: 200 },
        data: { 
          label: 'Auth Service', 
          technology: 'Node.js',
          category: 'backend',
          description: 'Authentication & authorization'
        }
      },
      {
        id: 'user-service',
        type: 'backend',
        position: { x: 400, y: 200 },
        data: { 
          label: 'User Service', 
          technology: 'Node.js',
          category: 'backend',
          description: 'User management'
        }
      },
      {
        id: 'order-service',
        type: 'backend',
        position: { x: 650, y: 200 },
        data: { 
          label: 'Order Service', 
          technology: 'Python',
          category: 'backend',
          description: 'Order processing'
        }
      },
      {
        id: 'message-queue',
        type: 'infrastructure',
        position: { x: 400, y: 350 },
        data: { 
          label: 'Message Queue', 
          technology: 'RabbitMQ',
          category: 'infrastructure',
          description: 'Async communication'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'api-gateway', target: 'auth-service' },
      { id: 'e2', source: 'api-gateway', target: 'user-service' },
      { id: 'e3', source: 'api-gateway', target: 'order-service' },
      { id: 'e4', source: 'auth-service', target: 'message-queue', animated: true },
      { id: 'e5', source: 'user-service', target: 'message-queue', animated: true },
      { id: 'e6', source: 'order-service', target: 'message-queue', animated: true }
    ]
  },
  
  'serverless': {
    name: 'Serverless Architecture',
    description: 'Event-driven architecture with serverless functions',
    nodes: [
      {
        id: 'frontend',
        type: 'frontend',
        position: { x: 100, y: 50 },
        data: { 
          label: 'React SPA', 
          technology: 'React',
          category: 'frontend',
          description: 'Single-page application'
        }
      },
      {
        id: 'cdn',
        type: 'infrastructure',
        position: { x: 350, y: 50 },
        data: { 
          label: 'CloudFront CDN', 
          technology: 'AWS',
          category: 'infrastructure',
          description: 'Content delivery'
        }
      },
      {
        id: 'api-gateway',
        type: 'infrastructure',
        position: { x: 600, y: 50 },
        data: { 
          label: 'API Gateway', 
          technology: 'AWS',
          category: 'infrastructure',
          description: 'API management'
        }
      },
      {
        id: 'lambda-1',
        type: 'backend',
        position: { x: 450, y: 200 },
        data: { 
          label: 'Lambda Function', 
          technology: 'AWS Lambda',
          category: 'backend',
          description: 'User operations'
        }
      },
      {
        id: 'lambda-2',
        type: 'backend',
        position: { x: 700, y: 200 },
        data: { 
          label: 'Lambda Function', 
          technology: 'AWS Lambda',
          category: 'backend',
          description: 'Data processing'
        }
      },
      {
        id: 'dynamodb',
        type: 'database',
        position: { x: 575, y: 350 },
        data: { 
          label: 'DynamoDB', 
          technology: 'AWS',
          category: 'database',
          description: 'NoSQL database'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'frontend', target: 'cdn' },
      { id: 'e2', source: 'cdn', target: 'api-gateway' },
      { id: 'e3', source: 'api-gateway', target: 'lambda-1' },
      { id: 'e4', source: 'api-gateway', target: 'lambda-2' },
      { id: 'e5', source: 'lambda-1', target: 'dynamodb', animated: true },
      { id: 'e6', source: 'lambda-2', target: 'dynamodb', animated: true }
    ]
  },
  
  'event-driven': {
    name: 'Event-Driven System',
    description: 'Event sourcing with message-driven architecture',
    nodes: [
      {
        id: 'producer-1',
        type: 'backend',
        position: { x: 100, y: 150 },
        data: { 
          label: 'Producer Service', 
          technology: 'Node.js',
          category: 'backend',
          description: 'Generates events'
        }
      },
      {
        id: 'producer-2',
        type: 'backend',
        position: { x: 100, y: 300 },
        data: { 
          label: 'Producer Service', 
          technology: 'Python',
          category: 'backend',
          description: 'Generates events'
        }
      },
      {
        id: 'event-bus',
        type: 'infrastructure',
        position: { x: 400, y: 225 },
        data: { 
          label: 'Event Bus', 
          technology: 'Kafka',
          category: 'infrastructure',
          description: 'Central event stream'
        }
      },
      {
        id: 'consumer-1',
        type: 'backend',
        position: { x: 700, y: 150 },
        data: { 
          label: 'Consumer Service', 
          technology: 'Node.js',
          category: 'backend',
          description: 'Processes events'
        }
      },
      {
        id: 'consumer-2',
        type: 'backend',
        position: { x: 700, y: 300 },
        data: { 
          label: 'Consumer Service', 
          technology: 'Go',
          category: 'backend',
          description: 'Processes events'
        }
      },
      {
        id: 'event-store',
        type: 'database',
        position: { x: 400, y: 400 },
        data: { 
          label: 'Event Store', 
          technology: 'MongoDB',
          category: 'database',
          description: 'Event sourcing database'
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'producer-1', target: 'event-bus', animated: true, label: 'publish' },
      { id: 'e2', source: 'producer-2', target: 'event-bus', animated: true, label: 'publish' },
      { id: 'e3', source: 'event-bus', target: 'consumer-1', animated: true, label: 'subscribe' },
      { id: 'e4', source: 'event-bus', target: 'consumer-2', animated: true, label: 'subscribe' },
      { id: 'e5', source: 'event-bus', target: 'event-store', label: 'persist' }
    ]
  }
};

export const getTemplate = (templateId) => {
  return templates[templateId] || null;
};

export const getTemplateList = () => {
  return Object.entries(templates).map(([id, template]) => ({
    id,
    name: template.name,
    description: template.description
  }));
};

