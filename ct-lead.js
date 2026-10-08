/* ЧистоТак — єдина логіка відправки заявок і конверсій для всіх форм сайту.
 *
 * Використання у формі:
 *   const res = await CTLead.send(data, { button: submitBtn });
 *   if (res.ok) { ...успіх... } else { CTLead.showError(form, res.status); }
 * Конверсія «Заявка» відправляється всередині send() — рівно один раз і лише після
 * успішної відповіді сервера (повторне натискання не дублює конверсію).
 *
 * Клік по tel: / t.me / viber: відстежується автоматично на всіх сторінках.
 */
(function () {
  'use strict';

  var API = 'https://cleaning-form-handler-azkl.onrender.com';
  var ORDER_URL = API + '/api/chistotak-order';

  // Google Ads: основна конверсія «Заявка» (як і раніше — не змінювати без потреби,
  // інакше кампанії втратять історію навчання).
  var ADS_LEAD = 'AW-18396553965/yBuHCKL4g4YdEO3FlMRE';
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
      return { ok: r.ok, status: r.status };
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
  async function send(data, opts) {
    opts = opts || {};
    var btn = opts.button;
    if (!data.page) data.page = location.href;

    if (isDuplicate(data)) return { ok: true, status: 200, duplicate: true };

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
      trackLead(data);
    }
    return res;
  }

  /* Конверсія «Заявка» — лише після успішної відповіді сервера (викликається з send). */
  function trackLead(data) {
    var name = (data && data.service) || 'cleaning_order';
    if (typeof window.ttq !== 'undefined') safe(function () { window.ttq.track('SubmitForm', { content_type: 'lead', content_name: name }); });
    if (typeof window.gtag === 'function') {
      safe(function () { window.gtag('event', 'generate_lead', { service: name }); });
      safe(function () { window.gtag('event', 'conversion', { send_to: ADS_LEAD }); });
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

  window.CTLead = {
    API: API,
    send: send,
    showError: showError,
    clearError: clearError,
    phone: phone
  };
})();
