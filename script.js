document.addEventListener('DOMContentLoaded', () => {
  function track(eventName, params = {}) {
    try { if (window.gtag) gtag('event', eventName, params); } catch (e) {}
    console.log('[track]', eventName, params);
  }

  // ----- Cart (localStorage) -----
  function getCart() {
    try { return JSON.parse(localStorage.getItem('mage_cart') || '[]'); } catch (e) { return []; }
  }
  function setCart(items) {
    try { localStorage.setItem('mage_cart', JSON.stringify(items)); } catch (e) {}
    updateCartSummary();
  }

  // ----- Nav -----
  const nav = document.querySelector('.nav');
  const navToggle = document.querySelector('.nav-toggle');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', nav.classList.contains('open'));
    });
  }
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', () => { nav.classList.remove('open'); });
  });

  // ----- Hero: tap to begin (game-style opening) -----
  const hero = document.getElementById('hero');
  const heroTapOverlay = document.getElementById('heroTapOverlay');
  const heroCursorGlow = document.getElementById('heroCursorGlow');
  const heroTapSuitsWrap = document.getElementById('heroTapSuitsWrap');
  const heroParticleBurst = document.getElementById('heroParticleBurst');
  const heroAudio = new Audio('assets/roll.mp3');

  function spawnParticles(container, count) {
    if (!container) return;
    const suits = ['♠', '♥', '♣', '♦'];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const dist = 100 + Math.random() * 150;
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist;
      const el = document.createElement('span');
      el.className = 'hero-particle';
      el.style.setProperty('--px', px + 'px');
      el.style.setProperty('--py', py + 'px');
      el.style.animationDelay = Math.random() * 0.08 + 's';
      if (i % 3 === 0) {
        el.textContent = suits[i % 4];
        el.style.width = el.style.height = '16px';
        el.style.marginLeft = el.style.marginTop = '-8px';
        el.style.fontSize = '12px';
        el.style.background = 'none';
        el.style.boxShadow = 'none';
        el.style.color = 'rgba(255,255,255,0.95)';
      }
      container.appendChild(el);
      setTimeout(() => el.remove(), 850);
    }
  }

  function startHero(ev) {
    if (!hero || hero.classList.contains('hero-started')) return;
    hero.classList.add('hero-started');
    hero.classList.add('hero-shake');
    setTimeout(() => hero.classList.remove('hero-shake'), 500);
    spawnParticles(heroParticleBurst, 28);
    try { heroAudio.currentTime = 0; heroAudio.play().catch(() => {}); } catch (e) {}
    if (window.gtag) gtag('event', 'hero_started');
  }

  if (heroTapOverlay) {
    heroTapOverlay.addEventListener('click', (e) => startHero(e));
    heroTapOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startHero(e); }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (hero && !hero.classList.contains('hero-started') && !e.target.matches('input, textarea')) {
      e.preventDefault();
      startHero(e);
    }
  });
  if (hero) {
    hero.addEventListener('click', (e) => {
      if (e.target.closest('.hero-tap-overlay') || e.target.closest('a') || e.target.closest('button')) return;
      if (hero.classList.contains('hero-started')) return;
      startHero(e);
    });
  }

  // Cursor-follow glow on overlay (before tap)
  if (heroTapOverlay && heroCursorGlow) {
    heroTapOverlay.addEventListener('mousemove', (e) => {
      if (hero.classList.contains('hero-started')) return;
      const rect = heroTapOverlay.getBoundingClientRect();
      heroCursorGlow.style.left = (e.clientX - rect.left) + 'px';
      heroCursorGlow.style.top = (e.clientY - rect.top) + 'px';
      heroCursorGlow.style.opacity = '1';
    });
    heroTapOverlay.addEventListener('mouseleave', () => { heroCursorGlow.style.opacity = '0'; });
  }

  // Suits follow mouse (parallax) before tap
  if (heroTapSuitsWrap && heroTapOverlay) {
    const suits = heroTapSuitsWrap.querySelectorAll('.hero-tap-suit');
    const baseTransforms = ['translate(-50%, -50%)', 'translate(50%, -50%)', 'translate(-50%, 50%)', 'translate(-50%, -50%)'];
    heroTapOverlay.addEventListener('mousemove', (e) => {
      if (hero.classList.contains('hero-started')) return;
      const rect = heroTapOverlay.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2)));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2)));
      const push = 14;
      const ax = [0, dx * push, 0, -dx * push];
      const ay = [-dy * push, dy * push * 0.6, dy * push, dy * push * 0.6];
      suits.forEach((s, i) => {
        s.style.transform = `${baseTransforms[i]} translate(${ax[i]}px, ${ay[i]}px)`;
        const d = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (d < 100) {
          s.style.color = 'rgba(255,255,255,0.7)';
          s.style.textShadow = '0 0 16px rgba(255,255,255,0.4)';
        } else {
          s.style.color = '';
          s.style.textShadow = '';
        }
      });
    });
    heroTapOverlay.addEventListener('mouseleave', () => {
      suits.forEach((s, i) => {
        s.style.transform = baseTransforms[i];
        s.style.color = '';
        s.style.textShadow = '';
      });
    });
  }

  // ----- Hero: mouse parallax (logo move with cursor after tap) -----
  const heroParallax = document.querySelector('.hero-logo-parallax');
  if (hero && heroParallax) {
    hero.addEventListener('mousemove', (e) => {
      if (!hero.classList.contains('hero-started')) return;
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      const dx = Math.round(x * 18);
      const dy = Math.round(y * 18);
      heroParallax.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    hero.addEventListener('mouseleave', () => { heroParallax.style.transform = ''; });
  }

  // ----- Smooth scroll -----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const id = this.getAttribute('href');
      if (id === '#') return;
      const el = document.querySelector(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  // ----- Roll the Mat demo -----
  const rollBtn = document.getElementById('rollBtn');
  const matDemo = document.querySelector('.mat-demo');
  const audio = new Audio('assets/roll.mp3');
  if (rollBtn && matDemo) {
    rollBtn.addEventListener('click', () => {
      const isRolled = matDemo.classList.contains('rolled-out');
      matDemo.classList.toggle('rolled-out', !isRolled);
      try { audio.currentTime = 0; audio.play().catch(() => {}); } catch (e) {}
      if (!isRolled) matDemo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      track(isRolled ? 'mat_folded' : 'mat_rolled');
    });
  }

  // ----- Add to Order (product cards → modal → cart) -----
  const modal = document.getElementById('modal');
  const buyForm = document.getElementById('buyForm');
  const quickSku = document.getElementById('quickSku');
  const quickName = document.getElementById('quickName');
  const qtyInput = document.getElementById('qty');
  const toast = document.getElementById('toast');
  const minusBtn = document.getElementById('minus');
  const plusBtn = document.getElementById('plus');

  function showToast(msg = 'Added to cart!') {
    if (!toast) { alert(msg); return; }
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
  }

  document.querySelectorAll('.btn-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const sku = btn.dataset.sku;
      const name = btn.dataset.name;
      const price = btn.dataset.price;
      if (!sku || !name) return;
      if (quickSku) quickSku.value = sku;
      if (quickName) quickName.textContent = name;
      if (qtyInput) qtyInput.value = 1;
      if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
      }
      track('open_add_modal', { sku, name });
    });
  });

  const closeBtn = document.querySelector('.modal .close');
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    });
  }
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  if (minusBtn && qtyInput) {
    minusBtn.addEventListener('click', () => {
      const v = Math.max(1, parseInt(qtyInput.value || '1', 10) - 1);
      qtyInput.value = v;
    });
  }
  if (plusBtn && qtyInput) {
    plusBtn.addEventListener('click', () => {
      const v = Math.max(1, parseInt(qtyInput.value || '1', 10) + 1);
      qtyInput.value = v;
    });
  }

  if (buyForm) {
    buyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const sku = quickSku ? quickSku.value : '';
      const name = quickName ? quickName.textContent : '';
      const qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : '1', 10));
      if (!sku) { showToast('Please select a product'); return; }
      const cart = getCart();
      const price = document.querySelector(`.btn-add[data-sku="${sku}"]`)?.dataset.price || '0';
      cart.push({ sku, name, price: parseFloat(price), qty, ts: Date.now() });
      setCart(cart);
      showToast('Added to cart!');
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      track('add_to_cart', { sku, quantity: qty });
    });
  }

  // ----- Cart summary (checkout) -----
  function updateCartSummary() {
    const cart = getCart();
    const cartItemsEl = document.getElementById('cartItems');
    const subtotalEl = document.getElementById('subtotal');
    const shippingEl = document.getElementById('shipping');
    const totalEl = document.getElementById('total');
    const countrySelect = document.getElementById('country');

    let subtotal = 0;
    cart.forEach(item => { subtotal += (item.price || 0) * (item.qty || 1); });

    if (cartItemsEl) {
      if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="cart-empty">Cart is empty. Add items from Shop.</p>';
      } else {
        cartItemsEl.innerHTML = cart.map((item, index) =>
          `<div class="cart-line" data-ts="${item.ts}" data-index="${index}">
            <button class="cart-dec" type="button">−</button>
            <span>${item.name} × ${item.qty} — $${(item.price * item.qty).toFixed(2)}</span>
          </div>`
        ).join('');
      }
    }
    if (subtotalEl) subtotalEl.textContent = '$' + subtotal.toFixed(2);

    const country = countrySelect ? countrySelect.value : '';
    let shipping = 0;
    if (country === 'US') shipping = subtotal >= 75 ? 0 : 8;
    else if (country === 'CN') shipping = subtotal >= 100 ? 0 : 12;
    else if (country && country !== '') shipping = 15;
    if (shippingEl) {
      shippingEl.textContent = shipping === 0 ? 'Free' : '$' + shipping.toFixed(2);
    }
    let total = subtotal + shipping;
    const giftWrap = document.getElementById('giftWrap');
    if (giftWrap && giftWrap.checked) total += 5;
    if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
  }

  if (document.getElementById('cartItems')) {
    const cartItemsEl = document.getElementById('cartItems');
    if (cartItemsEl && !cartItemsEl.dataset.bound) {
      cartItemsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.cart-dec');
        if (!btn) return;
        const line = btn.closest('.cart-line');
        if (!line) return;
        const ts = line.dataset.ts;
        const index = parseInt(line.dataset.index || '-1', 10);
        const cart = getCart();
        let idx = -1;
        if (ts) {
          idx = cart.findIndex(item => String(item.ts) === String(ts));
        }
        if (idx === -1 && index >= 0) idx = index;
        if (idx < 0) return;
        const sku = cart[idx]?.sku;
        if ((cart[idx].qty || 1) > 1) {
          cart[idx].qty -= 1;
        } else {
          cart.splice(idx, 1);
        }
        setCart(cart);
        track('cart_decrease', { sku });
      });
      cartItemsEl.dataset.bound = 'true';
    }
  }

  const countrySelect = document.getElementById('country');
  if (countrySelect) countrySelect.addEventListener('change', updateCartSummary);

  const giftWrap = document.getElementById('giftWrap');
  if (giftWrap) giftWrap.addEventListener('change', updateCartSummary);

  updateCartSummary();

  // ----- Testimonial carousel -----
  const slides = document.querySelectorAll('.testimonial-slide');
  let slideIndex = 0;
  function updateTestimonialSlides() {
    slides.forEach((s, i) => {
      s.style.display = i === slideIndex ? 'block' : 'none';
    });
  }
  if (slides && slides.length > 0) {
    updateTestimonialSlides();
    setInterval(() => {
      slideIndex = (slideIndex + 1) % slides.length;
      updateTestimonialSlides();
    }, 4000);
  }

  // ----- Checkout form -----
  const PAYMENT_API_URL = 'https://mage-payment-backend.onrender.com';

  const checkoutForm = document.getElementById('checkoutForm');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cart = getCart();
      if (cart.length === 0) {
        showToast('Your cart is empty. Add items from Shop.');
        return;
      }

      const placeOrderBtn = document.getElementById('placeOrderBtn');
      const originalText = placeOrderBtn ? placeOrderBtn.textContent : 'Place Order';

      const formData = new FormData(checkoutForm);
      const customer = {
        name: formData.get('name') || '',
        email: formData.get('email') || '',
        address: formData.get('address') || '',
      };

      const countrySelect = document.getElementById('country');
      const country = countrySelect ? countrySelect.value : '';
      let subtotal = 0;
      cart.forEach(item => { subtotal += (item.price || 0) * (item.qty || 1); });
      let shipping = 0;
      if (country === 'US') shipping = subtotal >= 75 ? 0 : 8;
      else if (country === 'CN') shipping = subtotal >= 100 ? 0 : 12;
      else if (country && country !== '') shipping = 15;

      const giftWrapEl = document.getElementById('giftWrap');
      const giftWrapChecked = giftWrapEl ? giftWrapEl.checked : false;

      if (placeOrderBtn) {
        placeOrderBtn.textContent = 'Processing...';
        placeOrderBtn.disabled = true;
      }

      try {
        const response = await fetch(`${PAYMENT_API_URL}/create-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cart: cart,
            shipping: shipping,
            gift_wrap: giftWrapChecked,
            customer: customer,
          }),
        });

        const data = await response.json();

        if (response.ok && data.checkout_url) {
          track('checkout_redirect', { total: subtotal + shipping + (giftWrapChecked ? 5 : 0) });
          window.location.href = data.checkout_url;
        } else {
          console.error('Checkout error:', data);
          const paymentModal = document.getElementById('paymentModal');
          if (paymentModal) {
            paymentModal.style.display = 'flex';
            paymentModal.setAttribute('aria-hidden', 'false');
          } else {
            showToast('Payment system unavailable. Please contact us to complete your order.');
          }
        }
      } catch (err) {
        console.error('Checkout fetch error:', err);
        const paymentModal = document.getElementById('paymentModal');
        if (paymentModal) {
          paymentModal.style.display = 'flex';
          paymentModal.setAttribute('aria-hidden', 'false');
        } else {
          showToast('Payment system unavailable. Please contact us to complete your order.');
        }
      } finally {
        if (placeOrderBtn) {
          placeOrderBtn.textContent = originalText;
          placeOrderBtn.disabled = false;
        }
      }

      track('checkout_submit');
    });
  }

  const paymentModal = document.getElementById('paymentModal');
  const paymentClose = document.querySelector('.payment-close');
  const paymentOk = document.getElementById('paymentModalOk');
  if (paymentModal) {
    if (paymentClose) paymentClose.addEventListener('click', () => { paymentModal.style.display = 'none'; paymentModal.setAttribute('aria-hidden', 'true'); });
    if (paymentOk) paymentOk.addEventListener('click', () => { paymentModal.style.display = 'none'; paymentModal.setAttribute('aria-hidden', 'true'); });
    paymentModal.addEventListener('click', (e) => { if (e.target === paymentModal) { paymentModal.style.display = 'none'; paymentModal.setAttribute('aria-hidden', 'true'); } });
  }

  // =====================================================
  // REAL MAGIC TRICK: The 21 Card Trick (经典21张牌魔术)
  // =====================================================
  
  const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = [
    { s: '♠', name: 'Spades', red: false },
    { s: '♥', name: 'Hearts', red: true },
    { s: '♣', name: 'Clubs', red: false },
    { s: '♦', name: 'Diamonds', red: true }
  ];
  const VALUE_NAMES = { A: 'Ace', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', J: 'Jack', Q: 'Queen', K: 'King' };

  // Magic state
  let magicState = {
    phase: 'intro',
    deck: [],
    round: 0,
    userCard: null,
  };

  function buildFullDeck() {
    const deck = [];
    for (const v of VALUES) {
      for (const suit of SUITS) {
        deck.push({ value: v, suit: suit.s, suitName: suit.name, red: suit.red });
      }
    }
    return deck;
  }

  function shuffleDeck(deck) {
    const a = [...deck];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getCardLabel(card) {
    return `${VALUE_NAMES[card.value] || card.value} of ${card.suitName}`;
  }

  function getCardHTML(card, index) {
    return `
      <div class="magic-card-new ${card.red ? 'red' : ''}" data-index="${index}">
        <div class="magic-card-inner">
          <div class="magic-card-front-new">
            <span class="corner top-left">
              <span class="card-value">${card.value}</span>
              <span class="card-suit-small">${card.suit}</span>
            </span>
            <span class="card-suit-center">${card.suit}</span>
            <span class="corner bottom-right">
              <span class="card-value">${card.value}</span>
              <span class="card-suit-small">${card.suit}</span>
            </span>
          </div>
        </div>
      </div>
    `;
  }

  function dealIntoColumns(deck) {
    const columns = [[], [], []];
    for (let i = 0; i < 21; i++) {
      columns[i % 3].push(deck[i]);
    }
    return columns;
  }

  function collectCards(columns, selectedCol) {
    const newDeck = [];
    const before = selectedCol === 0 ? 1 : 0;
    const after = selectedCol === 2 ? 1 : 2;
    
    for (const card of columns[before]) newDeck.push(card);
    for (const card of columns[selectedCol]) newDeck.push(card);
    for (const card of columns[after]) newDeck.push(card);
    
    return newDeck;
  }

  function renderMagicUI() {
    const magicContent = document.getElementById('magicContent');
    if (!magicContent) return;

    switch (magicState.phase) {
      case 'intro':
        renderIntro(magicContent);
        break;
      case 'memorize':
        renderMemorize(magicContent);
        break;
      case 'round1':
      case 'round2':
      case 'round3':
        renderRound(magicContent);
        break;
      case 'reveal':
        renderReveal(magicContent);
        break;
    }
  }

  function renderIntro(container) {
    container.innerHTML = `
      <div class="magic-intro">
        <div class="magic-icon">🎴</div>
        <h3>The Mind Reader</h3>
        <p class="magic-subtitle">A classic card trick, digitized.</p>
        <div class="magic-steps">
          <div class="step"><span class="step-num">1</span><span>I'll show you 21 cards</span></div>
          <div class="step"><span class="step-num">2</span><span>Pick one card in your mind</span></div>
          <div class="step"><span class="step-num">3</span><span>Answer 3 simple questions</span></div>
          <div class="step"><span class="step-num">4</span><span>I'll read your mind ✨</span></div>
        </div>
        <button class="magic-btn primary" id="startMagicBtn">
          <span>Begin the Magic</span>
          <span class="btn-sparkle">✦</span>
        </button>
      </div>
    `;

    document.getElementById('startMagicBtn').addEventListener('click', () => {
      const fullDeck = shuffleDeck(buildFullDeck());
      magicState.deck = fullDeck.slice(0, 21);
      magicState.phase = 'memorize';
      magicState.round = 0;
      renderMagicUI();
      playMagicSound();
    });
  }

  function renderMemorize(container) {
    const columns = dealIntoColumns(magicState.deck);
    
    container.innerHTML = `
      <div class="magic-memorize">
        <div class="magic-header">
          <h3>Memorize One Card</h3>
          <p>Look at the cards below. Pick <strong>ONE card</strong> in your mind and remember it.</p>
          <p class="magic-hint">Don't tell me which one — just remember it!</p>
        </div>
        <div class="magic-columns-display">
          ${columns.map((col, colIndex) => `
            <div class="magic-column-cards">
              ${col.map((card, i) => getCardHTML(card, colIndex * 7 + i)).join('')}
            </div>
          `).join('')}
        </div>
        <button class="magic-btn primary" id="cardMemorizedBtn">
          <span>I've memorized my card</span>
          <span class="btn-arrow">→</span>
        </button>
      </div>
    `;

    document.getElementById('cardMemorizedBtn').addEventListener('click', () => {
      magicState.phase = 'round1';
      magicState.round = 1;
      renderMagicUI();
      playMagicSound();
    });
  }

  function renderRound(container) {
    const columns = dealIntoColumns(magicState.deck);
    const roundNum = magicState.round;
    
    const messages = [
      "Which column contains your card?",
      "I'm getting closer... which column now?",
      "Final question — which column?"
    ];

    const hints = [
      "Click the column that has your card",
      "The magic is working...",
      "Almost there..."
    ];

    container.innerHTML = `
      <div class="magic-round">
        <div class="magic-header">
          <div class="round-indicator">
            <span class="round-dot ${roundNum >= 1 ? 'active' : ''}"></span>
            <span class="round-dot ${roundNum >= 2 ? 'active' : ''}"></span>
            <span class="round-dot ${roundNum >= 3 ? 'active' : ''}"></span>
          </div>
          <h3>${messages[roundNum - 1]}</h3>
          <p class="magic-hint">${hints[roundNum - 1]}</p>
        </div>
        <div class="magic-columns-selectable">
          ${columns.map((col, colIndex) => `
            <div class="magic-column-select" data-column="${colIndex}">
              <div class="column-label">Column ${colIndex + 1}</div>
              <div class="magic-column-cards">
                ${col.map((card, i) => getCardHTML(card, colIndex * 7 + i)).join('')}
              </div>
              <button class="column-select-btn" data-column="${colIndex}">
                <span>This column</span>
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.column-select-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const col = parseInt(e.currentTarget.dataset.column);
        selectColumn(col);
      });
    });

    container.querySelectorAll('.magic-column-select').forEach(colEl => {
      colEl.addEventListener('click', (e) => {
        if (e.target.closest('.column-select-btn')) return;
        const col = parseInt(colEl.dataset.column);
        selectColumn(col);
      });
    });
  }

  function selectColumn(colIndex) {
    const columns = dealIntoColumns(magicState.deck);
    magicState.deck = collectCards(columns, colIndex);
    magicState.round++;
    
    playMagicSound();

    if (magicState.round > 3) {
      magicState.phase = 'reveal';
      magicState.userCard = magicState.deck[10];
      
      const magicContent = document.getElementById('magicContent');
      magicContent.innerHTML = `
        <div class="magic-thinking">
          <div class="thinking-animation">
            <div class="thinking-cards">
              <div class="floating-card">🎴</div>
              <div class="floating-card delay-1">🎴</div>
              <div class="floating-card delay-2">🎴</div>
            </div>
            <div class="thinking-text">Reading your mind...</div>
          </div>
        </div>
      `;
      
      setTimeout(() => {
        renderMagicUI();
        playMagicSound();
      }, 2500);
    } else {
      magicState.phase = `round${magicState.round}`;
      renderMagicUI();
    }
  }

  function renderReveal(container) {
    const card = magicState.userCard;
    const label = getCardLabel(card);
    
    container.innerHTML = `
      <div class="magic-reveal-section">
        <div class="reveal-dramatic">
          <div class="magic-sparkles">
            <span class="sparkle s1">✦</span>
            <span class="sparkle s2">✧</span>
            <span class="sparkle s3">✦</span>
            <span class="sparkle s4">✧</span>
            <span class="sparkle s5">✦</span>
          </div>
          <h3>Your card is...</h3>
        </div>
        
        <div class="reveal-card-container">
          <div class="reveal-card ${card.red ? 'red' : ''}">
            <div class="reveal-card-inner">
              <span class="corner top-left">
                <span class="card-value">${card.value}</span>
                <span class="card-suit-small">${card.suit}</span>
              </span>
              <span class="card-suit-center large">${card.suit}</span>
              <span class="corner bottom-right">
                <span class="card-value">${card.value}</span>
                <span class="card-suit-small">${card.suit}</span>
              </span>
            </div>
          </div>
        </div>
        
        <div class="reveal-label">${label}</div>
        
        <div class="reveal-reaction">
          <p>Was I right? ✨</p>
        </div>
        
        <div class="reveal-actions">
          <button class="magic-btn secondary" id="howItWorksBtn">
            <span>How did you do that?</span>
          </button>
          <button class="magic-btn primary" id="tryAgainBtn">
            <span>Try Again</span>
            <span class="btn-sparkle">✦</span>
          </button>
        </div>
        
        <div class="magic-explanation" id="magicExplanation" style="display: none;">
          <div class="explanation-content">
            <h4>The Secret ✨</h4>
            <p>This is the classic <strong>21 Card Trick</strong>, a mathematical magic trick that always works!</p>
            <p>When you deal 21 cards into 3 columns of 7 and pick up the chosen column in the middle, repeating 3 times, the card always ends up in position 11 (the exact middle).</p>
            <p>The math: After each round, your card moves closer to the center of the deck. After 3 rounds, it's guaranteed to be the 11th card.</p>
            <p class="explanation-note">Now you can perform this trick with a real deck! 🎴</p>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      container.querySelector('.reveal-card-container')?.classList.add('revealed');
    }, 100);

    document.getElementById('tryAgainBtn').addEventListener('click', () => {
      resetMagic();
    });

    document.getElementById('howItWorksBtn').addEventListener('click', (e) => {
      const explanation = document.getElementById('magicExplanation');
      if (explanation) {
        explanation.style.display = explanation.style.display === 'none' ? 'block' : 'none';
        e.currentTarget.querySelector('span').textContent = explanation.style.display === 'none' ? 'How did you do that?' : 'Hide explanation';
      }
    });
  }

  function resetMagic() {
    magicState = {
      phase: 'intro',
      deck: [],
      round: 0,
      userCard: null,
    };
    renderMagicUI();
    playMagicSound();
  }

  function playMagicSound() {
    try {
      const audio = new Audio('assets/roll.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {}
  }

  // Magic Modal controls
  const magicModal = document.getElementById('magicModal');
  const magicModalClose = document.querySelector('.magic-modal-close');

  function openMagicModal() {
    if (!magicModal) return;
    magicModal.style.display = 'flex';
    magicModal.setAttribute('aria-hidden', 'false');
    resetMagic();
    track('magic_modal_open');
  }

  function closeMagicModal() {
    if (magicModal) {
      magicModal.style.display = 'none';
      magicModal.setAttribute('aria-hidden', 'true');
    }
  }

  document.querySelectorAll('.magic-trigger').forEach(btn => {
    btn.addEventListener('click', openMagicModal);
  });

  if (magicModalClose) {
    magicModalClose.addEventListener('click', closeMagicModal);
  }

  if (magicModal) {
    magicModal.addEventListener('click', (e) => {
      if (e.target === magicModal) closeMagicModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && magicModal.getAttribute('aria-hidden') === 'false') {
        closeMagicModal();
      }
    });
  }
});
