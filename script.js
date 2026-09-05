// ---------- Live-style mandi ticker (mock data, styled to look like a live feed) ----------
  const tickerData = [
    { crop:"Tomato", icon:"tomato", price:1650, dir:"up" },
    { crop:"Onion", icon:"onion", price:1420, dir:"down" },
    { crop:"Wheat", icon:"wheat", price:2210, dir:"up" },
    { crop:"Potato", icon:"potato", price:980, dir:"down" },
  ];

  const icons = {
    tomato: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="14" r="7" fill="#bd4130"/><path d="M9 8c1-2 5-2 6 0" stroke="#4c7a44" stroke-width="2" stroke-linecap="round"/></svg>`,
    onion: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 5c4 2 6 6 6 10a6 6 0 01-12 0c0-4 2-8 6-10z" fill="#e6a419"/><path d="M12 3v3" stroke="#4c7a44" stroke-width="2"/></svg>`,
    wheat: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18" stroke="#c98a0e" stroke-width="2"/><path d="M12 6l-4 2M12 6l4 2M12 10l-4 2M12 10l4 2M12 14l-4 2M12 14l4 2" stroke="#e6a419" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    potato: `<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="13" rx="7" ry="6" fill="#b76e44"/></svg>`
  };

  function renderTicker(){
    const body = document.getElementById('ticker-body');
    body.innerHTML = tickerData.map(item => `
      <div class="ticker-row">
        <div class="ticker-crop">${icons[item.icon]}<span>${item.crop}</span></div>
        <div class="ticker-price ${item.dir}">₹${item.price}/qtl ${item.dir === 'up' ? '↑' : '↓'}</div>
      </div>
    `).join('');
    document.getElementById('ticker-date').textContent = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  }
  renderTicker();

  // ---------- Buyer listing grid ----------
  const listings = [
    { crop:"Tomato", icon:"tomato", qty:"20 quintals", loc:"Baheri, UP", asking:1700, market:1650 },
    { crop:"Onion", icon:"onion", qty:"35 quintals", loc:"Nashik, MH", asking:1380, market:1420 },
    { crop:"Wheat", icon:"wheat", qty:"50 quintals", loc:"Karnal, HR", asking:2250, market:2210 },
    { crop:"Potato", icon:"potato", qty:"40 quintals", loc:"Agra, UP", asking:1020, market:980 },
    { crop:"Tomato", icon:"tomato", qty:"12 quintals", loc:"Kolar, KA", asking:1600, market:1650 },
    { crop:"Wheat", icon:"wheat", qty:"28 quintals", loc:"Bathinda, PB", asking:2180, market:2210 },
  ];

  function renderListings(){
    const grid = document.getElementById('listing-grid');
    grid.innerHTML = listings.map((l, i) => `
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
  renderListings();

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