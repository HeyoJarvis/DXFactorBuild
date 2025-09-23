/**
 * Performance Monitor - Tracks desktop app performance and system resources
 * 
 * Features:
 * 1. Memory usage tracking
 * 2. CPU usage monitoring
 * 3. Window performance metrics
 * 4. Network activity monitoring
 * 5. Performance alerts and optimization
 */

const { app, powerMonitor } = require('electron');
const os = require('os');

class PerformanceMonitor {
  constructor(appLifecycle) {
    this.appLifecycle = appLifecycle;
    this.logger = appLifecycle.getLogger();
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.metrics = {
      memory: {
        used: 0,
        total: 0,
        percentage: 0
      },
      cpu: {
        usage: 0,
        loadAverage: []
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron
      },
      app: {
        startTime: Date.now(),
        uptime: 0,
        windowCount: 0,
        signalsProcessed: 0
      }
    };
    
    this.thresholds = {
      memoryWarning: 500, // MB
      memoryError: 1000, // MB
      cpuWarning: 80, // %
      cpuError: 95 // %
    };
  }
  
  /**
   * Start performance monitoring
   */
  start() {
    if (this.isMonitoring) return;
    
    try {
      this.isMonitoring = true;
      
      // Monitor every 30 seconds
      this.monitoringInterval = setInterval(() => {
        this.collectMetrics();
      }, 30000);
      
      // Initial collection
      this.collectMetrics();
      
      // Setup power monitoring
      this.setupPowerMonitoring();
      
      this.logger.info('Performance monitoring started', {
        interval: 30000,
        thresholds: this.thresholds
      });
      
    } catch (error) {
      this.logger.error('Failed to start performance monitoring', { error: error.message });
      this.isMonitoring = false;
    }
  }
  
