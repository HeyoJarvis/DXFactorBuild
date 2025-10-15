# Architecture Diagram Builder - Advanced Features

## Container/Group Support

The Architecture Diagram Builder now supports sophisticated grouping and container nodes, allowing you to create complex diagrams similar to AWS architecture diagrams.

## New Node Types

### 1. Group/Container Nodes
Large container nodes that can hold other nodes inside them:
- AWS Regions
- VPCs
- Kubernetes Clusters
- Subnets
- Any logical grouping

**Properties:**
- Customizable color and background
- Header with label and optional badge
- Dashed border for visual distinction
- Resizable to fit contained nodes

### 2. Service Nodes
Smaller nodes designed for microservices:
- Compact design
- Shows replica count
- Perfect for Kubernetes pods/services

### 3. Load Balancer Nodes
Special nodes for traffic distribution:
- Pink/magenta theme
- Shows load balancing icon
- Connects frontend to backend services

## AI Generation Examples

### Example 1: Kubernetes Cluster with Services

**Input:**
```
An EKS cluster running 3 microservices. Each service connects to a PostgreSQL database. 
A load balancer distributes traffic to the services.
```

**Result:**
- Creates a Kubernetes Cluster group (orange border)
- Generates 3 service nodes inside the cluster
- Creates PostgreSQL database node
- Adds load balancer node
- Connects: Load Balancer → Services → Database

### Example 2: AWS VPC Architecture

**Input:**
```
AWS region with a VPC containing React frontend, Node.js backend, and MongoDB database. 
Frontend calls the backend through an Application Load Balancer.
```

**Result:**
- Creates AWS Region group container
- Generates React frontend node
- Creates ALB load balancer
- Generates Node.js backend node (inside VPC)
- Creates MongoDB database node (inside VPC)
- Connects: React → ALB → Backend → MongoDB

### Example 3: Simple Architecture

**Input:**
```
A React frontend that connects to a Python backend API, which stores data in PostgreSQL and Redis for caching.
```

**Result:**
- React frontend node
- Python backend node
- PostgreSQL database node
- Redis infrastructure node
- Intelligent connections between them

## Smart Detection Keywords

### Container Detection
- **Kubernetes**: `kubernetes`, `k8s`, `eks`, `cluster`
- **AWS**: `aws`, `vpc`, `region`
- Automatically creates group nodes when detected

### Service Count Detection
- **Pattern**: `[number] service[s]`
- **Examples**: 
  - "3 services" → generates 3 service nodes
  - "5 microservices" → generates 5 service nodes

### Load Balancer Detection
- **Keywords**: `load balancer`, `loadbalancer`, `lb`, `alb`, `nlb`
- Creates specialized load balancer node

### Technology Detection
Expanded detection includes:
- **Frontend**: react, vue, angular, nextjs, svelte, frontend, ui
- **Backend**: nodejs, python, java, go, ruby, php, express, django, flask, backend, api
- **Database**: postgresql, mysql, mongodb, redis, elasticsearch, database, db
- **Infrastructure**: docker, nginx, kafka, rabbitmq, queue

## Intelligent Connection Logic

The AI generator creates smart connections based on common patterns:

1. **Frontend → Load Balancer → Backend**
   - If load balancer exists, frontend connects through it
   - Otherwise, frontend connects directly to backend

2. **Backend → Database**
   - All backend/service nodes connect to database nodes
   - Uses appropriate labels (SQL, NoSQL, etc.)

3. **Load Balancer → Services**
   - Load balancer distributes to all backend/service nodes
   - Shows "HTTP" labels on connections

## Manual Editing

After AI generation, you can:

1. **Resize Containers**: Click and drag container borders
2. **Move Nodes**: Drag nodes to reposition (even inside containers)
3. **Add Connections**: Drag from node handles to create edges
4. **Edit Labels**: Click nodes to edit (future feature)
5. **Add More Nodes**: Drag from palette while maintaining groups

## Container/Group Properties

When AI creates a container, it includes:

```javascript
{
  id: 'group-0',
  type: 'group',
  position: { x: 50, y: 50 },
  style: { width: 600, height: 400 },  // Resizable
  data: {
    label: 'Kubernetes Cluster',
    badge: 'EKS',                       // Optional badge
    color: '#FF9900',                    // Header color
    backgroundColor: 'rgba(255, 153, 0, 0.05)',  // Container background
    description: 'Managed Kubernetes cluster'
  }
}
```

## Node Hierarchy

Nodes inside containers use:
```javascript
{
  parentNode: 'group-0',  // ID of parent container
  extent: 'parent'        // Constrain movement to parent
}
```

This ensures:
- Child nodes stay inside parent container
- Proper z-index layering
- Visual grouping

## Example Prompts to Try

### 1. Microservices with Message Queue
```
A Kubernetes cluster with 4 microservices. They communicate through Kafka message queue. 
Frontend is React outside the cluster. PostgreSQL database inside the cluster.
```

### 2. Serverless AWS
```
AWS region with Lambda functions behind API Gateway. DynamoDB for storage. 
CloudFront CDN for React frontend.
```

### 3. Traditional Three-Tier
```
Classic three-tier: Vue.js frontend, Java Spring Boot backend, MySQL database. 
NGINX load balancer in front.
```

### 4. Event-Driven
```
EKS cluster with 3 producer services and 2 consumer services. 
RabbitMQ message queue connects them. MongoDB for event storage.
```

## Tips for Best Results

1. **Be Specific**: Mention exact technologies and counts
2. **Use Structure Words**: "cluster", "VPC", "region" trigger containers
3. **Specify Numbers**: "3 services" is better than "multiple services"
4. **Mention Connections**: Describe how components communicate
5. **Layer by Layer**: Describe from outside-in (CDN → LB → Services → DB)

## Visual Customization

### Colors by Type
- **Frontend**: Blue (#3b82f6)
- **Backend**: Green (#10b981)
- **Database**: Orange (#f59e0b)
- **Infrastructure**: Purple (#8b5cf6)
- **Load Balancer**: Pink (#ec4899)
- **Service**: Indigo (#6366f1)
- **AWS Container**: Orange (#FF9900)
- **Kubernetes Container**: Orange (#FF9900)

### Container Styles
- **Dashed Border**: 2px dashed, matches header color
- **Transparent Background**: Subtle color wash (5% opacity)
- **Header**: Solid color with white text
- **Badge**: Semi-transparent white pill

## React Flow Features

Built on React Flow, includes:
- **Zoom**: Mouse wheel or controls
- **Pan**: Click and drag canvas
- **Fit View**: Auto-center button
- **Mini-map**: Overview in corner
- **Snap to Grid**: 15x15 pixel grid
- **Animated Edges**: Show data flow direction

## Future Enhancements

- [ ] Subnet groupings within VPCs
- [ ] Security group visualizations
- [ ] IAM role connections
- [ ] Database replication arrows
- [ ] Network traffic metrics
- [ ] Cost estimation overlays
- [ ] Compliance zone markings
- [ ] Import from Terraform/CloudFormation

---

**Status**: Container support implemented ✅  
**Last Updated**: 2025-01-15  
**Version**: 2.0 (with grouping)

