/* =========================================================================
   AXIOS GLASS — DOM scraper
   Reads only what Axios already rendered. Never removes or rewrites the
   original nodes: ASP.NET postbacks and __VIEWSTATE stay fully functional.
   ========================================================================= */

(function (global) {
  'use strict';

  const doc = global.document;
  const messageTriggers = Object.create(null);
  const attachmentTriggers = Object.create(null);
  const APP_TABLE_IDS = ['table-rcla', 'table-voti', 'table-compiti', 'table-argomenti'];

  function text(el) {
    return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function cleanHtml(html) {
    return String(html || '')
      .replace(/<br\s*\/?[^>]*>/gi, ' | ')
      .replace(/<\/(?:p|div|tr|li)>/gi, ' | ')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#39;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .replace(/\s*\|\s*\|/g, ' | ')
      .trim();
  }

  function pick(record, names) {
    for (let i = 0; i < names.length; i++) {
      const keys = Object.keys(record);
      for (let j = 0; j < keys.length; j++) {
        const value = record[keys[j]];
        const str = typeof value === 'string' ? value.trim() : text(value);
        if (keys[j].toLowerCase().indexOf(names[i]) >= 0 && str) return str;
      }
    }
    return '';
  }

  /* --------------------------------------------------------------- metadata */
  function metadata() {
    const nameEl = doc.querySelector('.username');
    const instEl = doc.querySelector('.desc-as-header .pull-left') || doc.querySelector('.desc-as-header');
    const yearEl = doc.querySelector('.anno-footer');
    const avatarEl = doc.querySelector('#imgAvatarHeader');

    let student = 'Studente';
    if (nameEl) {
      student = text(nameEl).replace(/^\[|\]$/g, '').trim() || 'Studente';
    }

    let institute = 'Registro Elettronico Axios';
    if (instEl) {
      const title = instEl.getAttribute('title');
      const raw = title || text(instEl);
      institute = raw.replace(/^\d+\s*-\s*/, '').split('\n')[0].trim() || institute;
    }

    return {
      student: student,
      institute: institute,
      year: yearEl ? text(yearEl) : '',
      avatar: avatarEl && avatarEl.src ? avatarEl.src : ''
    };
  }

  /* --------------------------------------------------------------- section */
  function detectSection(fallback) {
    const bodyText = text(doc.querySelector('body')).slice(0, 4000);
    const legendText = Array.prototype.map.call(doc.querySelectorAll('legend'), text).join(' ').toLowerCase();
    const has = function (selector) { return !!doc.querySelector(selector); };
    const activeTab = function (action) {
      const link = doc.querySelector('[data-action="' + action + '"]');
      const tab = link && link.closest('li');
      return !!(tab && /\bactive\b/.test(tab.className));
    };

    if (has('#table-voti') || has('.table-voti') || has('.rdoc_full_valutazioni')) return 'voti';
    // "Compiti e Verifiche" is a real Axios tab with its own server-side table.
    if (has('#table-compiti') || activeTab('FAMILY_REGISTRO_CLASSE_COMPITI')) return 'compiti';
    if (has('#table-argomenti') || activeTab('FAMILY_REGISTRO_CLASSE_ARGOMENTI')) return 'registro';
    if (has('#table-rcla') || has('.family-rcla') || /registro di classe/i.test(legendText)) return 'registro';
    if (has('.tm-header') || has('#content-timeline') || has('#content-menu')) return 'dashboard';
    if (/assenze/i.test(legendText) || has('[id*="assenze"]')) return 'assenze';
    if (/comunicazioni/i.test(legendText) || has('[id*="comunicazioni"]')) return 'comunicazioni';
    if (/orario/i.test(legendText) || has('[id*="orario"]')) return 'orario';
    if (/pagella/i.test(legendText) || has('[id*="pagella"]')) return 'pagella';
    if (/compiti|verifiche|argomenti/i.test(bodyText) && has('#table-rcla')) return 'registro';
    return fallback || 'dashboard';
  }

  function isLoginPage() {
    return /sd_login|login\.aspx/i.test(doc.location ? doc.location.pathname : '') ||
      !!doc.querySelector('form[action*="Login"], #txtUserName, #txtPassword');
  }

  function expandSelect(name) {
    const select = doc.querySelector('select[name="' + name + '_length"]');
    if (!select || !select.options || !select.options.length) return;
    const values = Array.prototype.map.call(select.options, function (o) { return String(o.value); });
    const target = values.indexOf('-1') >= 0
      ? '-1'
      : (values.filter(function (v) { return /^\d+$/.test(v); })
          .sort(function (a, b) { return Number(b) - Number(a); })[0] || '100');
    if (select.value !== target) {
      select.value = target;
      select.dispatchEvent(new global.Event('change', { bubbles: true }));
    }
  }

  function expandTables() {
    expandSelect('table-voti');
    expandSelect('table-compiti');
    expandSelect('table-argomenti');
  }

  /* ---------------------------------------------------------------- grades */
  function normalizeType(value, hints) {
    const raw = String(value || '').toLowerCase();
    if (/orale|^o\b/.test(raw) || (hints && hints.oral)) return 'Orale';
    if (/pratic|^p\b/.test(raw) || (hints && hints.practical)) return 'Pratico';
    return 'Scritto';
  }

  function scrapeGrades() {
    const grades = [];
    const seen = Object.create(null);

    function add(grade) {
      if (!grade || !grade.display) return;
      const key = [grade.subject, grade.date, grade.display, grade.type].join('|');
      if (seen[key]) return;
      seen[key] = true;
      grades.push(grade);
    }

    expandTables();

    const candidates = ['#table-voti', '.table-voti', '#content-alunno table', '#page-content table'];
    let table = null;
    for (let s = 0; s < candidates.length && !table; s++) {
      const found = doc.querySelectorAll(candidates[s]);
      for (let i = 0; i < found.length; i++) {
        if (found[i].id === 'table-rcla') continue;
        if (found[i].querySelectorAll('tr').length > 1) { table = found[i]; break; }
      }
    }

    if (table) {
      const headers = Array.prototype.map.call(
        table.querySelectorAll('thead th, tr:first-child th, tr:first-child td'),
        function (el) { return text(el).toLowerCase(); }
      );
      function col(patterns, fallback) {
        for (let i = 0; i < headers.length; i++) {
          for (let p = 0; p < patterns.length; p++) {
            if (patterns[p].test(headers[i])) return i;
          }
        }
        return fallback;
      }
      const cols = {
        date: col([/data/, /giorno/], 0),
        subject: col([/materia/], 1),
        type: col([/tipo/], 2),
        grade: col([/voto/, /valutazione/], 3),
        comment: col([/commento/, /note/, /obiettivo/], 5),
        teacher: col([/docente/, /insegnante/], 6)
      };

      let lastSubject = '';
      const rows = table.querySelectorAll('tbody tr');
      for (let r = 0; r < rows.length; r++) {
        const tr = rows[r];
        if (tr.classList.contains('dataTables_empty')) continue;
        const cells = tr.querySelectorAll('td');
        if (cells.length < 3) continue;

        const subject = text(cells[cols.subject]) || lastSubject;
        if (subject) lastSubject = subject;

        const gradeCell = cells[cols.grade];
        const commentEl = tr.querySelector('.family-voti-obiettivi, a[data-desc], button[data-desc]');
        const comment = (commentEl && commentEl.getAttribute('data-desc')) || text(cells[cols.comment]);
        const raw = text(gradeCell);
        const noMedia = tr.classList.contains('voti_no_media') ||
          (gradeCell && gradeCell.classList.contains('voto_no_media')) ||
          /non fa media/i.test(raw);

        add({
          subject: subject || 'Generale',
          display: raw,
          raw: raw,
          date: text(cells[cols.date]),
          type: normalizeType(text(cells[cols.type])),
          teacher: text(cells[cols.teacher]),
          comment: comment,
          faMedia: !noMedia
        });
      }
    }

    // Grid-style grades (`.voto` spans with tooltip metadata).
    const grid = doc.querySelectorAll('.rdoc_full_valutazioni .voto, .table .voto');
    for (let i = 0; i < grid.length; i++) {
      const el = grid[i];
      const title = el.getAttribute('data-original-title') || el.getAttribute('title') || '';
      const dateMatch = title.match(/data[:\s]+([\d/.-]+)/i);
      const field = function (label) {
        const m = title.match(new RegExp(label + '[\\s:]+([^<\\n]+?)(?=\\s+(?:data|materia|docente|note|commento)[\\s:]|$)', 'i'));
        return m && m[1].trim();
      };
      const tooltipSubject = field('materia');
      const tooltipTeacher = field('docente');
      const tooltipComment = field('(?:note|commento)');
      const row = el.closest('tr');
      const fallbackSubject = row ? text(row.querySelector('th, td:first-child')) : '';
      const oral = /voto_o|voti_o/i.test(el.className) || (el.parentNode && /voto_o|voti_o/i.test(el.parentNode.className));
      const practical = /voto_p|voti_p/i.test(el.className) || (el.parentNode && /voto_p|voti_p/i.test(el.parentNode.className));

      add({
        subject: tooltipSubject || fallbackSubject || 'Generale',
        display: text(el),
        raw: text(el),
        date: (dateMatch && dateMatch[1].trim()) || '',
        type: normalizeType('', { oral: oral, practical: practical }),
        teacher: tooltipTeacher || '',
        comment: tooltipComment || '',
        faMedia: !el.classList.contains('voto_no_media')
      });
    }

    return grades;
  }

  /* --------------------------------------------------------------- register */

  // Axios renders two register lists as server-side DataTables:
  //   #table-compiti    -> giorno | materia | testo | verifica | inserito
  //   #table-argomenti  -> giorno | materia | testo | inserito
  // The "verifica" flag decides whether a row is a compito or a verifica.
  function parseAxiosList(table, source) {
    const headers = Array.prototype.map.call(
      table.querySelectorAll('thead th, tr:first-child th, tr:first-child td'),
      function (el) { return text(el).toLowerCase(); }
    );
    function col(patterns, fallback) {
      for (let i = 0; i < headers.length; i++) {
        for (let p = 0; p < patterns.length; p++) {
          if (patterns[p].test(headers[i])) return i;
        }
      }
      return fallback;
    }
    const isCompiti = source === 'compiti';
    const cols = {
      date: col([/giorno/, /^data/], 0),
      subject: col([/materia/], 1),
      body: col([/testo/, /compito/, /argomento/], 2),
      verifica: col([/verifica/], 3)
    };

    const result = [];
    const rows = table.querySelectorAll('tbody tr');
    for (let r = 0; r < rows.length; r++) {
      const tr = rows[r];
      if (tr.classList.contains('dataTables_empty')) continue;
      const cells = tr.querySelectorAll('td');
      if (cells.length < 3) continue;

      const bodyCell = cells[cols.body];
      const verificaCell = cells[cols.verifica];
      const verificaHtml = verificaCell ? String(verificaCell.innerHTML || '') : '';
      const verificaText = text(verificaCell).trim();
      const flagged = isCompiti && (
        /^(s[iì]|yes|true|1|verifica)$/i.test(verificaText) ||
        /fa-check|glyphicon-ok|icon-check|checked|\bverifica\b/i.test(verificaHtml)
      );
      const type = isCompiti ? (flagged ? 'verifica' : 'compito') : 'argomento';

      result.push({
        id: source + '-' + r + '-' + type,
        type: type,
        title: cleanHtml(bodyCell ? bodyCell.innerHTML : ''),
        subject: text(cells[cols.subject]),
        date: text(cells[cols.date]),
        description: '',
        teacher: '',
        source: source
      });
    }
    return result;
  }

  function scrapeRegister() {
    const items = [];
    let source = '';
    const week = text(doc.querySelector('#fdData'));

    // Make sure server-side tables expose all rows before we read the DOM.
    expandTables();

    // Weekly "Registro di classe" table (argomenti | compiti | verifiche columns).
    const table = doc.querySelector('#table-rcla');
    if (table) {
      const rows = table.querySelectorAll('tbody tr');
      const categories = [
        { index: 1, type: 'argomento' },
        { index: 2, type: 'compito' },
        { index: 3, type: 'verifica' }
      ];
      for (let r = 0; r < rows.length; r++) {
        const cells = rows[r].querySelectorAll('td');
        if (cells.length < 4) continue;
        const date = cleanHtml(cells[0].innerHTML);
        categories.forEach(function (cat) {
          const cell = cells[cat.index];
          if (!cell) return;
          const parts = String(cell.innerHTML).split(/<br\s*\/?>/i);
          parts.forEach(function (part, p) {
            const cleaned = cleanHtml(part);
            if (!cleaned) return;
            const match = part.match(/<b>(.*?)[:\s]*<\/b>(.*)/i);
            const subject = match ? cleanHtml(match[1]) : '';
            const description = match ? cleanHtml(match[2]) : cleaned;
            const title = description || subject || cleaned;
            items.push({
              id: 'rcla-' + r + '-' + cat.type + '-' + p,
              type: cat.type,
              title: title,
              subject: subject,
              date: date,
              description: description && description !== title ? description : '',
              teacher: '',
              source: 'rcla'
            });
          });
        });
      }
      if (items.length) source = 'rcla';
    }

    // Dedicated "Compiti e Verifiche" tab: every real row becomes one item.
    const compitiTable = doc.querySelector('#table-compiti');
    if (compitiTable) {
      const parsed = parseAxiosList(compitiTable, 'compiti');
      if (parsed.length) {
        items.length = 0;
        items.push.apply(items, parsed);
        source = 'compiti';
      }
    }

    // "Argomenti" tab, when the user opens that tab instead.
    const argomentiTable = doc.querySelector('#table-argomenti');
    if (argomentiTable) {
      const parsed = parseAxiosList(argomentiTable, 'argomenti');
      if (parsed.length) {
        items.length = 0;
        items.push.apply(items, parsed);
        source = 'argomenti';
      }
    }

    // Dashboard timeline items are useful tasks too.
    const timeline = doc.querySelectorAll('.mt-actions .mt-action');
    for (let i = 0; i < timeline.length; i++) {
      const author = text(timeline[i].querySelector('.mt-action-author'));
      const description = text(timeline[i].querySelector('.mt-action-desc'));
      const isTask = /compito per casa/i.test(author);
      const subject = isTask
        ? author.replace(/compito per casa\s*(di|del)?\s*/i, '')
        : author.replace(/argomento\s*(di|del)?\s*/i, '');
      const day = timeline[i].closest('.tm-day');
      const date = day
        ? [text(day.querySelector('.tm-day-number')), text(day.querySelector('.tm-day-name')), text(day.querySelector('.tm-month'))].filter(Boolean).join(' ')
        : text(doc.querySelector('#dpToday'));
      items.push({
        id: (isTask ? 'dash-task-' : 'dash-topic-') + i,
        type: isTask ? 'compito' : 'argomento',
        title: description || author,
        subject: subject,
        date: date,
        description: description && description !== author ? author : '',
        teacher: '',
        source: 'timeline'
      });
    }

    return { items: items, week: week, source: source };
  }

  /* ---------------------------------------------------------------- generic */
  function tableRecords(table) {
    const headerCells = table.querySelectorAll('thead th, tr:first-child th, tr:first-child td');
    const headers = Array.prototype.map.call(headerCells, function (el, i) {
      return text(el) || 'col-' + i;
    });
    const records = [];
    const rows = table.querySelectorAll('tbody tr');
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (row.classList.contains('dataTables_empty')) continue;
      const cells = row.querySelectorAll('td');
      if (!cells.length) continue;
      const record = {};
      for (let c = 0; c < cells.length; c++) {
        record[headers[c] || 'col-' + c] = cleanHtml(cells[c].innerHTML);
      }
      records.push(record);
    }
    return records;
  }

  function clickableIn(row) {
    const candidates = row.querySelectorAll('a[href], [data-action], [onclick], button');
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      if (text(el) || el.getAttribute('data-action') || el.getAttribute('onclick')) return el;
    }
    if (row.getAttribute('onclick') || row.getAttribute('data-action')) return row;
    return null;
  }

  function attachmentIn(row) {
    const candidates = row.querySelectorAll('a[href], [data-action], [onclick], button');
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      const hay = [
        el.getAttribute('href'), el.getAttribute('data-action'),
        el.getAttribute('onclick'), text(el), el.getAttribute('title')
      ].join(' ');
      if (/\.pdf|\.docx?|\.xlsx?|\.pptx?|\.zip|\/download|download|scarica|allegat/i.test(hay)) return el;
    }
    return null;
  }

  function isAppTable(table) {
    return APP_TABLE_IDS.indexOf(table.id) >= 0 ||
      table.classList.contains('table-voti') ||
      !!(table.closest && table.closest('#axglass-app'));
  }

  function tablesIn(container) {
    return Array.prototype.filter.call(container.querySelectorAll('table'), function (t) {
      return !isAppTable(t);
    });
  }

  function communicationScope() {
    return doc.querySelector('[id*="comunicaz"], [class*="comunicaz"]') ||
      doc.querySelector('#content-alunno') || doc.querySelector('#page-content') || doc.body;
  }

  function communicationTable(table) {
    const headerCells = table.querySelectorAll('thead th, tr:first-child th, tr:first-child td');
    const headers = Array.prototype.map.call(headerCells, text).join(' ').toLowerCase();
    return /comunicaz|oggetto|mittente|destinat|allegat|\bdata\b|\btitolo\b/.test(headers);
  }

  function communicationRecords() {
    Object.keys(messageTriggers).forEach(function (key) { delete messageTriggers[key]; });
    Object.keys(attachmentTriggers).forEach(function (key) { delete attachmentTriggers[key]; });

    const scope = communicationScope();
    const allTables = tablesIn(scope);
    const matching = allTables.filter(communicationTable);
    const tables = matching.length ? matching : (scope !== doc.body ? allTables : []);
    const records = [];
    let offset = 0;
    tables.forEach(function (t) {
      const headerCells = t.querySelectorAll('thead th, tr:first-child th, tr:first-child td');
      const headers = Array.prototype.map.call(headerCells, function (el, i) { return text(el) || 'col-' + i; });
      const rows = t.querySelectorAll('tbody tr');
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (row.classList.contains('dataTables_empty')) continue;
        const cells = row.querySelectorAll('td');
        if (!cells.length) continue;
        const record = {};
        for (let c = 0; c < cells.length; c++) {
          record[headers[c] || 'col-' + c] = cleanHtml(cells[c].innerHTML);
        }
        const id = 'gen-' + (offset + r);
        const trigger = clickableIn(row);
        const attachment = attachmentIn(row);
        if (trigger) messageTriggers[id] = trigger;
        if (attachment) attachmentTriggers[id] = attachment;
        record.id = id;
        record.action = trigger ? 'open' : '';
        record.attachment = attachment
          ? { label: text(attachment) || attachment.getAttribute('title') || 'Allegato' }
          : null;
        records.push(record);
      }
      offset += rows.length;
    });
    return records;
  }

  function scrapeGeneric(section) {
    const container = doc.querySelector('#content-alunno') || doc.querySelector('#page-content') || doc.body;
    const tables = tablesIn(container);
    const records = [];
    tables.forEach(function (t) { records.push.apply(records, tableRecords(t)); });

    const result = {};
    const textScope = section === 'comunicazioni' ? communicationScope() : container;
    const paragraphs = Array.prototype.map.call(textScope.querySelectorAll('p, .alert, .desc-as-header'), text)
      .filter(function (t) { return t.length > 5 && !/A\.S\./i.test(t); });

    if (section === 'assenze') {
      result.attendance = records.map(function (r, i) {
        return {
          id: 'att-' + i,
          date: pick(r, ['data', 'giorno']),
          kind: /ritardo/i.test(Object.values(r).join(' ')) ? 'ritardo' : 'assenza',
          subject: pick(r, ['materia']),
          hours: pick(r, ['ore', 'durata']),
          justified: pick(r, ['giustificat', 'motiv'])
        };
      });
    }

    if (section === 'comunicazioni') {
      const commRecords = communicationRecords();
      result.communications = commRecords.map(function (r) {
        const values = Object.keys(r).filter(function (k) {
          return k !== 'id' && k !== 'action' && k !== 'attachment';
        }).map(function (k) { return r[k]; });
        return {
          id: r.id,
          action: r.action,
          attachment: r.attachment || null,
          title: pick(r, ['oggetto', 'titolo', 'comunicazione', 'argomento']) || values.slice(0, 2).join(' — '),
          from: pick(r, ['mittente', 'da ', 'docente']),
          date: pick(r, ['data']),
          body: values.join(' · ')
        };
      }).concat(paragraphs.slice(0, 12).map(function (p, i) {
        return { id: 'txt-' + i, title: p.slice(0, 90), from: '', date: '', body: p, attachment: null };
      }));
    }

    if (section === 'orario' && tables.length) {
      const table = tables[0];
      const head = Array.prototype.map.call(table.querySelectorAll('thead th, tr:first-child th'), text);
      const days = head.slice(1);
      const rows = table.querySelectorAll('tbody tr');
      result.timetable = days.map(function (day, dayIndex) {
        const lessons = [];
        for (let r = 0; r < rows.length; r++) {
          const cells = rows[r].querySelectorAll('td');
          const cell = cells[dayIndex + 1];
          if (!cell) continue;
          const label = cleanHtml(cell.innerHTML);
          if (!label) continue;
          lessons.push({ subject: label, time: text(cells[0]), teacher: '' });
        }
        return { day: day, lessons: lessons };
      });
    }

    if (section === 'pagella') {
      // Report cards are documents, not grade lists: expose only the raw rows.
      result.reportRows = records;
    }

    result.pageText = paragraphs;
    return result;
  }

  /* ------------------------------------------------------------------ API */
  global.AxiosGlassScraper = {
    text: text,
    metadata: metadata,
    detectSection: detectSection,
    isLoginPage: isLoginPage,
    scrapeGrades: scrapeGrades,
    scrapeRegister: scrapeRegister,
    scrapeGeneric: scrapeGeneric,
    tableRecords: tableRecords,
    messageTrigger: function (id) { return messageTriggers[id] || null; },
    attachmentTrigger: function (id) { return attachmentTriggers[id] || null; }
  };
})(window);
