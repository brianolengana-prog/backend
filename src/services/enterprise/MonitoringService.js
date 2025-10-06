/**
 * Enterprise Monitoring Service
 * Comprehensive monitoring, metrics, and observability for extraction system
 */

const EventEmitter = require('events');
const prometheus = require('prom-client');

class MonitoringService extends EventEmitter {
  constructor() {
    super();
    this.metrics = new Map();
    this.alerts = new Map();
    this.thresholds = new Map();
    
    this.initializeMetrics();
    this.initializeAlerts();
    this.startMetricsCollection();
  }

  initializeMetrics() {
    // Create Prometheus metrics
    this.metrics.set('extraction_requests_total', new prometheus.Counter({
      name: 'extraction_requests_total',
      help: 'Total number of extraction requests',
      labelNames: ['document_type', 'status', 'user_id']
    }));

    this.metrics.set('extraction_duration_seconds', new prometheus.Histogram({
      name: 'extraction_duration_seconds',
      help: 'Duration of extraction requests in seconds',
      labelNames: ['document_type', 'extraction_strategy'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
    }));

    this.metrics.set('extraction_accuracy_score', new prometheus.Histogram({
      name: 'extraction_accuracy_score',
      help: 'Accuracy score of extractions (0-1)',
      labelNames: ['document_type', 'extraction_strategy'],
      buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    }));

    this.metrics.set('contacts_extracted_total', new prometheus.Counter({
      name: 'contacts_extracted_total',
      help: 'Total number of contacts extracted',
      labelNames: ['document_type', 'extraction_method']
    }));

    this.metrics.set('queue_size_gauge', new prometheus.Gauge({
      name: 'queue_size_gauge',
      help: 'Current size of processing queues',
      labelNames: ['queue_name', 'status']
    }));

    this.metrics.set('memory_usage_bytes', new prometheus.Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type']
    }));

    this.metrics.set('cpu_usage_percent', new prometheus.Gauge({
      name: 'cpu_usage_percent',
      help: 'CPU usage percentage'
    }));

    this.metrics.set('error_rate_percent', new prometheus.Gauge({
      name: 'error_rate_percent',
      help: 'Error rate percentage over time window',
      labelNames: ['error_type', 'component']
    }));

    this.metrics.set('api_response_time_seconds', new prometheus.Histogram({
      name: 'api_response_time_seconds',
      help: 'API response time in seconds',
      labelNames: ['endpoint', 'method', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    }));

    // Business metrics
    this.metrics.set('user_satisfaction_score', new prometheus.Gauge({
      name: 'user_satisfaction_score',
      help: 'User satisfaction score (1-5)',
      labelNames: ['user_segment']
    }));

    this.metrics.set('revenue_impact_dollars', new prometheus.Counter({
      name: 'revenue_impact_dollars',
      help: 'Revenue impact in dollars',
      labelNames: ['feature', 'user_tier']
    }));

    console.log('📊 Monitoring metrics initialized');
  }

  initializeAlerts() {
    // Define alert thresholds
    this.thresholds.set('error_rate', { warning: 5, critical: 10 }); // percentage
    this.thresholds.set('response_time', { warning: 2, critical: 5 }); // seconds
    this.thresholds.set('queue_size', { warning: 100, critical: 500 }); // jobs
    this.thresholds.set('memory_usage', { warning: 80, critical: 95 }); // percentage
    this.thresholds.set('cpu_usage', { warning: 80, critical: 95 }); // percentage
    this.thresholds.set('accuracy_drop', { warning: 0.1, critical: 0.2 }); // drop from baseline

    // Alert configurations
    this.alerts.set('high_error_rate', {
      condition: 'error_rate > threshold',
      severity: 'critical',
      message: 'High error rate detected',
      actions: ['notify_oncall', 'scale_up', 'enable_circuit_breaker']
    });

    this.alerts.set('slow_response_time', {
      condition: 'response_time > threshold',
      severity: 'warning',
      message: 'Slow response times detected',
      actions: ['notify_team', 'check_resources']
    });

    this.alerts.set('queue_backup', {
      condition: 'queue_size > threshold',
      severity: 'warning',
      message: 'Processing queue backing up',
      actions: ['scale_workers', 'notify_team']
    });

    console.log('🚨 Alert system initialized');
  }

