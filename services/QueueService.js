/**
 * Custom Queue Microservice
 * A lightweight job scheduler without external dependencies
 * Uses setTimeout for scheduling and in-memory storage
 */

class QueueService {
  constructor() {
    this.jobs = new Map(); // Store scheduled jobs: jobId -> { timeoutId, jobData, scheduledTime }
    this.isRunning = false;
    this.checkInterval = null;
    this.checkIntervalMs = 60000; // Check every minute for overdue jobs
  }

  /**
   * Schedule a job to execute at a specific time
   * @param {string} jobId - Unique identifier for the job
   * @param {Date|number} scheduledTime - When to execute the job (Date object or timestamp)
   * @param {Function} jobFunction - Function to execute
   * @param {Object} jobData - Additional data to pass to the job function
   * @returns {boolean} - True if scheduled successfully
   */
  scheduleJob(jobId, scheduledTime, jobFunction, jobData = {}) {
    try {
      // Cancel existing job if it exists
      this.cancelJob(jobId);

      // Convert to Date if needed
      const targetTime = scheduledTime instanceof Date 
        ? scheduledTime.getTime() 
        : new Date(scheduledTime).getTime();

      const now = Date.now();
      const delay = targetTime - now;

      // If the time has already passed, execute immediately
      if (delay <= 0) {
        console.log(`[QueueService] Job ${jobId} scheduled time has passed, executing immediately`);
        this.executeJob(jobId, jobFunction, jobData);
        return true;
      }

      // Schedule the job
      const timeoutId = setTimeout(() => {
        this.executeJob(jobId, jobFunction, jobData);
        this.jobs.delete(jobId);
      }, delay);

      // Store job information
      this.jobs.set(jobId, {
        timeoutId,
        jobFunction,
        jobData,
        scheduledTime: new Date(targetTime),
        createdAt: new Date(),
      });

      console.log(`[QueueService] Job ${jobId} scheduled for ${new Date(targetTime).toISOString()} (in ${Math.round(delay / 1000)}s)`);
      
      // Start the checker if not running
      if (!this.isRunning) {
        this.startChecker();
      }

      return true;
    } catch (error) {
      console.error(`[QueueService] Error scheduling job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Execute a job immediately
   * @param {string} jobId - Job identifier
   * @param {Function} jobFunction - Function to execute
   * @param {Object} jobData - Data to pass to the function
   */
  async executeJob(jobId, jobFunction, jobData) {
    try {
      console.log(`[QueueService] Executing job ${jobId}`);
      await jobFunction(jobData);
      console.log(`[QueueService] Job ${jobId} executed successfully`);
    } catch (error) {
      console.error(`[QueueService] Error executing job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled job
   * @param {string} jobId - Job identifier
   * @returns {boolean} - True if job was found and cancelled
   */
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      clearTimeout(job.timeoutId);
      this.jobs.delete(jobId);
      console.log(`[QueueService] Job ${jobId} cancelled`);
      return true;
    }
    return false;
  }

  /**
   * Get job information
   * @param {string} jobId - Job identifier
   * @returns {Object|null} - Job information or null if not found
   */
  getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      jobId,
      scheduledTime: job.scheduledTime,
      createdAt: job.createdAt,
      jobData: job.jobData,
      timeUntilExecution: job.scheduledTime.getTime() - Date.now(),
    };
  }

  /**
   * Get all scheduled jobs
   * @returns {Array} - Array of job information
   */
  getAllJobs() {
    const jobs = [];
    this.jobs.forEach((job, jobId) => {
      jobs.push({
        jobId,
        scheduledTime: job.scheduledTime,
        createdAt: job.createdAt,
        jobData: job.jobData,
        timeUntilExecution: job.scheduledTime.getTime() - Date.now(),
      });
    });
    return jobs;
  }

  /**
   * Start the background checker for overdue jobs
   */
  startChecker() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      this.checkOverdueJobs();
    }, this.checkIntervalMs);

    console.log('[QueueService] Background checker started');
  }

  /**
   * Stop the background checker
   */
  stopChecker() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('[QueueService] Background checker stopped');
  }

  /**
   * Check for overdue jobs and execute them
   */
  checkOverdueJobs() {
    const now = Date.now();
    const overdueJobs = [];

    this.jobs.forEach((job, jobId) => {
      if (job.scheduledTime.getTime() <= now) {
        overdueJobs.push({ jobId, job });
      }
    });

    if (overdueJobs.length > 0) {
      console.log(`[QueueService] Found ${overdueJobs.length} overdue job(s)`);
      overdueJobs.forEach(({ jobId, job }) => {
        this.executeJob(jobId, job.jobFunction, job.jobData);
        this.jobs.delete(jobId);
      });
    }
  }

  /**
   * Clear all scheduled jobs
   */
  clearAll() {
    this.jobs.forEach((job, jobId) => {
      clearTimeout(job.timeoutId);
    });
    this.jobs.clear();
    console.log('[QueueService] All jobs cleared');
  }

  /**
   * Get statistics about the queue
   * @returns {Object} - Queue statistics
   */
  getStats() {
    return {
      totalJobs: this.jobs.size,
      isRunning: this.isRunning,
      checkIntervalMs: this.checkIntervalMs,
    };
  }
}

// Export singleton instance
const queueService = new QueueService();

module.exports = queueService;
