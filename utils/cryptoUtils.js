require("dotenv").config();
const crypto = require("crypto");

const SECRET_KEY = process.env.SECRET_KEY;
const IV_LENGTH = 16; // AES requires a 16-byte IV

if (!SECRET_KEY) {
  throw new Error("SECRET_KEY is missing in environment variables!");
}

// Encrypt Data
function encryptData(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(SECRET_KEY, "hex"),
    iv
  );

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

// Decrypt Data
function decryptData(encryptedText) {
  const [iv, encrypted] = encryptedText.split(":").map((part) =>
    Buffer.from(part, "hex")
  );

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(SECRET_KEY, "hex"),
    iv
  );

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

module.exports = { encryptData, decryptData };
