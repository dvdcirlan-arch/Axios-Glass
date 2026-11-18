/* =========================================================================
   AXIOS GLASS — extension entry point
   Boots only on real Axios pages, mounts the new UI without deleting the
   original ASP.NET DOM, and keeps everything in sync via a MutationObserver.
   ========================================================================= */

(function (global) {
  'use strict';

  if (global.__AXIOS_GLASS_INJECTED__) return;
  global.__AXIOS_GLASS_INJECTED__ = true;

  const Core = global.AxiosGlassCore;
  const UI = global.AxiosGlassUI;
  const Scraper = global.AxiosGlassScraper;
  const doc = global.document;
  const KEYS = Core.KEYS;
  const CACHE_KEY = 'axiosglass:session-cache';

  const NAV_ACTIONS = {
    voti: 'FAMILY_VOTI',
    registro: 'FAMILY_REGISTRO_CLASSE',
    compiti: 'FAMILY_REGISTRO_CLASSE_COMPITI',
    dashboard: 'DASHBOARDLOAD',
    assenze: 'FAMILY_ASSENZE',
    comunicazioni: 'FAMILY_COMUNICAZIONI',
    orario: 'FAMILY_ORARIO',
    pagella: 'FAMILY_PAGELLA'
  };

  const state = {
    active: Core.storageGet(KEYS.active, true),
    section: Core.storageGet(KEYS.section, 'dashboard'),
    simulations: Core.storageGet(KEYS.simulations, {}),
    completed: Core.storageGet(KEYS.completed, {}),
    read: Core.storageGet(KEYS.read, {}),
    gradeFilter: Core.storageGet(KEYS.gradeFilter, 'all'),
    registerFilter: Core.storageGet(KEYS.registerFilter, 'all'),
    registerSort: Core.storageGet(KEYS.registerSort, 'date'),
    sort: Core.storageGet(KEYS.sort, 'date-desc'),
    target: Core.storageGet(KEYS.target, 8),
    search: '',
    gradeQuery: '',
    subjectFilter: '',
    openMessageId: null
  };

  let lastData = null;
  let root = null;
  let restorePill = null;
  let rendering = false;
  let observer = null;
  let debounceTimer = null;
  let observedHost = null;
  let forcedSection = null;

  function save(key, value) { Core.storageSet(key, value); }

  function loadCache() {
    try {
      return JSON.parse(global.sessionStorage.getItem(CACHE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveCache(cache) {
    try {
      global.sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) { /* sessionStorage may be unavailable */ }
  }

  function keep(key, current, cache) {
    if (current && current.length) {
      cache[key] = current;
      return current;
    }
    return cache[key] || [];
  }

  function mergeById(current, cached) {
    const map = Object.create(null);
    (cached || []).forEach(function (item) { map[item.id] = item; });
    (current || []).forEach(function (item) { map[item.id] = item; });
    return Object.keys(map).map(function (key) { return map[key]; });
  }

  function dateKey(value) {
    const parts = String(value || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return parts ? parts[3] + parts[2] + parts[1] : '99999999';
  }

  function trigger(selector) {
    const el = doc.querySelector(selector);
    if (!el) return false;
    const inner = el.querySelector('a');
    (inner || el).click();
    return true;
  }

  // The "Compiti e Verifiche" tab only exists after Registro di classe loaded.
  // Click it when present, otherwise load Registro first and then click the tab.
  function waitFor(selector, callback, timeout) {
    const started = Date.now();
    function attempt() {
      const el = doc.querySelector(selector);
      if (el) { callback(el); return; }
      if (Date.now() - started < (timeout || 5000)) global.setTimeout(attempt, 120);
    }
    attempt();
  }

  function openCompitiTab() {
    const tab = '[data-action="FAMILY_REGISTRO_CLASSE_COMPITI"]';
    if (doc.querySelector(tab)) { trigger(tab); return; }
    if (trigger('[data-action="FAMILY_REGISTRO_CLASSE"]')) {
      waitFor(tab, function () { trigger(tab); });
    }
  }

  function triggerMessage(id) {
    const el = Scraper.messageTrigger && Scraper.messageTrigger(id);
    if (!el) return false;
    const link = el.matches && el.matches('a') ? el : (el.querySelector('a[href]') || el);
    link.click();
    return true;
  }

  function triggerAttachment(id) {
    const el = Scraper.attachmentTrigger && Scraper.attachmentTrigger(id);
    if (!el) return false;
    el.click();
    return true;
  }

  function moveMessage(step) {
    const list = (lastData && lastData.communications) || [];
    let index = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === state.openMessageId) { index = i; break; }
    }
    const next = index + step;
    if (next < 0 || next >= list.length) return;
    state.openMessageId = list[next].id;
    state.read[state.openMessageId] = true;
    save(KEYS.read, state.read);
    render();
  }

  function collect() {
    // Once the user picks a section, keep it stable across re-renders;
    // DOM detection is only the initial fallback on a fresh page load.
    const section = forcedSection || Scraper.detectSection(state.section);
    state.section = section;
    save(KEYS.section, section);

    const raw = {
      meta: Scraper.metadata(),
      section: section,
      search: state.search,
      gradeQuery: state.gradeQuery,
      gradeFilter: state.gradeFilter,
      registerFilter: state.registerFilter,
      registerSort: state.registerSort,
      sort: state.sort,
      subjectFilter: state.subjectFilter,
      openMessageId: state.openMessageId,
      target: state.target,
      simulations: state.simulations,
      completed: state.completed,
      read: state.read
    };

    const cache = loadCache();

    raw.grades = keep('grades', Scraper.scrapeGrades(), cache);
    const register = Scraper.scrapeRegister();
    // Drop cached rows from the same live source: the weekly table and the
    // "Compiti e Verifiche" table must never be mixed into one stale list.
    const cachedRegister = (cache.register || []).filter(function (item) {
      return !register.source || item.source !== register.source;
    });
    raw.register = mergeById(register.items, cachedRegister);
    cache.register = raw.register;
    if (register.week) {
      raw.week = register.week;
      cache.week = register.week;
    } else {
      raw.week = cache.week || '';
    }

    if (['assenze', 'comunicazioni', 'orario', 'pagella'].indexOf(section) >= 0) {
      const extra = Scraper.scrapeGeneric(section);
      Object.keys(extra).forEach(function (key) {
        // Pagella tables must never feed fake grades into cached Voti data.
        if (key === 'grades') return;
        raw[key] = keep(key, extra[key], cache);
      });
      if (extra.pageText) raw.pageText = extra.pageText;
      if (extra.summary) {
        cache.summary = extra.summary;
        raw.summary = extra.summary;
      }
    } else {
      ['attendance', 'communications', 'timetable', 'reportRows', 'pageText'].forEach(function (key) {
        raw[key] = cache[key] || [];
      });
      if (cache.summary) raw.summary = cache.summary;
    }

    // Upcoming commitments are derived from the register, so they exist on every page.
    raw.events = raw.register.filter(function (item) {
      return item.type !== 'argomento' && /\d{2}\/\d{2}\/\d{4}/.test(item.date || '');
    }).map(function (item) {
      return { date: item.date, title: item.title, subject: item.subject };
    }).sort(function (a, b) { return dateKey(a.date) - dateKey(b.date); });

    saveCache(cache);
    lastData = Core.normalize(raw);
    return lastData;
  }

  function render() {
    if (!root || !state.active) return;
    rendering = true;
    try {
      const data = collect();
      Core.rerender(root, data, handlers);
    } finally {
      rendering = false;
    }
  }

  function toast(message) {
    const old = doc.querySelector('.ag-toast');
    if (old) old.remove();
    const el = doc.createElement('div');
    el.className = 'ag-toast';
    el.textContent = message;
    doc.body.appendChild(el);
    global.setTimeout(function () { el.remove(); }, 2400);
  }

  function setActive(active) {
    state.active = active;
    save(KEYS.active, active);
    doc.body.classList.toggle('ag-active', active);
    if (root) root.style.display = active ? '' : 'none';
    if (restorePill) restorePill.style.display = active ? 'none' : '';
    if (active) render();
  }

  /* ------------------------------------------------------------- handlers */
  const handlers = {
    nav: function (payload) {
      if (!payload.section) return;
      forcedSection = payload.section;
      state.section = payload.section;
      state.subjectFilter = '';
      state.openMessageId = null;
      state.registerFilter = 'all';
      save(KEYS.registerFilter, state.registerFilter);
      save(KEYS.section, state.section);
      render();
      if (payload.section === 'compiti') {
        openCompitiTab();
      } else {
        const action = NAV_ACTIONS[payload.section];
        if (action) trigger('[data-action="' + action + '"]');
      }
      global.scrollTo({ top: 0, behavior: 'smooth' });
    },
    search: function (payload) {
      state.search = payload.value;
      state.gradeQuery = payload.value;
      render();
    },
    'grade-search': function (payload) { state.gradeQuery = payload.value; render(); },
    'grade-filter': function (payload) {
      state.gradeFilter = payload.filter;
      save(KEYS.gradeFilter, state.gradeFilter);
      render();
    },
    'register-filter': function (payload) {
      state.registerFilter = payload.filter === 'compito' || payload.filter === 'verifica'
        ? payload.filter : 'all';
      save(KEYS.registerFilter, state.registerFilter);
      render();
    },
    'register-sort': function (payload) {
      state.registerSort = payload.sort === 'alpha' ? 'alpha' : 'date';
      save(KEYS.registerSort, state.registerSort);
      render();
    },
    sort: function (payload) { state.sort = payload.sort; save(KEYS.sort, state.sort); render(); },
    subject: function (payload) {
      state.subjectFilter = payload.subject;
      forcedSection = 'voti';
      state.section = 'voti';
      save(KEYS.section, state.section);
      render();
    },
    'toggle-task': function (payload) {
      state.completed[payload.id] = !state.completed[payload.id];
      save(KEYS.completed, state.completed);
      render();
      toast(state.completed[payload.id] ? 'Attività completata' : 'Attività ripristinata');
    },
    'open-message': function (payload) {
      state.openMessageId = payload.id;
      state.read[payload.id] = true;
      save(KEYS.read, state.read);
      render();
    },
    'message-prev': function () { moveMessage(-1); },
    'message-next': function () { moveMessage(1); },
    'close-modal': function () {
      state.openMessageId = null;
      render();
    },
    'open-original': function (payload) {
      if (!triggerMessage(payload.id)) toast('Il messaggio originale non è più disponibile nella pagina.');
    },
    'open-attachment': function (payload) {
      if (!triggerAttachment(payload.id)) toast('L’allegato non è più disponibile nella pagina.');
    },
    'sim-input': function (payload) {
      state.simulations[payload.subject] = Number(payload.value);
      save(KEYS.simulations, state.simulations);
      render();
    },
    'sim-reset': function (payload) {
      delete state.simulations[payload.subject];
      save(KEYS.simulations, state.simulations);
      render();
    },
    'sim-clear': function () {
      state.simulations = {};
      save(KEYS.simulations, {});
      render();
      toast('Simulazioni azzerate');
    },
    'target-input': function (payload) {
      state.target = Number(payload.value);
      save(KEYS.target, state.target);
      render();
    },
    'week-prev': function () { trigger('button.settimana-naviga[data-others="-7"]'); },
    'week-next': function () { trigger('button.settimana-naviga[data-others="+7"]'); },
    notifications: function () {
      forcedSection = 'comunicazioni';
      state.section = 'comunicazioni';
      save(KEYS.section, state.section);
      render();
      trigger('[data-action="FAMILY_COMUNICAZIONI"]');
    },
    classic: function () { setActive(false); },
    'reload-data': function () { render(); toast('Dati ricaricati'); }
  };

  /* ------------------------------------------------------------------ boot */
  function ensureShell() {
    root = doc.getElementById('axglass-app');
    if (!root) {
      root = doc.createElement('div');
      root.id = 'axglass-app';
      doc.body.prepend(root);
    }

    restorePill = doc.getElementById('axglass-restore');
    if (!restorePill) {
      restorePill = doc.createElement('button');
      restorePill.id = 'axglass-restore';
      restorePill.className = 'ag-fab';
      restorePill.innerHTML = UI.icon('sparkles') + '<span>Mostra Axios Glass</span>';
      restorePill.addEventListener('click', function () { setActive(true); });
      doc.body.appendChild(restorePill);
    }
  }

  function relevantMutation(mutations) {
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      const nodes = m.addedNodes || [];
      for (let j = 0; j < nodes.length; j++) {
        const node = nodes[j];
        if (node.nodeType !== 1) continue;
        if (node.id === 'axglass-app' || node.id === 'axglass-restore') continue;
        if (node.closest && node.closest('#axglass-app')) continue;
        return true;
      }
      if (m.type === 'characterData' && m.target && m.target.parentElement &&
          !m.target.parentElement.closest('#axglass-app')) return true;
    }
    return false;
  }

  function attachObserver() {
    if (observer) observer.disconnect();
    observedHost = doc.getElementById('page-content') || doc.body;
    observer = new global.MutationObserver(function (mutations) {
      if (rendering || !state.active || !relevantMutation(mutations)) return;
      global.clearTimeout(debounceTimer);
      debounceTimer = global.setTimeout(function () {
        const host = doc.getElementById('page-content') || doc.body;
        if (host !== observedHost) attachObserver();
        render();
      }, 140);
    });
    observer.observe(observedHost, { childList: true, subtree: true, characterData: true });
  }

  function boot() {
    if (Scraper.isLoginPage()) return;
    if (!doc.getElementById('page-content') && !doc.getElementById('content-alunno')) return;

    ensureShell();
    doc.body.classList.toggle('ag-active', state.active);
    if (restorePill) restorePill.style.display = state.active ? 'none' : '';
    render();
    attachObserver();

    doc.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        const input = root && root.querySelector('[data-action="search"]');
        if (input) { event.preventDefault(); input.focus(); input.select(); }
      }
    });
  }

  // Public hooks used by the Android WebView shell (harmless for the extension).
  global.AxiosGlassMobile = {
    setActive: setActive,
    render: render,
    isActive: function () { return state.active; },
    section: function () { return state.section; }
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
