/**
 * Webhook Routes for Microsoft Graph Notifications
 * 
 * Handles incoming notifications from Microsoft Graph for:
 * - Meeting transcripts
 * - Meeting recordings
 */

const express = require('express');
const router = express.Router();

/**
 * Initialize webhook routes
 * @param {Object} webhookService - MicrosoftGraphWebhookService instance
 */
function initializeWebhookRoutes(webhookService) {
  /**
   * POST /webhooks/microsoft-graph
   * Receives notifications from Microsoft Graph
   */
  router.post('/microsoft-graph', async (req, res) => {
    try {
      // Microsoft sends validation request on subscription creation
      // Handle this FIRST before trying to read body
      if (req.query.validationToken) {
        const validationToken = webhookService.validateSubscription(
          req.query.validationToken
        );
        return res.status(200).send(validationToken);
      }

      // Process notifications
      const notifications = req.body?.value;
      if (notifications && Array.isArray(notifications)) {
        for (const notification of notifications) {
          // Handle each notification asynchronously
          webhookService.handleNotification(notification).catch(() => {
            // Errors are logged by the webhook service
          });
        }
      }

      // Acknowledge receipt immediately (Microsoft requires 202 within 3 seconds)
      res.status(202).send();

    } catch (error) {
      // Log errors but don't crash
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /webhooks/microsoft-graph/status
   * Check webhook service status
   */
  router.get('/microsoft-graph/status', (req, res) => {
    const subscriptions = webhookService.getActiveSubscriptions();
    res.json({
      status: 'active',
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        type: sub.type,
        resource: sub.resource,
        expiresAt: sub.expirationDateTime
      }))
    });
  });

  return router;
}

module.exports = { initializeWebhookRoutes };

