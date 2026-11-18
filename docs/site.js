/* =========================================================================
   AXIOS GLASS — GitHub Pages landing page controller
   Handles the IT/EN switch and the "copy clone command" button.
   ========================================================================= */

(function () {
  'use strict';

  var KEY = 'axiosglass:site-lang';
  var nodes = document.querySelectorAll('[data-it][data-en]');
  var buttons = document.querySelectorAll('.lang-switch button');

  function apply(lang) {
    var next = lang === 'en' ? 'en' : 'it';
    document.documentElement.lang = next;
    Array.prototype.forEach.call(nodes, function (el) {
      // Static authored strings only; allows <b> inside badges.
      el.innerHTML = el.getAttribute('data-' + next) || el.innerHTML;
    });
    var copyBtn = document.querySelector('[data-copy]');
    if (copyBtn && copyBtn.getAttribute('data-it-toast')) {
      copyBtn.setAttribute('data-toast', copyBtn.getAttribute('data-' + next + '-toast') || copyBtn.getAttribute('data-toast'));
    }
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang') === next);
      btn.setAttribute('aria-pressed', btn.getAttribute('data-lang') === next ? 'true' : 'false');
    });
    try { localStorage.setItem(KEY, next); } catch (e) { /* storage may be blocked */ }
  }

  Array.prototype.forEach.call(buttons, function (btn) {
    btn.addEventListener('click', function () { apply(btn.getAttribute('data-lang')); });
  });

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
  apply(saved || 'it');

  var copy = document.querySelector('[data-copy]');
  if (copy) {
    copy.addEventListener('click', function () {
      var value = copy.getAttribute('data-copy') || '';
      var done = function () {
        var old = document.querySelector('.site-toast');
        if (old) old.remove();
        var toast = document.createElement('div');
        toast.className = 'site-toast';
        toast.textContent = copy.getAttribute('data-toast') || 'Copiato';
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, done);
      } else {
        var input = document.createElement('textarea');
        input.value = value;
        document.body.appendChild(input);
        input.select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        input.remove();
        done();
      }
    });
  }
})();
