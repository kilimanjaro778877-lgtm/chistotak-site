/* ЧистоТак — ручне введення площі в калькуляторах.
 * Велика цифра площі стає полем вводу: можна вписати з клавіатури, а можна тягнути повзунок —
 * вони синхронізовані. Наявні скрипти калькуляторів не змінюються: поле лише керує повзунком
 * (подія 'input'), а повзунок, як і раніше, оновлює цифру й ціну.
 */
(function () {
  'use strict';

  // [повзунок, елемент з цифрою площі]
  var PAIRS = [
    ['area-slider', 'area-value'],   // головна
    ['pg-slider', 'pg-area'],        // сторінки послуг
    ['area-range', 'area-display']   // Київ / Львів
  ];

  function enhance(sliderId, valueId) {
    var slider = document.getElementById(sliderId);
    var shown = document.getElementById(valueId);
    if (!slider || !shown || shown.dataset.ctArea) return;
    shown.dataset.ctArea = '1';

    var input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.className = 'ct-area-input ' + shown.className;
    input.setAttribute('aria-label', 'Площа, м²');
    input.value = shown.textContent.trim();
    shown.style.display = 'none';
    shown.insertAdjacentElement('afterend', input);

    function bounds() {
      return { min: parseFloat(slider.min) || 0, max: parseFloat(slider.max) || 9999 };
    }
    function push(v) {
      slider.value = v;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Повзунок / скрипт калькулятора змінили цифру → оновлюємо поле (якщо людина зараз не вводить)
    new MutationObserver(function () {
      if (document.activeElement !== input) input.value = shown.textContent.trim();
    }).observe(shown, { childList: true, characterData: true, subtree: true });

    // Під час вводу застосовуємо лише допустимі значення, щоб «2» на шляху до «25» не стрибало
    input.addEventListener('input', function () {
      var v = parseInt(input.value, 10), b = bounds();
      if (!isNaN(v) && v >= b.min && v <= b.max) push(v);
    });
    // На виході з поля — підрізаємо до меж
    function commit() {
      var v = parseInt(input.value, 10), b = bounds();
      if (isNaN(v)) v = parseInt(slider.value, 10);
      v = Math.max(b.min, Math.min(b.max, v));
      input.value = v;
      push(v);
    }
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
    input.addEventListener('focus', function () { input.select(); });

    // Межі повзунка можуть змінюватися (на головній — при виборі іншої послуги)
    new MutationObserver(function () { input.min = slider.min; input.max = slider.max; })
      .observe(slider, { attributes: true, attributeFilter: ['min', 'max'] });
    input.min = slider.min; input.max = slider.max;
  }

  function init() { PAIRS.forEach(function (p) { enhance(p[0], p[1]); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
