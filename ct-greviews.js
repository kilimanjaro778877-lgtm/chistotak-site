/* ЧистоТак — блок «Відгуки в Google»: рейтинг, кількість і останні відгуки з профілю компанії.
 *
 * Дані бере сервер (/api/google-reviews, кеш 12 год) — ключ Google на сайт не потрапляє.
 * Монтується в <div id="ct-greviews" hidden></div>. Немає даних або сервер недоступний —
 * блок лишається схованим, сторінка виглядає як раніше.
 */
(function () {
  'use strict';

  var API = (window.CTLead && window.CTLead.API) || 'https://cleaning-form-handler-azkl.onrender.com';
  var RU = /^ru/i.test(document.documentElement.lang || '');
  var T = RU
    ? { title: 'Отзывы в Google', reviews: 'отзывов в Google', all: 'Все отзывы в Google', write: 'Оставить отзыв', more: 'Читать полностью', src: 'Отзывы из Google' }
    : { title: 'Відгуки в Google', reviews: 'відгуків у Google', all: 'Усі відгуки в Google', write: 'Залишити відгук', more: 'Читати повністю', src: 'Відгуки з Google' };

  var G = '<svg class="ct-gr-g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function stars(n) {
    var full = Math.round(n), out = '';
    for (var i = 1; i <= 5; i++) out += '<span class="' + (i <= full ? 'on' : '') + '">★</span>';
    return '<span class="ct-gr-stars" aria-label="' + n + ' / 5">' + out + '</span>';
  }

  function plural(n) {
    // «37 відгуків» / «отзывов» — для блоку достатньо родового відмінка множини
    return n + ' ' + T.reviews;
  }

  function card(r) {
    var ava = r.photo
      ? '<img class="ct-gr-ava" src="' + esc(r.photo) + '" alt="" loading="lazy" referrerpolicy="no-referrer" width="40" height="40">'
      : '<span class="ct-gr-ava ct-gr-ava-i">' + esc((r.author || '?').charAt(0)) + '</span>';
    var long = (r.text || '').length > 220;
    return '<article class="ct-gr-card">' +
      '<div class="ct-gr-head">' + ava + '<div><div class="ct-gr-name">' + esc(r.author) + '</div>' +
      '<div class="ct-gr-meta">' + stars(r.rating) + ' <span>' + esc(r.when) + '</span></div></div>' + G + '</div>' +
      '<p class="ct-gr-text' + (long ? ' is-long' : '') + '">' + esc(r.text) + '</p>' +
      (long ? '<button type="button" class="ct-gr-more">' + T.more + '</button>' : '') +
      '</article>';
  }

  function render(box, d) {
    box.innerHTML =
      '<div class="ct-gr-top">' +
        '<div class="ct-gr-score">' + G + '<div><div class="ct-gr-label">' + T.title + '</div>' +
        '<div class="ct-gr-num"><b>' + d.rating.toFixed(1).replace('.', ',') + '</b> ' + stars(d.rating) + '</div>' +
        '<div class="ct-gr-count">' + plural(d.count) + '</div></div></div>' +
        '<div class="ct-gr-actions">' +
          '<a class="ct-gr-btn" href="' + esc(d.write_url) + '" target="_blank" rel="noopener">' + T.write + '</a>' +
          '<a class="ct-gr-link" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + T.all + ' →</a>' +
        '</div>' +
      '</div>' +
      (d.reviews.length ? '<div class="ct-gr-list">' + d.reviews.map(card).join('') + '</div>' : '') +
      '<div class="ct-gr-src">' + T.src + '</div>';
    box.hidden = false;
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.ct-gr-more');
      if (!b) return;
      b.previousElementSibling.classList.remove('is-long');
      b.remove();
    });
  }

  function init() {
    var box = document.getElementById('ct-greviews');
    if (!box) return;
    fetch(API + '/api/google-reviews')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.ok && d.count > 0) render(box, d); })
      .catch(function () { /* немає даних — блок схований */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
