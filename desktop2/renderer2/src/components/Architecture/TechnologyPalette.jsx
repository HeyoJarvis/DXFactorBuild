import { useState } from 'react';
import './TechnologyPalette.css';

const technologies = {
  frontend: [
    { id: 'react', name: 'React', logo: '/tech-logos/frontend/react.svg' },
    { id: 'vue', name: 'Vue.js', logo: '/tech-logos/frontend/vue.svg' },
    { id: 'angular', name: 'Angular', logo: '/tech-logos/frontend/angular.svg' },
    { id: 'nextjs', name: 'Next.js', logo: '/tech-logos/frontend/nextjs.svg' },
    { id: 'svelte', name: 'Svelte', logo: '/tech-logos/frontend/svelte.svg' },
  ],
  backend: [
    { id: 'nodejs', name: 'Node.js', logo: '/tech-logos/backend/nodejs.svg' },
    { id: 'python', name: 'Python', logo: '/tech-logos/backend/python.svg' },
    { id: 'java', name: 'Java', logo: '/tech-logos/backend/java.svg' },
    { id: 'go', name: 'Go', logo: '/tech-logos/backend/go.svg' },
    { id: 'ruby', name: 'Ruby', logo: '/tech-logos/backend/ruby.svg' },
    { id: 'php', name: 'PHP', logo: '/tech-logos/backend/php.svg' },
  ],
  database: [
    { id: 'postgresql', name: 'PostgreSQL', logo: '/tech-logos/database/postgresql.svg' },
    { id: 'mysql', name: 'MySQL', logo: '/tech-logos/database/mysql.svg' },
    { id: 'mongodb', name: 'MongoDB', logo: '/tech-logos/database/mongodb.svg' },
    { id: 'redis', name: 'Redis', logo: '/tech-logos/database/redis.svg' },
    { id: 'elasticsearch', name: 'Elasticsearch', logo: '/tech-logos/database/elasticsearch.svg' },
  ],
  infrastructure: [
    { id: 'docker', name: 'Docker', logo: '/tech-logos/infrastructure/docker.svg' },
    { id: 'kubernetes', name: 'Kubernetes', logo: '/tech-logos/infrastructure/kubernetes.svg' },
    { id: 'aws', name: 'AWS', logo: '/tech-logos/infrastructure/aws.svg' },
    { id: 'azure', name: 'Azure', logo: '/tech-logos/infrastructure/azure.svg' },
    { id: 'gcp', name: 'Google Cloud', logo: '/tech-logos/infrastructure/gcp.svg' },
    { id: 'nginx', name: 'NGINX', logo: '/tech-logos/infrastructure/nginx.svg' },
  ],
  tools: [
    { id: 'git', name: 'Git', logo: '/tech-logos/tools/git.svg' },
    { id: 'github', name: 'GitHub', logo: '/tech-logos/tools/github.svg' },
    { id: 'gitlab', name: 'GitLab', logo: '/tech-logos/tools/gitlab.svg' },
    { id: 'jenkins', name: 'Jenkins', logo: '/tech-logos/tools/jenkins.svg' },
    { id: 'terraform', name: 'Terraform', logo: '/tech-logos/tools/terraform.svg' },
  ]
};

export default function TechnologyPalette() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [recentlyUsed, setRecentlyUsed] = useState([]);

  const categories = ['all', 'frontend', 'backend', 'database', 'infrastructure', 'tools'];

  const handleDragStart = (event, tech, category) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({
      type: category,
      data: {
        label: tech.name,
        technology: tech.name,
        category: category,
        logo: tech.logo
      }
    }));
    event.dataTransfer.effectAllowed = 'move';
    
    // Add to recently used
    setRecentlyUsed(prev => {
      const filtered = prev.filter(t => t.id !== tech.id);
      return [{ ...tech, category }, ...filtered].slice(0, 5);
    });
  };

  const filterTechnologies = () => {
    let filtered = {};
    
    Object.entries(technologies).forEach(([category, techs]) => {
      if (selectedCategory === 'all' || selectedCategory === category) {
        const matchingTechs = techs.filter(tech =>
          tech.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (matchingTechs.length > 0) {
          filtered[category] = matchingTechs;
        }
      }
    });
    
    return filtered;
  };

  const filteredTechs = filterTechnologies();

  return (
    <div className="technology-palette">
      <div className="palette-header">
        <h3 className="palette-title">Technology Palette</h3>
        <p className="palette-subtitle">Drag to canvas</p>
      </div>

      {/* Search */}
      <div className="palette-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          type="text"
          placeholder="Search technologies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="palette-search-input"
        />
      </div>

      {/* Category Filter */}
      <div className="palette-categories">
        {categories.map(cat => (
          <button
            key={cat}
            className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Recently Used */}
      {recentlyUsed.length > 0 && (
        <div className="palette-section">
          <div className="section-header">Recently Used</div>
          <div className="tech-grid">
            {recentlyUsed.map(tech => (
              <div
                key={`recent-${tech.id}`}
                className="tech-item"
                draggable
                onDragStart={(e) => handleDragStart(e, tech, tech.category)}
                title={tech.name}
              >
                <div className="tech-icon">
                  <div className="tech-icon-placeholder" style={{
                    background: `linear-gradient(135deg, ${getCategoryColor(tech.category)}20, ${getCategoryColor(tech.category)}40)`
                  }}>
                    {tech.name.charAt(0)}
                  </div>
                </div>
                <div className="tech-name">{tech.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technology Categories */}
      <div className="palette-technologies">
        {Object.entries(filteredTechs).map(([category, techs]) => (
          <div key={category} className="palette-section">
            <div className="section-header">
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </div>
            <div className="tech-grid">
              {techs.map(tech => (
                <div
                  key={tech.id}
                  className="tech-item"
                  draggable
                  onDragStart={(e) => handleDragStart(e, tech, category)}
                  title={tech.name}
                >
                  <div className="tech-icon">
                    <div className="tech-icon-placeholder" style={{
                      background: `linear-gradient(135deg, ${getCategoryColor(category)}20, ${getCategoryColor(category)}40)`
                    }}>
                      {tech.name.charAt(0)}
                    </div>
                  </div>
                  <div className="tech-name">{tech.name}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(filteredTechs).length === 0 && (
        <div className="palette-empty">
          <div className="empty-icon">🔍</div>
          <div className="empty-text">No technologies found</div>
        </div>
      )}
    </div>
  );
}

function getCategoryColor(category) {
  const colors = {
    frontend: '#3b82f6',
    backend: '#10b981',
    database: '#f59e0b',
    infrastructure: '#8b5cf6',
    tools: '#6b7280'
  };
  return colors[category] || '#6b7280';
}

