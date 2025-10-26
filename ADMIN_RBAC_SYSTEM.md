# Role-Based Access Control (RBAC) System

## Overview
The Admin Panel now features a comprehensive three-tier role-based access control system that delegates team management responsibilities across different organizational levels.

## Role Hierarchy

### 1. **Admin** (Full Access)
- **Badge Color**: Red (#ef4444)
- **Capabilities**:
  - ✅ View all teams across all departments
  - ✅ View all users in the organization
  - ✅ Create new departments
  - ✅ Create new units in any department
  - ✅ Edit any team/unit
  - ✅ Delete any team/unit
  - ✅ Assign users to any team
  - ✅ Remove users from any team
  - ✅ Manage department structures

**Use Case**: System administrators, C-level executives, HR managers

### 2. **Team Lead** (Department-Level Access)
- **Badge Color**: Purple (#8b5cf6)
- **Capabilities**:
  - ✅ View all teams in their department
  - ✅ View all users in their department teams
  - ✅ Create new units within their department
  - ✅ Edit units in their department
  - ✅ Delete units in their department
  - ✅ Assign users to teams in their department
  - ✅ Remove users from teams in their department
  - ❌ Cannot access other departments
  - ❌ Cannot create departments

**Use Case**: Engineering Manager, Sales Director, Product Lead

### 3. **Unit Lead** (Unit-Level Access)
- **Badge Color**: Blue (#3b82f6)
- **Capabilities**:
  - ✅ View only their assigned units
  - ✅ View users in their units
  - ✅ Assign users to their units
  - ✅ Remove users from their units
  - ❌ Cannot create new teams/units
  - ❌ Cannot delete teams/units
  - ❌ Cannot edit team/unit details
  - ❌ Cannot access other units

**Use Case**: Team Leader, Squad Lead, Project Manager

## UI Components

### Capabilities Banner
A colored banner displayed at the top of the Admin panel that clearly communicates the user's permissions:

- **Admin**: "You have full administrative access to all teams and users."
- **Team Lead**: "You can manage teams and users in the [Department Name] department."
- **Unit Lead**: "You can manage [N] unit(s)."

### Role Badge
Displayed next to the user's name in the header with color-coded visual identification:
- Admin: Red badge
- Team Lead: Purple badge  
- Unit Lead: Blue badge

### Conditional UI Elements
- "New Department" / "New Unit" buttons only appear if user has `canCreateTeams` capability
- Edit/Delete buttons on team cards respect permissions
- User assignment interface filtered based on role

## Database Schema

### Required Fields

#### `users` table
```sql
user_role VARCHAR CHECK (user_role IN ('admin', 'team_lead', 'unit_lead', 'developer', 'sales'))
```

#### `team_members` table
```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL CHECK (role IN ('member', 'unit_lead', 'team_lead')),
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);
```

**Note**: The `role` field in `team_members` table tracks leadership assignments:
- `'member'`: Regular team member
- `'unit_lead'`: User is a lead of this specific unit
- `'team_lead'`: User is a lead of teams in this unit's department

### Setting Up Leadership

To assign someone as a Unit Lead:
```sql
-- Add user to team_members with unit_lead role
INSERT INTO team_members (user_id, team_id, role)
VALUES ('user-uuid', 'team-uuid', 'unit_lead');

-- Also update their user_role if not already set
UPDATE users 
SET user_role = 'unit_lead'
WHERE id = 'user-uuid';
```

To assign someone as a Team Lead:
```sql
-- Add user to one of their department's teams with team_lead role
INSERT INTO team_members (user_id, team_id, role)
VALUES ('user-uuid', 'team-in-department-uuid', 'team_lead');

-- Update their user_role
UPDATE users 
SET user_role = 'team_lead'
WHERE id = 'user-uuid';
```

## Backend Implementation

### Permission Helpers

#### `isAdmin()`
Returns `true` if current user has `user_role = 'admin'`

#### `isTeamLead()`
Returns `true` if current user has `user_role` of `'team_lead'` or `'admin'`

#### `isUnitLead()`
Returns `true` if current user has `user_role` of `'unit_lead'`, `'team_lead'`, or `'admin'`

#### `getManagedTeams()`
Returns array of teams the user can manage:
- **Admin**: All teams
- **Team Lead**: Teams in their department
- **Unit Lead**: Only their assigned units

#### `canManageTeam(teamId)`
Checks if the current user has permission to manage a specific team

#### `getUserDepartment()`
Returns the department name for Team Leads (first team they're assigned to)

### IPC Handlers with RBAC

All handlers check permissions before executing operations:

```javascript
// Example: admin:addUserToTeam
ipcMain.handle('admin:addUserToTeam', async (event, targetUserId, teamId) => {
  // 1. Check user has at least unit_lead role
  if (!isUnitLead()) {
    return { success: false, error: 'Permission denied' };
  }
  
  // 2. Check user can manage this specific team
  const canManage = await canManageTeam(teamId);
  if (!canManage) {
    return { success: false, error: 'You cannot manage this team' };
  }
  
  // 3. Proceed with operation
  // ...
});
```

### New IPC Handler: `admin:getCapabilities`

Returns capability information for the current user:

```javascript
{
  role: 'team_lead',
  canCreateTeams: true,
  canDeleteTeams: true,
  canManageUsers: true,
  canSeeAllUsers: false,
  canSeeAllTeams: false,
  managedTeamsCount: 5,
  department: 'Engineering',
  isAdmin: false,
  isTeamLead: true,
  isUnitLead: false
}
```

## Frontend Implementation

### Capabilities State

The Admin panel loads capabilities on mount:

```javascript
const [capabilities, setCapabilities] = useState(null);

useEffect(() => {
  loadCapabilities();
}, []);

const loadCapabilities = async () => {
  const result = await window.electronAPI.admin.getCapabilities();
  if (result.success) {
    setCapabilities(result.capabilities);
  }
};
```

### Conditional Rendering

```jsx
{/* Only show create button if user can create teams */}
{capabilities?.canCreateTeams && (
  <button onClick={handleCreateTeam}>
    New {capabilities.isAdmin ? 'Department' : 'Unit'}
  </button>
)}
```

### Role-Based Filtering

Teams and users are automatically filtered by the backend based on role:
- `getAllTeams()` returns only manageable teams
- `getAllUsers()` returns only users in manageable teams

## Access Control Flow

### Creating a New Unit

1. **User clicks "New Unit"**
   - Button only visible if `capabilities.canCreateTeams === true`
   
2. **Backend receives request**
   - Check `isTeamLead()` - must be Team Lead or Admin
   - If Team Lead: verify department matches user's department
   - If Unit Lead: reject (cannot create units)
   
3. **Unit is created**
   - Logged with user ID and role
   - Audit trail maintained

### Assigning a User to a Team

1. **User clicks "Manage Teams" on a user card**
   - Button only visible if `capabilities.canManageUsers === true`
   
2. **Modal shows teams**
   - Only teams the manager can control
   - Admin: All teams
   - Team Lead: Teams in their department
   - Unit Lead: Only their units
   
3. **User toggles checkbox**
   - Backend calls `canManageTeam(teamId)`
   - If false: Operation rejected with error
   - If true: Membership added/removed

### Deleting a Team

1. **User clicks "Delete" button**
   - Button only visible if `capabilities.canDeleteTeams === true`
   
2. **Backend receives request**
   - Check `isTeamLead()` - must be Team Lead or Admin
   - Check `canManageTeam(teamId)` - must manage this specific team
   
3. **Team is deleted**
   - All members removed automatically (CASCADE)
   - Logged with manager ID and role

## Security Considerations

### ✅ Implemented

1. **Server-Side Validation**: All permissions checked on backend, not just frontend
2. **Role Verification**: Every IPC call validates user role
3. **Team-Specific Checks**: `canManageTeam()` ensures granular control
4. **Audit Logging**: All operations logged with user ID and role
5. **Database Constraints**: Foreign keys and CASCADE ensure data integrity

### 🔒 Best Practices

1. **Never trust client-side checks**: UI hiding is UX, not security
2. **Log everything**: Audit trail for all management operations
3. **Fail closed**: Default to deny if permissions unclear
4. **Clear error messages**: Help users understand why they can't perform an action

## Migration Guide

### From Single-Admin to RBAC

1. **Identify Team Leads**
   ```sql
   -- Update existing managers to team_lead role
   UPDATE users 
   SET user_role = 'team_lead'
   WHERE id IN ('uuid1', 'uuid2', ...);
   ```

2. **Assign Team Leads to Departments**
   ```sql
   -- Add team_lead role entries to team_members
   INSERT INTO team_members (user_id, team_id, role)
   SELECT 'team-lead-uuid', t.id, 'team_lead'
   FROM teams t
   WHERE t.department = 'Engineering';
   ```

3. **Identify Unit Leads**
   ```sql
   -- Update squad leads to unit_lead role
   UPDATE users 
   SET user_role = 'unit_lead'
   WHERE id IN ('uuid1', 'uuid2', ...);
   ```

4. **Assign Unit Leads to Units**
   ```sql
   -- Add unit_lead role entries
   INSERT INTO team_members (user_id, team_id, role)
   VALUES 
   ('unit-lead-1-uuid', 'unit-1-uuid', 'unit_lead'),
   ('unit-lead-2-uuid', 'unit-2-uuid', 'unit_lead');
   ```

## Testing Checklist

### Admin Role
- [ ] Can see all teams
- [ ] Can see all users
- [ ] Can create departments
- [ ] Can create units in any department
- [ ] Can edit any team
- [ ] Can delete any team
- [ ] Can assign users to any team
- [ ] Can remove users from any team
- [ ] Sees "You have full administrative access" banner

### Team Lead Role
- [ ] Can see only their department teams
- [ ] Can see only users in their department
- [ ] Can create units in their department
- [ ] Cannot create units in other departments
- [ ] Can edit teams in their department
- [ ] Can delete teams in their department
- [ ] Can assign users to teams in their department
- [ ] Cannot manage other departments
- [ ] Sees department-specific banner

### Unit Lead Role
- [ ] Can see only their units
- [ ] Can see only users in their units
- [ ] Cannot create new units
- [ ] Cannot edit unit details
- [ ] Cannot delete units
- [ ] Can assign users to their units
- [ ] Can remove users from their units
- [ ] Cannot manage other units
- [ ] Sees unit-specific banner with count

### UI Consistency
- [ ] Role badge shows correct color
- [ ] Capabilities banner shows correct message
- [ ] Create buttons only visible when allowed
- [ ] Edit/Delete buttons respect permissions
- [ ] Error messages are clear and helpful
- [ ] Management button in header shows for all roles

## Troubleshooting

### "Permission denied" errors

**Problem**: User gets "Permission denied" when trying to manage a team

**Solutions**:
1. Check user's `user_role` in database
2. Verify user has entry in `team_members` with appropriate role
3. Check if team is in user's department (for team_lead)
4. Verify database relationships are set up correctly

### Teams not showing up

**Problem**: Team Lead or Unit Lead sees no teams

**Solutions**:
1. Check user has entries in `team_members` table
2. Verify `role` field in `team_members` is 'unit_lead' or 'team_lead'
3. Check that teams have correct `department` field
4. Ensure foreign key relationships are valid

### Cannot assign users

**Problem**: Cannot add users to teams even with correct role

**Solutions**:
1. Verify `team_members` table exists and has correct schema
2. Check for UNIQUE constraint on (user_id, team_id)
3. Ensure `canManageTeam()` returns true for the specific team
4. Check console for detailed error messages

## Future Enhancements

### Suggested Additions

1. **Role Change UI**: Allow admins to promote/demote users
2. **Delegation**: Team Leads can designate Unit Leads
3. **Permission Templates**: Pre-defined permission sets
4. **Time-Limited Access**: Temporary leadership assignments
5. **Approval Workflows**: Require admin approval for certain actions
6. **Activity History**: View all management actions
7. **Bulk Operations**: Assign multiple users at once
8. **Cross-Department Visibility**: Read-only access to other departments

---

**Last Updated**: October 26, 2025  
**Version**: 1.0  
**Status**: Production Ready


