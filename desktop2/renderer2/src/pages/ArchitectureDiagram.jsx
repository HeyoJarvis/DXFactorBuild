import { useState, useCallback, useRef } from 'react';
import { toPng } from 'html-to-image';
import TechnologyPalette from '../components/Architecture/TechnologyPalette';
import DiagramCanvas from '../components/Architecture/DiagramCanvas';
import AIGenerator from '../components/Architecture/AIGenerator';
import './ArchitectureDiagram.css';

export default function ArchitectureDiagram({ user }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [diagramName, setDiagramName] = useState('Untitled Architecture');
  const canvasRef = useRef(null);

  const handleGenerate = useCallback((parsed) => {
    setNodes(parsed.nodes);
    setEdges(parsed.edges);
  }, []);

  const handleLoadTemplate = useCallback((template) => {
    setNodes(template.nodes);
    setEdges(template.edges);
    setDiagramName(template.name);
  }, []);

  const handleExportPNG = useCallback(async () => {
    const canvas = document.querySelector('.react-flow');
    if (!canvas) return;

    try {
      const dataUrl = await toPng(canvas, {
        backgroundColor: '#ffffff',
        width: canvas.offsetWidth,
        height: canvas.offsetHeight,
      });

      const link = document.createElement('a');
      link.download = `${diagramName.toLowerCase().replace(/ /g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [diagramName]);

  const handleExportJSON = useCallback(() => {
    const data = {
      name: diagramName,
      nodes,
      edges,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${diagramName.toLowerCase().replace(/ /g, '-')}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [diagramName, nodes, edges]);

  const handleClear = useCallback(() => {
    if (window.confirm('Are you sure you want to clear the diagram?')) {
      setNodes([]);
      setEdges([]);
      setDiagramName('Untitled Architecture');
    }
  }, []);

  return (
    <div className="architecture-diagram-page">
      {/* Header */}
      <div className="architecture-header" style={{ WebkitAppRegion: 'drag' }}>
        <div className="header-content" style={{ WebkitAppRegion: 'no-drag' }}>
          {/* Left: Title */}
          <div className="header-brand">
            <div className="brand-text">
              <input
                type="text"
                className="diagram-name-input"
                value={diagramName}
                onChange={(e) => setDiagramName(e.target.value)}
                placeholder="Diagram name..."
              />
              <span className="brand-subtitle">Architecture Builder</span>
            </div>
          </div>

          {/* Center: Actions */}
          <div className="header-actions">
            <button className="header-btn" onClick={handleClear} title="Clear diagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear
            </button>
            <button className="header-btn" onClick={handleExportJSON} title="Export as JSON">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              Save JSON
            </button>
            <button className="header-btn header-btn-primary" onClick={handleExportPNG} title="Export as PNG">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export PNG
            </button>
          </div>

          {/* Right: Window Controls */}
          <div className="header-controls">
            <div className="node-count">
              {nodes.length} node{nodes.length !== 1 ? 's' : ''}
            </div>
            <button
              className="minimize-btn"
              onClick={() => {
                if (window.electronAPI?.window?.minimize) {
                  window.electronAPI.window.minimize();
                } else if (window.electron?.minimize) {
                  window.electron.minimize();
                } else {
                  window.close();
                }
              }}
              title="Minimize"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Three Panel Layout */}
      <div className="architecture-content">
        {/* Left: Technology Palette */}
        <div className="left-panel">
          <TechnologyPalette />
        </div>

        {/* Center: Canvas */}
        <div className="center-panel" ref={canvasRef}>
          {nodes.length === 0 ? (
            <div className="canvas-empty-state">
              <div className="empty-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                </svg>
              </div>
              <h3 className="empty-title">Start Building Your Architecture</h3>
              <p className="empty-subtitle">
                Drag technologies from the left palette or use AI to generate a diagram
              </p>
            </div>
          ) : (
            <DiagramCanvas
              initialNodes={nodes}
              initialEdges={edges}
              onNodesChange={setNodes}
              onEdgesChange={setEdges}
            />
          )}
        </div>

        {/* Right: AI Generator */}
        <div className="right-panel">
          <AIGenerator
            onGenerate={handleGenerate}
            onLoadTemplate={handleLoadTemplate}
          />
        </div>
      </div>
    </div>
  );
}

