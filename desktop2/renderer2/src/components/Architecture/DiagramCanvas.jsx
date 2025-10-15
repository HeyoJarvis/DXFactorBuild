import { useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import './DiagramCanvas.css';

// Custom node components
const FrontendNode = ({ data }) => (
  <div className="custom-node frontend-node">
    <div className="node-header">
      <div className="node-icon">F</div>
      <div className="node-label">{data.label}</div>
    </div>
    {data.description && <div className="node-description">{data.description}</div>}
  </div>
);

const BackendNode = ({ data }) => (
  <div className="custom-node backend-node">
    <div className="node-header">
      <div className="node-icon">B</div>
      <div className="node-label">{data.label}</div>
    </div>
    {data.description && <div className="node-description">{data.description}</div>}
  </div>
);

const DatabaseNode = ({ data }) => (
  <div className="custom-node database-node">
    <div className="node-header">
      <div className="node-icon">D</div>
      <div className="node-label">{data.label}</div>
    </div>
    {data.description && <div className="node-description">{data.description}</div>}
  </div>
);

const InfrastructureNode = ({ data }) => (
  <div className="custom-node infrastructure-node">
    <div className="node-header">
      <div className="node-icon">I</div>
      <div className="node-label">{data.label}</div>
    </div>
    {data.description && <div className="node-description">{data.description}</div>}
  </div>
);

// Container/Group node for grouping other nodes
const GroupNode = ({ data }) => (
  <div className="group-node" style={{
    borderColor: data.color || '#6b7280',
    backgroundColor: data.backgroundColor || 'rgba(107, 114, 128, 0.05)'
  }}>
    <div className="group-header" style={{
      backgroundColor: data.color || '#6b7280'
    }}>
      <div className="group-label">{data.label}</div>
      {data.badge && <div className="group-badge">{data.badge}</div>}
    </div>
    {data.description && <div className="group-description">{data.description}</div>}
  </div>
);

// Service/Pod node (smaller, for microservices)
const ServiceNode = ({ data }) => (
  <div className="service-node">
    <div className="service-icon">S</div>
    <div className="service-label">{data.label}</div>
    {data.replicas && <div className="service-replicas">×{data.replicas}</div>}
  </div>
);

// Load Balancer node
const LoadBalancerNode = ({ data }) => (
  <div className="custom-node loadbalancer-node">
    <div className="node-header">
      <div className="node-icon">⚖</div>
      <div className="node-label">{data.label}</div>
    </div>
    {data.description && <div className="node-description">{data.description}</div>}
  </div>
);

const nodeTypes = {
  frontend: FrontendNode,
  backend: BackendNode,
  database: DatabaseNode,
  infrastructure: InfrastructureNode,
  group: GroupNode,
  service: ServiceNode,
  loadbalancer: LoadBalancerNode
};

export default function DiagramCanvas({ 
  initialNodes = [], 
  initialEdges = [],
  onNodesChange: onNodesChangeCallback,
  onEdgesChange: onEdgesChangeCallback
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        }
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');

      if (!type) {
        return;
      }

      const nodeData = JSON.parse(type);
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode = {
        id: `node-${Date.now()}`,
        type: nodeData.type,
        position,
        data: nodeData.data
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  // Update parent component when nodes or edges change
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    if (onNodesChangeCallback) {
      onNodesChangeCallback(nodes);
    }
  }, [onNodesChange, onNodesChangeCallback, nodes]);

  const handleEdgesChange = useCallback((changes) => {
    onEdgesChange(changes);
    if (onEdgesChangeCallback) {
      onEdgesChangeCallback(edges);
    }
  }, [onEdgesChange, onEdgesChangeCallback, edges]);

  return (
    <div className="diagram-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          }
        }}
      >
        <Background
          variant="dots"
          gap={20}
          size={1}
          color="#e5e7eb"
        />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'frontend': return '#3b82f6';
              case 'backend': return '#10b981';
              case 'database': return '#f59e0b';
              case 'infrastructure': return '#8b5cf6';
              default: return '#6b7280';
            }
          }}
          maskColor="rgba(0, 0, 0, 0.05)"
        />
      </ReactFlow>
    </div>
  );
}