  /**
   * Stop performance monitoring
   */
  stop() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.logger.info('Performance monitoring stopped');
  }
  
  /**
   * Collect current performance metrics
   */
  collectMetrics() {
    try {
      // Memory metrics
      const memoryUsage = process.memoryUsage();
      const systemMemory = {
        total: os.totalmem(),
        free: os.freemem()
      };
      
      this.metrics.memory = {
        used: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heap: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        systemTotal: Math.round(systemMemory.total / 1024 / 1024), // MB
        systemFree: Math.round(systemMemory.free / 1024 / 1024), // MB
        percentage: Math.round((memoryUsage.rss / systemMemory.total) * 100)
      };
      
      // CPU metrics
      const cpus = os.cpus();
      this.metrics.cpu = {
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        loadAverage: os.loadavg(),
        usage: this.calculateCpuUsage()
      };
      
      // App metrics
      this.metrics.app = {
        ...this.metrics.app,
        uptime: Date.now() - this.metrics.app.startTime,
        windowCount: require('electron').BrowserWindow.getAllWindows().length,
        pid: process.pid
      };
      
      // Check thresholds and alert if needed
      this.checkThresholds();
      
      this.logger.debug('Performance metrics collected', {
        memory: this.metrics.memory.used,
        cpu: this.metrics.cpu.usage,
        windows: this.metrics.app.windowCount
      });
      
    } catch (error) {
      this.logger.error('Failed to collect performance metrics', { error: error.message });
    }
  }
  
  /**
   * Calculate CPU usage percentage
   */
  calculateCpuUsage() {
    const loadAvg = os.loadavg()[0]; // 1-minute load average
    const numCPUs = os.cpus().length;
    
    // Convert load average to percentage
    return Math.min(Math.round((loadAvg / numCPUs) * 100), 100);
  }
  
  /**
   * Check performance thresholds and alert
   */
  checkThresholds() {
    const { memory, cpu } = this.metrics;
    
    // Memory threshold checks
    if (memory.used > this.thresholds.memoryError) {
      this.logger.error('Critical memory usage detected', { 
        used: memory.used,
        threshold: this.thresholds.memoryError 
      });
      
      // Try to trigger garbage collection
      if (global.gc) {
        global.gc();
        this.logger.info('Garbage collection triggered');
      }
      
    } else if (memory.used > this.thresholds.memoryWarning) {
      this.logger.warn('High memory usage detected', { 
        used: memory.used,
        threshold: this.thresholds.memoryWarning 
      });
    }
    
    // CPU threshold checks
    if (cpu.usage > this.thresholds.cpuError) {
      this.logger.error('Critical CPU usage detected', { 
        usage: cpu.usage,
        threshold: this.thresholds.cpuError 
      });
    } else if (cpu.usage > this.thresholds.cpuWarning) {
      this.logger.warn('High CPU usage detected', { 
        usage: cpu.usage,
        threshold: this.thresholds.cpuWarning 
      });
    }
  }
  
  /**
   * Setup power monitoring
   */
  setupPowerMonitoring() {
    if (!powerMonitor.isSupported) {
      this.logger.debug('Power monitoring not supported on this platform');
      return;
    }
    
    powerMonitor.on('suspend', () => {
      this.logger.info('System is going to sleep');
      // Reduce monitoring frequency when suspended
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = setInterval(() => {
          this.collectMetrics();
        }, 120000); // 2 minutes
      }
    });
    
    powerMonitor.on('resume', () => {
      this.logger.info('System resumed from sleep');
      // Restore normal monitoring frequency
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = setInterval(() => {
          this.collectMetrics();
        }, 30000); // 30 seconds
      }
    });
    
    powerMonitor.on('on-ac', () => {
      this.logger.debug('System plugged in to AC power');
    });
    
    powerMonitor.on('on-battery', () => {
      this.logger.debug('System switched to battery power');
      // Could reduce performance monitoring on battery
    });
  }
  
  /**
   * Get current performance metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }
  
  /**
   * Get performance summary
   */
  getSummary() {
    return {
      memory: {
        used: this.metrics.memory.used,
        percentage: this.metrics.memory.percentage,
        status: this.getMemoryStatus()
      },
      cpu: {
        usage: this.metrics.cpu.usage,
        cores: this.metrics.cpu.cores,
        status: this.getCpuStatus()
      },
      app: {
        uptime: Math.round(this.metrics.app.uptime / 1000 / 60), // minutes
        windows: this.metrics.app.windowCount,
        status: this.getAppStatus()
      }
    };
  }
  
  /**
   * Get memory status
   */
  getMemoryStatus() {
    const used = this.metrics.memory.used;
    
    if (used > this.thresholds.memoryError) {
      return 'critical';
    } else if (used > this.thresholds.memoryWarning) {
      return 'warning';
    } else {
      return 'good';
    }
  }
  
  /**
   * Get CPU status
   */
  getCpuStatus() {
    const usage = this.metrics.cpu.usage;
    
    if (usage > this.thresholds.cpuError) {
      return 'critical';
    } else if (usage > this.thresholds.cpuWarning) {
      return 'warning';
    } else {
      return 'good';
    }
  }
  
  /**
   * Get app status
   */
  getAppStatus() {
    const memoryStatus = this.getMemoryStatus();
    const cpuStatus = this.getCpuStatus();
    
    if (memoryStatus === 'critical' || cpuStatus === 'critical') {
      return 'critical';
    } else if (memoryStatus === 'warning' || cpuStatus === 'warning') {
      return 'warning';
    } else {
      return 'good';
    }
  }
  
  /**
   * Increment signals processed counter
   */
  incrementSignalsProcessed() {
    this.metrics.app.signalsProcessed++;
  }
  
  /**
   * Update thresholds
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.logger.debug('Performance thresholds updated', { thresholds: this.thresholds });
  }
  
  /**
   * Reset metrics
   */
  reset() {
    this.metrics.app.signalsProcessed = 0;
    this.metrics.app.startTime = Date.now();
    this.logger.debug('Performance metrics reset');
  }
}

module.exports = PerformanceMonitor;
