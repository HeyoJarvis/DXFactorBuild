/**
 * Workflow Alert Card - Rich interactive Slack blocks for workflow alerts
 * 
 * Features:
 * 1. Context-rich workflow alert presentation
 * 2. Interactive action buttons
 * 3. Priority-based styling
 * 4. Detailed metrics and insights
 * 5. ROI and recommendation displays
 */

class WorkflowAlertCard {
  constructor() {
    this.alertEmojis = {
      'deal_stagnation': '🚨',
      'bottleneck_detected': '⚠️',
      'conversion_drop': '📉',
      'high_value_at_risk': '💰',
      'success_pattern_detected': '🎯',
      'rep_performance_anomaly': '👤',
      'roi_opportunity': '🚀',
      'workflow_optimization': '⚡'
    };
    
    this.urgencyColors = {
      'critical': '#FF0000',
      'high': '#FF8C00',
      'medium': '#1E90FF',
      'low': '#32CD32'
    };
  }
  
  /**
   * Create workflow alert blocks based on alert type
   */
  createWorkflowAlertBlocks(alertType, alertData, alertConfig) {
    const blocks = [];
    
    // Header with alert type and urgency
    blocks.push(this.createAlertHeader(alertType, alertData, alertConfig));
    
    // Main content based on alert type
    switch(alertType) {
      case 'deal_stagnation':
        blocks.push(...this.createDealStagnationBlocks(alertData));
        break;
      case 'bottleneck_detected':
        blocks.push(...this.createBottleneckBlocks(alertData));
        break;
      case 'conversion_drop':
        blocks.push(...this.createConversionDropBlocks(alertData));
        break;
      case 'high_value_at_risk':
        blocks.push(...this.createHighValueRiskBlocks(alertData));
        break;
      case 'success_pattern_detected':
        blocks.push(...this.createSuccessPatternBlocks(alertData));
        break;
      case 'rep_performance_anomaly':
        blocks.push(...this.createPerformanceAnomalyBlocks(alertData));
        break;
      case 'roi_opportunity':
        blocks.push(...this.createROIOpportunityBlocks(alertData));
        break;
      case 'workflow_optimization':
        blocks.push(...this.createOptimizationBlocks(alertData));
        break;
      default:
        blocks.push(this.createGenericAlertBlock(alertData));
    }
    
    // Action buttons (contextual to alert type)
    blocks.push(this.createActionButtons(alertType, alertData));
    
    // Context and metadata
    blocks.push(this.createContextBlock(alertData));
    
    return blocks;
  }
  
