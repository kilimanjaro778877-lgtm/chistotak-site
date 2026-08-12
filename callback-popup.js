(function () {
  'use strict';

  var HANDLER_URL = 'https://cleaning-form-handler-azkl.onrender.com/api/chistotak-order';
  var SUBMIT_KEY = 'chistotak_lastSubmit';
  var SUBMIT_BLOCK_MS = 24 * 60 * 60 * 1000; // 24h, same lock as the main order form
  var SHOWN_KEY = 'ct_popup_shown';          // sessionStorage — max once per visit
  var VISIT_START_KEY = 'ct_visit_start';    // sessionStorage — persists across page views
  var DELAY_MS = 15000;

  function alreadyConverted() {
    var last = localStorage.getItem(SUBMIT_KEY);
    return !!(last && (Date.now() - parseInt(last, 10)) < SUBMIT_BLOCK_MS);
  }

  function buildModal() {
    var overlay = document.createElement('div');
    overlay.id = 'ct-callback-overlay';
    overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.innerHTML =
      '<div class="relative w-full max-w-sm bg-zinc-900 border border-yellow-800 rounded-3xl p-6 sm:p-8 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="ct-callback-title">' +
        '<button type="button" id="ct-callback-close" aria-label="Закрити" class="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
        '<div id="ct-callback-form-state">' +
          '<h3 id="ct-callback-title" class="font-display text-2xl font-black text-zinc-100">Передзвонимо за 5 хвилин</h3>' +
          '<p class="mt-2 text-sm text-zinc-400">Залиште номер — підберемо зручний час і розрахуємо ціну.</p>' +
          '<form id="ct-callback-form" class="mt-5">' +
            '<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" aria-hidden="true" />' +
            '<label class="block text-sm font-semibold mb-2 text-zinc-300">Телефон</label>' +
            '<input type="tel" name="phone" required placeholder="+380 50 123 45 67" ' +
              'class="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 focus:border-gold-400 outline-none transition text-zinc-100" />' +
            '<button type="submit" class="btn-3d mt-4 w-full" style="padding:0.75rem">Замовити дзвінок</button>' +
            '<p class="mt-3 text-xs text-zinc-600 text-center">Без спаму. Один дзвінок, без нав\'язування.</p>' +
          '</form>' +
        '</div>' +
        '<div id="ct-callback-success" class="hidden text-center py-4">' +
          '<div class="text-4xl">✅</div>' +
          '<h3 class="mt-3 font-display text-xl font-black text-zinc-100">Заявку прийнято!</h3>' +
          '<p class="mt-2 text-sm text-zinc-400">Передзвонимо найближчим часом.</p>' +
        '</div>' +
      '</div>';
    return overlay;
  }

  function closePopup(overlay) {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.removeEventListener('keydown', onKeydown);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      var el = document.getElementById('ct-callback-overlay');
      closePopup(el);
    }
  }

  function showPopup() {
    if (alreadyConverted()) return;
    if (document.getElementById('ct-callback-overlay')) return;

    sessionStorage.setItem(SHOWN_KEY, '1');

    var overlay = buildModal();
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeydown);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePopup(overlay);
    });
    document.getElementById('ct-callback-close').addEventListener('click', function () {
      closePopup(overlay);
    });

    var form = document.getElementById('ct-callback-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (alreadyConverted()) {
        closePopup(overlay);
        return;
      }
      var btn = form.querySelector('button[type=submit]');
      var original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Відправляємо…';

      var data = Object.fromEntries(new FormData(form));
      data.name = 'Зворотний дзвінок (спливаюче вікно)';
      data.service = 'Зворотний дзвінок';
      data.page = location.href;
      data.source = 'popup-15s';

      fetch(HANDLER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) {
          if (!r.ok) throw new Error('bad status');
          localStorage.setItem(SUBMIT_KEY, String(Date.now()));
          document.getElementById('ct-callback-form-state').classList.add('hidden');
          document.getElementById('ct-callback-success').classList.remove('hidden');
          setTimeout(function () { closePopup(overlay); }, 4000);
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = original;
          alert('Помилка. Зателефонуйте: +38 073 131 22 28');
        });
    });
  }

  function init() {
    if (alreadyConverted()) return;
    if (sessionStorage.getItem(SHOWN_KEY)) return;

    var start = sessionStorage.getItem(VISIT_START_KEY);
    if (!start) {
      start = String(Date.now());
      sessionStorage.setItem(VISIT_START_KEY, start);
    }
    var elapsed = Date.now() - parseInt(start, 10);
    var remaining = DELAY_MS - elapsed;

    if (remaining <= 0) {
      showPopup();
    } else {
      setTimeout(showPopup, remaining);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
