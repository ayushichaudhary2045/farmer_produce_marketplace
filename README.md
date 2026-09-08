# SahiBhaav — Digital Farmer Produce Marketplace

**Smart India Hackathon 2026 — PS #7 (Agriculture & FoodTech)**  
*Connecting Farmers Directly to Bulk Buyers with Real Mandi Rates and Transparent Bidding*

---

## Overview

**SahiBhaav** is an agricultural commerce platform engineered to eliminate exploitative intermediary commissions (saving farmers 10–20% per transaction). It provides:
1. **Live Mandi Rates:** Government market benchmark rates sourced from Agmarknet / `data.gov.in`.
2. **AI-Driven Price Prediction:** Trend modeling across arrival dates to forecast 7-day future price trajectories.
3. **Direct Bulk Bidding:** Verified buyers place transparent bids directly on farmer listings.
4. **SMS & WhatsApp Alerts:** Real-time notifications for farmers even on feature phones (designed for rural connectivity constraints).
5. **Fast Farmer Produce Listing:** Minimalist mobile-first OTP authentication without passwords or complex forms.

---

## Project Structure

```
farmer_produce_marketplace/
├── api/
│   └── mandi-price.js      # Serverless proxy function (CORS bypass & Agmarknet integration)
├── index.html              # Responsive, accessible single-page application
├── script.js               # Client-side caching, live fetching, bidding, and filtering logic
├── style.css               # Clean typography, responsive grid, dialogs, and animations
├── vercel.json             # Vercel deployment configuration
└── README.md               # Technical overview and documentation
```

---

## Getting Started

### Local Development

1. **Option A: Static Server (Quick Demo)**
   - Open `index.html` directly in any web browser, or serve with:
     ```bash
     python -m http.server 3000
     # or
     npx serve .
     ```
   - In static mode, high-fidelity cached benchmarks are used instantly with realistic trends and interactive bidding.

2. **Option B: Full Vercel Dev Mode (with Live Government API Proxy)**
   - Install Vercel CLI and run:
     ```bash
     npm i -g vercel
     vercel dev
     ```
   - The serverless proxy at `/api/mandi-price` will handle live data fetching from `api.data.gov.in`.

### Environment Variables (Optional for Custom Agmarknet API Key)

In your `.env` or Vercel Project Settings:
- `AGMARKNET_API_KEY`: Your data.gov.in API key.
- `AGMARKNET_RESOURCE_ID`: Mandi daily price dataset resource ID (defaults to `9ef84268-d588-465a-a308-a864a43d0070`).

---

## Key Features & Optimizations

- **Intelligent In-Memory Caching:** 5-minute TTL cache on frontend to prevent rate-limiting and redundant API round-trips.
- **Request Deduplication:** Collapses identical concurrent fetches into a single network promise.
- **Statistical AI Trend Projection:** Daily price aggregation eliminating intra-day multi-mandi variance with bounded predictions.
- **Persistent Bidding System:** Real-time modal for placing bids, stored in `localStorage` with buyer contact details.
- **Client-Side Search & Filters:** Instant zero-lag filtering by crop, location, price, and lot size.
- **Rural Connectivity Architecture:** Resilient fallbacks ensure zero empty states even during network disruptions.
- **Full Mobile Responsiveness:** Drawer navigation and adaptive card layouts down to 320px screens.
