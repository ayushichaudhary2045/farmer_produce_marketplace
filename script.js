// ============ SahiBhaav — live Agmarknet integration (via same-origin proxy) ============
// The frontend never calls api.data.gov.in directly (browsers block that with a
// CORS error). Instead it calls our own /api/mandi-price endpoint (a Vercel
// serverless function), which fetches from Agmarknet server-side and returns
// the JSON. See /api/mandi-price.js for that proxy.
 
const AGMARKNET_TICKER_STATE = "Uttar Pradesh"; // default state shown in the hero ticker
 
const icons = {
  tomato: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="14" r="7" fill="#bd4130"/><path d="M9 8c1-2 5-2 6 0" stroke="#4c7a44" stroke-width="2" stroke-linecap="round"/></svg>`,
  onion: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 5c4 2 6 6 6 10a6 6 0 01-12 0c0-4 2-8 6-10z" fill="#e6a419"/><path d="M12 3v3" stroke="#4c7a44" stroke-width="2"/></svg>`,
  wheat: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18" stroke="#c98a0e" stroke-width="2"/><path d="M12 6l-4 2M12 6l4 2M12 10l-4 2M12 10l4 2M12 14l-4 2M12 14l4 2" stroke="#e6a419" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  potato: `<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="13" rx="7" ry="6" fill="#b76e44"/></svg>`
};
 
// Fallback data — rendered instantly, and again per-item if a live fetch fails.
const fallbackTicker = [
  { crop:"Tomato", icon:"tomato", price:1650, dir:"up" },
  { crop:"Onion", icon:"onion", price:1420, dir:"down" },
  { crop:"Wheat", icon:"wheat", price:2210, dir:"up" },
  { crop:"Potato", icon:"potato", price:980, dir:"down" },
];
 
// Each listing carries its own real state name (must match Agmarknet's "State" field values)
// so the live market price fetched matches where that produce actually is.
const listings = [
  { crop:"Tomato", icon:"tomato", qty:"20 quintals", loc:"Baheri, UP", state:"Uttar Pradesh", asking:1700, market:1650 },
  { crop:"Onion", icon:"onion", qty:"35 quintals", loc:"Nashik, MH", state:"Maharashtra", asking:1380, market:1420 },
  { crop:"Wheat", icon:"wheat", qty:"50 quintals", loc:"Karnal, HR", state:"Haryana", asking:2250, market:2210 },
  { crop:"Potato", icon:"potato", qty:"40 quintals", loc:"Agra, UP", state:"Uttar Pradesh", asking:1020, market:980 },
  { crop:"Tomato", icon:"tomato", qty:"12 quintals", loc:"Kolar, KA", state:"Karnataka", asking:1600, market:1650 },
  { crop:"Wheat", icon:"wheat", qty:"28 quintals", loc:"Bathinda, PB", state:"Punjab", asking:2180, market:2210 },
];
 
// ---------- Render functions ----------
function renderTicker(tickerData, isLive){
  const body = document.getElementById('ticker-body');
  body.innerHTML = tickerData.map(item => `
    <div class="ticker-row">
      <div class="ticker-crop">${icons[item.icon]}<span>${item.crop}</span></div>
      <div class="ticker-price ${item.dir}">₹${item.price}/qtl ${item.dir === 'up' ? '↑' : '↓'}</div>
    </div>
  `).join('');
  document.getElementById('ticker-date').textContent =
    (isLive ? 'Live · ' : '') + new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}
 
function renderListings(data){
  const grid = document.getElementById('listing-grid');
  grid.innerHTML = data.map((l, i) => `
    <div class="crate">
      <div class="crop-top">
        <div class="crop-icon">${icons[l.icon]}</div>
        <div class="loc">${l.loc}</div>
      </div>
      <h3>${l.crop}</h3>
      <div class="meta">${l.qty}</div>
      <div class="price-row">
        <div class="price-block asking">
          <div class="label">Asking price</div>
          <div class="amount">₹${l.asking}/qtl</div>
        </div>
        <div class="price-block market">
          <div class="label">Mandi price</div>
          <div class="amount">₹${l.market}/qtl</div>
        </div>
      </div>
      <button class="btn btn-marigold bid-btn" onclick="placeBid('${l.crop}', ${i})">Place bid</button>
    </div>
  `).join('');
}
 
