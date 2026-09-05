// Vercel serverless function — proxies the Agmarknet request server-side.
// Browsers are blocked by CORS from calling api.data.gov.in directly, but a
// server-to-server call (this function -> data.gov.in) has no such restriction.
// The frontend calls this same-origin endpoint instead: /api/mandi-price
 
// Environment variables take precedence, with fallback keys for demo environments.
const AGMARKNET_API_KEY = process.env.AGMARKNET_API_KEY || "579b464db66ec23bdd000001d5f2cc335738412a6b00dec51";
// 9ef84268-d588-465a-a308-a864a43d0070 is the official Agmarknet Current Daily Mandi Prices dataset
const AGMARKNET_RESOURCE_ID = process.env.AGMARKNET_RESOURCE_ID || "9ef84268-d588-465a-a308-a864a43d0070";

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { commodity, state, limit } = req.query || {};

  if (!commodity || !state) {
    res.status(400).json({ error: "commodity and state query params are required" });
    return;
  }

  const url = `https://api.data.gov.in/resource/${AGMARKNET_RESOURCE_ID}` +
              `?api-key=${AGMARKNET_API_KEY}&format=json` +
              `&filters[Commodity]=${encodeURIComponent(commodity)}` +
              `&filters[State]=${encodeURIComponent(state)}` +
              `&limit=${encodeURIComponent(limit || 50)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const apiRes = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await apiRes.json();

    if (!apiRes.ok || data.error) {
      res.setHeader('Cache-Control', 'no-cache');
      res.status(apiRes.status >= 400 ? apiRes.status : 502).json({
        error: data.error || data.message || "Failed to fetch Agmarknet data",
        records: []
      });
      return;
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-cache');
    res.status(500).json({
      error: "Failed to fetch Agmarknet data: " + (err.name === 'AbortError' ? 'Request timed out' : err.message),
      records: []
    });
  }
};

 