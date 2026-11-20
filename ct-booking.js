/* ЧистоТак — онлайн-запис у формі замовлення (#order-form).
 *
 * Календар на 14 днів: день → час (08:00 / 11:00 / 14:00). Вільні місця бере з сервера
 * (/api/chistotak-slots), обраний час кладе у приховані поля slot_date / slot_time —
 * форми й так збирають усе через FormData, тож CTLead.send відправить їх разом із заявкою.
 * Вибір часу необовʼязковий: якщо сервер недоступний, блок просто не показується,
 * а форма працює як раніше. Київ — живі місця; Львів (партнер) — «бажаний час» без лічильника.
 */
(function () {
  'use strict';

  var API = (window.CTLead && window.CTLead.API) || 'https://cleaning-form-handler-azkl.onrender.com';
  // Мова сторінки: російська версія сайту лежить у /ru/ з <html lang="ru">
  var RU = /^ru/i.test(document.documentElement.lang || '');
  var T = RU ? {
    wd: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], mon: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    at: ' в ', title: 'Выберите удобный день и время', opt: 'необязательно', day: 'День', time: 'Время начала',
    chosen: '✓ Выбрано: ', confirm: '. Менеджер подтвердит запись звонком.',
    noteLive: 'Серым — время уже занято. Можно не выбирать — согласуем по телефону.', note: 'Можно не выбирать — согласуем время по телефону.',
    pick: 'выбрать', full: 'занято', last: 'последнее место', free: 'свободно', allFull: 'Всё занято'
  } : {
    wd: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], mon: ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'],
    at: ' о ', title: 'Оберіть зручний день і час', opt: 'необовʼязково', day: 'День', time: 'Час початку',
    chosen: '✓ Обрано: ', confirm: '. Менеджер підтвердить запис дзвінком.',
    noteLive: 'Сірим — час уже зайнятий. Можна не обирати — узгодимо по телефону.', note: 'Можна не обирати — узгодимо час по телефону.',
    pick: 'обрати', full: 'зайнято', last: 'останнє місце', free: 'вільно', allFull: 'Усе зайнято'
  };
  var WD = T.wd;
  var MON = T.mon;
  var REFRESH_MS = 60 * 1000;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function parseDate(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function label(iso, t) {
    var d = parseDate(iso);
    return WD[d.getDay()].toLowerCase() + ', ' + ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + (t ? T.at + t : '');
  }

  function cityOf(form) {
    var c = form.querySelector('[name=city]');
    var v = (c && c.value) || '';
    return /льв|lviv/i.test(v) || /lviv/i.test(location.pathname) ? 'lviv' : 'kyiv';
  }

  function mount(form) {
    var submit = form.querySelector('button[type=submit]');
    if (!submit || form.querySelector('.ct-bk')) return;
    var anchor = submit;
    while (anchor.parentElement && anchor.parentElement !== form) anchor = anchor.parentElement;

    var box = el('div', 'ct-bk');
    box.hidden = true;
    box.innerHTML =
      '<div class="ct-bk-head"><span class="ct-bk-title">' + T.title + '</span><span class="ct-bk-opt">' + T.opt + '</span></div>' +
      '<div class="ct-bk-days" role="group" aria-label="' + T.day + '"></div>' +
      '<div class="ct-bk-times" role="group" aria-label="' + T.time + '"></div>' +
      '<p class="ct-bk-note"></p>' +
      '<input type="hidden" name="slot_date" value=""><input type="hidden" name="slot_time" value="">';
    form.insertBefore(box, anchor);

    var daysEl = box.querySelector('.ct-bk-days');
    var timesEl = box.querySelector('.ct-bk-times');
    var noteEl = box.querySelector('.ct-bk-note');
    var inDate = box.querySelector('[name=slot_date]');
    var inTime = box.querySelector('[name=slot_time]');
    var state = { days: [], live: false, day: '', city: '', loadedAt: 0 };

    function setNote() {
      if (inDate.value && inTime.value) {
        noteEl.innerHTML = T.chosen + '<b>' + label(inDate.value, inTime.value) + '</b>' + T.confirm;
      } else {
        noteEl.textContent = state.live
          ? T.noteLive
          : T.note;
      }
    }

    function freeLabel(s) {
      if (!state.live) return T.pick;
      if (s.free <= 0) return T.full;
      return s.free === 1 ? T.last : T.free;
    }

    function renderTimes() {
      timesEl.innerHTML = '';
      var day = state.days.filter(function (d) { return d.date === state.day; })[0];
      if (!day) return;
      day.slots.forEach(function (s) {
        var b = el('button', 'ct-bk-time', '<b>' + s.t + '</b><small>' + freeLabel(s) + '</small>');
        b.type = 'button';
        var full = state.live && s.free <= 0;
        b.disabled = full;
        if (full) b.classList.add('is-full');
        if (s.free === 1 && state.live) b.classList.add('is-last');
        var on = inDate.value === day.date && inTime.value === s.t;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.addEventListener('click', function () {
          if (inDate.value === day.date && inTime.value === s.t) { inDate.value = ''; inTime.value = ''; }
          else { inDate.value = day.date; inTime.value = s.t; }
          renderTimes(); setNote();
        });
        timesEl.appendChild(b);
      });
    }

    function renderDays() {
      daysEl.innerHTML = '';
      state.days.forEach(function (d) {
        var dt = parseDate(d.date);
        var anyFree = !state.live || d.slots.some(function (s) { return s.free > 0; });
        var b = el('button', 'ct-bk-day',
          '<span>' + WD[dt.getDay()] + '</span><b>' + dt.getDate() + '</b><small>' + MON[dt.getMonth()] + '</small>');
        b.type = 'button';
        if (!anyFree) { b.classList.add('is-full'); b.title = T.allFull; }
        if ([0, 6].indexOf(dt.getDay()) >= 0) b.classList.add('is-weekend');
        b.setAttribute('aria-pressed', d.date === state.day ? 'true' : 'false');
        b.addEventListener('click', function () { state.day = d.date; renderDays(); renderTimes(); });
        daysEl.appendChild(b);
      });
    }

    function apply(data) {
      state.days = (data && data.days) || [];
      state.live = !!(data && data.live);
      state.loadedAt = Date.now();
      if (!state.days.length) { box.hidden = true; return; }
      // обраний раніше час став недоступним — скидаємо
      var still = state.days.some(function (d) {
        return d.date === inDate.value && d.slots.some(function (s) { return s.t === inTime.value && (!state.live || s.free > 0); });
      });
      if (!still) { inDate.value = ''; inTime.value = ''; }
      if (!state.days.some(function (d) { return d.date === state.day; })) {
        var first = state.days.filter(function (d) { return !state.live || d.slots.some(function (s) { return s.free > 0; }); })[0];
        state.day = (first || state.days[0]).date;
      }
      box.hidden = false;
      renderDays(); renderTimes(); setNote();
    }

    function load() {
      var city = cityOf(form);
      state.city = city;
      fetch(API + '/api/chistotak-slots?city=' + city, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && state.city === city) apply(j); })
        .catch(function () { /* сервер недоступний — форма працює без запису */ });
    }

    var citySel = form.querySelector('select[name=city]');
    if (citySel) citySel.addEventListener('change', load);
    // Свіжі місця, коли людина повертається до форми
    form.addEventListener('focusin', function () { if (Date.now() - state.loadedAt > REFRESH_MS) load(); });
    load();
  }

  function init() {
    var form = document.getElementById('order-form');
    if (form) mount(form);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.CTBooking = { label: label };
})();