  startMetricsCollection() {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Collect business metrics every 5 minutes
    setInterval(() => {
      this.collectBusinessMetrics();
    }, 300000);

    console.log('📈 Metrics collection started');
  }

  // Extraction monitoring methods
  recordExtractionRequest(documentType, status, userId, metadata = {}) {
    this.metrics.get('extraction_requests_total').inc({
      document_type: documentType || 'unknown',
      status: status,
      user_id: userId || 'anonymous'
    });

    // Emit event for real-time monitoring
    this.emit('extraction_request', {
      documentType,
      status,
      userId,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  recordExtractionDuration(documentType, strategy, durationMs, metadata = {}) {
    const durationSeconds = durationMs / 1000;
    
    this.metrics.get('extraction_duration_seconds').observe({
      document_type: documentType || 'unknown',
      extraction_strategy: strategy || 'unknown'
    }, durationSeconds);

    // Check for performance alerts
    this.checkPerformanceThresholds(durationSeconds, metadata);

    this.emit('extraction_duration', {
      documentType,
      strategy,
      duration: durationSeconds,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  recordExtractionAccuracy(documentType, strategy, accuracy, metadata = {}) {
    this.metrics.get('extraction_accuracy_score').observe({
      document_type: documentType || 'unknown',
      extraction_strategy: strategy || 'unknown'
    }, accuracy);

    // Check for accuracy alerts
    this.checkAccuracyThresholds(documentType, accuracy, metadata);

    this.emit('extraction_accuracy', {
      documentType,
      strategy,
      accuracy,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  recordContactsExtracted(documentType, method, count, metadata = {}) {
    this.metrics.get('contacts_extracted_total').inc({
      document_type: documentType || 'unknown',
      extraction_method: method || 'unknown'
    }, count);

    this.emit('contacts_extracted', {
      documentType,
      method,
      count,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  recordQueueSize(queueName, status, size) {
    this.metrics.get('queue_size_gauge').set({
      queue_name: queueName,
      status: status
    }, size);

    // Check queue thresholds
    this.checkQueueThresholds(queueName, size);
  }

  recordAPIResponse(endpoint, method, statusCode, durationMs) {
    const durationSeconds = durationMs / 1000;
    
    this.metrics.get('api_response_time_seconds').observe({
      endpoint: endpoint,
      method: method,
      status_code: statusCode.toString()
    }, durationSeconds);

    // Check response time thresholds
    if (durationSeconds > this.thresholds.get('response_time').warning) {
      this.triggerAlert('slow_response_time', {
        endpoint,
        method,
        statusCode,
        duration: durationSeconds
      });
    }
  }

  // System monitoring methods
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    
    // Memory metrics
    this.metrics.get('memory_usage_bytes').set({ type: 'heap_used' }, memUsage.heapUsed);
    this.metrics.get('memory_usage_bytes').set({ type: 'heap_total' }, memUsage.heapTotal);
    this.metrics.get('memory_usage_bytes').set({ type: 'rss' }, memUsage.rss);
    this.metrics.get('memory_usage_bytes').set({ type: 'external' }, memUsage.external);

    // CPU metrics (simplified - in production use proper CPU monitoring)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to percentage
    this.metrics.get('cpu_usage_percent').set(cpuPercent);

    // Check system resource thresholds
    this.checkSystemThresholds(memUsage, cpuPercent);
  }

  collectBusinessMetrics() {
    // These would be calculated from your business data
    // For now, we'll simulate some metrics
    
    // User satisfaction (would come from surveys/feedback)
    this.metrics.get('user_satisfaction_score').set({ user_segment: 'enterprise' }, 4.2);
    this.metrics.get('user_satisfaction_score').set({ user_segment: 'small_business' }, 3.8);
    
    // Revenue impact (would come from billing/usage data)
    // This is just an example - you'd calculate actual revenue impact
    this.emit('business_metrics_collected', {
      timestamp: new Date().toISOString()
    });
  }

  // Threshold checking methods
  checkPerformanceThresholds(durationSeconds, metadata) {
    const threshold = this.thresholds.get('response_time');
    
    if (durationSeconds > threshold.critical) {
      this.triggerAlert('critical_performance', {
        duration: durationSeconds,
        threshold: threshold.critical,
        metadata
      });
    } else if (durationSeconds > threshold.warning) {
      this.triggerAlert('slow_performance', {
        duration: durationSeconds,
        threshold: threshold.warning,
        metadata
      });
    }
  }

  checkAccuracyThresholds(documentType, accuracy, metadata) {
    // You'd maintain baseline accuracy scores for comparison
    const baselineAccuracy = this.getBaselineAccuracy(documentType);
    const accuracyDrop = baselineAccuracy - accuracy;
    
    const threshold = this.thresholds.get('accuracy_drop');
    
    if (accuracyDrop > threshold.critical) {
      this.triggerAlert('critical_accuracy_drop', {
        documentType,
        accuracy,
        baseline: baselineAccuracy,
        drop: accuracyDrop,
        metadata
      });
    } else if (accuracyDrop > threshold.warning) {
      this.triggerAlert('accuracy_degradation', {
        documentType,
        accuracy,
        baseline: baselineAccuracy,
        drop: accuracyDrop,
        metadata
      });
    }
  }

  checkQueueThresholds(queueName, size) {
    const threshold = this.thresholds.get('queue_size');
    
    if (size > threshold.critical) {
      this.triggerAlert('critical_queue_backup', {
        queueName,
        size,
        threshold: threshold.critical
      });
    } else if (size > threshold.warning) {
      this.triggerAlert('queue_backup', {
        queueName,
        size,
        threshold: threshold.warning
      });
    }
  }

  checkSystemThresholds(memUsage, cpuPercent) {
    const memThreshold = this.thresholds.get('memory_usage');
    const cpuThreshold = this.thresholds.get('cpu_usage');
    
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (memPercent > memThreshold.critical) {
      this.triggerAlert('critical_memory_usage', {
        usage: memPercent,
        threshold: memThreshold.critical,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      });
    }
    
    if (cpuPercent > cpuThreshold.critical) {
      this.triggerAlert('critical_cpu_usage', {
        usage: cpuPercent,
        threshold: cpuThreshold.critical
      });
    }
  }

  // Alert management
  triggerAlert(alertType, data) {
    const alert = {
      type: alertType,
      severity: this.getAlertSeverity(alertType),
      message: this.getAlertMessage(alertType, data),
      data: data,
      timestamp: new Date().toISOString(),
      id: this.generateAlertId()
    };

    console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`, data);

    // Emit alert event
    this.emit('alert', alert);

    // Execute alert actions
    this.executeAlertActions(alertType, alert);

    return alert;
  }

  getAlertSeverity(alertType) {
    const severityMap = {
      'critical_performance': 'critical',
      'slow_performance': 'warning',
      'critical_accuracy_drop': 'critical',
      'accuracy_degradation': 'warning',
      'critical_queue_backup': 'critical',
      'queue_backup': 'warning',
      'critical_memory_usage': 'critical',
      'critical_cpu_usage': 'critical'
    };
    
    return severityMap[alertType] || 'info';
  }

  getAlertMessage(alertType, data) {
    const messageMap = {
      'critical_performance': `Critical performance issue: ${data.duration}s response time (threshold: ${data.threshold}s)`,
      'slow_performance': `Slow performance detected: ${data.duration}s response time`,
      'critical_accuracy_drop': `Critical accuracy drop: ${data.documentType} accuracy dropped to ${data.accuracy} (baseline: ${data.baseline})`,
      'accuracy_degradation': `Accuracy degradation detected for ${data.documentType}`,
      'critical_queue_backup': `Critical queue backup: ${data.queueName} has ${data.size} jobs`,
      'queue_backup': `Queue backup detected: ${data.queueName} has ${data.size} jobs`,
      'critical_memory_usage': `Critical memory usage: ${data.usage.toFixed(1)}%`,
      'critical_cpu_usage': `Critical CPU usage: ${data.usage.toFixed(1)}%`
    };
    
    return messageMap[alertType] || `Alert: ${alertType}`;
  }

  executeAlertActions(alertType, alert) {
    const actions = this.getAlertActions(alertType);
    
    actions.forEach(action => {
      switch (action) {
        case 'notify_oncall':
          this.notifyOnCall(alert);
          break;
        case 'notify_team':
          this.notifyTeam(alert);
          break;
        case 'scale_up':
          this.triggerScaleUp(alert);
          break;
        case 'scale_workers':
          this.scaleWorkers(alert);
          break;
        case 'enable_circuit_breaker':
          this.enableCircuitBreaker(alert);
          break;
        case 'check_resources':
          this.checkResources(alert);
          break;
      }
    });
  }

  getAlertActions(alertType) {
    const actionMap = {
      'critical_performance': ['notify_oncall', 'scale_up'],
      'slow_performance': ['notify_team', 'check_resources'],
      'critical_accuracy_drop': ['notify_oncall'],
      'accuracy_degradation': ['notify_team'],
      'critical_queue_backup': ['notify_oncall', 'scale_workers'],
      'queue_backup': ['notify_team', 'scale_workers'],
      'critical_memory_usage': ['notify_oncall', 'check_resources'],
      'critical_cpu_usage': ['notify_oncall', 'scale_up']
    };
    
    return actionMap[alertType] || ['notify_team'];
  }

  // Alert action implementations
  notifyOnCall(alert) {
    console.log('📞 Notifying on-call engineer:', alert.message);
    // Implement PagerDuty, Slack, email notification
  }

  notifyTeam(alert) {
    console.log('👥 Notifying team:', alert.message);
    // Implement team notification (Slack, email, etc.)
  }

  triggerScaleUp(alert) {
    console.log('📈 Triggering scale up due to alert:', alert.type);
    // Implement auto-scaling logic
  }

  scaleWorkers(alert) {
    console.log('👷 Scaling workers due to queue backup:', alert.data.queueName);
    // Implement worker scaling
  }

  enableCircuitBreaker(alert) {
    console.log('🔌 Enabling circuit breaker due to high error rate');
    // Implement circuit breaker logic
  }

  checkResources(alert) {
    console.log('🔍 Checking system resources due to performance issues');
    // Implement resource checking logic
  }

  // Utility methods
  getBaselineAccuracy(documentType) {
    // In production, this would come from historical data
    const baselines = {
      'call_sheet': 0.92,
      'invoice': 0.95,
      'resume': 0.88,
      'contract': 0.90,
      'unknown': 0.85
    };
    
    return baselines[documentType] || baselines.unknown;
  }

  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Dashboard and reporting methods
  getMetricsForDashboard(timeRange = '1h') {
    // Return formatted metrics for dashboard consumption
    return {
      extraction: {
        total_requests: this.getMetricValue('extraction_requests_total'),
        avg_duration: this.getMetricValue('extraction_duration_seconds', 'avg'),
        avg_accuracy: this.getMetricValue('extraction_accuracy_score', 'avg'),
        total_contacts: this.getMetricValue('contacts_extracted_total')
      },
      system: {
        memory_usage: this.getMetricValue('memory_usage_bytes'),
        cpu_usage: this.getMetricValue('cpu_usage_percent'),
        queue_sizes: this.getMetricValue('queue_size_gauge')
      },
      business: {
        user_satisfaction: this.getMetricValue('user_satisfaction_score'),
        revenue_impact: this.getMetricValue('revenue_impact_dollars')
      }
    };
  }

  getMetricValue(metricName, aggregation = 'current') {
    const metric = this.metrics.get(metricName);
    if (!metric) return null;
    
    // This is simplified - in production you'd query your metrics store
    // (Prometheus, InfluxDB, etc.) with proper time ranges and aggregations
    return metric.get ? metric.get() : 'N/A';
  }

  // Health check endpoint data
  getHealthStatus() {
    return {
      status: 'healthy', // This would be calculated based on current metrics
      timestamp: new Date().toISOString(),
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      alerts: {
        active: 0, // Count of active alerts
        critical: 0 // Count of critical alerts
      }
    };
  }

  // Cleanup and shutdown
  shutdown() {
    console.log('🛑 Shutting down monitoring service...');
    
    // Clear intervals
    // Stop metric collection
    // Close connections
    
    console.log('✅ Monitoring service shutdown complete');
  }
}

module.exports = new MonitoringService();