// ---------- Live Agmarknet fetch (via our own /api/mandi-price proxy) ----------
async function fetchCommodityPrice(commodity, state){
  const url = `/api/mandi-price?commodity=${encodeURIComponent(commodity)}&state=${encodeURIComponent(state)}&limit=50`;
 
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Proxy request failed for ${commodity}/${state}`);
  const data = await res.json();
  if(!data.records || data.records.length === 0) throw new Error(`No records for ${commodity}/${state}`);
 
  const parsed = data.records
    .map(r => ({ ...r, _date: parseDate(r.Arrival_Date) }))
    .filter(r => r._date && !isNaN(r.Modal_Price))
    .sort((a, b) => b._date - a._date);
 
  if(parsed.length === 0) throw new Error(`No usable records for ${commodity}/${state}`);
 
  const latest = parsed[0];
  const prev = parsed.find(r => Number(r.Modal_Price) !== Number(latest.Modal_Price)) || latest;
 
  const price = Number(latest.Modal_Price);
  const dir = price >= Number(prev.Modal_Price) ? 'up' : 'down';
  return { price, dir };
}
 
function parseDate(str){
  if(!str) return null;
  const [d, m, y] = str.split('/').map(Number);
  if(!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}
 
async function loadLiveMandiData(){
  // ---- Ticker: 4 crops, single default state ----
  const tickerCrops = [
    { crop:"Tomato", icon:"tomato" },
    { crop:"Onion", icon:"onion" },
    { crop:"Wheat", icon:"wheat" },
    { crop:"Potato", icon:"potato" },
  ];
 
  const tickerResults = await Promise.allSettled(
    tickerCrops.map(c => fetchCommodityPrice(c.crop, AGMARKNET_TICKER_STATE))
  );
 
  const liveTicker = tickerCrops.map((c, i) => {
    const r = tickerResults[i];
    if(r.status === 'fulfilled'){
      return { crop:c.crop, icon:c.icon, price:r.value.price, dir:r.value.dir };
    }
    return fallbackTicker.find(f => f.crop === c.crop);
  });
  const anyTickerLive = tickerResults.some(r => r.status === 'fulfilled');
  renderTicker(liveTicker, anyTickerLive);
 
  // ---- Listings: each fetched using its OWN state ----
  const comboKeys = [...new Set(listings.map(l => `${l.crop}|${l.state}`))];
 
  const comboResults = await Promise.allSettled(
    comboKeys.map(key => {
      const [crop, state] = key.split('|');
      return fetchCommodityPrice(crop, state);
    })
  );
 
  const priceMap = {};
  comboKeys.forEach((key, i) => {
    if(comboResults[i].status === 'fulfilled'){
      priceMap[key] = comboResults[i].value.price;
    }
  });
 
  const liveListings = listings.map(l => {
    const key = `${l.crop}|${l.state}`;
    return {
      ...l,
      market: priceMap[key] !== undefined ? priceMap[key] : l.market
    };
  });
 
  renderListings(liveListings);
}
 
// ---------- AI predicted price (real trend from Agmarknet history, via proxy) ----------
const AI_PREDICTION_COMMODITY = "Tomato";
const AI_PREDICTION_STATE = AGMARKNET_TICKER_STATE;
 
async function fetchPriceHistory(commodity, state){
  const url = `/api/mandi-price?commodity=${encodeURIComponent(commodity)}&state=${encodeURIComponent(state)}&limit=100`;
 
  const res = await fetch(url);
  if(!res.ok) throw new Error('History fetch failed');
  const data = await res.json();
  if(!data.records || data.records.length === 0) throw new Error('No history records');
 
  const points = data.records
    .map(r => ({ date: parseDate(r.Arrival_Date), price: Number(r.Modal_Price) }))
    .filter(p => p.date && !isNaN(p.price))
    .sort((a, b) => a.date - b.date);
 
  return points;
}
 
function predictNextWeek(points){
  if(points.length < 2) throw new Error('Not enough data points to trend');
 
  const recent = points.slice(-15);
  const first = recent[0];
  const last = recent[recent.length - 1];
 
  const dayDiff = Math.max(1, Math.round((last.date - first.date) / (1000 * 60 * 60 * 24)));
  const ratePerDay = (last.price - first.price) / dayDiff;
  const predicted = Math.round(last.price + ratePerDay * 7);
 
  const percent = (((predicted - last.price) / last.price) * 100).toFixed(1);
  const dir = predicted >= last.price ? 'up' : 'down';
 
  return { today: last.price, predicted, percent, dir };
}
 
async function loadAiPrediction(){
  try{
    const points = await fetchPriceHistory(AI_PREDICTION_COMMODITY, AI_PREDICTION_STATE);
    const result = predictNextWeek(points);
 
    document.getElementById('ai-today-value').textContent = `₹${result.today.toLocaleString('en-IN')}`;
    document.getElementById('ai-predicted-value').textContent = `₹${result.predicted.toLocaleString('en-IN')}`;
 
    const arrow = result.dir === 'up' ? '↑' : '↓';
    const word = result.dir === 'up' ? 'rise' : 'fall';
    document.getElementById('ai-delta').textContent = `${arrow} ${Math.abs(result.percent)}% expected ${word}`;
 
  } catch(err){
    console.warn('AI prediction fetch failed, keeping static fallback numbers:', err);
  }
}
 
// ---------- Initial render (instant, uses fallback so the page never looks empty) ----------
renderTicker(fallbackTicker, false);
renderListings(listings);
 
// ---------- Then attempt to upgrade to live data ----------
loadLiveMandiData();
loadAiPrediction();
 
// ---------- Toast ----------
function showToast(text){
  const toast = document.getElementById('toast');
  document.getElementById('toast-text').textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3800);
}
 
function placeBid(crop, i){
  showToast(`Bid placed on ${crop}. WhatsApp alert sent to farmer (demo).`);
}
 
// ---------- Farmer OTP flow (demo/simulated) ----------
document.getElementById('send-otp').addEventListener('click', () => {
  const phone = document.getElementById('phone').value.trim();
  if(phone.length < 10){ alert('Enter a 10-digit phone number'); return; }
  document.getElementById('otp-hint').classList.remove('hidden');
  document.getElementById('otp-field').classList.remove('hidden');
});
 
document.getElementById('verify-otp').addEventListener('click', () => {
  const otp = document.getElementById('otp').value.trim();
  if(otp.length !== 4){ alert('Enter the 4-digit code'); return; }
  document.getElementById('otp-stage').classList.add('hidden');
  document.getElementById('listing-form').classList.remove('hidden');
});
 
document.getElementById('listing-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const crop = document.getElementById('crop').value;
  const qty = document.getElementById('qty').value;
  const price = document.getElementById('price').value;
  const box = document.getElementById('listing-success');
  box.textContent = `Listed! ${qty} quintals of ${crop} at ₹${price}/quintal is now visible to buyers near you.`;
  box.classList.remove('hidden');
  e.target.reset();
});
 



