/**
 * Banner Notification Scheduler
 * Handles scheduling of banner notifications for future dates
 */

const queueService = require('./QueueService');
const { createDbPool } = require('../db_config/db');
const ambarsariyaPool = createDbPool();
const dayjs = require('dayjs');

class BannerScheduler {
  constructor() {
    this.jobPrefix = 'banner_notification_';
  }

  /**
   * Schedule notification for a banner's start time
   * @param {number} bannerId - Banner ID
   * @param {Date|string} startTime - When to send notifications
   * @param {number|null} excludeUserId - User ID to exclude from notifications
   * @returns {boolean} - True if scheduled successfully
   */
  scheduleStartNotification(bannerId, startTime, excludeUserId = null) {
    const jobId = `${this.jobPrefix}start_${bannerId}`;
    // Parse timestamp using dayjs (handles timestamp_without time zone from database)
    const scheduledTime = dayjs(startTime);

    // Check if the banner is scheduled for the future
    const now = dayjs();
    if (scheduledTime.isBefore(now) || scheduledTime.isSame(now)) {
      console.log(`[BannerScheduler] Banner ${bannerId} start time is in the past, not scheduling`);
      return false;
    }

    const jobFunction = async (jobData) => {
      try {
        console.log(`[BannerScheduler] Executing start notification for banner ${bannerId}`);
        
        // Import here to avoid circular dependency
        const bannerController = require('../controllers/Banner_Controller');
        
        // Check if banner is still active and start time has arrived
        const bannerCheck = await ambarsariyaPool.query(
          `SELECT id, is_active, start_time, end_time 
           FROM Sell.banner_notifications 
           WHERE id = $1`,
          [bannerId]
        );

        if (bannerCheck.rows.length === 0) {
          console.log(`[BannerScheduler] Banner ${bannerId} not found, skipping notification`);
          return;
        }

        const banner = bannerCheck.rows[0];
        
        // Only send if banner is still active and start time has arrived
        const bannerStartTime = dayjs(banner.start_time);
        const currentTime = dayjs();
        if (banner.is_active && (bannerStartTime.isBefore(currentTime) || bannerStartTime.isSame(currentTime))) {
          await bannerController.sendBannerNotificationsToUsers(bannerId, excludeUserId);
          console.log(`[BannerScheduler] Start notification sent for banner ${bannerId}`);
        } else {
          console.log(`[BannerScheduler] Banner ${bannerId} is not active or start time not reached`);
        }
      } catch (error) {
        console.error(`[BannerScheduler] Error executing start notification for banner ${bannerId}:`, error);
      }
    };

    // Convert dayjs to Date for queueService (which uses native Date internally)
    const scheduled = queueService.scheduleJob(
      jobId,
      scheduledTime.toDate(),
      jobFunction,
      { bannerId, excludeUserId, type: 'start' }
    );

    if (scheduled) {
      console.log(`[BannerScheduler] Scheduled start notification for banner ${bannerId} at ${scheduledTime.toISOString()}`);
    }

    return scheduled;
  }

  /**
   * Schedule reminder notification (optional - can be used for mid-campaign reminders)
   * @param {number} bannerId - Banner ID
   * @param {Date|string} reminderTime - When to send reminder
   * @param {number|null} excludeUserId - User ID to exclude
   * @returns {boolean}
   */
  scheduleReminderNotification(bannerId, reminderTime, excludeUserId = null) {
    const jobId = `${this.jobPrefix}reminder_${bannerId}`;
    // Parse timestamp using dayjs
    const scheduledTime = dayjs(reminderTime);

    const now = dayjs();
    if (scheduledTime.isBefore(now) || scheduledTime.isSame(now)) {
      return false;
    }

    const jobFunction = async (jobData) => {
      try {
        console.log(`[BannerScheduler] Executing reminder notification for banner ${bannerId}`);
        const bannerController = require('../controllers/Banner_Controller');
        
        const bannerCheck = await ambarsariyaPool.query(
          `SELECT id, is_active, start_time, end_time 
           FROM Sell.banner_notifications 
           WHERE id = $1 
           AND is_active = true 
           AND start_time <= NOW() 
           AND end_time >= NOW()`,
          [bannerId]
        );

        if (bannerCheck.rows.length > 0) {
          await bannerController.sendBannerNotificationsToUsers(bannerId, excludeUserId);
          console.log(`[BannerScheduler] Reminder notification sent for banner ${bannerId}`);
        }
      } catch (error) {
        console.error(`[BannerScheduler] Error executing reminder notification for banner ${bannerId}:`, error);
      }
    };

    // Convert dayjs to Date for queueService
    return queueService.scheduleJob(
      jobId,
      scheduledTime.toDate(),
      jobFunction,
      { bannerId, excludeUserId, type: 'reminder' }
    );
  }

  /**
   * Cancel scheduled notifications for a banner
   * @param {number} bannerId - Banner ID
   */
  cancelBannerNotifications(bannerId) {
    const startJobId = `${this.jobPrefix}start_${bannerId}`;
    const reminderJobId = `${this.jobPrefix}reminder_${bannerId}`;

    const cancelledStart = queueService.cancelJob(startJobId);
    const cancelledReminder = queueService.cancelJob(reminderJobId);

    if (cancelledStart || cancelledReminder) {
      console.log(`[BannerScheduler] Cancelled notifications for banner ${bannerId}`);
    }

    return { startCancelled: cancelledStart, reminderCancelled: cancelledReminder };
  }

  /**
   * Load and reschedule all active future banners from database
   * Useful for server restarts
   */
  async loadAndRescheduleBanners() {
    try {
      console.log('[BannerScheduler] Loading active future banners from database...');

      const banners = await ambarsariyaPool.query(
        `SELECT 
          bn.id,
          bn.start_time,
          bn.end_time,
          bn.is_active,
          ef.user_id
         FROM Sell.banner_notifications bn
         LEFT JOIN Sell.eshop_form ef ON ef.shop_no = bn.shop_no
         WHERE bn.is_active = true 
           AND bn.start_time > NOW()
         ORDER BY bn.start_time ASC`
      );

      let scheduledCount = 0;
      for (const banner of banners.rows) {
        const excludeUserId = banner.user_id || null;
        const scheduled = this.scheduleStartNotification(
          banner.id,
          banner.start_time,
          excludeUserId
        );
        if (scheduled) {
          scheduledCount++;
        }
      }

      console.log(`[BannerScheduler] Rescheduled ${scheduledCount} banner notification(s)`);
      return scheduledCount;
    } catch (error) {
      console.error('[BannerScheduler] Error loading and rescheduling banners:', error);
      return 0;
    }
  }

  /**
   * Get scheduled jobs for a banner
   * @param {number} bannerId - Banner ID
   * @returns {Object} - Scheduled job information
   */
  getBannerScheduledJobs(bannerId) {
    const startJobId = `${this.jobPrefix}start_${bannerId}`;
    const reminderJobId = `${this.jobPrefix}reminder_${bannerId}`;

    return {
      start: queueService.getJob(startJobId),
      reminder: queueService.getJob(reminderJobId),
    };
  }
}

// Export singleton instance
const bannerScheduler = new BannerScheduler();

module.exports = bannerScheduler;
