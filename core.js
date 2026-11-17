/* =========================================================================
   AXIOS GLASS — core utilities
   Shared by the extension content script and the standalone demo.
   ========================================================================= */

(function (global) {
  'use strict';

  const NS = 'axiosglass:';
  const KEYS = {
    active: NS + 'active',
    section: NS + 'section',
    simulations: NS + 'simulations',
    completed: NS + 'completed',
    read: NS + 'read',
    gradeFilter: NS + 'grade-filter',
    registerFilter: NS + 'register-filter',
    sort: NS + 'sort',
    target: NS + 'target'
  };

  function storageGet(key, fallback) {
    try {
      const raw = global.localStorage && global.localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      if (global.localStorage) global.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* storage can be unavailable in some contexts */ }
  }

  function parseGrade(text) {
    if (text == null) return null;
    let s = String(text).trim().replace(/\u00a0/g, ' ');
    if (!s) return null;

    // Unicode fractions, including mojibake-prone sources.
    s = s.replace(/(\d+)\s*(?:½|1\/2)/gi, '$1.5');
    s = s.replace(/½/g, '0.5');

    const lower = s.toLowerCase();
    const judgements = [
      [/gravemente|insufficiente|non sufficiente|scarso/, 5],
      [/eccellente|ottimo/, 10],
      [/distinto/, 9],
      [/buono/, 8],
      [/discreto/, 7],
      [/sufficiente/, 6]
    ];
    for (let i = 0; i < judgements.length; i++) {
      if (judgements[i][0].test(lower)) return judgements[i][1];
    }

    s = s.replace(/,/g, '.');

    // Fraction scores such as 7/8 -> 7.5.
    const frac = s.match(/\b(10|[1-9])\s*\/\s*(10|[1-9])\b/);
    if (frac) return clamp((parseFloat(frac[1]) + parseFloat(frac[2])) / 2);

    // Numeric score with + / ++ / - / -- suffixes.
    const num = s.match(/\b(10|[1-9])(?:\.(\d+))?\s*(\+\+|\+|--|-)?/);
    if (num) {
      let value = parseFloat(num[1]) + (num[2] ? parseFloat('0.' + num[2]) : 0);
      const suffix = num[3] || '';
      if (suffix === '++') value += 0.5;
      else if (suffix === '+') value += 0.25;
      else if (suffix === '--') value -= 0.5;
      else if (suffix === '-') value -= 0.25;
      return clamp(value);
    }
    return null;
  }

  function clamp(value) {
    return Math.max(1, Math.min(10, Math.round(value * 100) / 100));
  }

  function mean(values) {
    const usable = values.filter(function (v) { return typeof v === 'number' && isFinite(v); });
    if (!usable.length) return null;
    return usable.reduce(function (a, b) { return a + b; }, 0) / usable.length;
  }

  function chronological(grades) {
    return grades.slice().sort(function (a, b) {
      return parseItalianDate(a.date) - parseItalianDate(b.date);
    });
  }

  function parseItalianDate(value) {
    const parts = String(value || '').match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!parts) return 0;
    let year = parseInt(parts[3], 10);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    return new Date(year, parseInt(parts[2], 10) - 1, parseInt(parts[1], 10)).getTime();
  }

  function normalize(raw) {
    const input = raw || {};
    const grades = (input.grades || []).map(function (g, index) {
      const value = typeof g.value === 'number' ? g.value : parseGrade(g.display || g.raw || g.value);
      return {
        id: g.id || 'g-' + index,
        subject: String(g.subject || 'Generale'),
        value: value,
        display: g.display || (value != null ? formatNumber(value) : String(g.raw || '—')),
        raw: g.raw || g.display || '',
        date: g.date || '',
        type: g.type || '',
        teacher: g.teacher || '',
        comment: g.comment || '',
        simulated: !!g.simulated,
        counts: g.faMedia !== false
      };
    }).filter(function (g) { return g.value != null; });

    const bySubject = {};
    grades.forEach(function (g) {
      if (!bySubject[g.subject]) bySubject[g.subject] = [];
      bySubject[g.subject].push(g);
    });

    const subjects = Object.keys(bySubject).map(function (name) {
      const list = bySubject[name];
      const counted = list.filter(function (g) { return g.counts; });
      return {
        name: name,
        average: mean(counted.map(function (g) { return g.value; })),
        realAverage: mean(counted.filter(function (g) { return !g.simulated; }).map(function (g) { return g.value; })),
        gradeCount: counted.length,
        totalCount: list.length,
        teacher: (list.find(function (g) { return g.teacher; }) || {}).teacher || '',
        grades: list
      };
    }).sort(function (a, b) { return (b.average || 0) - (a.average || 0); });

    const ordered = chronological(grades.filter(function (g) { return g.counts && !g.simulated; }));
    const values = ordered.map(function (g) { return g.value; });
    const overall = mean(values);
    const half = Math.floor(values.length / 2);
    const firstHalf = mean(values.slice(0, half));
    const secondHalf = mean(values.slice(half));
    const trend = firstHalf != null && secondHalf != null ? secondHalf - firstHalf : 0;

    // Rolling average over the last 5 grades gives a readable trend line.
    const points = [];
    for (let i = 0; i < values.length; i++) {
      const window = values.slice(Math.max(0, i - 4), i + 1);
      points.push(Math.round(mean(window) * 100) / 100);
    }

    const distribution = {
      high: grades.filter(function (g) { return g.value >= 8; }).length,
      mid: grades.filter(function (g) { return g.value >= 6 && g.value < 8; }).length,
      low: grades.filter(function (g) { return g.value < 6; }).length
    };

    const register = (input.register || []).map(function (r, i) {
      return {
        id: r.id || 'r-' + i,
        type: r.type || 'argomento',
        title: r.title || 'Attività',
        subject: r.subject || '',
        date: r.date || '',
        teacher: r.teacher || '',
        description: r.description || '',
        done: !!(input.completed && input.completed[r.id || 'r-' + i])
      };
    });

    const attendance = input.attendance || [];
    const communications = (input.communications || []).map(function (c, i) {
      const id = c.id || 'c-' + i;
      return {
        id: id,
        title: c.title || 'Comunicazione',
        from: c.from || '',
        date: c.date || '',
        body: c.body || '',
        action: c.action || '',
        readAt: c.readAt || '',
        unread: !(input.read && input.read[id]) && !c.read
      };
    });

    const sims = input.simulations || {};
    const simulatedSubjectAverages = subjects.map(function (s) {
      return sims[s.name] != null ? Number(sims[s.name]) : s.average;
    }).filter(function (v) { return typeof v === 'number' && isFinite(v); });
    const simulatedAverage = simulatedSubjectAverages.length ? mean(simulatedSubjectAverages) : overall;

    const eventDays = (input.events || []).map(function (e) {
      return String(e.date || '').slice(0, 5);
    });

    return {
      meta: input.meta || {},
      section: input.section || 'dashboard',
      search: input.search || '',
      gradeQuery: input.gradeQuery || '',
      gradeFilter: input.gradeFilter || 'all',
      registerFilter: input.registerFilter || 'all',
      sort: input.sort || 'date-desc',
      subjectFilter: input.subjectFilter || '',
      openMessageId: input.openMessageId || null,
      target: input.target != null ? input.target : 8,
      reportRows: input.reportRows || [],
      week: input.week || '',
      pageText: input.pageText || [],
      todayLabel: input.todayLabel || new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }),
      now: input.now || new Date(),
      grades: grades,
      subjects: subjects,
      register: register,
      attendance: attendance,
      communications: communications,
      events: input.events || [],
      eventDays: eventDays,
      timetable: input.timetable || [],
      simulations: sims,
      simulatedAverage: simulatedAverage,
      summary: {
        average: overall,
        hasGrades: grades.length > 0,
        hasAttendance: attendance.length > 0 || !!(input.summary && input.summary.hasAttendance),
        hasRegister: register.length > 0,
        gradeCount: grades.length,
        subjectCount: subjects.length,
        trend: trend,
        trendPoints: points,
        distribution: distribution,
        absenceCount: (input.summary && input.summary.absenceCount) || attendance.filter(function (a) { return a.kind === 'assenza'; }).length,
        lateCount: (input.summary && input.summary.lateCount) || attendance.filter(function (a) { return a.kind === 'ritardo'; }).length,
        justifiedCount: (input.summary && input.summary.justifiedCount) || attendance.filter(function (a) { return a.justified && String(a.justified).toLowerCase() !== 'no'; }).length,
        presenceRate: (input.summary && input.summary.presenceRate) || '—',
        openTasks: register.filter(function (r) { return !r.done; }).length
      },
      unreadCount: communications.filter(function (c) { return c.unread; }).length
    };
  }

  // Grade needed on the next verification to reach a target average.
  function targetGrade(subject, target) {
    if (!subject || !isFinite(target)) return null;
    const counted = (subject.grades || []).filter(function (g) { return g.counts && !g.simulated; });
    if (!counted.length) return null;
    const sum = counted.reduce(function (a, g) { return a + g.value; }, 0);
    return target * (counted.length + 1) - sum;
  }

  function formatNumber(value) {
    return Number(value).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }

  // Re-render while keeping text inputs focused and their caret position.
  function rerender(root, data, handlers) {
    const active = document.activeElement;
    let focus = null;
    if (active && root && root.contains(active)) {
      focus = {
        action: active.getAttribute && active.getAttribute('data-action'),
        subject: active.getAttribute && active.getAttribute('data-subject'),
        id: active.getAttribute && active.getAttribute('data-id'),
        start: typeof active.selectionStart === 'number' ? active.selectionStart : null,
        end: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
      };
    }
    if (global.AxiosGlassUI) global.AxiosGlassUI.mount(root, data, handlers);
    if (focus && focus.action) {
      const selector = '[data-action="' + focus.action + '"]' +
        (focus.subject ? '[data-subject="' + focus.subject + '"]' : '') +
        (focus.id ? '[data-id="' + focus.id + '"]' : '');
      const next = root.querySelector(selector);
      if (next) {
        next.focus();
        if (focus.start != null && next.setSelectionRange) {
          try { next.setSelectionRange(focus.start, focus.end); } catch (e) { /* ignore */ }
        }
      }
    }
  }

  global.AxiosGlassCore = {
    KEYS: KEYS,
    storageGet: storageGet,
    storageSet: storageSet,
    parseGrade: parseGrade,
    normalize: normalize,
    targetGrade: targetGrade,
    rerender: rerender,
    mean: mean,
    clamp: clamp
  };
})(window);
