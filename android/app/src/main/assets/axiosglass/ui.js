/* =========================================================================
   AXIOS GLASS — UI layer
   Pure-ish rendering: takes the normalized data model and produces markup.
   No scraping, no network, no side effects except optional event binding.
   ========================================================================= */

(function (global) {
  'use strict';

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
    chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.1a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    sparkles: '<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M18 13l-6 6-6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 5v6h-6"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
    graduation: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>',
    clip: '<path d="M9 4h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"/><path d="M10 9h4M10 13h4"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/>',
    eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
    monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    download: '<path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 21h16"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'voti', label: 'Voti', icon: 'chart' },
    { id: 'registro', label: 'Registro', icon: 'book' },
    { id: 'compiti', label: 'Compiti', icon: 'clip' },
    { id: 'assenze', label: 'Presenze', icon: 'calendar' },
    { id: 'comunicazioni', label: 'Comunicazioni', icon: 'mail' },
    { id: 'orario', label: 'Orario', icon: 'clock' },
    { id: 'pagella', label: 'Pagella', icon: 'graduation' },
    { id: 'impostazioni', label: 'Impostazioni', icon: 'settings' }
  ];

  const TITLES = {
    dashboard: 'La tua giornata',
    voti: 'Valutazioni',
    registro: 'Registro di classe',
    compiti: 'Compiti e verifiche',
    assenze: 'Presenze e assenze',
    comunicazioni: 'Comunicazioni',
    orario: 'Orario settimanale',
    pagella: 'Pagella',
    impostazioni: 'Impostazioni'
  };

  function brandMark(cls) {
    return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 32 32" aria-hidden="true">' +
      '<rect x="2" y="2" width="28" height="28" rx="9" fill="#006667"/>' +
      '<path d="M10 12.5h12M10 17h9M10 21.5h5" stroke="#48BCBD" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="m21.5 5.8.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" fill="#fff"/>' +
      '</svg>';
  }

  function icon(name, cls) {
    return '<svg' + (cls ? ' class="' + esc(cls) + '"' : '') +
      ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || ICONS.sparkles) + '</svg>';
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtNum(value) {
    if (value == null || isNaN(value)) return '—';
    return Number(value).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }

  function inputNumber(value) {
    if (value == null || isNaN(value)) return '';
    return String(Math.round(Number(value) * 100) / 100);
  }

  function fmtDate(value) {
    if (!value) return '—';
    if (value instanceof Date) return value.toLocaleDateString('it-IT');
    const parts = String(value).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (parts) return parts[1].padStart(2, '0') + '/' + parts[2].padStart(2, '0') + '/' + parts[3];
    return esc(value);
  }

  function tone(value) {
    if (value >= 8) return 'top';
    if (value >= 6) return 'mid';
    return 'low';
  }

  function gradeChip(grade) {
    if (!grade) return '';
    return '<span class="ag-grade" data-tone="' + tone(grade.value) + '"' +
      (grade.simulated ? ' data-sim="true"' : '') + ' title="' + esc(grade.comment || grade.type || '') + '">' +
      esc(grade.display || fmtNum(grade.value)) + '</span>';
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (w) { return w[0].toUpperCase(); }).join('');
  }

  const TONES = ['lavender', 'mint', 'peach', 'sky', 'rose'];

  /* ------------------------------------------------------------------ shell */
  function sidebar(data) {
    const nav = NAV.map(function (item) {
      const count = item.id === 'comunicazioni' && data.unreadCount
        ? '<span class="ag-nav-badge">' + esc(data.unreadCount) + '</span>' : '';
      return '<button class="ag-nav-item' + (data.section === item.id ? ' is-active' : '') +
        '" data-action="nav" data-section="' + item.id + '">' + icon(item.icon) +
        '<span>' + item.label + '</span>' + count + '</button>';
    }).join('');

    const profile = '<div class="ag-profile">' +
      (data.meta.avatar
        ? '<img class="ag-avatar" src="' + esc(data.meta.avatar) + '" alt="">'
        : '<span class="ag-avatar">' + initials(data.meta.student) + '</span>') +
      '<div><div class="ag-profile-name">' + esc(data.meta.student || 'Studente') + '</div>' +
      '<div class="ag-profile-sub">' + esc(data.meta.className || data.meta.year || 'Registro Axios') + '</div></div>' +
      '</div>';

    return '<aside class="ag-sidebar">' +
      '<div class="ag-brand"><div class="ag-brand-mark">' + brandMark('ag-brand-logo') + '</div>' +
      '<div><div class="ag-brand-name">Axios Glass</div><div class="ag-brand-tag">Registro elettronico</div></div></div>' +
      '<div><div class="ag-nav-label">Workspace</div><nav class="ag-nav">' + nav + '</nav></div>' +
      '<div class="ag-sidebar-foot">' + profile +
      '<div class="ag-side-note">Dati letti in tempo reale dal tuo registro.<br>Nessun valore inventato.</div>' +
      '</div></aside>';
  }

  function topbar(data) {
    return '<header class="ag-topbar">' +
      '<div><div class="ag-crumb">Registro / ' + esc(TITLES[data.section] || 'Dashboard') + '</div>' +
      '<h1 class="ag-page-title">' + esc(TITLES[data.section] || 'Dashboard') + '</h1></div>' +
      '<div class="ag-topbar-spacer"></div>' +
      '<label class="ag-search">' + icon('search') +
      '<input type="search" data-action="search" placeholder="Cerca materia, voto, argomento…" value="' + esc(data.search || '') + '"></label>' +
      '<span class="ag-date-pill">' + esc(data.todayLabel || '') + '</span>' +
      '<button class="ag-icon-btn" data-action="notifications" title="Notifiche">' + icon('bell') +
      (data.unreadCount ? '<span class="ag-dot"></span>' : '') + '</button>' +
      '<button class="ag-icon-btn" data-action="classic" title="Modalità classica">' + icon('monitor') + '</button>' +
      '</header>';
  }

  /* ------------------------------------------------------------------ dashboard */
  function kpi(iconName, iconClass, label, value, suffix, foot) {
    return '<div class="ag-card ag-kpi"><div class="ag-kpi-top">' +
      '<span class="ag-kpi-ico ' + iconClass + '">' + icon(iconName) + '</span>' +
      '</div><div class="ag-kpi-label">' + esc(label) + '</div>' +
      '<div class="ag-kpi-value ag-mono">' + value + (suffix ? ' <small>' + esc(suffix) + '</small>' : '') + '</div>' +
      '<div class="ag-kpi-foot">' + foot + '</div></div>';
  }

  function hero(data) {
    const s = data.summary;
    return '<section class="ag-hero">' +
      '<div style="position:relative;z-index:1">' +
      '<span class="ag-hero-eyebrow">' + brandMark('ag-hero-logo') + ' ' + esc(data.meta.institute || 'Anno scolastico') + '</span>' +
      '<h1>Ciao ' + esc((data.meta.student || '').split(' ')[0] || 'studente') + ' 👋</h1>' +
      '<p>Ecco come sta andando il tuo percorso. ' +
      (s.gradeCount ? 'Hai <b>' + esc(s.gradeCount) + '</b> valutazioni registrate e una media complessiva di <b>' + fmtNum(s.average) + '</b>.' : 'I dati appariranno appena il registro caricherà le valutazioni.') +
      '</p>' +
      '<div class="ag-hero-actions">' +
      '<button class="ag-btn ag-btn--primary" data-action="nav" data-section="voti">' + icon('chart') + ' Vedi i voti</button>' +
      '<button class="ag-btn ag-btn--ghost" data-action="nav" data-section="registro">' + icon('clip') + ' Registro</button>' +
      '</div></div>' +
      '<div class="ag-hero-art"><div class="ag-hero-ring"><b>' + fmtNum(s.average) + '</b></div>' +
      '<div class="ag-hero-spark">' + icon('sparkles') + '</div></div>' +
      '</section>';
  }

  function subjectRow(subject, index) {
    const avg = subject.average;
    const barClass = avg >= 6 ? (avg >= 8 ? '' : ' ag-bar--mid') : ' ag-bar--low';
    return '<div class="ag-subject">' +
      '<div class="ag-subject-ico" data-tone="' + TONES[index % TONES.length] + '">' + esc(initials(subject.name)) + '</div>' +
      '<div><div class="ag-subject-name">' + esc(subject.name) + '</div>' +
      '<div class="ag-subject-meta">' + esc(subject.gradeCount || 0) + ' voti' +
      (subject.teacher ? ' · ' + esc(subject.teacher) : '') + '</div></div>' +
      '<div class="ag-bar' + barClass + '"><span style="width:' + Math.max(0, Math.min(100, (avg || 0) * 10)) + '%"></span></div>' +
      '<div class="ag-subject-avg ag-mono">' + fmtNum(avg) + '</div>' +
      '<button class="ag-subject-chev" data-action="subject" data-name="' + esc(subject.name) + '" title="Filtra voti">' + icon('chevron') + '</button>' +
      '</div>';
  }

  function sparkline(points) {
    if (!points || points.length < 2) {
      return '<div class="ag-empty"><b>Servono almeno due voti</b><span>Il grafico compare quando ci sono abbastanza valutazioni.</span></div>';
    }
    const w = 520, h = 96, pad = 8;
    const min = Math.min.apply(null, points) - 0.5;
    const max = Math.max.apply(null, points) + 0.5;
    const xs = points.map(function (_, i) { return pad + (i * (w - pad * 2)) / (points.length - 1); });
    const ys = points.map(function (p) { return h - pad - ((p - min) / (max - min || 1)) * (h - pad * 2); });
    const line = xs.map(function (x, i) { return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + ys[i].toFixed(1); }).join(' ');
    const area = line + ' L' + xs[xs.length - 1].toFixed(1) + ' ' + h + ' L' + xs[0].toFixed(1) + ' ' + h + ' Z';
    return '<svg class="ag-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="agSparkGrad" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" stop-color="#006667"/><stop offset="1" stop-color="#48bcbd"/></linearGradient>' +
      '<linearGradient id="agSparkFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="rgba(0,102,103,.24)"/><stop offset="1" stop-color="rgba(0,102,103,0)"/></linearGradient></defs>' +
      '<path class="ag-spark-area" d="' + area + '"/><path class="ag-spark-line" d="' + line + '"/>' +
      '<circle class="ag-spark-dot" cx="' + xs[xs.length - 1].toFixed(1) + '" cy="' + ys[ys.length - 1].toFixed(1) + '" r="4"/>' +
      '</svg>';
  }

  function donut(distribution) {
    const total = (distribution.high || 0) + (distribution.mid || 0) + (distribution.low || 0);
    if (!total) {
      return '<div class="ag-empty"><b>Nessuna valutazione</b><span>La distribuzione apparirà quando i voti saranno disponibili.</span></div>';
    }
    const c = 2 * Math.PI * 46;
    const colors = { high: '#48bcbd', mid: '#f0c987', low: '#e3a3a3' };
    let offset = 0;
    const arcs = ['high', 'mid', 'low'].map(function (key) {
      const len = total ? ((distribution[key] || 0) / total) * c : 0;
      const seg = '<circle cx="58" cy="58" r="46" stroke="' + colors[key] + '" ' +
        'stroke-dasharray="' + len.toFixed(1) + ' ' + (c - len).toFixed(1) + '" ' +
        'stroke-dashoffset="' + (-offset).toFixed(1) + '"/>';
      offset += len;
      return seg;
    }).join('');
    return '<div class="ag-donut-wrap"><div class="ag-donut-holder">' +
      '<svg class="ag-donut" viewBox="0 0 116 116"><circle cx="58" cy="58" r="46" stroke="rgba(0,102,103,.09)"/>' +
      arcs + '</svg><div class="ag-donut-center"><b>' + fmtNum(total) + '</b><span>Valutazioni</span></div></div>' +
      '<div class="ag-legend">' +
      '<div class="ag-legend-row"><span class="ag-legend-dot" style="background:#48bcbd"></span> Ottimi (≥8) <b>' + (distribution.high || 0) + '</b></div>' +
      '<div class="ag-legend-row"><span class="ag-legend-dot" style="background:#f0c987"></span> Nella media <b>' + (distribution.mid || 0) + '</b></div>' +
      '<div class="ag-legend-row"><span class="ag-legend-dot" style="background:#e3a3a3"></span> Da migliorare <b>' + (distribution.low || 0) + '</b></div>' +
      '</div></div>';
  }

  function miniCalendar(data) {
    const now = data.now || new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const offset = (first + 6) % 7;
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push('<b></b>');
    for (let d = 1; d <= days; d++) {
      const isToday = d === now.getDate();
      const key = String(d).padStart(2, '0') + '/' + String(month + 1).padStart(2, '0');
      const isEvent = (data.eventDays || []).indexOf(key) >= 0;
      cells.push('<b' + (isToday ? ' class="is-today"' : isEvent ? ' class="is-event"' : '') + '>' + d + '</b>');
    }
    const names = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
    return '<div class="ag-mini-cal">' + names.map(function (n) { return '<span>' + n + '</span>'; }).join('') +
      cells.join('') + '</div>';
  }

  function dashboard(data) {
    const s = data.summary;
    const recent = data.grades.slice(0, 6).map(function (g) {
      return '<tr><td><strong>' + esc(g.subject) + '</strong></td>' +
        '<td>' + gradeChip(g) + '</td><td>' + fmtDate(g.date) + '</td>' +
        '<td><span class="ag-chip ag-chip--grey">' + esc(g.type || '—') + '</span></td></tr>';
    }).join('');

    return '<div class="ag-stack">' +
      hero(data) +
      '<div class="ag-kpis">' +
      kpi('chart', '', 'Media generale', fmtNum(s.average), '/ 10',
        '<span class="' + (s.trend >= 0 ? 'ag-trend-up' : 'ag-trend-down') + '">' +
        (s.trend >= 0 ? '↑' : '↓') + ' ' + fmtNum(Math.abs(s.trend || 0)) + '</span> rispetto al periodo precedente') +
      kpi('clip', 'ag-kpi-ico--mint', 'Valutazioni', s.hasGrades ? esc(s.gradeCount) : '—', 'totali',
        s.hasGrades ? esc(s.subjectCount) + ' materie monitorate' : 'Apri la sezione Voti per caricare i dati') +
      kpi('calendar', 'ag-kpi-ico--peach', 'Assenze', s.hasAttendance ? esc(s.absenceCount || 0) : '—', '',
        s.hasAttendance ? 'Presenze registrate: ' + esc(s.presenceRate || '—') : 'Nessun dato di presenza disponibile') +
      kpi('check', 'ag-kpi-ico--sky', 'Da fare', esc(s.openTasks || 0), '',
        'Compiti e verifiche in programma') +
      '</div>' +
      '<div class="ag-grid">' +
      '<div class="ag-stack">' +
      '<section class="ag-card"><div class="ag-card-head"><div><h2 class="ag-card-title">Andamento materie</h2>' +
      '<p class="ag-card-sub">Media per materia, aggiornata in tempo reale</p></div>' +
      '<span class="ag-chip ag-chip--mint">' + esc(s.subjectCount) + ' materie</span></div>' +
      '<div class="ag-subjects">' + (data.subjects.length
        ? data.subjects.map(subjectRow).join('')
        : '<div class="ag-empty"><b>Nessuna materia trovata</b><span>Apri la sezione Voti del registro per caricare i dati.</span></div>') +
      '</div></section>' +
      '<section class="ag-card"><div class="ag-card-head"><div><h2 class="ag-card-title">Ultime valutazioni</h2>' +
      '<p class="ag-card-sub">Le prove più recenti estratte dal registro</p></div>' +
      '<button class="ag-btn ag-btn--ghost ag-btn--sm" data-action="nav" data-section="voti">Tutte ' + icon('chevron') + '</button></div>' +
      (recent ? '<div class="ag-table-scroll"><table class="ag-table"><thead><tr><th>Materia</th><th>Voto</th><th>Data</th><th>Tipo</th></tr></thead><tbody>' + recent + '</tbody></table></div>'
        : '<div class="ag-empty"><b>Nessun voto disponibile</b><span>Il registro non ha ancora pubblicato valutazioni.</span></div>') +
      '</section></div>' +
      '<div class="ag-stack">' +
      '<section class="ag-card"><div class="ag-card-head"><h2 class="ag-card-title">Distribuzione voti</h2></div>' + donut(s.distribution) + '</section>' +
      '<section class="ag-card"><div class="ag-card-head"><div><h2 class="ag-card-title">Andamento medio</h2>' +
      '<p class="ag-card-sub">Serie cronologica delle valutazioni</p></div></div>' + sparkline(s.trendPoints) + '</section>' +
      '<section class="ag-card"><div class="ag-card-head"><h2 class="ag-card-title">' + esc(nowMonth(data.now)) + '</h2>' +
      '<span class="ag-chip ag-chip--peach">Oggi</span></div>' + miniCalendar(data) + '</section>' +
      '<section class="ag-card"><div class="ag-card-head"><h2 class="ag-card-title">Prossimi impegni</h2></div>' +
      (data.events.length ? '<div class="ag-list">' + data.events.slice(0, 4).map(function (e) {
        return '<div class="ag-list-item"><div class="ag-list-ico ag-list-ico--mint">' + icon('calendar') + '</div>' +
          '<div class="ag-list-body"><div class="ag-list-title">' + esc(e.title) + '</div>' +
          '<div class="ag-list-meta">' + fmtDate(e.date) + (e.subject ? ' · ' + esc(e.subject) : '') + '</div></div></div>';
      }).join('') + '</div>' : '<div class="ag-empty"><b>Nessun imminente</b><span>Nessun evento in programma.</span></div>') +
      '</section></div></div></div>';
  }

  function nowMonth(date) {
    return (date || new Date()).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }

  /* ------------------------------------------------------------------ grades */
  function grades(data) {
    const filtered = filterGrades(data);
    const rows = filtered.map(function (g) {
      return '<tr><td><strong>' + esc(g.subject) + '</strong>' +
        (g.simulated ? ' <span class="ag-chip" style="margin-left:4px">simulato</span>' : '') + '</td>' +
        '<td>' + gradeChip(g) + '</td><td>' + fmtDate(g.date) + '</td>' +
        '<td>' + esc(g.type || '—') + '</td><td>' + esc(g.teacher || '—') + '</td>' +
        '<td>' + esc(g.comment || '—') + '</td></tr>';
    }).join('');

    return '<div class="ag-stack">' +
      '<section class="ag-card"><div class="ag-card-head"><div><h2 class="ag-card-title">Tutte le valutazioni</h2>' +
      '<p class="ag-card-sub">' + esc(filtered.length) + ' di ' + esc(data.grades.length) + ' prove visualizzate</p></div>' +
      '<div class="ag-seg">' + ['all', 'good', 'bad', 'simulated'].map(function (key) {
        const labels = { all: 'Tutte', good: '≥6', bad: '<6', simulated: 'Simulate' };
        return '<button data-action="grade-filter" data-filter="' + key + '"' +
          (data.gradeFilter === key ? ' class="is-active"' : '') + '>' + labels[key] + '</button>';
      }).join('') + '</div></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
      '<label class="ag-search" style="max-width:260px">' + icon('search') +
      '<input type="search" data-action="grade-search" placeholder="Filtra materia o docente…" value="' + esc(data.gradeQuery || '') + '"></label>' +
      '<div class="ag-seg"><button data-action="sort" data-sort="date-desc"' + (data.sort === 'date-desc' ? ' class="is-active"' : '') + '>Più recenti</button>' +
      '<button data-action="sort" data-sort="avg-desc"' + (data.sort === 'avg-desc' ? ' class="is-active"' : '') + '>Voto alto</button>' +
      '<button data-action="sort" data-sort="avg-asc"' + (data.sort === 'avg-asc' ? ' class="is-active"' : '') + '>Voto basso</button></div>' +
      '</div>' +
      (rows ? '<div class="ag-table-scroll"><table class="ag-table"><thead><tr><th>Materia</th><th>Voto</th><th>Data</th><th>Tipo</th><th>Docente</th><th>Commento</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div class="ag-empty"><b>Nessuna valutazione corrisponde</b><span>Prova a cambiare filtro o cerca un’altra materia.</span></div>') +
      '</section>' +
      simulator(data) + '</div>';
  }

  function filterGrades(data) {
    let list = data.grades.slice();
    if (data.subjectFilter) list = list.filter(function (g) { return g.subject === data.subjectFilter; });
    if (data.gradeQuery) {
      const q = data.gradeQuery.toLowerCase();
      list = list.filter(function (g) {
        return [g.subject, g.teacher, g.comment, g.type].join(' ').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (data.gradeFilter === 'good') list = list.filter(function (g) { return g.value >= 6; });
    if (data.gradeFilter === 'bad') list = list.filter(function (g) { return g.value < 6; });
    if (data.gradeFilter === 'simulated') list = list.filter(function (g) { return g.simulated; });
    if (data.sort === 'avg-desc') list.sort(function (a, b) { return b.value - a.value; });
    else if (data.sort === 'avg-asc') list.sort(function (a, b) { return a.value - b.value; });
    else list.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    return list;
  }

  function simulator(data) {
    const subjects = data.subjects.length ? data.subjects : [{ name: 'Generale', average: data.summary.average }];
    const weakest = data.subjects.filter(function (s) { return s.average != null; })
      .sort(function (a, b) { return a.average - b.average; })[0];
    const needed = weakest ? (global.AxiosGlassCore && global.AxiosGlassCore.targetGrade(weakest, Number(data.target))) : null;
    const neededLabel = needed == null ? '—' : needed > 10
      ? 'Non raggiungibile con un solo voto'
      : needed < 1 ? 'Obiettivo già raggiunto' : fmtNum(needed);
    const rows = subjects.map(function (s) {
      return '<div class="ag-sim-row"><label>' + esc(s.name) + '</label>' +
        '<input class="ag-sim-input" type="number" min="1" max="10" step="0.25" ' +
        'data-action="sim-input" data-subject="' + esc(s.name) + '" value="' + inputNumber(s.average) + '">' +
        '<button class="ag-icon-btn" data-action="sim-reset" data-subject="' + esc(s.name) + '" title="Ripristina">' + icon('refresh') + '</button></div>';
    }).join('');

    return '<section class="ag-card"><div class="ag-card-head"><div>' +
      '<h2 class="ag-card-title">Simulatore what-if</h2>' +
      '<p class="ag-card-sub">Immagina un voto diverso: la media si aggiorna subito, senza toccare il registro.</p></div>' +
      '<span class="ag-chip ag-chip--peach">' + icon('sparkles') + ' Simulazione</span></div>' +
      '<div class="ag-sim-grid"><div>' + rows + '</div>' +
      '<div class="ag-sim-out"><div class="big ag-mono">' + fmtNum(data.simulatedAverage != null ? data.simulatedAverage : data.summary.average) + '</div>' +
      '<div class="label">Media simulata</div>' +
      '<div class="ag-sim-delta ' + ((data.simulatedAverage || 0) >= data.summary.average ? 'ag-trend-up' : 'ag-trend-down') + '">' +
      ((data.simulatedAverage || 0) >= data.summary.average ? '↑' : '↓') + ' ' +
      fmtNum(Math.abs((data.simulatedAverage || data.summary.average) - data.summary.average)) + ' rispetto alla media reale</div>' +
      '<button class="ag-btn ag-btn--ghost ag-btn--sm" style="margin-top:14px" data-action="sim-clear">Azzera simulazioni</button>' +
      '</div></div>' +
      '<div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(0,102,103,.09);display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
      '<span class="ag-card-sub" style="margin:0">Obiettivo di media per la prossima verifica</span>' +
      '<input class="ag-sim-input" style="width:90px" type="number" min="1" max="10" step="0.25" data-action="target-input" value="' + inputNumber(data.target) + '">' +
      '<span class="ag-chip ag-chip--mint">' + (weakest ? esc(weakest.name) : 'Nessuna materia') + '</span>' +
      '<strong class="ag-mono">' + esc(neededLabel) + '</strong>' +
      '</div></section>';
  }

  /* ------------------------------------------------------------------ register */
  function register(data) {
    const list = data.register.filter(function (item) {
      return data.registerFilter === 'all' || item.type === data.registerFilter;
    });
    const isCompiti = data.section === 'compiti';
    const labels = { all: 'Tutto', verifica: 'Verifiche', compito: 'Compiti', argomento: 'Argomenti' };
    const noun = data.registerFilter === 'compito' ? 'compiti'
      : data.registerFilter === 'verifica' ? 'verifiche'
      : data.registerFilter === 'argomento' ? 'argomenti' : 'elementi';
    const sub = isCompiti
      ? esc(list.length) + ' ' + noun + ' letti dalla sezione Compiti e Verifiche del registro'
      : esc(data.week ? 'Settimana del ' + data.week + ' · ' : '') + esc(list.length) + ' elementi · spunta per segnare come fatto';
    return '<div class="ag-stack"><section class="ag-card">' +
      '<div class="ag-card-head"><div><h2 class="ag-card-title">' +
      (isCompiti ? 'Compiti e verifiche' : 'Attività della classe') + '</h2>' +
      '<p class="ag-card-sub">' + sub + '</p></div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      (isCompiti ? '' :
        '<button class="ag-icon-btn" data-action="week-prev" title="Settimana precedente">' + icon('chevron') + '</button>' +
        '<button class="ag-icon-btn" data-action="week-next" title="Settimana successiva">' + icon('chevron') + '</button>') +
      '</div></div>' +
      '<div class="ag-seg" style="margin-bottom:12px">' + Object.keys(labels).map(function (key) {
        return '<button data-action="register-filter" data-filter="' + key + '"' +
          (data.registerFilter === key ? ' class="is-active"' : '') + '>' + labels[key] + '</button>';
      }).join('') + '</div></div>' +
      (list.length ? '<div class="ag-list">' + list.map(function (item) {
        const ico = item.type === 'verifica' ? 'alert' : item.type === 'compito' ? 'clip' : 'book';
        const chip = item.type === 'verifica' ? 'ag-chip--rose' : item.type === 'compito' ? 'ag-chip--peach' : 'ag-chip--sky';
        return '<div class="ag-list-item' + (item.done ? ' is-done' : '') + '">' +
          '<button class="ag-check' + (item.done ? ' is-done' : '') + '" data-action="toggle-task" data-id="' + esc(item.id) + '">' + icon('check') + '</button>' +
          '<div class="ag-list-ico ' + (item.type === 'verifica' ? '' : 'ag-list-ico--lavender') + '">' + icon(ico) + '</div>' +
          '<div class="ag-list-body"><div class="ag-list-title">' + esc(item.title) + '</div>' +
          '<div class="ag-list-meta"><span class="ag-chip ' + chip + '">' + esc(labels[item.type] || item.type) + '</span>' +
          '<span>' + esc(item.subject || '') + '</span><span>' + fmtDate(item.date) + '</span>' +
          (item.teacher ? '<span>· ' + esc(item.teacher) + '</span>' : '') + '</div>' +
          (item.description ? '<div class="ag-list-note">' + esc(item.description) + '</div>' : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="ag-empty"><b>' +
        (isCompiti ? 'Nessun compito trovato' : 'Nessuna attività') + '</b><span>' +
        (isCompiti ? 'Apri Registro di classe → Compiti e Verifiche nel registro per caricare i dati reali.'
          : 'Nessun contenuto trovato in questa sezione del registro.') + '</span></div>') +
      '</section></div>';
  }

  /* ------------------------------------------------------------------ attendance */
  function attendance(data) {
    const s = data.summary;
    const rows = data.attendance.map(function (a) {
      const chip = a.kind === 'assenza' ? 'ag-chip--rose' : a.kind === 'ritardo' ? 'ag-chip--peach' : 'ag-chip--sky';
      return '<tr><td>' + fmtDate(a.date) + '</td><td><span class="ag-chip ' + chip + '">' + esc(a.kind || '—') + '</span></td>' +
        '<td>' + esc(a.subject || '—') + '</td><td>' + esc(a.hours || '—') + '</td>' +
        '<td>' + esc(a.justified || '—') + '</td></tr>';
    }).join('');
    return '<div class="ag-stack"><div class="ag-kpis">' +
      kpi('calendar', 'ag-kpi-ico--peach', 'Assenze totali', esc(s.absenceCount || 0), '', 'Somma delle assenze registrate') +
      kpi('clock', 'ag-kpi-ico--sky', 'Ritardi', esc(s.lateCount || 0), '', 'Ritardi comunicati dai docenti') +
      kpi('check', 'ag-kpi-ico--mint', 'Tasso presenza', esc(s.presenceRate || '—'), '', 'Calcolato sui giorni disponibili') +
      kpi('eye', '', 'Giustificate', esc(s.justifiedCount || 0), '', 'Assenze con motivazione') +
      '</div><section class="ag-card"><div class="ag-card-head"><div><h2 class="ag-card-title">Registro presenze</h2>' +
      '<p class="ag-card-sub">' + esc(data.attendance.length) + ' eventi estratti dal registro</p></div></div>' +
      (rows ? '<div class="ag-table-scroll"><table class="ag-table"><thead><tr><th>Data</th><th>Tipo</th><th>Materia</th><th>Ore</th><th>Giustificata</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div class="ag-empty"><b>Nessun evento di presenza</b><span>Il registro non mostra assenze o ritardi in questa sezione.</span></div>') +
      '</section></div>';
  }

  /* ------------------------------------------------------------------ communications */
  function communications(data) {
    const list = data.communications.map(function (c) {
      return '<div class="ag-list-item ag-message-item" style="cursor:pointer" data-action="open-message" data-id="' + esc(c.id) + '">' +
        '<div class="ag-list-ico ' + (c.unread ? '' : 'ag-list-ico--mint') + '">' + icon(c.unread ? 'mail' : 'eye') + '</div>' +
        '<div class="ag-list-body"><div class="ag-list-title">' + (c.unread ? '<span class="ag-dot" style="display:inline-block;vertical-align:middle;margin-right:6px"></span>' : '') + esc(c.title) + '</div>' +
        '<div class="ag-list-meta"><span>' + esc(c.from || 'Scuola') + '</span><span>' + fmtDate(c.date) + '</span>' +
        (c.readAt ? '<span>· letto</span>' : '') + '</div>' +
        '<div class="ag-list-note">' + esc(String(c.body || '').slice(0, 160)) + (String(c.body || '').length > 160 ? '…' : '') + '</div></div>' +
        icon('chevron') + '</div>';
    }).join('');
    return '<div class="ag-stack"><section class="ag-card"><div class="ag-card-head"><div>' +
      '<h2 class="ag-card-title">Posta e comunicazioni</h2><p class="ag-card-sub">Messaggi dalla scuola e dai docenti · clicca per leggere</p></div>' +
      '<span class="ag-chip ag-chip--peach">' + esc(data.unreadCount || 0) + ' da leggere</span></div>' +
      (list ? '<div class="ag-list">' + list + '</div>' : '<div class="ag-empty"><b>Cassetta vuota</b><span>Nessuna comunicazione disponibile.</span></div>') +
      '</section></div>';
  }

  function messageModal(data) {
    if (!data.openMessageId) return '';
    const list = data.communications || [];
    let index = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === data.openMessageId) { index = i; break; }
    }
    if (index < 0) return '';
    const c = list[index];
    const hasPrev = index > 0;
    const hasNext = index < list.length - 1;
    const body = c.body
      ? esc(c.body).replace(/\r?\n/g, '<br>')
      : '<span class="ag-muted">Testo non disponibile nel registro.</span>';

    return '<div class="ag-backdrop" data-action="close-modal" data-backdrop="true">' +
      '<div class="ag-modal ag-modal--message">' +
      '<div class="ag-card-head"><div>' +
      '<h3>' + esc(c.title) + '</h3>' +
      '<p class="ag-message-meta">' + esc(c.from || 'Scuola') + ' · ' + fmtDate(c.date) + '</p>' +
      '</div><button class="ag-icon-btn" data-action="close-modal" title="Chiudi">' + icon('close') + '</button></div>' +
      '<div class="ag-message-body">' + body + '</div>' +
      (c.action ? '<div class="ag-message-source"><button class="ag-btn ag-btn--ghost ag-btn--sm" data-action="open-original" data-id="' + esc(c.id) + '">' + icon('monitor') + ' Apri nel registro</button></div>' : '') +
      '<div class="ag-modal-actions">' +
      '<button class="ag-btn ag-btn--ghost ag-btn--sm" data-action="message-prev"' + (hasPrev ? '' : ' disabled') + '>' + icon('chevron') + ' Precedente</button>' +
      '<span class="ag-card-sub" style="margin:0;align-self:center">' + (index + 1) + ' / ' + list.length + '</span>' +
      '<button class="ag-btn ag-btn--primary ag-btn--sm" data-action="message-next"' + (hasNext ? '' : ' disabled') + '>Successiva ' + icon('chevron') + '</button>' +
      '</div></div></div>';
  }

  /* ------------------------------------------------------------------ timetable */
  function timetable(data) {
    if (!data.timetable.length) {
      return '<div class="ag-stack"><section class="ag-card"><div class="ag-empty"><b>Orario non disponibile</b>' +
        '<span>Apri la sezione Orario del registro per estrarre il calendario settimanale.</span></div></section></div>';
    }
    return '<div class="ag-stack"><section class="ag-card"><div class="ag-card-head"><div>' +
      '<h2 class="ag-card-title">Lezioni della settimana</h2><p class="ag-card-sub">Orario estratto dal registro Axios</p></div>' +
      '<span class="ag-chip ag-chip--mint">' + esc(data.meta.className || '') + '</span></div>' +
      '<div class="ag-timetable">' + data.timetable.map(function (day, i) {
        return '<div class="ag-day"><div class="ag-day-name">' + esc(day.day) + '</div>' +
          day.lessons.map(function (l) {
            return '<div class="ag-lesson" data-tone="' + TONES[(day.index || i) % TONES.length] + '">' +
              esc(l.subject) + (l.time ? '<span class="ag-lesson-time">' + esc(l.time) + '</span>' : '') +
              (l.teacher ? '<span class="ag-lesson-time">' + esc(l.teacher) + '</span>' : '') + '</div>';
          }).join('') + '</div>';
      }).join('') + '</div></section></div>';
  }

  /* ------------------------------------------------------------------ report card */
  function reportCard(data) {
    // The pagella is its own document: never reuse subject averages from Voti.
    const report = data.reportRows || [];
    const rows = report.map(function (r) {
      return '<tr>' + Object.keys(r).map(function (key, i) {
        return '<td>' + (i === 0 ? '<strong>' + esc(r[key]) + '</strong>' : esc(r[key])) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    const columns = report.length ? Object.keys(report[0]).length : 1;
    return '<div class="ag-stack"><section class="ag-card">' +
      '<div class="ag-card-head"><div><h2 class="ag-card-title">Pagella</h2>' +
      '<p class="ag-card-sub">' + esc(data.meta.institute || '') + ' · ' + esc(data.meta.year || '') + '</p></div></div>' +
      (rows ? '<div class="ag-table-scroll"><table class="ag-table"><thead><tr><th colspan="' + columns + '">Dati della pagella</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div class="ag-empty"><b>Pagella non disponibile</b><span>Il registro non ha ancora pubblicato la pagella. Le valutazioni sono nella sezione Voti.</span></div>') +
      '</section></div>';
  }

  /* ------------------------------------------------------------------ settings */
  function settings(data) {
    return '<div class="ag-stack"><section class="ag-card"><div class="ag-card-head"><div>' +
      '<h2 class="ag-card-title">Aspetto e comportamento</h2><p class="ag-card-sub">Preferenze salvate in questo browser</p></div></div>' +
      '<div class="ag-list">' +
      '<div class="ag-list-item"><div class="ag-list-ico ag-list-ico--lavender">' + icon('monitor') + '</div>' +
      '<div class="ag-list-body"><div class="ag-list-title">Interfaccia Axios Glass</div>' +
      '<div class="ag-list-note">La nuova interfaccia sostituisce quella originale solo quando è attiva. I form ASP.NET restano intatti.</div></div>' +
      '<button class="ag-btn ag-btn--ghost ag-btn--sm" data-action="classic">Passa al classico</button></div>' +
      '<div class="ag-list-item"><div class="ag-list-ico ag-list-ico--mint">' + icon('refresh') + '</div>' +
      '<div class="ag-list-body"><div class="ag-list-title">Ricarica i dati</div>' +
      '<div class="ag-list-note">Rilegge il DOM del registro e aggiorna tutte le sezioni.</div></div>' +
      '<button class="ag-btn ag-btn--ghost ag-btn--sm" data-action="reload-data">Ricarica</button></div>' +
      '</div></section>' +
      '<section class="ag-card"><div class="ag-card-head"><h2 class="ag-card-title">Informazioni</h2></div>' +
      '<p class="ag-card-sub" style="line-height:1.7">Axios Glass legge esclusivamente i dati già presenti nella pagina del registro. ' +
      'Nessun valore viene inventato o inviato a server esterni. Le simulazioni esistono solo nel tuo browser.</p>' +
      '<div class="ag-list-meta" style="margin-top:12px"><span class="ag-chip ag-chip--grey">v2.0.0</span>' +
      '<span class="ag-chip ag-chip--mint">Dati reali</span><span class="ag-chip ag-chip--peach">Pastel glass</span></div>' +
      '</section></div>';
  }

  /* ------------------------------------------------------------------ render */
  function section(data) {
    switch (data.section) {
      case 'voti': return grades(data);
      case 'registro': return register(data);
      case 'compiti': return register(data);
      case 'assenze': return attendance(data);
      case 'comunicazioni': return communications(data);
      case 'orario': return timetable(data);
      case 'pagella': return reportCard(data);
      case 'impostazioni': return settings(data);
      default: return dashboard(data);
    }
  }

  function render(data) {
    return '<div class="ag-app">' +
      '<div class="ag-orbs"><span class="ag-orb ag-orb--a"></span><span class="ag-orb ag-orb--b"></span><span class="ag-orb ag-orb--c"></span></div>' +
      '<div class="ag-shell">' + sidebar(data) +
      '<main class="ag-main">' + topbar(data) + section(data) + '</main></div></div>' +
      messageModal(data);
  }

  /* ------------------------------------------------------------------ binding */
  function mount(root, data, handlers) {
    if (!root) return;
    root.innerHTML = render(data);

    root.addEventListener('click', function (event) {
      const target = event.target.closest('[data-action]');
      if (!target || !root.contains(target)) return;
      // Clicks inside the modal must not bubble to the backdrop close action.
      if (target.getAttribute('data-backdrop') && event.target !== target) return;
      const action = target.getAttribute('data-action');
      const payload = {
        section: target.getAttribute('data-section'),
        filter: target.getAttribute('data-filter'),
        sort: target.getAttribute('data-sort'),
        id: target.getAttribute('data-id'),
        subject: target.getAttribute('data-subject')
      };
      if (handlers && typeof handlers[action] === 'function') {
        handlers[action](payload, event, target);
      }
    });

    if (!root.__agModalKeys) {
      root.__agModalKeys = true;
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape' || !root.querySelector('.ag-backdrop')) return;
        if (handlers && typeof handlers['close-modal'] === 'function') {
          handlers['close-modal']({}, event);
        }
      });
    }

    root.addEventListener('input', function (event) {
      const target = event.target;
      const action = target.getAttribute && target.getAttribute('data-action');
      if (!action || !handlers) return;
      if (handlers[action]) handlers[action]({
        value: target.value,
        subject: target.getAttribute('data-subject')
      }, event, target);
    });
  }

  global.AxiosGlassUI = {
    icon: icon,
    esc: esc,
    fmtNum: fmtNum,
    fmtDate: fmtDate,
    tone: tone,
    render: render,
    mount: mount,
    filterGrades: filterGrades,
    nav: NAV,
    titles: TITLES
  };
})(window);
