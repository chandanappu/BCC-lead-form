require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= GOOGLE SHEETS SETUP ================= */

const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY
  ? process.env.PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined,
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_CERT_URL,
};

const sheetsAuth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth: sheetsAuth });

/* ================= GMAIL OAUTH SETUP ================= */

const oAuth2Client = new google.auth.OAuth2(
  process.env.OAUTH_CLIENT_ID,
  process.env.OAUTH_CLIENT_SECRET,
  process.env.OAUTH_REDIRECT_URI
);

oAuth2Client.setCredentials({
  refresh_token: process.env.OAUTH_REFRESH_TOKEN,
});

/* ================= SEND EMAIL FUNCTION ================= */

async function sendThankYouEmail(toEmail, name, role) {
  try {
    const accessToken = await oAuth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.GMAIL_USER,
        clientId: process.env.OAUTH_CLIENT_ID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        refreshToken: process.env.OAUTH_REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });

    await transporter.sendMail({
      from: `Bharath Career Connect <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: "Thanks for Registering - Bharath Career Connect",
      html: `
        <h3>Dear ${name},</h3>
        <p>Thank you for applying for <strong>${role}</strong>.</p>
        <p>Our team will contact you shortly.</p>
        <p>For queries call: <strong>9090909090</strong></p>
        <br/>
        <p>Regards,<br/>Bharath Career Connect</p>
      `,
    });

    console.log("📧 Email sent to:", toEmail);
  } catch (error) {
    console.error("Email Error:", error.message);
  }
}

/* ================= REGISTER ROUTE ================= */

app.post("/api/register", async (req, res) => {
   console.log("request recived post");
  const { name, email, phone, gender, state, district, role, captchaToken } = req.body;

  if (!name || name.trim().length < 2)
    return res.status(400).send("Invalid name");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).send("Invalid email");

  if (!/^[6-9]\d{9}$/.test(phone))
    return res.status(400).send("Invalid phone");

  if (!captchaToken)
    return res.status(400).send("Captcha required");

  try {
    /* ===== VERIFY RECAPTCHA ===== */
    const verify = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: captchaToken,
        },
      }
    );

    if (!verify.data.success)
      return res.status(400).send("Captcha failed");

    /* ===== SAVE TO GOOGLE SHEETS ===== */
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID,
      range: "Sheet1!A:H",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            new Date().toLocaleString(),
            name,
            email,
            phone,
            gender,
            state,
            district,
            role,
          ],
        ],
      },
    });

    console.log("✅ Lead saved:", name);

    /* ===== SEND THANK YOU EMAIL ===== */
   

    res.json({ success: true });
     sendThankYouEmail(email, name, role);

  } catch (error) {
    console.error("FULL ERROR:", error);
    return res.status(500).send("Server error");
  }
});

/* ================= START SERVER ================= */

app.listen(5002, () => {
  console.log("🚀 Server running on http://localhost:5002");
});