const express = require("express");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const DB_FILE = "database.json";

// in memeory caching/ init
let urlCache = new Map();

if (fs.existsSync(DB_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    urlCache = new Map(Object.entries(data));
  } catch (err) {
    console.error("Failed to load DB. Starting fresh.", err);
  }
}

// Buffered saving  (to prevent disklock)
let saveTimeout = null;
let isSaving = false;
let pendingSave = false;

function bufferedSave() {
  if (isSaving) {
    pendingSave = true;
    return;
  }

  if (!saveTimeout) {
    saveTimeout = setTimeout(() => {
      isSaving = true;
      saveTimeout = null;

      const dataToSave = JSON.stringify(Object.fromEntries(urlCache), null, 2);
      fs.writeFile(DB_FILE, dataToSave, "utf-8", (err) => {
        if (err) console.error("Disk save error:", err);
        isSaving = false;

        if (pendingSave) {
          pendingSave = false;
          bufferedSave();
        }
      });
    }, 2000);
  }
}

//404 HTML
const ghost404HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <title>404 - Ghost Link</title>
    <style>
        body { font-family: monospace; text-align: center; margin-top: 15%; background: #1a1a1a; color: #00ffcc; }
        h1 { font-size: 3rem; }
        p { font-size: 1.2rem; color: #aaa; }
    </style>
</head>
<body>
    <h1>👻 404 Not Found</h1>
    <p>Oops, This link no longer exists. It might be expired, deleted, or hasn't started yet.</p>
</body>
</html>
`;

// Rate limit middleware

const rateLimitMap = new Map();
function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 50;

  if (!rateLimitMap.has(ip) || now > rateLimitMap.get(ip).resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  const data = rateLimitMap.get(ip);
  data.count++;

  if (data.count > maxRequests) {
    return res
      .status(429)
      .json({ error: "429 Too Many Requests. Chill for a minute." });
  }
  next();
}

//endpoints
app.post("/shorten", rateLimiter, (req, res) => {
  const { originalUrl, startDate, endDate } = req.body;

  if (!originalUrl) {
    return res
      .status(400)
      .json({ error: "400 Bad Request: originalUrl is required." });
  }

  const shortId = crypto.randomBytes(4).toString("hex");
  const nowISO = new Date().toISOString();

  const record = {
    originalUrl,
    createdAt: nowISO,
    startDate: startDate != null ? new Date(startDate).toISOString() : null,
    endDate: endDate != null ? new Date(endDate).toISOString() : null,
    clicks: { mobile: 0, desktop: 0 },
  };

  urlCache.set(shortId, record);
  bufferedSave();

  res.status(201).json({
    message: "Link created successfully",
    shortId,
    shortUrl: `http://localhost:3000/${shortId}`,
    record,
  });
});

app.get("/:shortId", (req, res) => {
  const { shortId } = req.params;
  const record = urlCache.get(shortId);

  if (!record) {
    return res.status(404).send(ghost404HTML);
  }

  const now = new Date();
  const start = record.startDate ? new Date(record.startDate) : null;
  const end = record.endDate ? new Date(record.endDate) : null;

  if ((start && now < start) || (end && now > end)) {
    return res.status(404).send(ghost404HTML);
  }

  const userAgent = req.headers["user-agent"] || "";
  const isMobile =
    /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(
      userAgent,
    );

  if (isMobile) {
    record.clicks.mobile++;
  } else {
    record.clicks.desktop++;
  }

  urlCache.set(shortId, record);
  bufferedSave();

  res.redirect(302, record.originalUrl);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 URL Shortener running port ${PORT}`);
});
