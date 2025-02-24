const { google } = require("googleapis");
const { oAuth2Client } = require("./GoogleDriveAccess/GoogleAuth");
const axios = require("axios");

const getDirectImageLink = async (photoUrl, accessToken) => {
  try {
    // Make API call to Google Photos Library
    const response = await axios.get("https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      

    const mediaItems = response.data.mediaItems || [];

    // 🔍 Find the correct media item that matches the shared link
    const matchedItem = mediaItems.find((item) => photoUrl.includes(item.id));

    if (!matchedItem) {
      console.warn(`No match found for ${photoUrl}`);
      return photoUrl; // Return original link if not found
    }

    // ✅ Convert baseUrl to a direct image URL
    return `${matchedItem.baseUrl}=w2048-h1024`;

  } catch (error) {
    console.error("Error fetching direct image link:", error.message);
    return photoUrl; // Return original link in case of error
  }
};


const post_convertGooglePhotos = async (req, res) => {
    const { imageLinks, oauthAccessToken } = req.body;
    console.log(req.body);
  
    if (!oauthAccessToken) {
      return res.status(400).json({ success: false, message: "Missing OAuth access token" });
    }
  
    try {
      // Convert all images using getDirectImageLink
      const convertedImages = await Promise.all(
        imageLinks.map(async (link) => {
          if (!link) return ""; // Skip empty links
          return await getDirectImageLink(link, oauthAccessToken);
        })
      );
  
      return res.json({ success: true, convertedImages });
    } catch (error) {
      console.error("Error converting Google Photos links:", error.message);
      return res.status(500).json({ success: false, message: "Error converting images" });
    }
  };
  
  module.exports = { post_convertGooglePhotos };
  