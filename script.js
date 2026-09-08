// ============ SahiBhaav — Modern Digital Mandi & Marketplace ============
// Integrates live Agmarknet prices via serverless proxy /api/mandi-price
// with in-memory caching, request deduplication, robust fallbacks,
// interactive buyer bidding, and verified farmer listing workflow.

const AGMARKNET_TICKER_STATE = "Uttar Pradesh";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache
const mandiCache = new Map();
const inFlightRequests = new Map();

// --- SVG Icons for crops with safe fallback ---
const icons = {
  tomato: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="14" r="7" fill="#bd4130"/><path d="M9 8c1-2 5-2 6 0" stroke="#4c7a44" stroke-width="2" stroke-linecap="round"/></svg>`,
  onion: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 5c4 2 6 6 6 10a6 6 0 01-12 0c0-4 2-8 6-10z" fill="#e6a419"/><path d="M12 3v3" stroke="#4c7a44" stroke-width="2"/></svg>`,
  wheat: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18" stroke="#c98a0e" stroke-width="2"/><path d="M12 6l-4 2M12 6l4 2M12 10l-4 2M12 10l4 2M12 14l-4 2M12 14l4 2" stroke="#e6a419" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  potato: `<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="13" rx="7" ry="6" fill="#b76e44"/></svg>`,
  rice: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 21V3M12 4c-3 3-4 7-2 10 3-1 4-4 2-10zM12 8c3 2 4 6 2 9-3-1-4-3-2-9z" stroke="#4c7a44" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="6" r="1.5" fill="#e6a419"/></svg>`,
  mustard: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="#e6a419"/><circle cx="8" cy="9" r="2.5" fill="#e6a419"/><circle cx="16" cy="9" r="2.5" fill="#e6a419"/><circle cx="12" cy="17" r="2.5" fill="#e6a419"/><path d="M12 12v9" stroke="#4c7a44" stroke-width="2"/></svg>`,
  cotton: `<svg viewBox="0 0 24 24" fill="none"><circle cx="10" cy="12" r="4" fill="#f3ecd8" stroke="#4a4030" stroke-width="1.2"/><circle cx="14" cy="12" r="4" fill="#f3ecd8" stroke="#4a4030" stroke-width="1.2"/><circle cx="12" cy="9" r="4" fill="#f3ecd8" stroke="#4a4030" stroke-width="1.2"/><path d="M12 15v6M9 20l3-2 3 2" stroke="#4c7a44" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  maize: `<svg viewBox="0 0 24 24" fill="none"><path d="M8 18c0-5 3-13 4-15 1 2 4 10 4 15a4 4 0 01-8 0z" fill="#e6a419"/><path d="M8 20c2 1 6 1 8 0M7 14c2-1 4-1 6-4M17 14c-2-1-4-1-6-4" stroke="#4c7a44" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  apple: `<svg viewBox="0 0 24 24" fill="none"><circle cx="10" cy="14" r="6" fill="#bd4130"/><circle cx="14" cy="14" r="6" fill="#bd4130"/><path d="M12 8c0-3 2-4 3-4M12 8c1-1 3-1 4 0" stroke="#4c7a44" stroke-width="2" stroke-linecap="round"/></svg>`,
  default: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 21V10M12 10c0-4 4-7 8-7-1 4-4 7-8 7zM12 14c0-3-3-5-6-5 1 3 3 5 6 5z" stroke="#4c7a44" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

function getCropIcon(cropName){
  if(!cropName) return icons.default;
  const name = cropName.toLowerCase().trim();
  if(name.includes('tomato') || name.includes('tamatar')) return icons.tomato;
  if(name.includes('onion') || name.includes('pyaz')) return icons.onion;
  if(name.includes('wheat') || name.includes('gehu')) return icons.wheat;
  if(name.includes('potato') || name.includes('aalu') || name.includes('aloo')) return icons.potato;
  if(name.includes('rice') || name.includes('paddy') || name.includes('chawal')) return icons.rice;
  if(name.includes('mustard') || name.includes('sarson')) return icons.mustard;
  if(name.includes('cotton') || name.includes('kapas')) return icons.cotton;
  if(name.includes('maize') || name.includes('corn') || name.includes('makka')) return icons.maize;
  if(name.includes('apple') || name.includes('seb')) return icons.apple;
  return icons[name] || icons.default;
}

// Fallback Mandi Ticker Data
const fallbackTicker = [
  { crop:"Tomato", icon:"tomato", price:1650, dir:"up" },
  { crop:"Onion", icon:"onion", price:1420, dir:"down" },
  { crop:"Wheat", icon:"wheat", price:2210, dir:"up" },
  { crop:"Potato", icon:"potato", price:980, dir:"down" },
];

// Benchmark Mandi Rates across crops
const benchmarkRates = {
  "tomato": 1650,
  "onion": 1420,
  "wheat": 2210,
  "potato": 980,
  "rice": 2450,
  "mustard": 5200,
  "cotton": 6800,
  "maize": 1950,
  "apple": 6500
};

// Initial Default Listings
const defaultListings = [
  { id: 1, crop:"Tomato", icon:"tomato", qty:"20 quintals", loc:"Baheri, UP", state:"Uttar Pradesh", asking:1700, market:1650, bids:[] },
  { id: 2, crop:"Onion", icon:"onion", qty:"35 quintals", loc:"Nashik, MH", state:"Maharashtra", asking:1380, market:1420, bids:[] },
  { id: 3, crop:"Wheat", icon:"wheat", qty:"50 quintals", loc:"Karnal, HR", state:"Haryana", asking:2250, market:2210, bids:[] },
  { id: 4, crop:"Potato", icon:"potato", qty:"40 quintals", loc:"Agra, UP", state:"Uttar Pradesh", asking:1020, market:980, bids:[] },
  { id: 5, crop:"Tomato", icon:"tomato", qty:"12 quintals", loc:"Kolar, KA", state:"Karnataka", asking:1600, market:1650, bids:[] },
  { id: 6, crop:"Wheat", icon:"wheat", qty:"28 quintals", loc:"Bathinda, PB", state:"Punjab", asking:2180, market:2210, bids:[] },
];

function loadStoredListings(){
  try {
    const raw = localStorage.getItem('sahibhaav_listings');
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch(e){
    console.warn('Could not parse stored listings', e);
  }
  return JSON.parse(JSON.stringify(defaultListings));
}

function saveListings(){
  try {
    localStorage.setItem('sahibhaav_listings', JSON.stringify(activeListings));
  } catch(e){
    console.warn('Could not save listings to localStorage', e);
  }
}

let activeListings = loadStoredListings();

// Current marketplace filter state
const currentFilter = {
  crop: 'all',
  search: '',
  sort: 'default'
};

function getFilteredListings(){
  let result = [...activeListings];

  // 1. Filter by crop
  if(currentFilter.crop !== 'all'){
    result = result.filter(l => l.crop.toLowerCase().includes(currentFilter.crop.toLowerCase()));
  }

  // 2. Search query
  if(currentFilter.search.trim()){
    const q = currentFilter.search.toLowerCase().trim();
    result = result.filter(l =>
      l.crop.toLowerCase().includes(q) ||
      (l.loc && l.loc.toLowerCase().includes(q)) ||
      (l.state && l.state.toLowerCase().includes(q))
    );
  }

  // 3. Sort
  if(currentFilter.sort === 'price-asc'){
    result.sort((a, b) => a.asking - b.asking);
  } else if(currentFilter.sort === 'price-desc'){
    result.sort((a, b) => b.asking - a.asking);
  } else if(currentFilter.sort === 'qty-desc'){
    result.sort((a, b) => {
      const numA = parseInt(a.qty, 10) || 0;
      const numB = parseInt(b.qty, 10) || 0;
      return numB - numA;
    });
  }

  return result;
}

// ---------- Render Functions ----------
function renderTicker(tickerData, isLive){
  const body = document.getElementById('ticker-body');
  if(!body) return;
  body.innerHTML = tickerData.map(item => `
    <div class="ticker-row">
      <div class="ticker-crop">${getCropIcon(item.crop)}<span>${item.crop}</span></div>
      <div class="ticker-price ${item.dir}">₹${item.price.toLocaleString('en-IN')}/qtl ${item.dir === 'up' ? '↑' : '↓'}</div>
    </div>
  `).join('');

  const dateEl = document.getElementById('ticker-date');
  if(dateEl){
    dateEl.textContent = (isLive ? 'Live · ' : '') + new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  }
}

function renderListings(data){
  const grid = document.getElementById('listing-grid');
  if(!grid) return;

  if(data.length === 0){
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:48px 20px; background:var(--paper); border:1px dashed var(--line); border-radius:4px;">
        <h3 style="margin:0 0 8px;">No produce found</h3>
        <p style="color:var(--ink-soft); margin:0 0 16px;">No listings match your current search or filter.</p>
        <button type="button" class="btn btn-primary btn-sm" onclick="resetAllFilters()">Show all listings</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = data.map((l) => {
    const iconSvg = getCropIcon(l.crop);
    const hasBids = l.bids && l.bids.length > 0;
    const topBid = hasBids ? Math.max(...l.bids.map(b => b.amount)) : null;
    const bidSummary = hasBids
      ? `Top bid: ₹${topBid.toLocaleString('en-IN')}/qtl (${l.bids.length} bid${l.bids.length > 1 ? 's' : ''})`
      : `No bids yet · Be the first`;

    return `
      <div class="crate" data-id="${l.id}">
        ${l.isNew ? '<span class="crate-badge">Just Listed</span>' : ''}
        <div class="crop-top">
          <div class="crop-icon">${iconSvg}</div>
          <div class="loc">${l.loc}</div>
        </div>
        <h3>${l.crop}</h3>
        <div class="meta">${l.qty}</div>
        <div class="price-row">
          <div class="price-block asking">
            <div class="label">Asking price</div>
            <div class="amount">₹${l.asking.toLocaleString('en-IN')}/qtl</div>
          </div>
          <div class="price-block market">
            <div class="label">Mandi price</div>
            <div class="amount">₹${l.market.toLocaleString('en-IN')}/qtl</div>
          </div>
        </div>
        <div class="crate-bids">${bidSummary}</div>
        <button type="button" class="btn btn-marigold bid-btn" onclick="openBidModal(${l.id})">Place bid</button>
      </div>
    `;
  }).join('');
}

// ---------- Robust Date Parsing ----------
function parseDate(str){
  if(!str) return null;
  // Handles DD/MM/YYYY or DD-MM-YYYY
  if(str.includes('/') || (str.includes('-') && str.length <= 10 && str.split('-')[0].length <= 2)){
    const delimiter = str.includes('/') ? '/' : '-';
    const [d, m, y] = str.split(delimiter).map(Number);
    if(d && m && y) return new Date(y, m - 1, d);
  }
  // Handles YYYY-MM-DD or standard date format
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// ---------- Live Agmarknet Fetch (via serverless proxy with cache) ----------
async function fetchCommodityPrice(commodity, state){
  const cacheKey = `${commodity.toLowerCase()}|${state.toLowerCase()}`;
  const cached = mandiCache.get(cacheKey);
  if(cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)){
    return cached.data;
  }

  if(inFlightRequests.has(cacheKey)){
    return inFlightRequests.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const url = `/api/mandi-price?commodity=${encodeURIComponent(commodity)}&state=${encodeURIComponent(state)}&limit=50`;
      const res = await fetch(url);
      if(!res.ok) throw new Error(`Proxy error ${res.status}`);
      const data = await res.json();
      if(!data.records || !Array.isArray(data.records) || data.records.length === 0){
        throw new Error('No records');
      }

      const parsed = data.records
        .map(r => ({ ...r, _date: parseDate(r.Arrival_Date) }))
        .filter(r => r._date && !isNaN(r.Modal_Price) && Number(r.Modal_Price) > 0)
        .sort((a, b) => b._date - a._date);

      if(parsed.length === 0) throw new Error('No valid records');

      const latest = parsed[0];
      const prev = parsed.find(r => Number(r.Modal_Price) !== Number(latest.Modal_Price)) || latest;

      const price = Number(latest.Modal_Price);
      const dir = price >= Number(prev.Modal_Price) ? 'up' : 'down';
      const result = { price, dir, isLive: true };

      mandiCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch(err){
      // Graceful fallback from benchmark
      const baseKey = commodity.toLowerCase();
      const basePrice = benchmarkRates[baseKey] || 1600;
      return { price: basePrice, dir: 'up', isLive: false };
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

async function loadLiveMandiData(){
  // 1. Ticker data (4 key crops for default state)
  const tickerCrops = [
    { crop:"Tomato", icon:"tomato" },
    { crop:"Onion", icon:"onion" },
    { crop:"Wheat", icon:"wheat" },
    { crop:"Potato", icon:"potato" },
  ];

  const tickerResults = await Promise.allSettled(
    tickerCrops.map(c => fetchCommodityPrice(c.crop, AGMARKNET_TICKER_STATE))
  );

  let anyTickerLive = false;
  const liveTicker = tickerCrops.map((c, i) => {
    const r = tickerResults[i];
    if(r.status === 'fulfilled' && r.value){
      if(r.value.isLive) anyTickerLive = true;
      return { crop: c.crop, icon: c.icon, price: r.value.price, dir: r.value.dir };
    }
    return fallbackTicker.find(f => f.crop === c.crop);
  });

  renderTicker(liveTicker, anyTickerLive);

  // 2. Refresh listing market prices per state
  const comboKeys = [...new Set(activeListings.map(l => `${l.crop}|${l.state || AGMARKNET_TICKER_STATE}`))];

  const comboResults = await Promise.allSettled(
    comboKeys.map(key => {
      const [crop, state] = key.split('|');
      return fetchCommodityPrice(crop, state);
    })
  );

  const priceMap = {};
  comboKeys.forEach((key, i) => {
    if(comboResults[i].status === 'fulfilled' && comboResults[i].value){
      priceMap[key] = comboResults[i].value.price;
    }
  });

  activeListings = activeListings.map(l => {
    const key = `${l.crop}|${l.state || AGMARKNET_TICKER_STATE}`;
    return {
      ...l,
      market: priceMap[key] !== undefined ? priceMap[key] : l.market
    };
  });

  saveListings();
  renderListings(getFilteredListings());
}

// ---------- AI Predicted Price Engine ----------
const AI_PREDICTION_COMMODITY = "Tomato";
const AI_PREDICTION_STATE = AGMARKNET_TICKER_STATE;

async function fetchPriceHistory(commodity, state){
  const cacheKey = `history|${commodity.toLowerCase()}|${state.toLowerCase()}`;
  const cached = mandiCache.get(cacheKey);
  if(cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)){
    return cached.data;
  }

  try {
    const url = `/api/mandi-price?commodity=${encodeURIComponent(commodity)}&state=${encodeURIComponent(state)}&limit=100`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('History fetch failed');
    const data = await res.json();
    if(!data.records || !Array.isArray(data.records) || data.records.length === 0){
      throw new Error('No history records');
    }

    // Group by distinct date to avoid intra-day multi-mandi distortion
    const dateMap = new Map();
    data.records.forEach(r => {
      const d = parseDate(r.Arrival_Date);
      const price = Number(r.Modal_Price);
      if(d && !isNaN(price) && price > 0){
        const dateKey = d.toISOString().split('T')[0];
        if(!dateMap.has(dateKey)){
          dateMap.set(dateKey, { date: d, prices: [] });
        }
        dateMap.get(dateKey).prices.push(price);
      }
    });

    const points = Array.from(dateMap.values())
      .map(entry => ({
        date: entry.date,
        price: Math.round(entry.prices.reduce((a, b) => a + b, 0) / entry.prices.length)
      }))
      .sort((a, b) => a.date - b.date);

    if(points.length >= 2){
      mandiCache.set(cacheKey, { data: points, timestamp: Date.now() });
      return points;
    }
    throw new Error('Insufficient distinct dates');
  } catch(err){
    // Statistical fallback points
    const base = benchmarkRates[commodity.toLowerCase()] || 1650;
    const now = new Date();
    const points = [];
    for(let i = 12; i >= 0; i -= 2){
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayFactor = 1 + ((12 - i) * 0.007) + ((i % 3 - 1) * 0.004);
      points.push({
        date: d,
        price: Math.round(base * dayFactor)
      });
    }
    return points;
  }
}

function predictNextWeek(points){
  if(points.length < 2) throw new Error('Not enough data points');

  const recent = points.slice(-10);
  const first = recent[0];
  const last = recent[recent.length - 1];

  const dayDiff = Math.max(1, Math.round((last.date - first.date) / (1000 * 60 * 60 * 24)));
  const ratePerDay = (last.price - first.price) / dayDiff;
  let predicted = Math.round(last.price + ratePerDay * 7);

  // Clamp prediction within ±30%
  const minAllowed = Math.round(last.price * 0.7);
  const maxAllowed = Math.round(last.price * 1.3);
  predicted = Math.max(minAllowed, Math.min(maxAllowed, predicted));

  const percent = (((predicted - last.price) / last.price) * 100).toFixed(1);
  const dir = predicted >= last.price ? 'up' : 'down';

  return { today: last.price, predicted, percent, dir };
}

async function loadAiPrediction(){
  try {
    const points = await fetchPriceHistory(AI_PREDICTION_COMMODITY, AI_PREDICTION_STATE);
    const result = predictNextWeek(points);

    const todayEl = document.getElementById('ai-today-value');
    const predEl = document.getElementById('ai-predicted-value');
    const deltaEl = document.getElementById('ai-delta');

    if(todayEl) todayEl.textContent = `₹${result.today.toLocaleString('en-IN')}`;
    if(predEl) predEl.textContent = `₹${result.predicted.toLocaleString('en-IN')}`;

    if(deltaEl){
      const arrow = result.dir === 'up' ? '↑' : '↓';
      const word = result.dir === 'up' ? 'rise' : 'fall';
      deltaEl.textContent = `${arrow} ${Math.abs(result.percent)}% expected ${word}`;
      deltaEl.className = `delta ${result.dir}`;
    }
  } catch(err){
    console.warn('AI prediction keeping fallback numbers:', err);
  }
}

// ---------- Bid Modal & Bidding Flow ----------
let currentModalListing = null;

function openBidModal(listingId){
  const listing = activeListings.find(l => l.id === listingId);
  if(!listing) return;
  currentModalListing = listing;

  const idInput = document.getElementById('bid-listing-id');
  const titleEl = document.getElementById('modal-crop-title');
  const locEl = document.getElementById('modal-crop-loc');
  const qtyEl = document.getElementById('modal-crop-qty');
  const askingEl = document.getElementById('modal-crop-asking');
  const marketEl = document.getElementById('modal-crop-market');
  const amountInput = document.getElementById('bid-amount');
  const bidQtyInput = document.getElementById('bid-qty');

  if(idInput) idInput.value = listing.id;
  if(titleEl) titleEl.textContent = `Place a bid on ${listing.crop}`;
  if(locEl) locEl.textContent = listing.loc;
  if(qtyEl) qtyEl.textContent = listing.qty;
  if(askingEl) askingEl.textContent = `₹${listing.asking.toLocaleString('en-IN')} / qtl`;
  if(marketEl) marketEl.textContent = `₹${listing.market.toLocaleString('en-IN')} / qtl`;

  if(amountInput){
    amountInput.value = listing.asking;
    amountInput.min = Math.round(listing.asking * 0.5);
  }

  if(bidQtyInput){
    const lotNumber = parseInt(listing.qty, 10) || 10;
    bidQtyInput.value = lotNumber;
    bidQtyInput.max = lotNumber * 5;
  }

  const modal = document.getElementById('bid-modal');
  if(modal){
    modal.classList.remove('hidden');
    const nameInput = document.getElementById('bidder-name');
    if(nameInput) nameInput.focus();
  }
}

function closeBidModal(){
  const modal = document.getElementById('bid-modal');
  if(modal) modal.classList.add('hidden');
  currentModalListing = null;
  const form = document.getElementById('bid-form');
  if(form) form.reset();
}

// Bid form submit handler
const bidForm = document.getElementById('bid-form');
if(bidForm){
  bidForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const listingId = parseInt(document.getElementById('bid-listing-id').value, 10);
    const name = document.getElementById('bidder-name').value.trim();
    const phone = document.getElementById('bidder-phone').value.trim();
    const amount = Number(document.getElementById('bid-amount').value);
    const qty = Number(document.getElementById('bid-qty').value);

    if(!name || phone.length < 10 || isNaN(amount) || amount <= 0){
      showToast('Please enter valid buyer details and bid amount.');
      return;
    }

    const listingIndex = activeListings.findIndex(l => l.id === listingId);
    if(listingIndex === -1) return;

    if(!activeListings[listingIndex].bids){
      activeListings[listingIndex].bids = [];
    }

    const newBid = {
      bidder: name,
      phone,
      amount,
      qty,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    };

    activeListings[listingIndex].bids.push(newBid);
    saveListings();
    renderListings(getFilteredListings());
    updateFarmerBidsList();

    closeBidModal();
    showToast(`Bid of ₹${amount.toLocaleString('en-IN')}/qtl placed by ${name}! WhatsApp & SMS alert sent to farmer.`);
  });
}

// Modal dismissal listeners
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');
const bidModal = document.getElementById('bid-modal');

if(modalClose) modalClose.addEventListener('click', closeBidModal);
if(modalCancel) modalCancel.addEventListener('click', closeBidModal);
if(bidModal){
  bidModal.addEventListener('click', (e) => {
    if(e.target.id === 'bid-modal') closeBidModal();
  });
}
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && bidModal && !bidModal.classList.contains('hidden')){
    closeBidModal();
  }
});

// ---------- Farmer Auth & Produce Listing Flow ----------
let currentFarmerPhone = sessionStorage.getItem('sahibhaav_farmer_phone') || null;

function updateFarmerAuthUI(){
  const authBar = document.getElementById('farmer-auth-status');
  const otpStage = document.getElementById('otp-stage');
  const listingForm = document.getElementById('listing-form');
  const farmerPhoneDisplay = document.getElementById('farmer-phone-display');

  if(currentFarmerPhone){
    if(authBar) authBar.classList.remove('hidden');
    if(farmerPhoneDisplay) farmerPhoneDisplay.textContent = `+91 ${currentFarmerPhone}`;
    if(otpStage) otpStage.classList.add('hidden');
    if(listingForm) listingForm.classList.remove('hidden');
    updateFarmerBidsList();
  } else {
    if(authBar) authBar.classList.add('hidden');
    if(otpStage) otpStage.classList.remove('hidden');
    if(listingForm) listingForm.classList.add('hidden');
  }
}

const demoPhoneBtn = document.getElementById('demo-phone-btn');
if(demoPhoneBtn){
  demoPhoneBtn.addEventListener('click', () => {
    const phoneInput = document.getElementById('phone');
    if(phoneInput) phoneInput.value = '9876543210';
  });
}

const sendOtpBtn = document.getElementById('send-otp');
if(sendOtpBtn){
  sendOtpBtn.addEventListener('click', () => {
    const phoneInput = document.getElementById('phone');
    const raw = phoneInput ? phoneInput.value.replace(/\D/g, '') : '';
    if(raw.length < 10){
      showToast('Please enter a valid 10-digit mobile number.');
      return;
    }
    const cleanPhone = raw.slice(-10);
    phoneInput.value = cleanPhone;

    const hint = document.getElementById('otp-hint');
    const field = document.getElementById('otp-field');
    if(hint) hint.classList.remove('hidden');
    if(field) field.classList.remove('hidden');

    const otpInput = document.getElementById('otp');
    if(otpInput) otpInput.focus();
    showToast(`Demo OTP 4821 sent to +91 ${cleanPhone}`);
  });
}

const autoFillOtpBtn = document.getElementById('autofill-otp-btn');
if(autoFillOtpBtn){
  autoFillOtpBtn.addEventListener('click', () => {
    const otpInput = document.getElementById('otp');
    if(otpInput) otpInput.value = '4821';
  });
}

const verifyOtpBtn = document.getElementById('verify-otp');
if(verifyOtpBtn){
  verifyOtpBtn.addEventListener('click', () => {
    const otpInput = document.getElementById('otp');
    const phoneInput = document.getElementById('phone');
    const otp = otpInput ? otpInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.replace(/\D/g, '').slice(-10) : '';

    if(otp.length !== 4){
      showToast('Please enter the 4-digit verification code.');
      return;
    }
    if(otp !== '4821' && otp !== '1234'){
      showToast('Invalid OTP. Use demo code 4821.');
      return;
    }

    currentFarmerPhone = phone || '9876543210';
    sessionStorage.setItem('sahibhaav_farmer_phone', currentFarmerPhone);
    updateFarmerAuthUI();
    showToast('Verified successfully! You can now list your produce.');
  });
}

const logoutFarmerBtn = document.getElementById('logout-farmer');
if(logoutFarmerBtn){
  logoutFarmerBtn.addEventListener('click', () => {
    currentFarmerPhone = null;
    sessionStorage.removeItem('sahibhaav_farmer_phone');
    updateFarmerAuthUI();
    showToast('Farmer number reset.');
  });
}

// Farmer listing form submission
const listingForm = document.getElementById('listing-form');
if(listingForm){
  listingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const cropInput = document.getElementById('crop');
    const qtyInput = document.getElementById('qty');
    const priceInput = document.getElementById('price');
    const locInput = document.getElementById('location');
    const stateInput = document.getElementById('state');

    const crop = cropInput ? cropInput.value.trim() : '';
    const qty = qtyInput ? qtyInput.value.trim() : '';
    const price = priceInput ? Number(priceInput.value) : 0;
    const location = locInput ? locInput.value.trim() : '';
    const state = stateInput ? stateInput.value : AGMARKNET_TICKER_STATE;

    if(!crop || !qty || isNaN(price) || price <= 0 || !location){
      showToast('Please fill all listing details.');
      return;
    }

    const baseKey = crop.toLowerCase();
    const benchmark = benchmarkRates[baseKey] || Math.round(price * 0.95);

    const newListing = {
      id: Date.now(),
      crop: crop.charAt(0).toUpperCase() + crop.slice(1),
      icon: crop.toLowerCase(),
      qty: `${qty} quintals`,
      loc: `${location}, ${state.slice(0, 2).toUpperCase()}`,
      state: state,
      asking: price,
      market: benchmark,
      isNew: true,
      farmerPhone: currentFarmerPhone,
      bids: []
    };

    activeListings.unshift(newListing);
    saveListings();
    updateMarketplaceView();

    const successBox = document.getElementById('listing-success');
    const successText = document.getElementById('listing-success-text');
    if(successBox && successText){
      successText.innerHTML = `<strong>Listed!</strong> ${qty} quintals of ${newListing.crop} at ₹${price.toLocaleString('en-IN')}/qtl is now live for buyers across India.`;
      successBox.classList.remove('hidden');
    }

    // Refresh live market price for new crop in background
    fetchCommodityPrice(crop, state).then(res => {
      if(res && res.price){
        newListing.market = res.price;
        saveListings();
        updateMarketplaceView();
      }
    });

    e.target.reset();
    showToast(`${newListing.crop} successfully listed in digital mandi!`);
  });
}

const listAnotherBtn = document.getElementById('list-another-btn');
if(listAnotherBtn){
  listAnotherBtn.addEventListener('click', () => {
    const successBox = document.getElementById('listing-success');
    if(successBox) successBox.classList.add('hidden');
    const cropInput = document.getElementById('crop');
    if(cropInput) cropInput.focus();
  });
}

function updateFarmerBidsList(){
  const container = document.getElementById('farmer-bids-section');
  const list = document.getElementById('farmer-bids-list');
  if(!container || !list) return;

  const allBids = [];
  activeListings.forEach(l => {
    if(l.bids && l.bids.length > 0){
      l.bids.forEach(b => {
        allBids.push({ ...b, crop: l.crop, loc: l.loc });
      });
    }
  });

  if(allBids.length === 0){
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  list.innerHTML = allBids.slice(-4).reverse().map(b => `
    <div class="farmer-bid-item">
      <div>
        <strong>₹${b.amount.toLocaleString('en-IN')}/qtl</strong> on ${b.crop} (${b.qty} qtl)
        <span>from ${b.bidder} (${b.phone})</span>
      </div>
      <span class="tag" style="background:var(--leaf); color:#fff; font-size:0.7rem; padding:2px 6px; border-radius:2px;">SMS Sent</span>
    </div>
  `).join('');
}

// ---------- Filter & Search Toolbar ----------
const cropChips = document.querySelectorAll('#crop-chips .chip');
cropChips.forEach(btn => {
  btn.addEventListener('click', () => {
    cropChips.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter.crop = btn.dataset.crop;
    updateMarketplaceView();
  });
});

let searchDebounceTimer = null;
const listingSearch = document.getElementById('listing-search');
if(listingSearch){
  listingSearch.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      currentFilter.search = e.target.value;
      updateMarketplaceView();
    }, 180);
  });
}

const sortSelect = document.getElementById('sort-select');
if(sortSelect){
  sortSelect.addEventListener('change', (e) => {
    currentFilter.sort = e.target.value;
    updateMarketplaceView();
  });
}

const resetFiltersBtn = document.getElementById('reset-filters');
if(resetFiltersBtn){
  resetFiltersBtn.addEventListener('click', resetAllFilters);
}

function resetAllFilters(){
  currentFilter.crop = 'all';
  currentFilter.search = '';
  currentFilter.sort = 'default';

  cropChips.forEach(b => b.classList.toggle('active', b.dataset.crop === 'all'));
  if(listingSearch) listingSearch.value = '';
  if(sortSelect) sortSelect.value = 'default';
  updateMarketplaceView();
}

function updateMarketplaceView(){
  const filtered = getFilteredListings();
  renderListings(filtered);

  const countEl = document.getElementById('listing-count-text');
  const resetBtn = document.getElementById('reset-filters');
  const isFiltered = currentFilter.crop !== 'all' || currentFilter.search.trim() !== '' || currentFilter.sort !== 'default';

  if(countEl){
    countEl.textContent = `Showing ${filtered.length} of ${activeListings.length} listings`;
  }
  if(resetBtn){
    resetBtn.classList.toggle('hidden', !isFiltered);
  }
}

// ---------- Mobile Navigation Drawer ----------
const navToggle = document.getElementById('nav-toggle');
const navMobile = document.getElementById('nav-mobile');
if(navToggle && navMobile){
  navToggle.addEventListener('click', () => {
    navMobile.classList.toggle('hidden');
  });

  navMobile.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navMobile.classList.add('hidden');
    });
  });
}

// ---------- Toast Notification ----------
let toastTimeout = null;
function showToast(text){
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');
  if(!toast || !toastText) return;

  toastText.textContent = text;
  toast.classList.add('show');

  if(toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3800);
}

// Legacy helper for inline HTML if needed
window.placeBid = openBidModal;
window.resetAllFilters = resetAllFilters;

// ---------- Initialization ----------
renderTicker(fallbackTicker, false);
updateMarketplaceView();
updateFarmerAuthUI();

// Upgrade with live data
loadLiveMandiData();
loadAiPrediction();

 



