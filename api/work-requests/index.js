/**
 * Work Requests API
 * 
 * Handles work request management and notifications
 */

const WorkRequestAlertSystem = require('../notifications/work-request-alerts');
const { authenticate } = require('../middleware/auth');

let workRequestAlerts = null;

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Initialize work request alerts system
    if (!workRequestAlerts) {
      workRequestAlerts = new WorkRequestAlertSystem();
    }

    // Authentication middleware
    const authResult = await authenticate(req, res);
    if (!authResult.success) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: authResult.message 
      });
    }

    const { method } = req;
    const { action, id } = req.query;

    switch (method) {
      case 'GET':
        return await handleGetRequest(req, res, workRequestAlerts, action, id);
      
      case 'POST':
        return await handlePostRequest(req, res, workRequestAlerts, action);
      
      case 'PUT':
        return await handlePutRequest(req, res, workRequestAlerts, id);
      
      case 'DELETE':
        return await handleDeleteRequest(req, res, workRequestAlerts, id);
      
      default:
        return res.status(405).json({ 
          error: 'Method not allowed',
          allowed_methods: ['GET', 'POST', 'PUT', 'DELETE']
        });
    }

  } catch (error) {
    console.error('Work requests API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Handle GET requests
 */
async function handleGetRequest(req, res, workRequestAlerts, action, id) {
  switch (action) {
    case 'active':
      const activeRequests = await workRequestAlerts.getActiveWorkRequests();
      return res.json({
        work_requests: activeRequests,
        count: activeRequests.length,
        status: 'success'
      });

    case 'health':
      const healthStatus = await workRequestAlerts.healthCheck();
      return res.json({
        health: healthStatus,
        status: 'success'
      });

    case 'alerts':
      // Get chat alerts from Supabase
      try {
        const { data: alerts, error } = await workRequestAlerts.supabase
          .from('chat_alerts')
          .select('*')
          .eq('status', 'unread')
          .order('created_at', { ascending: false });

        if (error) throw error;

        return res.json({
          alerts: alerts || [],
          count: (alerts || []).length,
          status: 'success'
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Failed to fetch alerts',
          message: error.message
        });
      }

    case 'notifications':
      // Get desktop notifications
      try {
        const { data: notifications, error } = await workRequestAlerts.supabase
          .from('notifications')
          .select('*')
          .eq('status', 'unread')
          .order('timestamp', { ascending: false });

        if (error) throw error;

        return res.json({
          notifications: notifications || [],
          count: (notifications || []).length,
          status: 'success'
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Failed to fetch notifications',
          message: error.message
        });
      }

    case 'details':
      if (!id) {
        return res.status(400).json({ 
          error: 'Work request ID required',
          message: 'Please provide a work request ID'
        });
      }

      try {
        const { data: workRequest, error } = await workRequestAlerts.supabase
          .from('work_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        return res.json({
          work_request: workRequest,
          status: 'success'
        });
      } catch (error) {
        return res.status(404).json({
          error: 'Work request not found',
          message: error.message
        });
      }

    default:
      return res.json({
        status: 'work_requests_api_ready',
        available_actions: ['active', 'health', 'alerts', 'notifications', 'details'],
        endpoints: {
          'GET /api/work-requests?action=active': 'Get active work requests',
          'GET /api/work-requests?action=alerts': 'Get unread chat alerts',
          'GET /api/work-requests?action=notifications': 'Get unread notifications',
          'GET /api/work-requests?action=details&id={id}': 'Get work request details',
          'POST /api/work-requests?action=complete': 'Mark work request as complete',
          'POST /api/work-requests?action=dismiss': 'Dismiss work request',
          'PUT /api/work-requests?id={id}': 'Update work request'
        }
      });
  }
}

/**
 * Handle POST requests
 */
async function handlePostRequest(req, res, workRequestAlerts, action) {
  const { workRequestId, response, alertId } = req.body;

  switch (action) {
    case 'complete':
      if (!workRequestId) {
        return res.status(400).json({ 
          error: 'Work request ID required' 
        });
      }

      try {
        await workRequestAlerts.markWorkRequestComplete(workRequestId, response);
        return res.json({
          message: 'Work request marked as complete',
          work_request_id: workRequestId,
          status: 'success'
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Failed to complete work request',
          message: error.message
        });
      }

    case 'dismiss':
      if (!workRequestId && !alertId) {
        return res.status(400).json({ 
          error: 'Work request ID or alert ID required' 
        });
      }

      try {
        if (workRequestId) {
          await workRequestAlerts.supabase
            .from('work_requests')
            .update({ status: 'dismissed' })
            .eq('id', workRequestId);
        }

        if (alertId) {
          await workRequestAlerts.supabase
            .from('chat_alerts')
            .update({ status: 'dismissed' })
            .eq('id', alertId);
        }

        return res.json({
          message: 'Item dismissed successfully',
          status: 'success'
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Failed to dismiss item',
          message: error.message
        });
      }

    case 'mark-read':
      if (!alertId) {
        return res.status(400).json({ 
          error: 'Alert ID required' 
        });
      }

      try {
        await workRequestAlerts.supabase
          .from('chat_alerts')
          .update({ status: 'read' })
          .eq('id', alertId);

        return res.json({
          message: 'Alert marked as read',
          alert_id: alertId,
          status: 'success'
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Failed to mark alert as read',
          message: error.message
        });
      }

    default:
      return res.status(400).json({
        error: 'Invalid action',
        available_actions: ['complete', 'dismiss', 'mark-read']
      });
  }
}

/**
 * Handle PUT requests
 */
async function handlePutRequest(req, res, workRequestAlerts, id) {
  if (!id) {
    return res.status(400).json({ 
      error: 'Work request ID required' 
    });
  }

  const updates = req.body;
  
  try {
    const { data, error } = await workRequestAlerts.supabase
      .from('work_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      message: 'Work request updated successfully',
      work_request: data,
      status: 'success'
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to update work request',
      message: error.message
    });
  }
}

/**
 * Handle DELETE requests
 */
async function handleDeleteRequest(req, res, workRequestAlerts, id) {
  if (!id) {
    return res.status(400).json({ 
      error: 'Work request ID required' 
    });
  }

  try {
    const { error } = await workRequestAlerts.supabase
      .from('work_requests')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Remove from memory
    workRequestAlerts.activeWorkRequests.delete(id);

    return res.json({
      message: 'Work request deleted successfully',
      work_request_id: id,
      status: 'success'
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to delete work request',
      message: error.message
    });
  }
}
