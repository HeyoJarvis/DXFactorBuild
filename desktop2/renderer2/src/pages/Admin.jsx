import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Admin.css';

/**
 * Admin Panel - Manage teams, units, and organization structure
 * Only accessible to users with admin role
 */
export default function Admin({ user }) {
  const navigate = useNavigate();
  
  // Check management access (admin, team_lead, or unit_lead)
  useEffect(() => {
    if (!user || !['admin', 'team_lead', 'unit_lead'].includes(user.user_role)) {
      console.warn('⚠️ Unauthorized access attempt to Admin panel');
      navigate('/mission-control');
    }
  }, [user, navigate]);

  const [activeTab, setActiveTab] = useState('teams'); // 'teams', 'units', or 'users'
  const [teams, setTeams] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  
  // Modal states
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showCreateUnitModal, setShowCreateUnitModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUserTeamsModal, setShowUserTeamsModal] = useState(false);
  const [showChangeRoleModal, setShowChangeRoleModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedLeadTeams, setSelectedLeadTeams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [showNewDeptInput, setShowNewDeptInput] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    department: '',
    description: ''
  });

  useEffect(() => {
    loadCapabilities();
    loadTeams();
    loadUsers();
  }, []);

  const loadCapabilities = async () => {
    try {
      console.log('🔄 Loading capabilities...');
      const result = await window.electronAPI.admin.getCapabilities();
      
      if (result.success) {
        console.log('✅ Capabilities loaded:', result.capabilities);
        setCapabilities(result.capabilities);
      } else {
        console.error('❌ Failed to load capabilities:', result.error);
      }
    } catch (error) {
      console.error('❌ Error loading capabilities:', error);
    }
  };

  const loadTeams = async () => {
    try {
      setLoading(true);
      // Use admin API which filters teams based on user role
      const result = await window.electronAPI.admin.getAllTeams();
      
      if (result.success) {
        setTeams(result.teams || []);
        
        // Extract unique departments
        const depts = [...new Set((result.teams || []).map(t => t.department || 'General'))];
        setDepartments(depts.sort());
      } else {
        console.error('Failed to load teams:', result.error);
        setError(result.error || 'Failed to load teams');
      }
    } catch (error) {
      console.error('Error loading teams:', error);
      setError(error.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      console.log('🔄 Loading users...');
      const result = await window.electronAPI.admin.getAllUsers();
      
      console.log('📦 Users result:', result);
      
      if (result.success) {
        console.log(`✅ Loaded ${result.users?.length || 0} users`);
        setUsers(result.users || []);
      } else {
        console.error('❌ Failed to load users:', result.error);
        setError(result.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('❌ Error loading users:', error);
      setError(error.message || 'Failed to load users');
    }
  };

  const handleCreateTeam = () => {
    setFormData({
      name: '',
      slug: '',
      department: 'General', // Default to General
      description: ''
    });
    setShowCreateTeamModal(true);
  };

  const handleCreateUnit = () => {
    setFormData({
      name: '',
      slug: '',
      department: 'General', // Default to General
      description: ''
    });
    setShowCreateUnitModal(true);
  };

  const handleEdit = async (item) => {
    setSelectedItem(item);
    const itemDept = item.department || 'General';
    
    // Check if the item's department exists in our list
    const deptExists = departments.includes(itemDept);
    
    setFormData({
      name: item.name,
      slug: item.slug,
      department: itemDept,
      description: item.description || ''
    });
    
    // If department doesn't exist in list, show new dept input
    setShowNewDeptInput(!deptExists && itemDept !== 'General');
    
    // Load team members
    try {
      const result = await window.electronAPI.admin.getTeamMembers(item.id);
      if (result.success) {
        setTeamMembers(result.members || []);
      }
    } catch (error) {
      console.error('Error loading team members:', error);
      setTeamMembers([]);
    }
    
    setShowEditModal(true);
  };

  const handleSaveTeam = async () => {
    try {
      if (!formData.name || !formData.department) {
        alert('Please fill in all required fields');
        return;
      }

      const result = await window.electronAPI.admin.createOrUpdateTeam({
        id: selectedItem?.id,
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
        department: formData.department,
        description: formData.description
      });

      if (result.success) {
        await loadTeams();
        closeModals();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error saving team:', error);
      alert('Error saving team');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('Are you sure you want to delete this team/unit? This cannot be undone.')) {
      return;
    }

    try {
      const result = await window.electronAPI.admin.deleteTeam(teamId);
      
      if (result.success) {
        await loadTeams();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Error deleting team');
    }
  };

  const handleManageUserTeams = async (user) => {
    setSelectedUser(user);
    
    // Load user's team memberships
    try {
      const result = await window.electronAPI.admin.getUserTeams(user.id);
      if (result.success) {
        setSelectedUser({
          ...user,
          teamMemberships: result.teams || []
        });
      }
    } catch (error) {
      console.error('Error loading user teams:', error);
    }
    
    setShowUserTeamsModal(true);
  };

  const handleChangeRole = async (user) => {
    setSelectedUser(user);
    setSelectedRole(user.user_role);
    
    // Load teams where user is a lead
    try {
      const result = await window.electronAPI.admin.getUserLeadTeams(user.id);
      if (result.success && result.teams && result.teams.length > 0) {
        // For team_lead, if all teams are in same department, show that department
        if (user.user_role === 'team_lead') {
          const departments = [...new Set(result.teams.map(t => t.teams?.department).filter(Boolean))];
          if (departments.length === 1) {
            // Team lead of a single department - store department name
            setSelectedLeadTeams([departments[0]]);
          } else {
            // Legacy: team lead with mixed or specific units
            setSelectedLeadTeams(result.teams.map(t => t.team_id));
          }
        } else {
          // Unit lead - store team IDs
          setSelectedLeadTeams(result.teams.map(t => t.team_id));
        }
      } else {
        setSelectedLeadTeams([]);
      }
    } catch (error) {
      console.error('Error loading user lead teams:', error);
      setSelectedLeadTeams([]);
    }
    
    setShowChangeRoleModal(true);
  };

  const handleSaveRole = async () => {
    if (!selectedUser || !selectedRole) return;
    
    // Validate management role assignments
    if (selectedRole === 'unit_lead' && selectedLeadTeams.length === 0) {
      alert('Please select at least one unit to manage');
      return;
    }
    
    if (selectedRole === 'team_lead' && selectedLeadTeams.length === 0) {
      alert('Please select a department to lead');
      return;
    }
    
    try {
      // For team_lead, selectedLeadTeams[0] is the department name
      // Backend will handle assigning all units in that department
      const result = await window.electronAPI.admin.updateUserRole(selectedUser.id, selectedRole, selectedLeadTeams);
      
      if (result.success) {
        // Reload users list
        await loadUsers();
        closeModals();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Error updating user role');
    }
  };

  const handleToggleUserTeam = async (teamId) => {
    if (!selectedUser) return;
    
    const isMember = selectedUser.teamMemberships?.some(t => t.team_id === teamId);
    
    try {
      const result = isMember
        ? await window.electronAPI.admin.removeUserFromTeam(selectedUser.id, teamId)
        : await window.electronAPI.admin.addUserToTeam(selectedUser.id, teamId);
      
      if (result.success) {
        // Reload user teams
        const updatedResult = await window.electronAPI.admin.getUserTeams(selectedUser.id);
        if (updatedResult.success) {
          setSelectedUser({
            ...selectedUser,
            teamMemberships: updatedResult.teams || []
          });
        }
        // Reload users list
        await loadUsers();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error toggling user team:', error);
      alert('Error updating team membership');
    }
  };

  const closeModals = () => {
    setShowCreateTeamModal(false);
    setShowCreateUnitModal(false);
    setShowEditModal(false);
    setShowUserTeamsModal(false);
    setShowChangeRoleModal(false);
    setSelectedItem(null);
    setSelectedUser(null);
    setSelectedRole(null);
    setSelectedLeadTeams([]);
    setMemberSearchQuery('');
    setTeamMembers([]);
    setShowNewDeptInput(false);
    setFormData({
      name: '',
      slug: '',
      department: '',
      description: ''
    });
  };

  const handleToggleLeadTeam = (teamId) => {
    setSelectedLeadTeams(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
  };

  const handleAddUserToTeam = async (userId) => {
    if (!selectedItem) return;
    
    try {
      const result = await window.electronAPI.admin.addUserToTeam(userId, selectedItem.id);
      
      if (result.success) {
        // Reload team members
        const membersResult = await window.electronAPI.admin.getTeamMembers(selectedItem.id);
        if (membersResult.success) {
          setTeamMembers(membersResult.members || []);
        }
        // Reload users to update team counts
        await loadUsers();
      } else {
        alert('Error adding user: ' + result.error);
      }
    } catch (error) {
      console.error('Error adding user to team:', error);
      alert('Error adding user to team');
    }
  };

  const handleRemoveUserFromTeam = async (userId) => {
    if (!selectedItem) return;
    
    try {
      const result = await window.electronAPI.admin.removeUserFromTeam(userId, selectedItem.id);
      
      if (result.success) {
        // Reload team members
        const membersResult = await window.electronAPI.admin.getTeamMembers(selectedItem.id);
        if (membersResult.success) {
          setTeamMembers(membersResult.members || []);
        }
        // Reload users to update team counts
        await loadUsers();
      } else {
        alert('Error removing user: ' + result.error);
      }
    } catch (error) {
      console.error('Error removing user from team:', error);
      alert('Error removing user from team');
    }
  };

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Group teams by department
  const teamsByDepartment = teams.reduce((acc, team) => {
    const dept = team.department || 'General';
    if (!acc[dept]) {
      acc[dept] = [];
    }
    acc[dept].push(team);
    return acc;
  }, {});

  // Filter users based on search query
  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.user_role?.toLowerCase().includes(query)
    );
  });

  // Get users not in the current team (for adding) and filter by search
  const availableUsers = users
    .filter(u => !teamMembers.some(m => m.id === u.id))
    .filter(u => {
      if (!memberSearchQuery) return true;
      const query = memberSearchQuery.toLowerCase();
      return (
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.user_role?.toLowerCase().includes(query)
      );
    });

  // Check if user has any management role
  const canAccessAdmin = user && ['admin', 'team_lead', 'unit_lead'].includes(user.user_role);
  
  if (!canAccessAdmin) {
    return null;
  }

  // Helper to get role display name
  const getRoleDisplayName = (role) => {
    const roleNames = {
      'developer': 'Developer',
      'sales': 'Sales',
      'admin': 'Admin',
      'team_lead': 'Team Lead',
      'unit_lead': 'Unit Lead'
    };
    return roleNames[role] || role;
  };

  const getRoleColor = (role) => {
    const roleColors = {
      'developer': '#3b82f6',  // Blue
      'sales': '#22c55e',      // Green
      'admin': '#ef4444',      // Red
      'team_lead': '#f59e0b',  // Amber/Orange
      'unit_lead': '#8b5cf6'   // Purple
    };
    return roleColors[role] || '#6b7280';
  };

  return (
    <div className="admin-container">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-left">
          <button className="admin-back-button" onClick={() => navigate('/mission-control')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back
          </button>
          <h1 className="admin-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
            Admin Panel
          </h1>
        </div>
        <div className="admin-header-right">
          <div className="admin-user-badge" style={{ borderColor: getRoleColor(user.user_role) }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>{user.name}</span>
            <span className="admin-role-badge" style={{ 
              background: `${getRoleColor(user.user_role)}20`,
              color: getRoleColor(user.user_role),
              borderColor: `${getRoleColor(user.user_role)}50`
            }}>
              {getRoleDisplayName(user.user_role)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          Teams & Departments
        </button>
        <button
          className={`admin-tab ${activeTab === 'units' ? 'active' : ''}`}
          onClick={() => setActiveTab('units')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
          All Units
        </button>
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          Users
        </button>
      </div>

      {/* Capabilities Banner */}
      {capabilities && (
        <div className="admin-capabilities-banner" style={{ 
          background: `${getRoleColor(user.user_role)}10`,
          borderColor: `${getRoleColor(user.user_role)}30`
        }}>
          <div className="capability-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>
              {capabilities.isAdmin && 'You have full administrative access to all teams and users.'}
              {capabilities.isTeamLead && !capabilities.isAdmin && `You can manage teams and users in the ${capabilities.department} department.`}
              {capabilities.isUnitLead && !capabilities.isTeamLead && !capabilities.isAdmin && `You can manage ${capabilities.managedTeamsCount} unit${capabilities.managedTeamsCount !== 1 ? 's' : ''}.`}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="admin-content">
        {loading ? (
          <div className="admin-loading">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        ) : activeTab === 'teams' ? (
          // Teams & Departments View
          <div className="admin-teams-view">
            <div className="admin-section-header">
              <h2>Teams & Departments</h2>
              {capabilities?.canCreateTeams && (
                <button className="admin-create-button" onClick={handleCreateTeam}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  New Unit
                </button>
              )}
            </div>

            <div className="admin-departments-grid">
              {Object.keys(teamsByDepartment).sort().map(dept => (
                <div key={dept} className="admin-department-card">
                  <div className="department-card-header">
                    <h3>{dept}</h3>
                    <span className="department-count">{teamsByDepartment[dept].length} units</span>
                  </div>
                  <div className="department-units-list">
                    {teamsByDepartment[dept].map(unit => (
                      <div key={unit.id} className="department-unit-item">
                        <div className="unit-info">
                          <span className="unit-name">{unit.name}</span>
                          {unit.slug && <span className="unit-slug">/{unit.slug}</span>}
                        </div>
                        <div className="unit-actions">
                          <button onClick={() => handleEdit(unit)} title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button onClick={() => handleDeleteTeam(unit.id)} title="Delete" className="delete-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'units' ? (
          // All Units View
          <div className="admin-units-view">
            <div className="admin-section-header">
              <h2>All Units</h2>
              <div className="unit-stats">
                <span className="stat-badge">{teams.length} total units</span>
                <span className="stat-badge">{departments.length} departments</span>
              </div>
              {capabilities?.canCreateTeams && (
                <button className="admin-create-button" onClick={handleCreateUnit}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  New Unit
                </button>
              )}
            </div>

            {/* Search Bar */}
            <div className="admin-search-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                type="text"
                placeholder="Search units by name, department, or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>

            {/* Units Table */}
            <div className="admin-units-table">
              <table>
                <thead>
                  <tr>
                    <th>Unit Name</th>
                    <th>Department</th>
                    <th>Slug</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams
                    .filter(unit => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        unit.name?.toLowerCase().includes(query) ||
                        unit.department?.toLowerCase().includes(query) ||
                        unit.slug?.toLowerCase().includes(query) ||
                        'general'.includes(query) && !unit.department
                      );
                    })
                    .map(unit => (
                      <tr key={unit.id}>
                        <td>
                          <div className="unit-name-cell">
                            <strong>{unit.name}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="unit-department-badge">
                            {unit.department || 'General'}
                          </span>
                        </td>
                        <td>
                          <span className="unit-slug-cell">
                            {unit.slug ? `/${unit.slug}` : '-'}
                          </span>
                        </td>
                        <td>
                          <span className="unit-description-cell">
                            {unit.description || '-'}
                          </span>
                        </td>
                        <td>
                          <div className="unit-table-actions">
                            <button 
                              className="table-action-btn edit-btn" 
                              onClick={() => handleEdit(unit)}
                              title="Edit unit & manage members"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                              Edit
                            </button>
                            {capabilities?.canDeleteTeams && (
                              <button 
                                className="table-action-btn delete-btn" 
                                onClick={() => handleDeleteTeam(unit.id)}
                                title="Delete unit"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              
              {teams.filter(unit => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return (
                  unit.name?.toLowerCase().includes(query) ||
                  unit.department?.toLowerCase().includes(query) ||
                  unit.slug?.toLowerCase().includes(query) ||
                  'general'.includes(query) && !unit.department
                );
              }).length === 0 && (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="3" x2="9" y2="21"></line>
                  </svg>
                  <p>{searchQuery ? 'No units found matching your search' : 'No units yet'}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Users View
          <div className="admin-users-view">
            <div className="admin-section-header">
              <h2>All Users</h2>
              <div className="user-stats">
                <span className="stat-badge">{users.length} total users</span>
                <span className="stat-badge">{users.filter(u => u.user_role === 'admin').length} admins</span>
              </div>
            </div>

            {/* Search Bar */}
            <div className="admin-search-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                type="text"
                placeholder="Search users by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>

            {error && (
              <div className="admin-error-banner">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{error}</span>
                <button onClick={() => { setError(null); loadUsers(); }}>
                  Retry
                </button>
              </div>
            )}

            <div className="admin-users-grid">
              {filteredUsers.map(user => {
                const teamCount = user.team_count || 0;
                return (
                  <div key={user.id} className="admin-user-card">
                    <div className="user-card-header">
                      <div className="user-avatar">
                        {user.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div className="user-info">
                        <h3>{user.name}</h3>
                        <p className="user-email">{user.email}</p>
                      </div>
                      <span className={`user-role-badge ${user.user_role}`}>
                        {user.user_role || 'user'}
                      </span>
                    </div>

                    <div className="user-card-stats">
                      <div className="user-stat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="9" y1="3" x2="9" y2="21"></line>
                        </svg>
                        <span>{teamCount} {teamCount === 1 ? 'team' : 'teams'}</span>
                      </div>
                      {user.last_active && (
                        <div className="user-stat">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          <span>Active {formatRelativeTime(user.last_active)}</span>
                        </div>
                      )}
                    </div>

                    <div className="user-card-actions">
                      <button 
                        className="user-manage-button" 
                        onClick={() => handleManageUserTeams(user)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="9" y1="3" x2="9" y2="21"></line>
                        </svg>
                        Manage Teams
                      </button>
                      {capabilities?.isAdmin && (
                        <button 
                          className="user-role-button" 
                          onClick={() => handleChangeRole(user)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          Change Role
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* User Teams Management Modal */}
      {showUserTeamsModal && selectedUser && (
        <div className="admin-modal-overlay" onClick={closeModals}>
          <div className="admin-modal admin-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="user-modal-avatar">
                  {selectedUser.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <h2>{selectedUser.name}</h2>
                  <p className="user-modal-email">{selectedUser.email}</p>
                </div>
              </div>
              <button className="modal-close" onClick={closeModals}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="modal-content modal-content-teams">
              <h3 className="teams-section-title">Team Memberships</h3>
              <p className="teams-section-subtitle">Select which teams this user belongs to</p>
              
              {Object.keys(teamsByDepartment).sort().map(dept => (
                <div key={dept} className="team-department-section">
                  <h4 className="department-title">{dept}</h4>
                  <div className="team-checkboxes">
                    {teamsByDepartment[dept].map(team => {
                      const isMember = selectedUser.teamMemberships?.some(t => t.team_id === team.id);
                      return (
                        <label key={team.id} className="team-checkbox-label">
                          <input
                            type="checkbox"
                            checked={isMember}
                            onChange={() => handleToggleUserTeam(team.id)}
                          />
                          <span className="team-checkbox-name">{team.name}</span>
                          {team.slug && <span className="team-checkbox-slug">/{team.slug}</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="modal-cancel-button" onClick={closeModals}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {showChangeRoleModal && selectedUser && (
        <div className="admin-modal-overlay" onClick={closeModals}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="user-modal-avatar">
                  {selectedUser.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <h2>Change Role for {selectedUser.name}</h2>
                  <p className="user-modal-email">{selectedUser.email}</p>
                </div>
              </div>
              <button className="modal-close" onClick={closeModals}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Select Role *</label>
                <p className="role-help-text">
                  Current role: <strong>{getRoleDisplayName(selectedUser.user_role)}</strong>
                </p>
                <div className="role-options">
                  {['sales', 'developer', 'unit_lead', 'team_lead', 'admin'].map(role => (
                    <label key={role} className={`role-option ${selectedRole === role ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={selectedRole === role}
                        onChange={(e) => setSelectedRole(e.target.value)}
                      />
                      <div className="role-option-content">
                        <span className="role-option-name" style={{ color: getRoleColor(role) }}>
                          {getRoleDisplayName(role)}
                        </span>
                        <span className="role-option-desc">
                          {role === 'sales' && 'CRM integration, deal tracking, customer communications'}
                          {role === 'developer' && 'Code analysis, JIRA integration, pull requests'}
                          {role === 'unit_lead' && 'Manage team members within specific units'}
                          {role === 'team_lead' && 'Create units and manage department teams'}
                          {role === 'admin' && 'Full system administration and user management'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Team Lead: Select Department */}
              {selectedRole === 'team_lead' && (
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label>Select Department to Lead *</label>
                  <p className="role-help-text">
                    Team Lead will manage ALL units within this department
                  </p>
                  <select
                    value={selectedLeadTeams[0] || ''}
                    onChange={(e) => setSelectedLeadTeams(e.target.value ? [e.target.value] : [])}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '2px solid rgba(139, 92, 246, 0.2)',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Unit Lead: Select Specific Units */}
              {selectedRole === 'unit_lead' && (
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label>Select Units to Manage *</label>
                  <p className="role-help-text">
                    Choose which specific units this user will lead
                  </p>
                  <div className="lead-teams-selection">
                    {Object.keys(teamsByDepartment).sort().map(dept => (
                      <div key={dept} className="lead-team-department-section">
                        <h4 className="lead-department-title">{dept}</h4>
                        <div className="lead-team-checkboxes">
                          {teamsByDepartment[dept].map(team => (
                            <label key={team.id} className="lead-team-checkbox-label">
                              <input
                                type="checkbox"
                                checked={selectedLeadTeams.includes(team.id)}
                                onChange={() => handleToggleLeadTeam(team.id)}
                              />
                              <span className="lead-team-checkbox-name">{team.name}</span>
                              {team.slug && <span className="lead-team-checkbox-slug">/{team.slug}</span>}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-cancel-button" onClick={closeModals}>
                Cancel
              </button>
              <button 
                className="modal-save-button" 
                onClick={handleSaveRole}
                disabled={
                  !selectedRole || 
                  selectedRole === selectedUser.user_role ||
                  ((selectedRole === 'unit_lead' || selectedRole === 'team_lead') && selectedLeadTeams.length === 0)
                }
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateTeamModal || showCreateUnitModal || showEditModal) && (
        <div className="admin-modal-overlay" onClick={closeModals}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {showEditModal ? 'Edit Unit' : 'Create New Unit'}
              </h2>
              <button className="modal-close" onClick={closeModals}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., eng-desktop-team, sales-east-coast"
                />
              </div>

              <div className="form-group">
                <label>Department *</label>
                <p className="form-help-text">
                  {showEditModal 
                    ? 'Select an existing department or create a new one to move this unit'
                    : 'Select which department this unit belongs to'
                  }
                </p>
                {!showNewDeptInput ? (
                  <>
                    <select
                      value={formData.department}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setShowNewDeptInput(true);
                          setFormData({ ...formData, department: '' });
                        } else {
                          setFormData({ ...formData, department: e.target.value });
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '2px solid rgba(139, 92, 246, 0.2)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                      <option value="__new__" style={{ fontWeight: 'bold', color: '#8b5cf6' }}>
                        ➕ Create New Department...
                      </option>
                    </select>
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="e.g., Engineering, Marketing, Product"
                      autoFocus
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        border: '2px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewDeptInput(false);
                        setFormData({ ...formData, department: departments[0] || 'General' });
                      }}
                      style={{
                        padding: '10px 14px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        color: '#64748b'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="Auto-generated from name if left empty"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>

              {/* Team Members Section (only in edit mode) */}
              {showEditModal && (
                <>
                  <div className="form-divider"></div>
                  
                  <div className="team-members-section">
                    <h3 className="section-title">
                      Team Members ({teamMembers.length})
                    </h3>
                    <p className="form-help-text" style={{ marginTop: '-8px', marginBottom: '12px' }}>
                      Member changes are saved instantly. Click "Save Changes" to update unit details above.
                    </p>
                    
                    {teamMembers.length > 0 ? (
                      <div className="members-list">
                        {teamMembers.map(member => (
                          <div key={member.id} className="member-item">
                            <div className="member-avatar">
                              {member.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="member-info">
                              <div className="member-name">{member.name}</div>
                              <div className="member-email">{member.email}</div>
                            </div>
                            <span className="member-role-badge" style={{
                              background: `${getRoleColor(member.user_role)}20`,
                              color: getRoleColor(member.user_role),
                              borderColor: `${getRoleColor(member.user_role)}50`
                            }}>
                              {getRoleDisplayName(member.user_role)}
                            </span>
                            <button 
                              className="member-remove-button" 
                              onClick={() => handleRemoveUserFromTeam(member.id)}
                              title="Remove from team"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-members">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        <p>No members in this team yet</p>
                      </div>
                    )}

                    <h3 className="section-title" style={{ marginTop: '24px' }}>
                      Add Members
                    </h3>
                    
                    {/* Search bar for available users */}
                    <div className="member-search-bar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                      </svg>
                      <input
                        type="text"
                        placeholder="Search users to add..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                      />
                      {memberSearchQuery && (
                        <button className="clear-search-small" onClick={() => setMemberSearchQuery('')}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    {availableUsers.length > 0 ? (
                      <div className="add-members-list">
                        {availableUsers.map(user => (
                          <div key={user.id} className="add-member-item">
                            <div className="member-avatar">
                              {user.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="member-info">
                              <div className="member-name">{user.name}</div>
                              <div className="member-email">{user.email}</div>
                            </div>
                            <button 
                              className="member-add-button" 
                              onClick={() => handleAddUserToTeam(user.id)}
                              title="Add to team"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                              </svg>
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-members">
                        <p>{memberSearchQuery ? 'No users found matching search' : 'All users are already in this team'}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-cancel-button" onClick={closeModals}>
                Cancel
              </button>
              <button 
                className="modal-save-button" 
                onClick={handleSaveTeam}
              >
                {showEditModal ? 'Save Changes' : 'Create Unit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

