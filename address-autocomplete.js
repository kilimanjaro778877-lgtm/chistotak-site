(function () {
  'use strict';

  var DEBOUNCE_MS = 400;
  var MIN_CHARS = 3;

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function setupField(input) {
    if (input.dataset.ctAutocompleteInit) return;
    input.dataset.ctAutocompleteInit = '1';
    input.setAttribute('autocomplete', 'off');

    var wrap = input.parentElement;
    if (getComputedStyle(wrap).position === 'static') {
      wrap.style.position = 'relative';
    }

    var list = document.createElement('div');
    list.className = 'ct-address-suggestions';
    list.style.cssText =
      'position:absolute;left:0;right:0;top:100%;margin-top:4px;z-index:60;' +
      'background:#18181b;border:1px solid #3f3f46;border-radius:0.75rem;' +
      'max-height:220px;overflow-y:auto;display:none;box-shadow:0 10px 30px rgba(0,0,0,0.5)';
    wrap.appendChild(list);

    var controller = null;

    function hide() {
      list.style.display = 'none';
      list.innerHTML = '';
    }

    function renderResults(items) {
      list.innerHTML = '';
      if (!items.length) { hide(); return; }
      items.forEach(function (item) {
        var row = document.createElement('div');
        row.textContent = item.display_name;
        row.style.cssText =
          'padding:10px 14px;font-size:14px;color:#e4e4e7;cursor:pointer;border-bottom:1px solid #27272a';
        row.addEventListener('mouseenter', function () { row.style.background = '#27272a'; });
        row.addEventListener('mouseleave', function () { row.style.background = ''; });
        row.addEventListener('mousedown', function (e) {
          e.preventDefault();
          input.value = item.display_name;
          hide();
        });
        list.appendChild(row);
      });
      list.style.display = 'block';
    }

    var search = debounce(function (query) {
      if (query.length < MIN_CHARS) { hide(); return; }
      if (controller) controller.abort();
      controller = new AbortController();

      var url = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=0'
        + '&countrycodes=ua&limit=6&accept-language=uk&q=' + encodeURIComponent(query);

      fetch(url, { signal: controller.signal })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(renderResults)
        .catch(function () { /* aborted or offline — silently ignore, field still works as free text */ });
    }, DEBOUNCE_MS);

    input.addEventListener('input', function () { search(input.value.trim()); });
    input.addEventListener('blur', function () { setTimeout(hide, 150); });
  }

  function init() {
    document.querySelectorAll('input[name="address"]').forEach(setupField);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
