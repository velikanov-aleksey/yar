/* ЯR — агрегатор доставки и услуг Красноярского района. Без сборки, чистый JS. */
(() => {
  const { restaurants } = window.YAR_DATA;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const app = $('#app');
  const rub = n => n.toLocaleString('ru-RU') + ' ₽';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } },
  };

  // ---------- справочники ----------
  const PLACES = [
    ['Красный Яр', 'село'], ['Яр Парк', 'коттеджный посёлок'], ['Фэмили Парк', 'коттеджный посёлок'],
    ['Посёлки «Ассет»', 'коттеджные посёлки'], ['Грибы', 'коттеджный посёлок'], ['Ёлки', 'коттеджный посёлок'],
    ['Мирный', 'посёлок'], ['Угловой', 'посёлок'], ['Екатериновка', 'село'], ['Новая Семейкина', 'село'],
    ['Малая Царевщина', 'село'], ['Солонцовка', 'село'], ['Другой посёлок района', 'уточним при звонке'],
  ];
  const COLLECTIONS = [
    { id: 'pizza', e: '🍕', name: 'Пицца', f: (c) => c === 'Пицца' },
    { id: 'breakfast', e: '🍳', name: 'Завтраки', f: (c) => c === 'Завтраки' },
    { id: 'burgers', e: '🍔', name: 'Бургеры и шаверма', f: (c, n) => /бургер|шаверм|ролл/i.test(n) },
    { id: 'grill', e: '🥩', name: 'Мясо и гриль', f: (c, n) => c === 'Блюда на мангале' || /стейк|ребр|рёбр|шашлык|люля|корейка|щечк|щёчк/i.test(n) },
    { id: 'pasta', e: '🍝', name: 'Паста', f: (c, n) => /паста|спагетти/i.test(n) },
    { id: 'salads', e: '🥗', name: 'Салаты', f: (c) => c === 'Салаты' },
    { id: 'soups', e: '🍲', name: 'Супы', f: (c) => c === 'Супы' },
    { id: 'georgia', e: '🥟', name: 'Хинкали и хачапури', f: (c) => c === 'Хинкали' || c === 'Хачапури' },
    { id: 'beer', e: '🍤', name: 'К пиву', f: (c) => c === 'Горячие закуски' || c === 'Тёплые закуски' },
    { id: 'kids', e: '🧸', name: 'Детское', f: (c) => c === 'Детские блюда' },
    { id: 'desserts', e: '🍰', name: 'Десерты', f: (c) => c === 'Десерты' },
    { id: 'drinks', e: '☕', name: 'Кофе и напитки', f: (c) => c === 'Кофе' || c === 'Чай' || c === 'Напитки' },
  ];

  // плоский индекс блюд
  const DISHES = [];
  const byId = {};
  for (const r of restaurants) for (const c of r.cats) for (const d of c.items) {
    const x = { ...d, r, cat: c.name };
    DISHES.push(x); byId[d.id] = x;
  }
  const restById = Object.fromEntries(restaurants.map(r => [r.id, r]));

  // ---------- состояние ----------
  let place = store.get('yar_place', 'Красный Яр');
  let cart = store.get('yar_cart', { rid: null, lines: [] });
  const saveCart = () => { store.set('yar_cart', cart); paintCart(); };

  // ---------- общие элементы ----------
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function openLayer(el) { el.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeLayer(el) {
    if (el.hidden) return;
    el.classList.add('closing');
    setTimeout(() => { el.hidden = true; el.classList.remove('closing'); if ($$('.sheet:not([hidden]),.drawer:not([hidden])').length === 0) document.body.style.overflow = ''; }, 240);
  }
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-close]');
    if (c) closeLayer(c.closest('.sheet,.drawer'));
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.sheet:not([hidden]),.drawer:not([hidden])').forEach(closeLayer); });

  // заставка — один раз за сессию
  const splash = $('#splash');
  let seen = false; try { seen = sessionStorage.getItem('yar_splash'); sessionStorage.setItem('yar_splash', 1); } catch { /* */ }
  if (seen) splash.remove(); else setTimeout(() => { splash.classList.add('out'); setTimeout(() => splash.remove(), 600); }, 1400);

  window.addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', scrollY > 4), { passive: true });

  // ---------- посёлок ----------
  function paintPlace() {
    $('#placeName').textContent = place;
    $('#placeList').innerHTML = PLACES.map(([n, k]) => `<button type="button" class="${n === place ? 'on' : ''}" data-place="${esc(n)}">${esc(n)}<small>${esc(k)}</small></button>`).join('');
  }
  $('#placeBtn').onclick = () => { paintPlace(); openLayer($('#placeSheet')); };
  $('#placeList').onclick = e => {
    const b = e.target.closest('[data-place]'); if (!b) return;
    place = b.dataset.place; store.set('yar_place', place); paintPlace();
    closeLayer($('#placeSheet')); toast('Доставляем в: ' + place);
    const sel = $('#f-place'); if (sel) sel.value = place;
  };
  paintPlace();

  // ---------- корзина ----------
  const lineTotal = l => (l.price + (l.adds || []).reduce((s, a) => s + a.p, 0)) * l.qty;
  const cartTotal = () => cart.lines.reduce((s, l) => s + lineTotal(l), 0);
  const cartQty = () => cart.lines.reduce((s, l) => s + l.qty, 0);
  const qtyOf = id => cart.lines.filter(l => l.id === id).reduce((s, l) => s + l.qty, 0);

  function paintCart() {
    const n = cartQty();
    $('#cartCount').textContent = n; $('#cartCount').dataset.n = n;
    $('#cartSum').textContent = n ? rub(cartTotal()) : '';
    $('#tabCount').textContent = n || '';
    // обновить кнопки на карточках
    $$('[data-dish]').forEach(card => {
      const slot = $('.slot', card); if (!slot) return;
      slot.innerHTML = buyControl(byId[card.dataset.dish]);
    });
    if (!$('#cart').hidden) renderCart();
  }

  function addToCart(d, { opt = null, adds = [], qty = 1, fromEl = null } = {}) {
    if (cart.rid && cart.rid !== d.r.id && cart.lines.length) {
      const prev = restById[cart.rid].name;
      if (!confirm(`В корзине блюда из «${prev}». Заказ можно оформить только из одного заведения. Очистить корзину и добавить «${d.name}»?`)) return false;
      cart = { rid: null, lines: [] };
    }
    cart.rid = d.r.id;
    const key = [d.id, opt ? opt.l : '', adds.map(a => a.l).join('+')].join('|');
    const line = cart.lines.find(l => l.key === key);
    if (line) line.qty += qty;
    else cart.lines.push({ key, id: d.id, name: d.name, img: d.img, price: opt ? opt.p : d.price, opt: opt ? opt.l : null, adds, qty });
    saveCart();
    if (fromEl) fly(fromEl);
    const btn = innerWidth > 720 ? $('#cartBtn') : $('#tabCart');
    btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
    return true;
  }
  function changeQty(key, delta) {
    const l = cart.lines.find(x => x.key === key); if (!l) return;
    l.qty += delta;
    if (l.qty <= 0) cart.lines = cart.lines.filter(x => x !== l);
    if (!cart.lines.length) cart.rid = null;
    saveCart();
  }

  // летящая картинка в корзину
  function fly(img) {
    const target = innerWidth > 720 ? $('#cartBtn') : $('#tabCart');
    const a = img.getBoundingClientRect(), b = target.getBoundingClientRect();
    const f = img.cloneNode(); f.className = 'fly';
    const s = Math.min(a.width, 120);
    Object.assign(f.style, { left: a.left + a.width / 2 - s / 2 + 'px', top: a.top + a.height / 2 - s / 2 + 'px', width: s + 'px', height: s + 'px' });
    document.body.appendChild(f);
    requestAnimationFrame(() => {
      const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      f.style.transform = `translate(${dx}px, ${dy}px) scale(.15)`; f.style.opacity = '.4';
    });
    setTimeout(() => f.remove(), 750);
  }

  const openCart = () => { renderCart(); openLayer($('#cart')); };
  $('#cartBtn').onclick = openCart;
  $('#tabCart').onclick = openCart;

  function renderCart(step = 'list') {
    const card = $('#cartCard');
    const r = cart.rid && restById[cart.rid];
    if (!cart.lines.length) {
      card.innerHTML = `<div class="cart-head sheet-head"><h3>Корзина</h3><button class="x" data-close>×</button></div>
        <div class="empty"><div class="big">🛒</div><b>Пока пусто</b><span>Выберите что-нибудь вкусное</span><a class="btn btn-red" href="#/food" data-close>В ЯR Еду</a></div>`;
      return;
    }
    const total = cartTotal();
    if (step === 'list') {
      card.innerHTML = `
        <div class="cart-head"><div class="sheet-head"><h3>Корзина</h3><button class="x" data-close>×</button></div>
          <div class="cart-rest"><img src="${r.logo}" alt="">${esc(r.name)}<button class="muted" style="margin-left:auto;font-weight:700" id="clearCart">Очистить</button></div></div>
        <div class="cart-list">${cart.lines.map(l => `
          <div class="ci"><img src="${l.img}" alt="">
            <div><b>${esc(l.name)}</b><small>${[l.opt, ...(l.adds || []).map(a => '+ ' + a.l)].filter(Boolean).map(esc).join(', ')}${l.opt || (l.adds || []).length ? ' · ' : ''}${rub(lineTotal(l))}</small></div>
            <div class="stepper"><button data-q="-1" data-k="${esc(l.key)}">−</button><span>${l.qty}</span><button data-q="1" data-k="${esc(l.key)}">+</button></div>
          </div>`).join('')}</div>
        <div class="cart-foot">
          <div class="total"><span>Итого</span><span>${rub(total)}</span></div>
          <span class="muted" style="font-size:13px">Стоимость доставки в «${esc(place)}» подтвердит оператор</span>
          <button class="btn btn-red" id="toCheckout">Оформить заказ</button>
        </div>`;
      $('#clearCart').onclick = () => { cart = { rid: null, lines: [] }; saveCart(); };
      $('#toCheckout').onclick = () => renderCart('form');
      $$('[data-q]', card).forEach(b => b.onclick = () => changeQty(b.dataset.k, +b.dataset.q));
    } else if (step === 'form') {
      const me = store.get('yar_me', {});
      card.innerHTML = `
        <div class="cart-head"><div class="sheet-head"><button class="x" id="backList" aria-label="Назад">‹</button><h3 style="margin-right:auto">Оформление</h3><button class="x" data-close>×</button></div></div>
        <form class="cart-list form" id="orderForm">
          <div class="notice" style="margin-top:0">Демо-версия ЯR: заказ пока не отправляется в ресторан. Чтобы заказать сейчас, позвоните в заведение${r.phone ? ': ' + esc(r.phone) : ''}.</div>
          <label>Посёлок<select id="f-place" name="place">${PLACES.map(([n]) => `<option ${n === place ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
          <label>Улица, дом, квартира<input name="addr" required placeholder="ул. Сиреневая, 5" value="${esc(me.addr || '')}"></label>
          <label>Имя<input name="name" required placeholder="Как к вам обращаться" value="${esc(me.name || '')}"></label>
          <label>Телефон<input name="phone" required type="tel" inputmode="tel" placeholder="+7 (___) ___-__-__" value="${esc(me.phone || '')}"></label>
          <label>Комментарий<textarea name="comment" placeholder="Код домофона, сдача, пожелания"></textarea></label>
          <div class="pay"><label><input type="radio" name="pay" value="Наличные" checked>Наличными</label><label><input type="radio" name="pay" value="Карта курьеру">Картой курьеру</label></div>
        </form>
        <div class="cart-foot">
          <div class="total"><span>${esc(r.name)} · ${cartQty()} шт.</span><span>${rub(total)}</span></div>
          <button class="btn btn-red" form="orderForm">Оформить демо-заказ</button>
        </div>`;
      $('#backList').onclick = () => renderCart('list');
      const f = $('#orderForm');
      f.phone.addEventListener('input', () => { f.phone.value = maskPhone(f.phone.value); });
      f.onsubmit = e => {
        e.preventDefault();
        if (f.phone.value.replace(/\D/g, '').length < 11) { f.phone.focus(); toast('Проверьте номер телефона'); return; }
        const data = Object.fromEntries(new FormData(f));
        store.set('yar_me', { addr: data.addr, name: data.name, phone: data.phone });
        place = data.place; store.set('yar_place', place); paintPlace();
        const orders = store.get('yar_orders', []);
        const no = String(Date.now()).slice(-5);
        orders.push({ no, at: new Date().toISOString(), rest: r.name, lines: cart.lines, total, ...data });
        store.set('yar_orders', orders);
        cart = { rid: null, lines: [] }; saveCart();
        card.innerHTML = `<div class="cart-head sheet-head"><span></span><button class="x" data-close>×</button></div>
          <div class="done"><div class="ok"><svg viewBox="0 0 24 24" width="46" height="46"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <h3 style="font-family:var(--display);font-size:24px">Демо-заказ №${no} оформлен</h3>
          <p class="muted">Это демо-версия ЯR: заказ сохранён только на этом устройстве и в «${esc(r.name)}» не отправлен.${r.phone ? ` Чтобы заказать по-настоящему, позвоните: ${esc(r.phone)}.` : ''}</p>
          <a class="btn btn-ghost" href="#/food" data-close>Вернуться к ресторанам</a></div>`;
      };
    }
  }
  function maskPhone(v) {
    let d = v.replace(/\D/g, ''); if (d.startsWith('8')) d = '7' + d.slice(1); if (!d.startsWith('7')) d = '7' + d; d = d.slice(0, 11);
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    let s = '+7'; if (p[0]) s += ' (' + p[0]; if (p[0].length === 3) s += ')'; if (p[1]) s += ' ' + p[1]; if (p[2]) s += '-' + p[2]; if (p[3]) s += '-' + p[3];
    return s;
  }

  // ---------- карточка блюда ----------
  const needsSheet = d => (d.opts && d.opts.length) || (d.add && d.add.length);
  function buyControl(d) {
    const q = needsSheet(d) ? 0 : qtyOf(d.id);
    if (!q) return `<button class="add" data-add="${d.id}" type="button"><span>+</span> В корзину</button>`;
    const key = cart.lines.find(l => l.id === d.id).key;
    return `<div class="qty"><button type="button" data-q="-1" data-k="${esc(key)}">−</button><span>${q}</span><button type="button" data-q="1" data-k="${esc(key)}">+</button></div>`;
  }
  function dishCard(d, showRest = false, i = 0) {
    const from = d.opts ? '<small>от </small>' : '';
    return `<article class="dish reveal" style="--d:${Math.min(i, 12) * 0.04}s" data-dish="${d.id}">
      <div class="dish-img"><img src="${d.img}" alt="${esc(d.name)}" loading="lazy">
        ${showRest ? `<span class="dish-from"><img src="${d.r.logo}" alt="">${esc(d.r.name)}</span>` : ''}</div>
      <div class="dish-body"><div class="dish-price">${from}${rub(d.price)}</div><div class="dish-name">${esc(d.name)}</div>
        ${d.w ? `<div class="dish-w">${esc(d.w)}</div>` : ''}<div class="slot">${buyControl(d)}</div></div></article>`;
  }
  // делегирование кликов по сетке блюд
  app.addEventListener('click', e => {
    const q = e.target.closest('[data-q]');
    if (q) { e.stopPropagation(); changeQty(q.dataset.k, +q.dataset.q); return; }
    const a = e.target.closest('[data-add]');
    const card = e.target.closest('[data-dish]');
    if (!card) return;
    const d = byId[card.dataset.dish];
    if (a && !needsSheet(d)) { if (addToCart(d, { fromEl: $('.dish-img img', card) })) toast(`«${d.name}» в корзине`); return; }
    openDish(d);
  });

  function openDish(d) {
    const st = { opt: d.opts ? d.opts[0] : null, adds: [], qty: 1 };
    const el = $('#dishCard');
    const price = () => ((st.opt ? st.opt.p : d.price) + st.adds.reduce((s, a) => s + a.p, 0)) * st.qty;
    el.innerHTML = `
      <button class="x" data-close aria-label="Закрыть">×</button>
      <div class="dc-img"><img src="${d.img}" alt="${esc(d.name)}"></div>
      <div class="dc-body">
        <a class="dc-from" href="#/r/${d.r.id}" data-close><img src="${d.r.logo}" alt="">${esc(d.r.name)} · ${esc(d.cat)}</a>
        <h3>${esc(d.name)}</h3>
        ${d.w ? `<div class="muted">${esc(d.w)}</div>` : ''}
        ${d.d ? `<p style="margin:0;color:var(--ink-2)">${esc(d.d)}</p>` : ''}
        ${d.opts ? `<div class="opt-group"><b>Размер</b><div class="seg">${d.opts.map((o, i) => `<button type="button" data-o="${i}" class="${i ? '' : 'on'}">${esc(o.l)}</button>`).join('')}</div></div>` : ''}
        ${d.add ? `<div class="opt-group"><b>Добавить</b>${d.add.map((a, i) => `<label class="check"><span><input type="checkbox" data-a="${i}"> ${esc(a.l)}</span><span>+${rub(a.p)}</span></label>`).join('')}</div>` : ''}
        <div class="dc-foot">
          <div class="stepper"><button type="button" data-s="-1">−</button><span id="dcQ">1</span><button type="button" data-s="1">+</button></div>
          <button class="btn btn-red" id="dcAdd" type="button">Добавить · <span id="dcP"></span></button>
        </div>
      </div>`;
    const upd = () => { $('#dcP').textContent = rub(price()); $('#dcQ').textContent = st.qty; };
    $$('[data-o]', el).forEach(b => b.onclick = () => { st.opt = d.opts[+b.dataset.o]; $$('[data-o]', el).forEach(x => x.classList.toggle('on', x === b)); upd(); });
    $$('[data-a]', el).forEach(c => c.onchange = () => { st.adds = $$('[data-a]', el).filter(x => x.checked).map(x => d.add[+x.dataset.a]); upd(); });
    $$('[data-s]', el).forEach(b => b.onclick = () => { st.qty = Math.max(1, st.qty + +b.dataset.s); upd(); });
    $('#dcAdd').onclick = () => {
      if (addToCart(d, { opt: st.opt, adds: st.adds, qty: st.qty, fromEl: $('.dc-img img', el) })) { toast(`«${d.name}» в корзине`); closeLayer($('#dishSheet')); }
    };
    upd(); openLayer($('#dishSheet'));
  }

  // ---------- появление при прокрутке ----------
  let io;
  function observe() {
    io && io.disconnect();
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -40px' });
    $$('.reveal:not(.in)').forEach(el => io.observe(el));
  }

  // ---------- страницы ----------
  const svcTile = (cls, img, badge, title, text, href) => `
    <${href ? `a href="${href}"` : 'div'} class="svc ${cls} reveal"><img src="${img}" alt="" loading="lazy"><span class="badge ${badge === 'Работает' ? 'live' : ''}">${badge}</span>
      <h3><span class="l-ya">Я</span><span class="l-r">R</span> ${title}</h3><p>${text}</p></${href ? 'a' : 'div'}>`;

  function pageHome() {
    const villages = PLACES.slice(0, -1).map(([n], i) => `<span class="${i > 0 && i < 6 ? 'hot' : ''}">${esc(n)}</span>`).join('');
    app.innerHTML = `<div class="page wrap">
      <section class="hero">
        <div class="hero-big">ЯR</div>
        <h1 class="reveal">Всё для дома — в&nbsp;одном приложении</h1>
        <p class="reveal" style="--d:.08s">Еда из любимых кафе, клининг, мастера и покос газона. Работаем по Красноярскому району — от Красного Яра до Яр Парка.</p>
        <div class="hero-actions reveal" style="--d:.16s"><a class="btn btn-white" href="#/food">Заказать еду →</a></div>
      </section>
      <div class="marquee"><div class="marquee-track">${villages}${villages}</div></div>

      <section class="section">
        <div class="section-head"><h2 class="reveal">Сервисы ЯR</h2></div>
        <div class="services">
          ${svcTile('big', 'assets/gen/hero-food.jpg', 'Работает', 'Еда', 'Уютное, Свояк и Сковородка — меню, фото и корзина в одном месте', '#/food')}
          ${svcTile('soon', 'assets/gen/svc-cleaning.jpg', 'Скоро', 'Клининг', 'Уборка домов и квартир')}
          ${svcTile('soon', 'assets/gen/svc-repair.jpg', 'Скоро', 'Мастер', 'Сантехник, ремонт посудомоек и стиральных машин')}
          ${svcTile('soon', 'assets/gen/svc-lawn.jpg', 'Скоро', 'Сад', 'Покос газона и уход за участком')}
          <div class="svc soon reveal" style="background:var(--red);color:#fff"><span class="badge">Скоро</span><h3>Ваш сервис</h3><p>Хотите подключиться к ЯR? Мы на связи.</p></div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="reveal">Как это работает</h2></div>
        <div class="how">
          <div class="reveal"><b>1</b><strong>Выберите посёлок</strong><p>Красный Яр, Мирный, Угловой, Яр Парк, Фэмили Парк и другие.</p></div>
          <div class="reveal" style="--d:.08s"><b>2</b><strong>Соберите заказ</strong><p>Меню всех заведений с фото и ценами — в одном каталоге.</p></div>
          <div class="reveal" style="--d:.16s"><b>3</b><strong>Получите домой</strong><p>Оператор подтвердит заказ по телефону, курьер привезёт.</p></div>
        </div>
      </section>
    </div>`;
  }

  function pageFood(colId = null, query = '') {
    const total = DISHES.length;
    app.innerHTML = `<div class="page wrap">
      <section class="food-hero">
        <img src="assets/gen/hero-food.jpg" alt="">
        <div class="kicker reveal"><span class="logo"><span class="l-ya">Я</span><span class="l-r">R</span></span> Еда</div>
        <h1 class="reveal" style="--d:.06s">Любимые блюда — <em>в&nbsp;одном месте</em></h1>
        <label class="search reveal" style="--d:.12s"><svg viewBox="0 0 24 24" width="20" height="20"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input id="q" type="search" placeholder="Найти среди ${total} блюд: пицца, хинкали, раф…" value="${esc(query)}" autocomplete="off"></label>
      </section>

      <section class="section" style="margin-top:28px">
        <div class="logos">${restaurants.map(r => `<a class="logo-chip reveal" href="#/r/${r.id}"><span class="ring"><img src="${r.logo}" alt="${esc(r.name)}"></span><span>${esc(r.name)}<small>${esc(r.kind)}</small></span></a>`).join('')}</div>
      </section>

      <section class="section" style="margin-top:20px">
        <div class="chips" id="cols"><button class="chip ${colId ? '' : 'on'}" data-col="">Все заведения</button>${COLLECTIONS.map(c => `<button class="chip ${c.id === colId ? 'on' : ''}" data-col="${c.id}"><i>${c.e}</i>${c.name}</button>`).join('')}</div>
      </section>
      <div id="foodBody"></div>
    </div>`;
    const body = $('#foodBody');
    const paint = () => {
      const q = $('#q').value.trim().toLowerCase();
      const col = COLLECTIONS.find(c => c.id === colId);
      if (!q && !col) {
        body.innerHTML = `<section class="section" style="margin-top:20px"><div class="section-head"><h2 class="reveal">Заведения</h2><span class="muted">Доставка в ${esc(place)}</span></div>
          <div class="rests">${restaurants.map((r, i) => `
            <a class="rest reveal" style="--d:${i * 0.08}s" href="#/r/${r.id}">
              <div class="rest-cover"><img src="${r.cover}" alt="" loading="lazy"><span class="time">${r.cats.reduce((s, c) => s + c.items.length, 0)} блюд</span></div>
              <div class="rest-body"><img class="rest-logo" src="${r.logo}" alt=""><h3>${esc(r.name)}</h3><div class="kind">${esc(r.kind)}${r.address ? ' · ' + esc(r.address.replace('с. ', '')) : ''}</div>
                <div class="tags">${r.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div></div>
            </a>`).join('')}</div></section>
          <section class="section"><div class="section-head"><h2 class="reveal">Хиты района</h2><a href="#/food/pizza">Вся пицца →</a></div>
          <div class="dishes">${pickHits().map((d, i) => dishCard(d, true, i)).join('')}</div></section>`;
      } else {
        let list = DISHES;
        if (col) list = list.filter(d => col.f(d.cat, d.name));
        if (q) list = list.filter(d => (d.name + ' ' + d.cat + ' ' + (d.d || '')).toLowerCase().includes(q));
        const title = q ? `Найдено: ${list.length}` : `${col.e} ${col.name}`;
        body.innerHTML = `<section class="section" style="margin-top:20px"><div class="section-head"><h2>${esc(title)}</h2><span class="muted">${col && !q ? 'из всех заведений' : ''}</span></div>
          ${list.length ? `<div class="dishes">${list.map((d, i) => dishCard(d, true, i)).join('')}</div>` : `<div class="empty"><div class="big">🔍</div><b>Ничего не нашлось</b><span>Попробуйте другое слово</span></div>`}</section>`;
      }
      observe();
    };
    $('#cols').onclick = e => {
      const b = e.target.closest('[data-col]'); if (!b) return;
      colId = b.dataset.col || null;
      $$('#cols .chip').forEach(x => x.classList.toggle('on', x === b));
      history.replaceState(null, '', colId ? '#/food/' + colId : '#/food');
      paint();
      b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    };
    let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(paint, 180); };
    paint();
  }
  function pickHits() {
    const want = [['uyutnoe', 'Хачапури по-аджарски'], ['svoyak', 'Стейк рибай'], ['skovorodka', 'Сырники со сметаной'], ['uyutnoe', 'Пепперони'],
      ['svoyak', 'Паста карбонара'], ['skovorodka', 'Пепперони'], ['uyutnoe', 'Хинкали с говядиной'], ['svoyak', 'Медовик'],
      ['skovorodka', 'Раф халва'], ['uyutnoe', 'Борщ сибирский'], ['svoyak', 'Свиные ребра барбекю'], ['skovorodka', 'Блины с говядиной и перцем']];
    return want.map(([r, n]) => DISHES.find(d => d.r.id === r && d.name.includes(n))).filter(Boolean);
  }

  function pageRest(id) {
    const r = restById[id];
    if (!r) return pageFood();
    const info = [r.address && `📍 ${esc(r.address)}`, r.hours && `🕑 ${esc(r.hours)}`].filter(Boolean).map(s => `<span>${s}</span>`).join('')
      + (r.phone ? `<a href="tel:${r.phone.replace(/[^\d+]/g, '')}">📞 ${esc(r.phone)}</a>` : '');
    app.innerHTML = `<div class="page wrap">
      <section class="r-hero">
        <a class="back" href="#/food" aria-label="Назад"><svg viewBox="0 0 24 24" width="22" height="22"><path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></a>
        <img src="${r.cover}" alt="" id="rCover">
        <div class="r-hero-in"><img class="r-logo" src="${r.logo}" alt="${esc(r.name)}">
          <div><h1>${esc(r.name)}</h1><div class="kind">${esc(r.kind)} · ${esc(r.about)}</div><div class="r-info">${info}</div></div></div>
      </section>
      ${place && cart.rid && cart.rid !== r.id && cart.lines.length ? `<div class="notice">В корзине заказ из «${esc(restById[cart.rid].name)}». Заказ оформляется из одного заведения.</div>` : ''}
      <div class="cat-tabs"><div class="chips" id="catTabs">${r.cats.map((c, i) => `<a class="chip ${i ? '' : 'on'}" href="#c-${c.id}" data-cat="${c.id}">${esc(c.name)}</a>`).join('')}</div></div>
      ${r.cats.map(c => `<section class="cat-sec" id="c-${c.id}"><h2 class="reveal">${esc(c.name)}</h2><div class="dishes">${c.items.map((d, i) => dishCard(byId[d.id], false, i)).join('')}</div></section>`).join('')}
    </div>`;
    // вкладки категорий: плавная прокрутка + подсветка текущей
    $('#catTabs').onclick = e => {
      const a = e.target.closest('[data-cat]'); if (!a) return; e.preventDefault();
      $('#c-' + a.dataset.cat).scrollIntoView({ behavior: 'smooth' });
    };
    const tabs = $$('#catTabs .chip');
    const spy = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const id = e.target.id.slice(2);
      tabs.forEach(t => t.classList.toggle('on', t.dataset.cat === id));
      const on = tabs.find(t => t.dataset.cat === id);
      on && on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('.cat-sec').forEach(s => spy.observe(s));
    pageCleanup = () => spy.disconnect();
  }

  // параллакс обложки заведения
  window.addEventListener('scroll', () => {
    const c = $('#rCover'); if (c) c.style.transform = `translateY(${Math.min(scrollY, 400) * 0.25}px)`;
  }, { passive: true });

  // ---------- роутер ----------
  let pageCleanup = null;
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    if (h.startsWith('c-')) return; // якорь категории
    pageCleanup && pageCleanup(); pageCleanup = null;
    $$('.sheet:not([hidden]),.drawer:not([hidden])').forEach(el => { el.hidden = true; });
    document.body.style.overflow = '';
    const [a, b] = h.split('/');
    if (a === 'food') pageFood(b || null);
    else if (a === 'r') pageRest(b);
    else pageHome();
    const nav = a === 'food' || a === 'r' ? 'food' : 'home';
    $$('[data-nav]').forEach(x => x.classList.toggle('on', x.dataset.nav === nav));
    scrollTo({ top: 0, behavior: 'instant' });
    observe();
  }
  window.addEventListener('hashchange', route);
  route();
  paintCart();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
