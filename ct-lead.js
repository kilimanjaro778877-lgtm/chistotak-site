/* ЧистоТак — єдина логіка відправки заявок і конверсій для всіх форм сайту.
 *
 * Використання у формі:
 *   const res = await CTLead.send(data, { button: submitBtn });
 *   if (res.ok) { ...успіх... } else { CTLead.showError(form, res.status); }
 * Після успішної відповіді сервера людину переводимо на /dyakuyemo.html — конверсія «Заявка»
 * (Google Ads, Facebook Lead, TikTok SubmitForm) спрацьовує там, рівно один раз: форма ставить
 * одноразову мітку, сторінка подяки її «гасить». Оновлення / повторний захід нічого не рахують.
 *
 * Клік по tel: / t.me / viber: / wa.me відстежується автоматично на всіх сторінках.
 * Онлайн-запис (ct-booking.js) додає у форму slot_date/slot_time — сервер бронює місце.
 */
(function () {
  'use strict';

  var API = 'https://cleaning-form-handler-azkl.onrender.com';
  var ORDER_URL = API + '/api/chistotak-order';

  // Google Ads: основна конверсія «Заявка» (як і раніше — не змінювати без потреби,
  // інакше кампанії втратять історію навчання).
  // Обидва акаунти Google Ads: кампанія «Прибирання квартир у Києві» — AW-18383404362 (стара мітка конверсії),
  // і AW-18396553965. Кожен акаунт рахує лише свою конверсію — дубля всередині акаунта немає.
  var ADS_LEADS = ['AW-18383404362/oncCCMnI2-AcEMr68b1E', 'AW-18396553965/yBuHCKL4g4YdEO3FlMRE'];
  // Google Ads: окремі дії-конверсії для кліків. Порожньо = не відправляється в Ads.
  // Створити в Google Ads → Цілі → Конверсії → «Клік по телефону» / «Клік у Telegram»
  // і вставити сюди мітку виду 'AW-18396553965/XXXXXXXX'.
  var ADS_CALL = '';
  var ADS_MESSENGER = '';
  // GA4: порожньо = вимкнено. Вставити 'G-XXXXXXXXXX' після створення ресурсу GA4.
  var GA4_ID = '';

  var PHONE_KYIV = '+38 073 131 22 28';
  var PHONE_LVIV = '+38 097 825 51 31';
  var TELEGRAM = 'https://t.me/jamboss8';

  var ATTEMPT_TIMEOUT_MS = 20000;
  var RETRY_DELAYS_MS = [3000, 6000]; // до 3 спроб загалом
  var CONVERTED_KEY = 'chistotak_lastSubmit'; // читає callback-popup.js (не показувати попап тим, хто вже залишив заявку)
  var DEDUP_KEY = 'ct_last_lead';
  var DEDUP_MS = 2 * 60 * 1000; // повторне натискання тієї ж заявки протягом 2 хв не дублюється
  var THANKS_KEY = 'ct_thanks';  // одноразова мітка для сторінки подяки
  var THANKS_URL = '/dyakuyemo.html';
  var THANKS_TTL_MS = 10 * 60 * 1000;

  function safe(fn) { try { fn(); } catch (_) {} }

  if (GA4_ID && typeof window.gtag === 'function') {
    safe(function () { window.gtag('config', GA4_ID); });
  }

  function isLviv() { return /lviv/i.test(location.pathname); }
  function phone() { return isLviv() ? PHONE_LVIV : PHONE_KYIV; }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function attempt(body) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ATTEMPT_TIMEOUT_MS) : null;
    return fetch(ORDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      // q: 'ok' | 'suspect' — оцінка антифроду сервера (підозрілі не зараховуємо в рекламу)
      return r.json().then(function (j) {
        return { ok: r.ok, status: r.status, q: (j && j.q) || 'ok', slot: (j && j.slot) || '' };
      }, function () { return { ok: r.ok, status: r.status, q: 'ok' }; });
    }, function () {
      if (timer) clearTimeout(timer);
      return { ok: false, status: 0 }; // мережа / таймаут
    });
  }

  function retriable(res) {
    return res.status === 0 || res.status >= 500;
  }

  function fingerprint(data) {
    return [data.phone, data.service, data.details].join('|');
  }

  function isDuplicate(data) {
    try {
      var prev = JSON.parse(sessionStorage.getItem(DEDUP_KEY) || 'null');
      return !!(prev && prev.fp === fingerprint(data) && Date.now() - prev.t < DEDUP_MS);
    } catch (_) { return false; }
  }

  /* Відправляє заявку. Повертає {ok, status, duplicate}. */
  /* Сума, яку людина бачила на сайті: калькулятор саме цієї послуги + доп. послуги з фіксованою ціною.
   * Іде в заявку окремим рядком, щоб менеджер назвав ту саму цифру. */
  var PAGE_CALC = {
    'generalna-prybyrannia': 'Генеральне прибирання', 'pidtrymuyuche-prybyrannia': 'Підтримуюче прибирання',
    'mytia-vikon': 'Миття вікон', 'chystka-kylyma': 'Чистка килима', 'planove-prybyrannia': 'Планове прибирання'
  };

  function firstNum(text) {
    var m = String(text || '').match(/\d[\d\s ]*/);
    return m ? parseInt(m[0].replace(/\D/g, ''), 10) || 0 : 0;
  }

  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₴'; }

  function siteTotal(form, service) {
    service = String(service || '').trim();
    var baseEl = null;
    var sum = document.getElementById('sum-total'), sumSvc = document.getElementById('sum-service');
    var calc = document.getElementById('calc-price'), type = document.getElementById('calc-type');
    var pg = document.getElementById('pg-price');
    if (sum && sumSvc) {
      if (sumSvc.textContent.trim() === service) baseEl = sum;             // головна
    } else if (calc && type) {
      var opt = type.options[type.selectedIndex];                           // Київ / Львів
      if (opt && service.indexOf(opt.text.split(' ')[0]) === 0) baseEl = calc;
    } else if (pg) {
      var page = (location.pathname.match(/([\w-]+)\.html$/) || [])[1];    // сторінки послуг
      if (PAGE_CALC[page] === service) baseEl = pg;
    }
    var baseText = baseEl ? baseEl.textContent : '';
    var base = firstNum(baseText);
    var from = /від/i.test(baseText);

    var add = 0, parts = [], perSqm = [];
    Array.prototype.forEach.call(form.querySelectorAll('.upsell-check:checked'), function (cb) {
      if (cb.closest('[style*="display: none"], [style*="display:none"]')) return; // сховано: уже враховано в калькуляторі головної
      var ex = cb.dataset.extra || '';
      var m = ex.match(/^(.*?)\s*\+\s*([\d\s]+)\s*₴(\/м²)?/);
      if (!m) return;
      var price = parseInt(m[2].replace(/\D/g, ''), 10) || 0;
      if (m[3]) perSqm.push(m[1] + ' ' + price + ' ₴/м² (за площею)');
      else { add += price; parts.push(m[1] + ' ' + money(price)); }
    });

    if (!base && !add) {
      if (baseEl) return baseText.replace(/₴/g, '').trim() || '—'; // напр. «Індивідуально» (офіси)
      return perSqm.length ? 'не розраховано · ' + perSqm.join(', ') : 'не розраховувалась (для цієї послуги на сторінці немає калькулятора)';
    }
    var out = (from ? 'від ' : '') + money(base + add);
    var how = [];
    if (base && parts.length) how.push('калькулятор ' + money(base));
    if (parts.length) how.push(parts.join(' + '));
    if (how.length) out += ' — ' + how.join(' + ');
    if (perSqm.length) out += '; + ' + perSqm.join(', ');
    return out;
  }

  async function send(data, opts) {
    opts = opts || {};
    var btn = opts.button;
    if (!data.page) data.page = location.href;
    if (data.total == null) {
      var form = btn && btn.form;
      if (form && form.id === 'order-form') safe(function () { data.total = siteTotal(form, data.service); });
    }

    if (isDuplicate(data)) return { ok: true, status: 200, duplicate: true };

    // Номер перевіряємо одразу у формі — людина просто виправить помилку
    if (!phoneLooksValid(data.phone)) return { ok: false, status: 'phone' };

    // Сигнали «людина чи бот» для антифроду сервера
    data.t_ms = Math.round(typeof performance !== 'undefined' && performance.now ? performance.now() : 0);
    data.hi = humanActions;

    var slowTimer = btn ? setTimeout(function () {
      btn.textContent = 'Ще кілька секунд…';
    }, 6000) : null;

    var body = JSON.stringify(data);
    var res = await attempt(body);
    for (var i = 0; !res.ok && retriable(res) && i < RETRY_DELAYS_MS.length; i++) {
      await sleep(RETRY_DELAYS_MS[i]);
      res = await attempt(body);
    }
    if (slowTimer) clearTimeout(slowTimer);

    if (res.ok) {
      safe(function () { localStorage.setItem(CONVERTED_KEY, String(Date.now())); });
      safe(function () { sessionStorage.setItem(DEDUP_KEY, JSON.stringify({ fp: fingerprint(data), t: Date.now() })); });
      // Підозрілу (за оцінкою сервера) заявку людина бачить як звичайну, але мітки для
      // конверсії не ставимо — реклама не вчиться на ботах і скликуванні
      if (res.q !== 'suspect') {
        safe(function () {
          sessionStorage.setItem(THANKS_KEY, JSON.stringify({ t: Date.now(), service: data.service || '', city: data.city || '', phone: e164(data.phone) }));
        });
      }
      // Обраний час запису — покажемо на сторінці подяки (held | full | wish | late)
      if (data.slot_date && data.slot_time) {
        safe(function () { sessionStorage.setItem('ct_slot', JSON.stringify({ d: data.slot_date, t: data.slot_time, s: res.slot || 'wish' })); });
      }
      // Невелика пауза — кнопка встигає показати «Заявку прийнято», далі сторінка подяки
      setTimeout(function () { location.assign(THANKS_URL); }, 400);
    }
    return res;
  }

  /* Чи схожий номер на справжній: український мобільний/міський або міжнародний з «+».
     Ті самі правила, що й на сервері (antifraud.py), — щоб людина виправила помилку одразу. */
  var UA_MOBILE = ['39', '50', '63', '66', '67', '68', '73', '77', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99'];
  function phoneLooksValid(p) {
    var raw = String(p || '').trim();
    var d = raw.replace(/\D/g, '');
    if (d.length === 10 && d.charAt(0) === '0') d = '38' + d;
    else if (d.length === 9) d = '380' + d;
    else if (d.length === 11 && d.slice(0, 2) === '80') d = '3' + d;
    if (d.slice(0, 3) === '380') {
      if (d.length !== 12) return false;
      var rest = d.slice(3);
      if (new Set(rest.split('')).size <= 2) return false;
      return UA_MOBILE.indexOf(rest.slice(0, 2)) !== -1 || '3456'.indexOf(rest.charAt(0)) !== -1;
    }
    return raw.charAt(0) === '+' && d.length >= 10 && d.length <= 15 && new Set(d.split('')).size > 2;
  }

  // Лічильник дій людини (натискання, дотики, кліки) — боти зазвичай їх не роблять
  var humanActions = 0;
  ['keydown', 'pointerdown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function () { humanActions++; }, { passive: true, capture: true });
  });

  /* Телефон у форматі E.164 (+380…) — для покращених конверсій Google Ads. */
  function e164(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (d.length === 10 && d.charAt(0) === '0') d = '38' + d;
    if (d.length === 9) d = '380' + d;
    return d.length >= 11 ? '+' + d : '';
  }

  /* Сторінка подяки: конверсія лише за наявності свіжої мітки від форми, мітка одразу стирається. */
  function fireThanks() {
    var tok = null;
    safe(function () { tok = JSON.parse(sessionStorage.getItem(THANKS_KEY) || 'null'); });
    safe(function () { sessionStorage.removeItem(THANKS_KEY); });
    if (!tok || !tok.t || Date.now() - tok.t > THANKS_TTL_MS) return null;
    // Покращені конверсії: gtag сам хешує (SHA-256) номер у браузері; працює, якщо увімкнено в налаштуваннях конверсій Ads
    if (tok.phone && typeof window.gtag === 'function') {
      safe(function () { window.gtag('set', 'user_data', { phone_number: tok.phone }); });
    }
    trackLead({ service: tok.service });
    return tok;
  }

  /* Конверсія «Заявка» — лише після успішної відповіді сервера (викликається з send). */
  function trackLead(data) {
    var name = (data && data.service) || 'cleaning_order';
    if (typeof window.ttq !== 'undefined') safe(function () { window.ttq.track('SubmitForm', { content_type: 'lead', content_name: name }); });
    if (typeof window.gtag === 'function') {
      safe(function () { window.gtag('event', 'generate_lead', { service: name }); });
      ADS_LEADS.forEach(function (to) { safe(function () { window.gtag('event', 'conversion', { send_to: to }); }); });
    }
    if (typeof window.fbq === 'function') safe(function () { window.fbq('track', 'Lead', { content_name: name }); });
  }

  /* Помилка: дані у формі лишаються, показуємо клікабельний телефон і Telegram. */
  function showError(form, status) {
    if (!form) return;
    var box = form.querySelector('.ct-lead-error');
    if (!box) {
      box = document.createElement('div');
      box.className = 'ct-lead-error';
      box.setAttribute('role', 'alert');
      box.style.cssText = 'margin-top:12px;padding:12px 14px;border-radius:12px;border:1px solid rgba(248,113,113,.5);background:rgba(127,29,29,.25);color:#fecaca;font-size:14px;line-height:1.45;text-align:left';
      form.appendChild(box);
    }
    var p = phone();
    if (status === 'phone') {
      // Помилка в номері — підказуємо формат і ставимо курсор у поле, без «страшних» повідомлень
      box.innerHTML = 'Перевірте номер телефону — наприклад, <b>+380 50 123 45 67</b> або <b>050 123 45 67</b>.';
      var ph = form.querySelector('[name=phone]');
      if (ph) { try { ph.focus(); } catch (_) {} }
      return;
    }
    var tooMany = status === 429;
    box.innerHTML =
      (tooMany ? 'Забагато спроб поспіль. ' : 'Не вдалося надіслати заявку — ваші дані збережені у формі, спробуйте ще раз. ') +
      'Або зв\'яжіться з нами одразу: <a href="tel:' + p.replace(/\s/g, '') + '" style="color:#EDBA4A;font-weight:700;text-decoration:underline">' + p + '</a>' +
      ' · <a href="' + TELEGRAM + '" target="_blank" rel="noopener" style="color:#EDBA4A;font-weight:700;text-decoration:underline">Telegram</a>';
  }

  function clearError(form) {
    var box = form && form.querySelector('.ct-lead-error');
    if (box) box.parentNode.removeChild(box);
  }

  /* Кліки по кнопках зв'язку — окремі події, не змішуються з конверсією «Заявка». */
  function onContactClick(e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var kind = /^tel:/i.test(href) ? 'call'
      : /^(https?:\/\/)?(t\.me|telegram\.me)\//i.test(href) ? 'telegram'
      : /^viber:/i.test(href) ? 'viber'
      : /^(https?:\/\/)?(wa\.me|api\.whatsapp\.com)\//i.test(href) ? 'whatsapp'
      : null;
    if (!kind) return;
    var label = (a.textContent || '').trim().slice(0, 40) || kind;
    if (typeof window.gtag === 'function') {
      safe(function () { window.gtag('event', kind === 'call' ? 'click_call' : 'click_messenger', { method: kind, link_text: label, page_path: location.pathname }); });
      var adsLabel = kind === 'call' ? ADS_CALL : ADS_MESSENGER;
      if (adsLabel) safe(function () { window.gtag('event', 'conversion', { send_to: adsLabel }); });
    }
    if (typeof window.fbq === 'function') safe(function () { window.fbq('track', 'Contact', { content_name: kind }); });
    if (typeof window.ttq !== 'undefined') safe(function () { window.ttq.track('Contact', { content_name: kind }); });
  }
  document.addEventListener('click', onContactClick, true);

  /* Плаваюча кнопка Telegram -> «Написати»: вибір Telegram / Viber / WhatsApp. */
  var MESSENGERS = [
    { name: 'Telegram', href: TELEGRAM, bg: '#2AABEE', ext: true,
      icon: '<path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.56 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>' },
    { name: 'Viber', href: 'viber://chat?number=%2B380731312228', bg: '#7360F2', ext: false,
      icon: '<path d="M12 2C6.9 2 3 5.6 3 10.3c0 2.6 1.2 4.9 3.2 6.4V21l3.4-1.9c.8.2 1.6.3 2.4.3 5.1 0 9-3.6 9-8.3S17.1 2 12 2zm4.6 11.6c-.2.6-1.1 1.1-1.6 1.1-.4 0-.9.2-3-.7-2.5-1.1-4.1-3.7-4.2-3.9-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.3 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.6-.1 1.1z"/>' },
    { name: 'WhatsApp', href: 'https://wa.me/380731312228', bg: '#25D366', ext: true,
      icon: '<path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.2 13.9c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.6.8 2 .9 2.1.1.1.1.3 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/>' }
  ];

  function enhanceFloat() {
    var tg = document.querySelector('.fixed a[aria-label="Написати в Telegram"]');
    if (!tg || tg.dataset.ctMsg) return;
    tg.dataset.ctMsg = '1';
    var wrap = document.createElement('div');
    wrap.className = 'ct-msg';
    var menu = document.createElement('div');
    menu.className = 'ct-msg-menu';
    menu.hidden = true;
    MESSENGERS.forEach(function (m) {
      var a = document.createElement('a');
      a.className = 'ct-msg-item';
      a.href = m.href;
      if (m.ext) { a.target = '_blank'; a.rel = 'noopener'; }
      a.innerHTML = '<span>' + m.name + '</span><i style="background:' + m.bg + '"><svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">' + m.icon + '</svg></i>';
      menu.appendChild(a);
    });
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = tg.className;
    btn.setAttribute('style', tg.getAttribute('style') || '');
    btn.setAttribute('aria-label', 'Написати нам у месенджер');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2zm3 6a1.3 1.3 0 100 2.6A1.3 1.3 0 007 10zm5 0a1.3 1.3 0 100 2.6 1.3 1.3 0 000-2.6zm5 0a1.3 1.3 0 100 2.6 1.3 1.3 0 000-2.6z"/></svg>';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !wrap.contains(e.target)) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    });
    tg.parentNode.insertBefore(wrap, tg);
    wrap.appendChild(menu);
    wrap.appendChild(btn);
    tg.parentNode.removeChild(tg);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhanceFloat);
  else enhanceFloat();

  window.CTLead = {
    API: API,
    send: send,
    showError: showError,
    clearError: clearError,
    fireThanks: fireThanks,
    phone: phone
  };
})();