  /**
   * Create alert header block
   */
  createAlertHeader(alertType, alertData, alertConfig) {
    const emoji = this.alertEmojis[alertType] || '📢';
    const urgencyIndicator = alertConfig.urgency === 'critical' ? ' 🔴' : 
                            alertConfig.urgency === 'high' ? ' 🟠' : '';
    
    return {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": `${emoji} ${alertData.title || 'Workflow Alert'}${urgencyIndicator}`
      }
    };
  }
  
  /**
   * Deal stagnation alert blocks
   */
  createDealStagnationBlocks(alertData) {
    return [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Deal:* ${alertData.deal_name} (${alertData.deal_value ? '$' + alertData.deal_value.toLocaleString() : 'Unknown value'})\n*Rep:* ${alertData.rep_name}\n*Current Stage:* ${alertData.current_stage}\n*Stagnant For:* ${alertData.days_stagnant} days (avg: ${alertData.stage_average} days)`
        },
        "accessory": {
          "type": "image",
          "image_url": `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(alertData.rep_name || 'Unknown')}`,
          "alt_text": alertData.rep_name || 'Sales Rep'
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": `*Risk Level:* ${alertData.risk_level || 'Medium'}`
          },
          {
            "type": "mrkdwn",
            "text": `*Close Probability:* ${alertData.close_probability || 'Unknown'}%`
          },
          {
            "type": "mrkdwn",
            "text": `*Last Activity:* ${alertData.last_activity_date || 'Unknown'}`
          },
          {
            "type": "mrkdwn",
            "text": `*Next Step:* ${alertData.next_step || 'Not defined'}`
          }
        ]
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*🤖 AI Recommendations:*\n${(alertData.ai_recommendations || ['Schedule immediate check-in', 'Review deal requirements', 'Engage additional stakeholders']).map(rec => `• ${rec}`).join('\n')}`
        }
      }
    ];
  }
  
  /**
   * Bottleneck detection alert blocks
   */
  createBottleneckBlocks(alertData) {
    return [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Bottleneck Location:* ${alertData.bottleneck_location}\n*Issue:* ${alertData.issue_description}\n*Impact:* ${alertData.impact_description}\n*Affected Deals:* ${alertData.affected_deals_count || 0} deals`
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": `*Severity:* ${alertData.severity || 'Medium'}`
          },
          {
            "type": "mrkdwn",
            "text": `*Revenue at Risk:* $${(alertData.revenue_at_risk || 0).toLocaleString()}`
          },
          {
            "type": "mrkdwn",
            "text": `*Avg Delay:* ${alertData.avg_delay_days || 0} days`
          },
          {
            "type": "mrkdwn",
            "text": `*Pattern Frequency:* ${alertData.pattern_frequency || 'Unknown'}`
          }
        ]
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*🔧 Suggested Solutions:*\n${(alertData.suggested_solutions || ['Process optimization needed', 'Resource allocation review', 'Tool automation opportunity']).map(solution => `• ${solution}`).join('\n')}`
        }
      }
    ];
  }
  
  /**
   * ROI opportunity alert blocks
   */
  createROIOpportunityBlocks(alertData) {
    return [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Tool Recommendation:* ${alertData.recommended_tool}\n*Addresses:* ${alertData.bottleneck_addressed}\n*Potential ROI:* ${alertData.roi_percentage}% (${alertData.payback_months} month payback)`
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": `*Annual Revenue Impact:* $${(alertData.revenue_impact || 0).toLocaleString()}`
          },
          {
            "type": "mrkdwn",
            "text": `*Implementation Cost:* $${(alertData.implementation_cost || 0).toLocaleString()}`
          },
          {
            "type": "mrkdwn",
            "text": `*Time Savings:* ${alertData.time_savings_hours || 0}h/week per rep`
          },
          {
            "type": "mrkdwn",
            "text": `*Confidence:* ${alertData.confidence_score || 0}%`
          }
        ]
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Key Benefits:*\n${(alertData.key_benefits || ['Increased efficiency', 'Better conversion rates', 'Reduced manual work']).map(benefit => `• ${benefit}`).join('\n')}`
        }
      }
    ];
  }
  
  /**
   * Success pattern detection blocks
   */
  createSuccessPatternBlocks(alertData) {
    return [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Pattern Identified:* ${alertData.pattern_name}\n*Success Rate:* ${Math.round((alertData.success_rate || 0) * 100)}%\n*Sample Size:* ${alertData.sample_size || 0} workflows\n*Top Performer:* ${alertData.top_performer || 'Unknown'}`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*🎯 Success Factors:*\n${(alertData.success_factors || ['Fast response times', 'Multi-stakeholder engagement', 'Structured follow-up']).map(factor => `• ${factor}`).join('\n')}`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*📈 Scaling Opportunity:*\nIf replicated across team: ${alertData.scaling_impact || 'Significant improvement expected'}`
        }
      }
    ];
  }
  
  /**
   * Performance anomaly blocks
   */
  createPerformanceAnomalyBlocks(alertData) {
    return [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Rep:* ${alertData.rep_name}\n*Anomaly Type:* ${alertData.anomaly_type}\n*Current Performance:* ${alertData.current_metric}\n*Expected Performance:* ${alertData.expected_metric}`
        },
        "accessory": {
          "type": "image",
          "image_url": `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(alertData.rep_name || 'Rep')}`,
          "alt_text": alertData.rep_name || 'Sales Rep'
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": `*Deviation:* ${alertData.deviation_percentage || 0}%`
          },
          {
            "type": "mrkdwn",
            "text": `*Time Period:* ${alertData.time_period || 'Last 30 days'}`
          },
          {
            "type": "mrkdwn",
            "text": `*Trend:* ${alertData.trend || 'Unknown'}`
          },
          {
            "type": "mrkdwn",
            "text": `*Impact:* ${alertData.impact_level || 'Medium'}`
          }
        ]
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*💡 Recommended Actions:*\n${(alertData.recommended_actions || ['Schedule 1:1 meeting', 'Review recent activities', 'Provide additional coaching']).map(action => `• ${action}`).join('\n')}`
        }
      }
    ];
  }
  
  /**
   * Conversion drop blocks
   */
  createConversionDropBlocks(alertData) {
    return [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Stage Affected:* ${alertData.stage_name}\n*Current Conversion:* ${Math.round((alertData.current_conversion || 0) * 100)}%\n*Historical Average:* ${Math.round((alertData.historical_conversion || 0) * 100)}%\n*Drop Percentage:* ${Math.round((alertData.drop_percentage || 0) * 100)}%`
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": `*Time Period:* ${alertData.time_period || 'Last 30 days'}`
          },
          {
            "type": "mrkdwn",
            "text": `*Deals Affected:* ${alertData.deals_affected || 0}`
          },
          {
            "type": "mrkdwn",
            "text": `*Revenue Impact:* $${(alertData.revenue_impact || 0).toLocaleString()}`
          },
          {
            "type": "mrkdwn",
            "text": `*Confidence:* ${alertData.confidence || 0}%`
          }
        ]
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*🔍 Potential Causes:*\n${(alertData.potential_causes || ['Market conditions', 'Process changes', 'Resource constraints']).map(cause => `• ${cause}`).join('\n')}`
        }
      }
    ];
  }
  
  /**
   * High value at risk blocks
   */
  createHighValueRiskBlocks(alertData) {
    return [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Deal:* ${alertData.deal_name}\n*Value:* $${(alertData.deal_value || 0).toLocaleString()}\n*Risk Score:* ${alertData.risk_score || 0}/10\n*Days to Close:* ${alertData.days_to_close || 'Unknown'}`
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": `*Rep:* ${alertData.rep_name || 'Unknown'}`
          },
          {
            "type": "mrkdwn",
            "text": `*Stage:* ${alertData.current_stage || 'Unknown'}`
          },
          {
            "type": "mrkdwn",
            "text": `*Last Contact:* ${alertData.last_contact || 'Unknown'}`
          },
          {
            "type": "mrkdwn",
            "text": `*Competitor:* ${alertData.competitor || 'Unknown'}`
          }
        ]
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*⚠️ Risk Factors:*\n${(alertData.risk_factors || ['Long silence period', 'Competitor activity', 'Budget concerns']).map(factor => `• ${factor}`).join('\n')}`
        }
      }
    ];
  }
  
  /**
   * Workflow optimization blocks
   */
  createOptimizationBlocks(alertData) {
    return [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*Optimization Opportunity:* ${alertData.optimization_title}\n*Current Performance:* ${alertData.current_performance}\n*Potential Improvement:* ${alertData.potential_improvement}\n*Implementation Effort:* ${alertData.implementation_effort || 'Medium'}`
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": `*ROI Estimate:* ${alertData.roi_estimate || 'TBD'}%`
          },
          {
            "type": "mrkdwn",
            "text": `*Time to Value:* ${alertData.time_to_value || 'Unknown'}`
          },
          {
            "type": "mrkdwn",
            "text": `*Affected Workflows:* ${alertData.affected_workflows || 0}`
          },
          {
            "type": "mrkdwn",
            "text": `*Priority:* ${alertData.priority || 'Medium'}`
          }
        ]
      }
    ];
  }
  
  /**
   * Generic alert block for unknown types
   */
  createGenericAlertBlock(alertData) {
    return {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Alert:* ${alertData.title || 'Workflow Alert'}\n*Description:* ${alertData.description || 'No description available'}\n*Severity:* ${alertData.severity || 'Medium'}`
      }
    };
  }
  
  /**
   * Create action buttons based on alert type
   */
  createActionButtons(alertType, alertData) {
    const baseActions = {
      "type": "actions",
      "elements": []
    };
    
    switch(alertType) {
      case 'deal_stagnation':
        baseActions.elements = [
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "📅 Schedule Check-in"},
            "action_id": "schedule_checkin",
            "value": JSON.stringify({deal_id: alertData.deal_id, type: 'checkin'}),
            "style": "primary"
          },
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "📞 Call Rep"},
            "action_id": "call_rep",
            "value": JSON.stringify({rep_id: alertData.rep_id, deal_id: alertData.deal_id})
          },
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "📊 View Analysis"},
            "action_id": "view_deal_analysis",
            "value": JSON.stringify({deal_id: alertData.deal_id})
          }
        ];
        break;
        
      case 'roi_opportunity':
        baseActions.elements = [
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "📋 Implementation Plan"},
            "action_id": "get_implementation_plan",
            "value": JSON.stringify({tool: alertData.recommended_tool, bottleneck: alertData.bottleneck_id}),
            "style": "primary"
          },
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "💰 ROI Details"},
            "action_id": "view_roi_details",
            "value": JSON.stringify({recommendation_id: alertData.recommendation_id})
          },
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "✅ Approve"},
            "action_id": "approve_implementation",
            "value": JSON.stringify({recommendation_id: alertData.recommendation_id}),
            "style": "primary"
          }
        ];
        break;
        
      case 'bottleneck_detected':
        baseActions.elements = [
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "🔧 View Solutions"},
            "action_id": "view_bottleneck_solutions",
            "value": JSON.stringify({bottleneck_id: alertData.bottleneck_id}),
            "style": "primary"
          },
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "📈 Impact Analysis"},
            "action_id": "view_impact_analysis",
            "value": JSON.stringify({bottleneck_id: alertData.bottleneck_id})
          }
        ];
        break;
        
      default:
        baseActions.elements = [
          {
            "type": "button",
            "text": {"type": "plain_text", "text": "📊 View Details"},
            "action_id": "view_alert_details",
            "value": JSON.stringify({alert_id: alertData.alert_id || alertData.id})
          }
        ];
    }
    
    // Add common actions
    baseActions.elements.push({
      "type": "button",
      "text": {"type": "plain_text", "text": "✅ Mark Handled"},
      "action_id": "mark_handled",
      "value": JSON.stringify({alert_id: alertData.alert_id || alertData.id})
    });
    
    return baseActions;
  }
  
  /**
   * Create context block with metadata
   */
  createContextBlock(alertData) {
    const contextElements = [];
    
    // Add confidence score if available
    if (alertData.confidence_score) {
      contextElements.push({
        "type": "mrkdwn",
        "text": `📊 Confidence: ${alertData.confidence_score}%`
      });
    }
    
    // Add analysis timestamp
    contextElements.push({
      "type": "mrkdwn",
      "text": `🕒 ${new Date(alertData.analyzed_at || Date.now()).toLocaleString()}`
    });
    
    // Add organization context if available
    if (alertData.organization_name) {
      contextElements.push({
        "type": "mrkdwn",
        "text": `🏢 ${alertData.organization_name}`
      });
    }
    
    return {
      "type": "context",
      "elements": contextElements
    };
  }
}

module.exports = WorkflowAlertCard;
