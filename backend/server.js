require("dotenv").config();
const express = require("express");// its a from work for backend comes under Node.js
const cors = require("cors"); // this helps front end to send request to back end 
const axios = require("axios");// this is used to call external apis like google sheets


const app = express(); // storing express function in app variable

const { google } = require("googleapis");// storing in google var google api  

const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN
};
//google sheets connection
const auth = new google.auth.GoogleAuth({
  keyFile: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

app.use(cors()); //.use is middeleware 
app.use(express.json());

app.post("/api/register", async (req, res) => {
  const { name, email, phone, gender, district, role, captchaToken } = req.body;

  if (!name || name.trim().length < 2)
    return res.status(400).send("Invalid name");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).send("Invalid email");

  if (!/^[6-9]\d{9}$/.test(phone))
    return res.status(400).send("Invalid phone");

  if (!captchaToken)
    return res.status(400).send("Captcha required");

  try {
    // Verify captcha
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

    // Save to Google Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEET_ID,
      range: "Sheet1!A:G", // 7 columns
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            new Date().toLocaleString(),
            name,
            email,
            phone,
            gender,
            district,
            role
          ]
        ],
      },
    });

    console.log("Lead saved:", { name, email, phone, gender, district, role });

    return res.json({ success: true });

  } catch (error) {
    console.error("Server Error:", error.message);
    return res.status(500).send("Server error");
  }
});
app.listen(5002, () => {
  console.log("Server running on http://localhost:5002");
});