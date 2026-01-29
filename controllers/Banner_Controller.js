const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();
const nodemailer = require("nodemailer");
const axios = require("axios");
const bannerScheduler = require("../services/BannerScheduler");
const dayjs = require("dayjs");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper function to geocode address to coordinates
const geocodeAddress = async (address) => {
  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json`,
      {
        params: {
          address: address,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (response.data.status === "OK" && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
        formatted_address: response.data.results[0].formatted_address,
      };
    } else {
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }
  } catch (error) {
    console.error("Geocoding error:", error);
    throw error;
  }
};

// Helper function to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Create a banner notification (supports both shop and admin creation)
const createBannerNotification = async (req, res) => {
  try {
    const {
      shop_access_token,
      area_name,
      address, // New: address field for geocoding
      latitude,
      longitude,
      radius, // in km
      start_time,
      end_time,
      offer_message,
      shop_no,
      business_name, // For admin-created banners
      created_by_admin, // Flag to indicate admin creation
      user_id, // User ID of the creator (to exclude from notifications)
      banner_type = 'regular', // 'regular' or 'famous_area'
      famous_area_id, // ID of famous area from admin.famous_areas
    } = req.body;

    // Validate required fields (area_name not required for famous_area if famous_area_id is provided)
    // For famous_area banners, area_name will be set from famous area data
    if (banner_type !== 'famous_area' && !area_name) {
      return res.status(400).json({
        message: "Missing required field: area_name",
      });
    }
    if (!start_time || !end_time) {
      return res.status(400).json({
        message: "Missing required fields: start_time, end_time",
      });
    }

    let finalLatitude = latitude;
    let finalLongitude = longitude;
    let finalAddress = address;
    let shopData = null;
    let actualShopNo = shop_no || null;
    let actualShopAccessToken = shop_access_token || null;
    let finalBusinessName = business_name;
    let finalRadius = radius;
    let finalFamousAreaId = null;
    let finalAreaName = area_name;

    // Handle famous area banner
    if (banner_type === 'famous_area') {
      if (!famous_area_id) {
        return res.status(400).json({
          message: "famous_area_id is required for famous_area banner type",
        });
      }

      // Fetch famous area data
      const famousAreaQuery = await ambarsariyaPool.query(
        `SELECT * FROM admin.famous_areas WHERE id = $1`,
        [famous_area_id]
      );

      if (famousAreaQuery.rows.length === 0) {
        return res.status(404).json({
          message: "Famous area not found",
        });
      }

      const famousArea = famousAreaQuery.rows[0];
      finalLatitude = parseFloat(famousArea.latitude);
      finalLongitude = parseFloat(famousArea.longitude);
      finalAddress = famousArea.area_address;
      // Use provided radius if given, otherwise fall back to famous area's length_in_km, or default to 1
      finalRadius = radius ? parseFloat(radius) : (parseFloat(famousArea.length_in_km) || 1);
      finalFamousAreaId = famous_area_id;
      
      // Use famous area title as area_name if not provided
      if (!finalAreaName) {
        finalAreaName = famousArea.area_title;
      }
    } else {
      // Regular banner - validate radius
      if (!radius) {
        return res.status(400).json({
          message: "Missing required field: radius",
        });
      }
      finalRadius = radius;
    }

    // If address is provided (can be string or object from FormField) - only for regular banners
    if (banner_type !== 'famous_area' && address) {
      // Handle address as object (from FormField address type)
      if (typeof address === 'object' && address !== null) {
        if (address.latitude && address.longitude) {
          finalLatitude = address.latitude;
          finalLongitude = address.longitude;
          finalAddress = address.formatted_address || address.description;
        } else if (address.description) {
          // If object has description but no coordinates, geocode it
          try {
            const geocodeResult = await geocodeAddress(address.description);
            finalLatitude = geocodeResult.latitude;
            finalLongitude = geocodeResult.longitude;
            finalAddress = geocodeResult.formatted_address;
          } catch (geocodeError) {
            return res.status(400).json({
              message: "Failed to geocode address. Please provide valid address or coordinates.",
              error: geocodeError.message,
            });
          }
        }
      } else if (typeof address === 'string' && !latitude && !longitude) {
        // Handle address as string - geocode it
        try {
          const geocodeResult = await geocodeAddress(address);
          finalLatitude = geocodeResult.latitude;
          finalLongitude = geocodeResult.longitude;
          finalAddress = geocodeResult.formatted_address;
        } catch (geocodeError) {
          return res.status(400).json({
            message: "Failed to geocode address. Please provide valid address or coordinates.",
            error: geocodeError.message,
          });
        }
      }
    }

    // If coordinates are provided but no address, reverse geocode (optional)
    if (latitude && longitude && !address) {
      finalAddress = `${area_name}, Amritsar`; // Default address
    }

    // Validate coordinates
    if (!finalLatitude || !finalLongitude) {
      return res.status(400).json({
        message: "Either address or latitude/longitude must be provided",
      });
    }

    // If shop_access_token is provided, validate shop exists
    if (shop_access_token && !created_by_admin) {
      const shopCheck = await ambarsariyaPool.query(
        `SELECT ef.shop_no, ef.business_name, uc.username 
         FROM Sell.eshop_form ef 
         JOIN Sell.user_credentials uc ON uc.user_id = ef.user_id 
         WHERE ef.shop_access_token = $1`,
        [shop_access_token]
      );

      if (shopCheck.rows.length === 0) {
        return res.status(404).json({ message: "Shop not found" });
      }

      shopData = shopCheck.rows[0];
      actualShopNo = shop_no || shopData.shop_no;
      finalBusinessName = shopData.business_name;
    } else if (created_by_admin) {
      // Admin-created banner - shop_no and shop_access_token can be null
      actualShopNo = shop_no || null;
      actualShopAccessToken = shop_access_token || null;
    } else {
      return res.status(400).json({
        message: "Either shop_access_token or created_by_admin flag must be provided",
      });
    }

    // Get user_id if shop_access_token is provided
    let creatorUserId = user_id || null;
    if (shop_access_token && !creatorUserId) {
      const userQuery = await ambarsariyaPool.query(
        `SELECT ef.user_id 
         FROM Sell.eshop_form ef 
         WHERE ef.shop_access_token = $1`,
        [shop_access_token]
      );
      if (userQuery.rows.length > 0) {
        creatorUserId = userQuery.rows[0].user_id;
      }
    }

    // Create banner notification
    const result = await ambarsariyaPool.query(
      `INSERT INTO Sell.banner_notifications 
       (shop_no, shop_access_token, area_name, address, latitude, longitude, radius, start_time, end_time, offer_message, business_name, banner_type, famous_area_id, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()) 
       RETURNING *`,
      [
        actualShopNo,
        actualShopAccessToken,
        finalAreaName,
        finalAddress,
        finalLatitude,
        finalLongitude,
        finalRadius,
        start_time,
        end_time,
        offer_message || `Visit ${finalBusinessName || finalAreaName} to avail special offers!`,
        finalBusinessName,
        banner_type,
        finalFamousAreaId,
      ]
    );

    const banner = result.rows[0];

    // Check if banner is scheduled for the future using dayjs
    // Parse timestamp_without time zone from database
    const startTime = dayjs(banner.start_time);
    const now = dayjs();
    const isFutureBanner = startTime.isAfter(now);

    if (isFutureBanner) {
      // Schedule notification for future start time
      try {
        bannerScheduler.scheduleStartNotification(banner.id, banner.start_time, creatorUserId);
        console.log(`Banner ${banner.id} scheduled for future notification at ${startTime.toISOString()}`);
      } catch (scheduleError) {
        console.error("Error scheduling future banner notification:", scheduleError);
        // Don't fail the request if scheduling fails
      }
    } else {
      // Banner starts now or in the past - send notifications immediately
      try {
        await sendBannerNotificationsToUsers(banner.id, creatorUserId);
      } catch (emailError) {
        console.error("Error sending initial email notifications:", emailError);
        // Don't fail the request if email sending fails
      }
    }

    res.status(201).json({
      message: isFutureBanner 
        ? "Banner notification created successfully. Notifications will be sent when the banner starts."
        : "Banner notification created successfully. Nearby users have been notified.",
      banner: banner,
      scheduled: isFutureBanner,
    });
  } catch (error) {
    console.error("Error creating banner notification:", error);
    res.status(500).json({
      message: "Error creating banner notification",
      error: error.message,
    });
  }
};

// Get nearby banner notifications for a user
const getNearbyBanners = async (req, res) => {
  try {
    const { latitude, longitude, user_access_token } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        message: "Latitude and longitude are required",
      });
    }

    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);

    // Get all active banner notifications (within time limit)
    const banners = await ambarsariyaPool.query(
      `SELECT 
        bn.*,
        COALESCE(ef.business_name, bn.business_name) as business_name,
        COALESCE(ef.address, bn.address) as address,
        ef.shop_access_token,
        ef.latitude as shop_latitude,
        ef.longitude as shop_longitude,
        fa.area_title as famous_area_title,
        fa.area_address as famous_area_address,
        fa.length_in_km as famous_area_length
       FROM Sell.banner_notifications bn
       LEFT JOIN Sell.eshop_form ef ON ef.shop_no = bn.shop_no
       LEFT JOIN admin.famous_areas fa ON fa.id = bn.famous_area_id
       WHERE bn.start_time <= NOW() 
         AND bn.end_time >= NOW()
         AND bn.is_active = true
       ORDER BY bn.created_at DESC`
    );

    // Calculate distance for each banner and filter by radius
    const nearbyBanners = banners.rows
      .map((banner) => {
        const distance = calculateDistance(
          userLat,
          userLon,
          parseFloat(banner.latitude),
          parseFloat(banner.longitude)
        );

        return {
          ...banner,
          distance: distance,
          is_within_radius: distance <= parseFloat(banner.radius),
        };
      })
      .filter((banner) => banner.is_within_radius)
      .sort((a, b) => a.distance - b.distance); // Sort by distance (closest first)

    // Calculate opacity and size based on distance (mirror effect)
    const maxDistance = Math.max(...nearbyBanners.map((b) => b.distance), 1);
    const bannersWithVisuals = nearbyBanners.map((banner) => {
      const maxRadius = parseFloat(banner.radius);
      const distanceRatio = banner.distance / maxRadius; // 0 (closest) to 1 (furthest)
      const opacity = Math.max(0.3, 1 - distanceRatio * 0.7); // 100% to 30%
      const scale = Math.max(0.7, 1 - distanceRatio * 0.3); // 100% to 70%

      return {
        ...banner,
        opacity: opacity,
        scale: scale,
        visual_clarity: opacity * 100, // Percentage for display
      };
    });

    res.json({
      banners: bannersWithVisuals,
      count: bannersWithVisuals.length,
    });
  } catch (error) {
    console.error("Error fetching nearby banners:", error);
    res.status(500).json({
      message: "Error fetching nearby banners",
      error: error.message,
    });
  }
};

// Get all banners for a shop
const getShopBanners = async (req, res) => {
  try {
    const { shop_access_token } = req.params;

    const banners = await ambarsariyaPool.query(
      `SELECT * FROM Sell.banner_notifications 
       WHERE shop_access_token = $1 
       ORDER BY created_at DESC`,
      [shop_access_token]
    );

    res.json({
      banners: banners.rows,
      count: banners.rows.length,
    });
  } catch (error) {
    console.error("Error fetching shop banners:", error);
    res.status(500).json({
      message: "Error fetching shop banners",
      error: error.message,
    });
  }
};

// Update banner notification
const updateBannerNotification = async (req, res) => {
  try {
    const { banner_id } = req.params;
    const {
      area_name,
      latitude,
      longitude,
      radius,
      start_time,
      end_time,
      offer_message,
      is_active,
    } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (area_name !== undefined) {
      updateFields.push(`area_name = $${paramCount++}`);
      values.push(area_name);
    }
    if (latitude !== undefined) {
      updateFields.push(`latitude = $${paramCount++}`);
      values.push(latitude);
    }
    if (longitude !== undefined) {
      updateFields.push(`longitude = $${paramCount++}`);
      values.push(longitude);
    }
    if (radius !== undefined) {
      updateFields.push(`radius = $${paramCount++}`);
      values.push(radius);
    }
    if (start_time !== undefined) {
      updateFields.push(`start_time = $${paramCount++}`);
      values.push(start_time);
    }
    if (end_time !== undefined) {
      updateFields.push(`end_time = $${paramCount++}`);
      values.push(end_time);
    }
    if (offer_message !== undefined) {
      updateFields.push(`offer_message = $${paramCount++}`);
      values.push(offer_message);
    }
    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    values.push(banner_id);

    const result = await ambarsariyaPool.query(
      `UPDATE Sell.banner_notifications 
       SET ${updateFields.join(", ")}, updated_at = NOW() 
       WHERE id = $${paramCount} 
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Banner notification not found" });
    }

    const updatedBanner = result.rows[0];

    // If start_time was updated, reschedule the notification
    if (start_time !== undefined) {
      // Cancel existing scheduled notification
      bannerScheduler.cancelBannerNotifications(banner_id);
      
      // Get creator user_id
      let creatorUserId = null;
      if (updatedBanner.shop_access_token) {
        const userQuery = await ambarsariyaPool.query(
          `SELECT ef.user_id 
           FROM Sell.eshop_form ef 
           WHERE ef.shop_access_token = $1`,
          [updatedBanner.shop_access_token]
        );
        if (userQuery.rows.length > 0) {
          creatorUserId = userQuery.rows[0].user_id;
        }
      }

      // Schedule new notification if start_time is in the future using dayjs
      const newStartTime = dayjs(updatedBanner.start_time);
      const now = dayjs();
      if (newStartTime.isAfter(now)) {
        bannerScheduler.scheduleStartNotification(updatedBanner.id, updatedBanner.start_time, creatorUserId);
      }
    }

    res.json({
      message: "Banner notification updated successfully",
      banner: updatedBanner,
    });
  } catch (error) {
    console.error("Error updating banner notification:", error);
    res.status(500).json({
      message: "Error updating banner notification",
      error: error.message,
    });
  }
};

