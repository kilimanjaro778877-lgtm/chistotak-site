(function () {
  'use strict';

  // Відправка і конверсії — через спільний ct-lead.js (CTLead.send).
  var SUBMIT_KEY = 'chistotak_lastSubmit';
  var SUBMIT_BLOCK_MS = 24 * 60 * 60 * 1000; // 24h — не показувати попап тим, хто вже залишив заявку
  var SHOWN_KEY = 'ct_popup_shown';          // sessionStorage — max once per visit
  var VISIT_START_KEY = 'ct_visit_start';    // sessionStorage — persists across page views
  var DELAY_MS = 90000; // 1.5 хв — щоб встигли ознайомитись із сайтом перед попапом

  function alreadyConverted() {
    var last = localStorage.getItem(SUBMIT_KEY);
    return !!(last && (Date.now() - parseInt(last, 10)) < SUBMIT_BLOCK_MS);
  }

  var RU = /^ru/i.test(document.documentElement.lang || '');
  var T = RU ? {
    close: 'Закрыть', title: 'Перезвоним за 5 минут', sub: 'Оставьте номер — подберём удобное время и рассчитаем цену.', phone: 'Телефон',
    btn: 'Заказать звонок', nospam: 'Без спама. Один звонок, без навязывания.', ok: 'Заявка принята!', okSub: 'Перезвоним в ближайшее время.',
    sending: 'Отправляем…', err: 'Ошибка. Позвоните: ', kyiv: 'Киев', lviv: 'Львов'
  } : {
    close: 'Закрити', title: 'Передзвонимо за 5 хвилин', sub: 'Залиште номер — підберемо зручний час і розрахуємо ціну.', phone: 'Телефон',
    btn: 'Замовити дзвінок', nospam: 'Без спаму. Один дзвінок, без нав\'язування.', ok: 'Заявку прийнято!', okSub: 'Передзвонимо найближчим часом.',
    sending: 'Відправляємо…', err: 'Помилка. Зателефонуйте: ', kyiv: 'Київ', lviv: 'Львів'
  };

  function buildModal() {
    var overlay = document.createElement('div');
    overlay.id = 'ct-callback-overlay';
    overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.innerHTML =
      '<div class="relative w-full max-w-sm bg-zinc-900 border border-yellow-800 rounded-3xl p-6 sm:p-8 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="ct-callback-title">' +
        '<button type="button" id="ct-callback-close" aria-label="' + T.close + '" class="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
        '<div id="ct-callback-form-state">' +
          '<h3 id="ct-callback-title" class="font-display text-2xl font-black text-zinc-100">' + T.title + '</h3>' +
          '<p class="mt-2 text-sm text-zinc-400">' + T.sub + '</p>' +
          '<form id="ct-callback-form" class="mt-5">' +
            '<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0" aria-hidden="true" />' +
            '<label class="block text-sm font-semibold mb-2 text-zinc-300">' + T.phone + '</label>' +
            '<input type="tel" name="phone" required placeholder="+380 50 123 45 67" ' +
              'class="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 focus:border-gold-400 outline-none transition text-zinc-100" />' +
            '<button type="submit" class="btn-3d mt-4 w-full" style="padding:0.75rem">' + T.btn + '</button>' +
            '<p class="mt-3 text-xs text-zinc-600 text-center">' + T.nospam + '</p>' +
          '</form>' +
        '</div>' +
        '<div id="ct-callback-success" class="hidden text-center py-4">' +
          '<div class="text-4xl">✅</div>' +
          '<h3 class="mt-3 font-display text-xl font-black text-zinc-100">' + T.ok + '</h3>' +
          '<p class="mt-2 text-sm text-zinc-400">' + T.okSub + '</p>' +
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
      var btn = form.querySelector('button[type=submit]');
      var original = btn.textContent;
      btn.disabled = true;
      btn.textContent = T.sending;

      var data = Object.fromEntries(new FormData(form));
      data.name = 'Зворотний дзвінок (спливаюче вікно)';
      data.city = /kyiv/i.test(location.pathname) ? T.kyiv
        : /lviv/i.test(location.pathname) ? T.lviv
        : 'Не вказано (спливаюче вікно)';
      data.service = 'Зворотний дзвінок';
      data.page = location.href;
      data.source = 'popup-15s';

      (async function () {
        var r = window.CTLead
          ? await window.CTLead.send(data, { button: btn })
          : { ok: false, status: 0 };

        if (r.ok) {
          document.getElementById('ct-callback-form-state').classList.add('hidden');
          document.getElementById('ct-callback-success').classList.remove('hidden');
          setTimeout(function () { closePopup(overlay); }, 4000);
        } else {
          btn.disabled = false;
          btn.textContent = original;
          if (window.CTLead) window.CTLead.showError(form, r.status);
          else alert(T.err + (/lviv/i.test(location.pathname) ? '+38 097 825 51 31' : '+38 073 131 22 28'));
        }
      })();
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
