## SHORT URL

A URL shortening service built with Node.js and Express, featuring time-based link expiration and click tracking.

## Features

- **Create Short Links** — Generate compact shortened URLs from long URLs
- **Time-Based Expiration** — Set optional start and end dates for link validity
- **Click Tracking** — Track clicks separately for mobile and desktop browsers
- **Persistent Storage** — URLs are saved to a JSON database file
- **Rate Limiting** — Protects the API with per-IP rate limiting (50 requests/minute)
- **In-Memory Cache** — Fast URL lookups with disk synchronization

## Installation

```bash
npm install
```

## Usage

Start the server:

```bash
npm start
```

The server runs on `http://localhost:3000`.

## API Endpoints

### POST /shorten

Creates a new shortened URL.

**Request Body:**

```json
{
  "originalUrl": "https://example.com/very/long/url",
  "startDate": "2026-03-01T00:00:00Z",
  "endDate": "2026-12-31T23:59:59Z"
}
```

- `originalUrl` (required): The URL to shorten
- `startDate` (optional): Link becomes active on this date (null = no lower bound)
- `endDate` (optional): Link expires on this date (null = no upper bound)

**Response:**

```json
{
  "message": "Link created successfully",
  "shortId": "a1b2c3d4",
  "shortUrl": "http://localhost:3000/a1b2c3d4",
  "record": { ... }
}
```

### GET /:shortId

Redirects to the original URL and logs the click if the link is active.

Returns a 404 "Ghost Link" page if:

- The short ID doesn't exist
- The link hasn't started yet (before startDate)
- The link has expired (after endDate)

## How It Works

1. **Shortened URLs** are stored in memory with a backup on disk (`database.json`)
2. **Time-Traveler Logic** — Links only work within their valid time window
3. **Browser Detection** — Distinguishes between mobile and desktop traffic
4. **Buffered Saves** — Uses a 2-second debounce to prevent disk contention

## Project Structure

```
server.js              # Main application file
database.json          # Persistent URL storage
package.json           # Dependencies and metadata
```

## Tech Stack

- **Express.js** — Web framework
- **Node.js fs** — File system for persistence
- **crypto** — Random ID generation
