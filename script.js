// ============ SahiBhaav — live Agmarknet integration ============
// NOTE: This API key is from the free, public data.gov.in catalog (Agmarknet dataset).
// For a production app, this call should go through your own backend so the key
// isn't exposed in client-side code. Fine for a hackathon demo/prototype.
 
const AGMARKNET_API_KEY = "579b464db66ec23bdd000001d5f2cc335738412a6b00dec51";
const AGMARKNET_RESOURCE_ID = "35985678-0d79-46b4-9ed6-6f13308a1d24";
const AGMARKNET_STATE = "Uttar Pradesh"; // change this to match your team's/demo region
 
const icons = {
  tomato: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="14" r="7" fill="#bd4130"/><path d="M9 8c1-2 5-2 6 0" stroke="#4c7a44" stroke-width="2" stroke-linecap="round"/></svg>`,
  onion: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 5c4 2 6 6 6 10a6 6 0 01-12 0c0-4 2-8 6-10z" fill="#e6a419"/><path d="M12 3v3" stroke="#4c7a44" stroke-width="2"/></svg>`,
  wheat: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18" stroke="#c98a0e" stroke-width="2"/><path d="M12 6l-4 2M12 6l4 2M12 10l-4 2M12 10l4 2M12 14l-4 2M12 14l4 2" stroke="#e6a419" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  potato: `<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="13" rx="7" ry="6" fill="#b76e44"/></svg>`
};
 
// Fallback data — used instantly on load, and again if the live API fails or is slow.
// This is the same "local caching" fallback strategy described in the feasibility slide.
const fallbackTicker = [
  { crop:"Tomato", icon:"tomato", price:1650, dir:"up" },
  { crop:"Onion", icon:"onion", price:1420, dir:"down" },
  { crop:"Wheat", icon:"wheat", price:2210, dir:"up" },
  { crop:"Potato", icon:"potato", price:980, dir:"down" },
];
 
const listings = [
  { crop:"Tomato", icon:"tomato", qty:"20 quintals", loc:"Baheri, UP", asking:1700, market:1650 },
  { crop:"Onion", icon:"onion", qty:"35 quintals", loc:"Nashik, MH", asking:1380, market:1420 },
  { crop:"Wheat", icon:"wheat", qty:"50 quintals", loc:"Karnal, HR", asking:2250, market:2210 },
  { crop:"Potato", icon:"potato", qty:"40 quintals", loc:"Agra, UP", asking:1020, market:980 },
  { crop:"Tomato", icon:"tomato", qty:"12 quintals", loc:"Kolar, KA", asking:1600, market:1650 },
  { crop:"Wheat", icon:"wheat", qty:"28 quintals", loc:"Bathinda, PB", asking:2180, market:2210 },
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
 
// ---------- Live Agmarknet fetch ----------
async function fetchCommodityPrice(commodity){
  const url = `https://api.data.gov.in/resource/${AGMARKNET_RESOURCE_ID}` +
              `?api-key=${AGMARKNET_API_KEY}&format=json` +
              `&filters[Commodity]=${encodeURIComponent(commodity)}` +
              `&filters[State]=${encodeURIComponent(AGMARKNET_STATE)}` +
              `&limit=50`;
 
  const res = await fetch(url);
  if(!res.ok) throw new Error('Agmarknet request failed');
  const data = await res.json();
  if(!data.records || data.records.length === 0) throw new Error('No records for ' + commodity);
 
  // Parse dd/mm/yyyy and sort newest first
  const parsed = data.records
    .map(r => ({ ...r, _date: parseDate(r.Arrival_Date) }))
    .filter(r => r._date && !isNaN(r.Modal_Price))
    .sort((a, b) => b._date - a._date);
 
  if(parsed.length === 0) throw new Error('No usable records for ' + commodity);
 
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
  const crops = [
    { crop:"Tomato", icon:"tomato" },
    { crop:"Onion", icon:"onion" },
    { crop:"Wheat", icon:"wheat" },
    { crop:"Potato", icon:"potato" },
  ];
 
  try{
    const results = await Promise.all(
      crops.map(c => fetchCommodityPrice(c.crop).then(r => ({ ...c, ...r })))
    );
 
    // Only treat as "live" if we actually got at least one real result
    const liveTicker = results.map(r => ({ crop:r.crop, icon:r.icon, price:r.price, dir:r.dir }));
    renderTicker(liveTicker, true);
 
    // Update the market price shown on buyer listings using live data where available
    const priceMap = {};
    results.forEach(r => { priceMap[r.crop] = r.price; });
    const liveListings = listings.map(l => ({
      ...l,
      market: priceMap[l.crop] !== undefined ? priceMap[l.crop] : l.market
    }));
    renderListings(liveListings);
 
  } catch(err){
    console.warn('Live Agmarknet fetch failed, using cached fallback data:', err);
    // Fallback already rendered on initial load — nothing else to do
  }
}
 
// ---------- Initial render (instant, uses fallback so the page never looks empty) ----------
renderTicker(fallbackTicker, false);
renderListings(listings);
 
// ---------- Then attempt to upgrade to live data ----------
loadLiveMandiData();
 
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
 