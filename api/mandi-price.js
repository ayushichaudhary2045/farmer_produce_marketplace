// Vercel serverless function — proxies the Agmarknet request server-side.
// Browsers are blocked by CORS from calling api.data.gov.in directly, but a
// server-to-server call (this function -> data.gov.in) has no such restriction.
// The frontend calls this same-origin endpoint instead: /api/mandi-price
 
const AGMARKNET_API_KEY = "579b464db66ec23bdd000001d5f2cc335738412a6b00dec51";
const AGMARKNET_RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24";
 
module.exports = async (req, res) => {
  const { commodity, state, limit } = req.query;
 
  if (!commodity || !state) {
    res.status(400).json({ error: "commodity and state query params are required" });
    return;
  }
 
  const url = `https://api.data.gov.in/resource/${AGMARKNET_RESOURCE_ID}` +
              `?api-key=${AGMARKNET_API_KEY}&format=json` +
              `&filters[Commodity]=${encodeURIComponent(commodity)}` +
              `&filters[State]=${encodeURIComponent(state)}` +
              `&limit=${limit || 50}`;
 
  try {
    const apiRes = await fetch(url);
    const data = await apiRes.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch Agmarknet data" });
  }
};
 