// Delete banner notification
const deleteBannerNotification = async (req, res) => {
  try {
    const { banner_id } = req.params;

    // Cancel any scheduled notifications for this banner
    bannerScheduler.cancelBannerNotifications(banner_id);

    const result = await ambarsariyaPool.query(
      `DELETE FROM Sell.banner_notifications 
       WHERE id = $1 
       RETURNING *`,
      [banner_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Banner notification not found" });
    }

    res.json({
      message: "Banner notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting banner notification:", error);
    res.status(500).json({
      message: "Error deleting banner notification",
      error: error.message,
    });
  }
};

// Helper function to send email notifications (used internally and by scheduler)
const sendBannerNotificationsToUsers = async (bannerId, excludeUserId = null) => {
  const bannerResult = await ambarsariyaPool.query(
    `SELECT bn.*, 
     COALESCE(ef.business_name, bn.business_name) as business_name,
     COALESCE(ef.address, bn.address) as address 
     FROM Sell.banner_notifications bn
     LEFT JOIN Sell.eshop_form ef ON ef.shop_no = bn.shop_no
     WHERE bn.id = $1 AND bn.is_active = true 
       AND bn.start_time <= NOW() 
       AND bn.end_time >= NOW()`,
    [bannerId]
  );

  if (bannerResult.rows.length === 0) {
    return { message: "Active banner not found", total_nearby_users: 0, emails_sent: 0 };
  }

  const banner = bannerResult.rows[0];

    // Get banner creator's user_id to exclude from notifications (if not provided)
    let creatorUserId = excludeUserId;
    if (!creatorUserId) {
      const bannerCreatorQuery = await ambarsariyaPool.query(
        `SELECT ef.user_id 
         FROM Sell.banner_notifications bn
         LEFT JOIN Sell.eshop_form ef ON ef.shop_no = bn.shop_no
         WHERE bn.id = $1`,
        [bannerId]
      );
      creatorUserId = bannerCreatorQuery.rows[0]?.user_id || null;
    }

    // Get all users (members, shops, visitors, merchants) with email and location
    // EXCLUDE the user who created the banner (if provided)
    const usersQuery = creatorUserId
      ? `SELECT DISTINCT
          u.user_id,
          u.user_type,
          uc.username,
          u.full_name,
          mp.latitude,
          mp.longitude,
          ef.latitude as shop_latitude,
          ef.longitude as shop_longitude
         FROM Sell.users u
         JOIN Sell.user_credentials uc ON uc.user_id = u.user_id
         LEFT JOIN Sell.member_profiles mp ON mp.user_id = u.user_id
         LEFT JOIN Sell.eshop_form ef ON ef.user_id = u.user_id
         WHERE uc.username IS NOT NULL 
           AND (mp.latitude IS NOT NULL OR ef.latitude IS NOT NULL)
           AND u.user_id != $1`
      : `SELECT DISTINCT
          u.user_id,
          u.user_type,
          uc.username,
          u.full_name,
          mp.latitude,
          mp.longitude,
          ef.latitude as shop_latitude,
          ef.longitude as shop_longitude
         FROM Sell.users u
         JOIN Sell.user_credentials uc ON uc.user_id = u.user_id
         LEFT JOIN Sell.member_profiles mp ON mp.user_id = u.user_id
         LEFT JOIN Sell.eshop_form ef ON ef.user_id = u.user_id
         WHERE uc.username IS NOT NULL 
           AND (mp.latitude IS NOT NULL OR ef.latitude IS NOT NULL)`;

    const users = await ambarsariyaPool.query(
      usersQuery,
      excludeUserId ? [excludeUserId] : []
    );

  const bannerLat = parseFloat(banner.latitude);
  const bannerLon = parseFloat(banner.longitude);
  const radius = parseFloat(banner.radius);

  const nearbyUsers = users.rows
    .map((user) => {
      const userLat = parseFloat(user.latitude || user.shop_latitude);
      const userLon = parseFloat(user.longitude || user.shop_longitude);

      if (!userLat || !userLon) return null;

      const distance = calculateDistance(bannerLat, bannerLon, userLat, userLon);

      return {
        ...user,
        distance: distance,
        is_nearby: distance <= radius,
      };
    })
    .filter((user) => user && user.is_nearby);

  // Send emails to nearby users
  const emailPromises = nearbyUsers.map(async (user) => {
    try {
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: user.username,
        subject: `🎯 You're near ${banner.area_name}! Special Offer Available`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Hello ${user.full_name || "Valued Customer"}!</h2>
            <p>You are currently near <strong>${banner.area_name}</strong> area.</p>
            ${banner.business_name ? `<p><strong>${banner.business_name}</strong> has a special offer for you!</p>` : ''}
            <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; font-size: 16px;">${banner.offer_message || `Visit ${banner.business_name || banner.area_name} to avail special offers!`}</p>
            </div>
            <p><strong>Location:</strong> ${banner.address || banner.area_name}</p>
            <p><strong>Distance:</strong> ${user.distance.toFixed(2)} km away</p>
            <p style="color: #666; font-size: 14px;">This offer is valid until ${dayjs(banner.end_time).format('MMMM DD, YYYY [at] hh:mm A')}.</p>
            <p style="margin-top: 30px; color: #999; font-size: 12px;">Best regards,<br>Ambarsariya Mall Team</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      return { user_id: user.user_id, email_sent: true };
    } catch (emailError) {
      console.error(`Error sending email to ${user.username}:`, emailError);
      return { user_id: user.user_id, email_sent: false, error: emailError.message };
    }
  });

  const emailResults = await Promise.all(emailPromises);
  const successCount = emailResults.filter((r) => r.email_sent).length;

  return {
    message: `Email notifications sent to ${successCount} nearby users`,
    total_nearby_users: nearbyUsers.length,
    emails_sent: successCount,
    results: emailResults,
  };
};

// Send email notifications to nearby users (called by cron job or manually)
const sendBannerNotifications = async (req, res) => {
  try {
    const { banner_id } = req.params;

    const result = await sendBannerNotificationsToUsers(banner_id, null);
    res.json(result);
  } catch (error) {
    console.error("Error sending banner notifications:", error);
    res.status(500).json({
      message: "Error sending banner notifications",
      error: error.message,
    });
  }
};

// Get all banners (for admin)
const getAllBanners = async (req, res) => {
  try {
    const banners = await ambarsariyaPool.query(
      `SELECT 
        bn.*,
        COALESCE(ef.business_name, bn.business_name) as business_name,
        COALESCE(ef.address, bn.address) as address
       FROM Sell.banner_notifications bn
       LEFT JOIN Sell.eshop_form ef ON ef.shop_no = bn.shop_no
       ORDER BY bn.created_at DESC`
    );

    res.json({
      banners: banners.rows,
      count: banners.rows.length,
    });
  } catch (error) {
    console.error("Error fetching all banners:", error);
    res.status(500).json({
      message: "Error fetching all banners",
      error: error.message,
    });
  }
};

module.exports = {
  createBannerNotification,
  getNearbyBanners,
  getShopBanners,
  getAllBanners,
  updateBannerNotification,
  deleteBannerNotification,
  sendBannerNotifications,
  sendBannerNotificationsToUsers, // Export for use by scheduler
};
