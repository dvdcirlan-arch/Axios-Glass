/**
 * AXIOS MODERN REGISTER - REAL-TIME SCRAPING EXTENSION (MANIFEST V3)
 * Dark Mode Web-App (Linear / Raycast / Vercel style)
 * 
 * Features:
 * 1. Activates on https://registrofamiglie.axioscloud.it/
 * 2. Uses MutationObserver to dynamically detect when content/tables appear in DOM.
 * 3. Scrapes 100% real live grades (commas -> dots, suffixes, judgements) capturing ALL grades without mock data.
 * 4. Completely redesigns Registro di Classe (compiti, verifiche, argomenti) and other sections into modern cards.
 * 5. Hides original Axios container (display: none !important) preserving ASP.NET forms & postbacks.
 * 6. Includes emergency toggle button to switch back to original Axios HTML.
 */

(function () {
  'use strict';

  if (window.__AXIOS_MODERN_INJECTED__) return;
  window.__AXIOS_MODERN_INJECTED__ = true;

  // =========================================================================
  // 1. STATE MANAGEMENT
  // =========================================================================
  const STATE = {
    isActive: localStorage.getItem('axios_modern_active') !== 'false',
    currentSection: 'voti', // 'voti' | 'registro' | 'dashboard' | 'assenze' | 'comunicazioni' | 'orario' | 'pagella' | 'generic'
    allGradesMap: {}, // Persistent map: key -> grade object
    scrapedSubjects: [], // Array of subjects with computed stats
    isTableFound: false,
    simulations: JSON.parse(localStorage.getItem('axios_simulations') || '[]'),
    completedTasks: JSON.parse(localStorage.getItem('axios_completed_tasks') || '{}'),
    isDrawerOpen: false,
    searchQuery: '',
    filterStatus: 'all', // 'all' | 'good' | 'bad' | 'simulated'
    rclaFilter: 'all', // 'all' | 'verifiche' | 'compiti' | 'argomenti'
    sortOrder: 'avg-desc',
    selectedSimSubject: '',
  };

  // =========================================================================
  // 2. ULTRA-RESILIENT GRADE EXTRACTOR (HANDLES ALL FORMATS)
  // =========================================================================

  function extractGradeValue(text) {
    if (!text) return null;
    let s = text.trim();

    // Replace Italian fractions ½ or 1/2
    s = s.replace(/(\d+)\s*(?:½|1\/2)/g, '$1.5');
    s = s.replace(/½|\b1\/2\b/g, '0.5');
    s = s.replace(/,/g, '.');

    const lower = s.toLowerCase();
    // Negative judgements before positive
    if (lower.includes('non sufficiente') || lower.includes('insufficiente') || lower.includes('gravemente') || lower.includes('scarso')) {
      return 5;
    }
    if (lower.includes('eccellente') || lower.includes('ottimo')) return 10;
    if (lower.includes('distinto')) return 9;
    if (lower.includes('buono')) return 8;
    if (lower.includes('discreto')) return 7;
    if (lower.includes('sufficiente')) return 6;

    // Fractions like 7/8 or 6/7
    const fracMatch = s.match(/\b(10|[1-9])\s*\/\s*(10|[1-9])\b/);
    if (fracMatch) {
      return (parseFloat(fracMatch[1]) + parseFloat(fracMatch[2])) / 2;
    }

    // Standard number + suffixes (+, -, ++, --)
    const numMatch = s.match(/\b(10|[1-9])(?:\.(\d+))?\s*(\+\+|\+|--|-)?/);
    if (numMatch) {
      let base = parseFloat(numMatch[1]);
      if (numMatch[2]) {
        base += parseFloat('0.' + numMatch[2]);
      }
      let suffix = numMatch[3] || '';
      let delta = 0;
      if (suffix === '++') delta = 0.5;
      else if (suffix === '+') delta = 0.25;
      else if (suffix === '--') delta = -0.5;
      else if (suffix === '-') delta = -0.25;
      return Math.min(10, Math.max(1, base + delta));
    }
    return null;
  }

  // =========================================================================
  // 3. METADATA & SECTION DETECTOR
  // =========================================================================

  function getStudentMetadata() {
    const userEl = document.querySelector('.username');
    const instituteEl = document.querySelector('.desc-as-header .pull-left') || document.querySelector('.desc-as-header');
    const yearEl = document.querySelector('.anno-footer');
    const avatarEl = document.querySelector('#imgAvatarHeader');

    let name = 'Studente';
    if (userEl) {
      name = userEl.textContent.trim().replace(/^b/i, '').trim() || 'Studente';
    }

    let institute = 'Registro Elettronico Axios';
    if (instituteEl) {
      const titleAttr = instituteEl.getAttribute('title');
      if (titleAttr) {
        institute = titleAttr.replace(/^\d+\s*-\s*/, '').trim();
      } else {
        const text = instituteEl.textContent.trim();
        institute = text.replace(/^\d+\s*-\s*/, '').split('\n')[0].trim();
      }
    }

    let year = '';
    if (yearEl) {
      year = yearEl.textContent.trim();
    }

    let avatar = '';
    if (avatarEl && avatarEl.src) {
      avatar = avatarEl.src;
    }

    return { name, institute, year, avatar };
  }

  function detectCurrentSection() {
    // If table-voti or grades grid is present
    if (document.getElementById('table-voti') || document.querySelector('.table-voti') || document.querySelector('.rdoc_full_valutazioni')) {
      return 'voti';
    }
    // If Registro di classe table is present
    if (document.getElementById('table-rcla') || document.querySelector('.family-rcla') || document.querySelector('legend')?.textContent?.includes('Registro di Classe')) {
      return 'registro';
    }
    // If timeline / dashboard
    if (document.querySelector('.tm-header') || document.getElementById('content-timeline') || document.getElementById('content-menu')) {
      return 'dashboard';
    }
    // If assenze
    if (document.querySelector('[id*="assenze"]') || document.querySelector('legend')?.textContent?.toLowerCase().includes('assenze')) {
      return 'assenze';
    }
    // If comunicazioni
    if (document.querySelector('[id*="comunicazioni"]') || document.querySelector('legend')?.textContent?.toLowerCase().includes('comunicazioni')) {
      return 'comunicazioni';
    }
    // If orario
    if (document.querySelector('[id*="orario"]') || document.querySelector('legend')?.textContent?.toLowerCase().includes('orario')) {
      return 'orario';
    }
    // If pagella
    if (document.querySelector('[id*="pagella"]') || document.querySelector('legend')?.textContent?.toLowerCase().includes('pagella')) {
      return 'pagella';
    }
    return STATE.currentSection || 'voti';
  }

  // =========================================================================
  // 4. REAL-TIME SCRAPING OF ALL VOTI (ZERO MOCK DATA)
  // =========================================================================

  function autoExpandDataTables() {
    const lenSelect = document.querySelector('select[name="table-voti_length"]');
    if (lenSelect && lenSelect.value !== '100' && lenSelect.value !== '-1') {
      lenSelect.value = '100';
      lenSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function scrapeAllGrades() {
    autoExpandDataTables();

    // 1. Scrape #table-voti (DataTables)
    const tableCandidates = [
      document.getElementById('table-voti'),
      document.querySelector('.table-voti'),
      document.querySelector('#content-alunno table'),
      document.querySelector('#page-content table'),
    ];

    const table = tableCandidates.find((t) => t && t.id !== 'table-rcla' && t.querySelectorAll('tr').length > 1);

    if (table) {
      const headers = Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td')).map((h) =>
        h.textContent.trim().toLowerCase()
      );

      let dateCol = headers.findIndex((h) => h.includes('data') || h.includes('giorno'));
      let subjCol = headers.findIndex((h) => h.includes('materia'));
      let typeCol = headers.findIndex((h) => h.includes('tipo'));
      let gradeCol = headers.findIndex((h) => h.includes('voto') || h.includes('valutazione'));
      let commentCol = headers.findIndex((h) => h.includes('commento') || h.includes('note') || h.includes('obiettivo'));
      let teacherCol = headers.findIndex((h) => h.includes('docente') || h.includes('insegnante'));

      if (dateCol === -1) dateCol = 0;
      if (subjCol === -1) subjCol = 1;
      if (typeCol === -1) typeCol = 2;
      if (gradeCol === -1) gradeCol = 3;
      if (commentCol === -1) commentCol = 5;
      if (teacherCol === -1) teacherCol = 6;

      const rows = table.querySelectorAll('tbody tr');
      let lastSubject = '';

      rows.forEach((tr, rIdx) => {
        if (tr.classList.contains('dataTables_empty')) return;
        const cells = tr.querySelectorAll('td');
        if (cells.length < 3) return;

        const dateStr = cells[dateCol] ? cells[dateCol].textContent.trim() : '';
        let subjStr = cells[subjCol] ? cells[subjCol].textContent.trim() : '';
        if (subjStr) lastSubject = subjStr;
        else subjStr = lastSubject;

        const typeStr = cells[typeCol] ? cells[typeCol].textContent.trim() : 'S';
        const gradeRaw = cells[gradeCol] ? cells[gradeCol].textContent.trim() : '';
        let commentStr = cells[commentCol] ? cells[commentCol].textContent.trim() : '';
        let teacherStr = cells[teacherCol] ? cells[teacherCol].textContent.trim() : '';

        // Extract comment from tooltips or modal buttons
        const commentBtn = tr.querySelector('.family-voti-obiettivi, a[data-desc], button[data-desc]');
        if (commentBtn) {
          const descAttr = commentBtn.getAttribute('data-desc');
          if (descAttr) commentStr = descAttr;
        }

        const num = extractGradeValue(gradeRaw);
        if (num !== null && subjStr) {
          const cleanSubj = subjStr.replace(/\s+/g, ' ').trim();
          let typeChar = 'S';
          const typeLower = typeStr.toLowerCase();
          if (typeLower.startsWith('o')) typeChar = 'O';
          else if (typeLower.startsWith('p')) typeChar = 'P';

          const uniqueKey = `${cleanSubj}_${dateStr}_${num}_${typeChar}_${gradeRaw}`;

          const isNoMedia = tr.classList.contains('voti_no_media') ||
                            cells[gradeCol]?.classList.contains('voto_no_media') ||
                            gradeRaw.toLowerCase().includes('non fa media');

          STATE.allGradesMap[uniqueKey] = {
            id: uniqueKey,
            materia: cleanSubj,
            voto: num,
            raw: gradeRaw,
            tipo: typeChar,
            data: dateStr,
            commento: commentStr,
            docente: teacherStr,
            faMedia: !isNoMedia,
          };
          STATE.isTableFound = true;
        }
      });
    }

    // 2. Scrape Grid View (.rdoc_full_valutazioni)
    const gridVotes = document.querySelectorAll('.rdoc_full_valutazioni .voto, .table .voto');
    gridVotes.forEach((vEl, idx) => {
      const gradeRaw = vEl.textContent.trim();
      const num = extractGradeValue(gradeRaw);
      if (num === null) return;

      const title = vEl.getAttribute('data-original-title') || vEl.getAttribute('title') || '';
      let dateStr = 'Data N.D.';
      let subjStr = 'Materia';
      let docStr = '';
      let comStr = '';

      const dMatch = title.match(/data[:\s]+([\d/.-]+)/i);
      if (dMatch) dateStr = dMatch[1];
      const mMatch = title.match(/materia[:\s]+([^<>\n]+)/i);
      if (mMatch) subjStr = mMatch[1].trim();
      const docMatch = title.match(/docente[:\s]+([^<>\n]+)/i);
      if (docMatch) docStr = docMatch[1].trim();
      const comMatch = title.match(/note|commento[:\s]+([^<>\n]+)/i);
      if (comMatch) comStr = comMatch[1].trim();

      if (subjStr === 'Materia') {
        const row = vEl.closest('tr');
        if (row) {
          const firstThOrTd = row.querySelector('th, td:first-child');
          if (firstThOrTd) subjStr = firstThOrTd.textContent.trim();
        }
      }

      let typeChar = 'S';
      if (vEl.classList.contains('voto_O') || vEl.classList.contains('voti_O')) typeChar = 'O';
      else if (vEl.classList.contains('voto_P') || vEl.classList.contains('voti_P')) typeChar = 'P';

      const cleanSubj = subjStr.replace(/\s+/g, ' ').trim();
      const uniqueKey = `${cleanSubj}_${dateStr}_${num}_${typeChar}_${gradeRaw}`;

      STATE.allGradesMap[uniqueKey] = {
        id: uniqueKey,
        materia: cleanSubj,
        voto: num,
        raw: gradeRaw,
        tipo: typeChar,
        data: dateStr,
        commento: comStr,
        docente: docStr,
        faMedia: !vEl.classList.contains('voto_no_media'),
      };
      STATE.isTableFound = true;
    });

    // Group into subjects
    const subjectsMap = {};
    Object.values(STATE.allGradesMap).forEach((g) => {
      if (!subjectsMap[g.materia]) {
        subjectsMap[g.materia] = {
          materia: g.materia,
          docente: g.docente,
          voti: [],
        };
      }
      subjectsMap[g.materia].voti.push(g);
      if (!subjectsMap[g.materia].docente && g.docente) {
        subjectsMap[g.materia].docente = g.docente;
      }
    });

    STATE.scrapedSubjects = Object.values(subjectsMap);
  }

  // =========================================================================
  // 5. REGISTRO DI CLASSE SCRAPER (TABLE-RCLA & TIMELINE)
  // =========================================================================

  function scrapeRegistroClasse() {
    const table = document.getElementById('table-rcla');
    if (!table) return null;

    const rows = table.querySelectorAll('tbody tr');
    const days = [];

    const weekInput = document.getElementById('fdData');
    const weekDateStr = weekInput ? weekInput.value : '';

    rows.forEach((tr, idx) => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 4) {
        const dateRaw = cells[0].innerHTML
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const parseCellItems = (cell, category) => {
          if (!cell) return [];
          const html = cell.innerHTML.trim();
          if (!html) return [];

          const parts = html.split(/<br\s*\/?>/i).map((p) => p.trim()).filter(Boolean);
          return parts.map((part, pIdx) => {
            const match = part.match(/<b>(.*?)[:\s]*<\/b>(.*)/i);
            let subject = 'Generale';
            let desc = part;
            if (match) {
              subject = match[1].replace(/[:\s]+$/, '').trim();
              desc = match[2].trim();
            } else {
              desc = part.replace(/<[^>]*>/g, '').trim();
            }

            return {
              id: `rcla-${idx}-${category}-${pIdx}`,
              category,
              subject,
              description: desc.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
            };
          });
        };

        const argomenti = parseCellItems(cells[1], 'argomento');
        const compiti = parseCellItems(cells[2], 'compito');
        const verifiche = parseCellItems(cells[3], 'verifica');

        days.push({
          dateStr: dateRaw,
          argomenti,
          compiti,
          verifiche,
          hasContent: argomenti.length > 0 || compiti.length > 0 || verifiche.length > 0,
        });
      }
    });

    return {
      weekDateStr,
      days,
    };
  }

  // =========================================================================
  // 6. STATS & SIMULATOR CALCULATIONS
  // =========================================================================

  function calculateStats(subjects, simulations = []) {
    let allGradesSum = 0;
    let allGradesCount = 0;
    let subjectAveragesSum = 0;
    let evaluatedSubjectsCount = 0;
    let goodSubjectsCount = 0;
    let badSubjectsCount = 0;

    const subjectsWithComputed = subjects.map((subj) => {
      const realGrades = subj.voti.filter((v) => v.faMedia);
      const realSum = realGrades.reduce((acc, v) => acc + v.voto, 0);
      const realAvg = realGrades.length > 0 ? realSum / realGrades.length : 0;

      const activeSims = simulations.filter((s) => s.materia.toLowerCase() === subj.materia.toLowerCase());
      const simGrades = activeSims.map((s) => ({
        id: s.id,
        voto: s.voto,
        raw: s.voto.toString(),
        tipo: s.tipo || 'S',
        data: 'Simulato',
        commento: 'Voto futuro simulato',
        docente: subj.docente,
        isSimulated: true,
        faMedia: true,
      }));

      const allGrades = [...subj.voti, ...simGrades];
      const countGrades = allGrades.filter((v) => v.faMedia);
      const computedSum = countGrades.reduce((acc, v) => acc + v.voto, 0);
      const computedAvg = countGrades.length > 0 ? computedSum / countGrades.length : 0;
      const delta = computedAvg - realAvg;

      if (countGrades.length > 0) {
        allGradesSum += computedSum;
        allGradesCount += countGrades.length;
        subjectAveragesSum += computedAvg;
        evaluatedSubjectsCount++;

        if (computedAvg >= 6.0) goodSubjectsCount++;
        else badSubjectsCount++;
      }

      return {
        ...subj,
        realAvg,
        computedAvg,
        delta,
        activeSimsCount: activeSims.length,
        allGrades,
      };
    });

    const arithmeticAverage = allGradesCount > 0 ? allGradesSum / allGradesCount : 0;
    const averageOfAverages = evaluatedSubjectsCount > 0 ? subjectAveragesSum / evaluatedSubjectsCount : 0;

    let percentileVal = null;
    const pEl = document.querySelector('.percentile-valore');
    if (pEl) {
      const pNum = parseInt(pEl.textContent.replace(/\D/g, ''), 10);
      if (!isNaN(pNum)) percentileVal = pNum;
    }

    return {
      arithmeticAverage,
      averageOfAverages,
      evaluatedSubjectsCount,
      goodSubjectsCount,
      badSubjectsCount,
      percentile: percentileVal,
      subjects: subjectsWithComputed,
    };
  }

  function calculateTargetGrade(subj, targetAvg) {
    const grades = subj.voti.filter((v) => v.faMedia);
    const n = grades.length;
    const sum = grades.reduce((acc, v) => acc + v.voto, 0);
    return targetAvg * (n + 1) - sum;
  }

  // =========================================================================
  // 7. CLICK DELEGATION
  // =========================================================================

  function triggerAxiosAction(actionName, selector = '') {
    let target = null;
    if (actionName) {
      target =
        document.querySelector(`[data-action="${actionName}"]`) ||
        document.querySelector(`.family-tile[data-action="${actionName}"]`) ||
        document.querySelector(`a[data-action="${actionName}"]`) ||
        document.querySelector(`button[data-action="${actionName}"]`);
    }
    if (!target && selector) {
      target = document.querySelector(selector);
    }

    if (target) {
      const innerA = target.querySelector('a');
      if (innerA) innerA.click();
      target.click();
    } else {
      console.log(`[Modern Axios] Action: ${actionName}`);
    }
  }

  // =========================================================================
  // 8. SVG SPARKLINE GENERATOR
  // =========================================================================

  function generateSparklineSvg(grades, isGood) {
    if (!grades || grades.length === 0) {
      return `<svg class="ax-sparkline-svg"><text x="50%" y="50%" fill="#6B7280" font-size="11" text-anchor="middle">Nessun voto</text></svg>`;
    }

    const width = 320;
    const height = 50;
    const padX = 14;
    const padY = 8;

    const values = grades.map((g) => g.voto);
    const minVal = Math.min(4, ...values);
    const maxVal = Math.max(10, ...values);
    const stepX = grades.length > 1 ? (width - padX * 2) / (grades.length - 1) : 0;

    const points = grades.map((g, i) => {
      const x = grades.length === 1 ? width / 2 : padX + i * stepX;
      const normalized = (g.voto - minVal) / (maxVal - minVal || 1);
      const y = height - padY - normalized * (height - padY * 2);
      return { x, y, grade: g };
    });

    const norm6 = (6.0 - minVal) / (maxVal - minVal || 1);
    const y6 = height - padY - norm6 * (height - padY * 2);

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      pathD += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
    const strokeColor = isGood ? '#10B981' : '#EF4444';
    const gradId = `grad-${Math.random().toString(36).substring(2, 8)}`;

    const circles = points
      .map(
        (p) => `
      <circle 
        class="ax-sparkline-point" 
        cx="${p.x}" 
        cy="${p.y}" 
        r="4" 
        style="stroke: ${p.grade.voto >= 6 ? '#10B981' : '#EF4444'};"
        data-grade="${p.grade.raw || p.grade.voto}"
        data-date="${p.grade.data}"
        data-comment="${p.grade.commento || ''}"
        data-teacher="${p.grade.docente || ''}"
        data-type="${p.grade.tipo || 'S'}"
      />`
      )
      .join('');

    return `
      <svg class="ax-sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <line x1="${padX}" y1="${y6}" x2="${width - padX}" y2="${y6}" stroke="rgba(255,255,255,0.12)" stroke-dasharray="3,3" stroke-width="1"/>
        <path d="${areaD}" fill="url(#${gradId})" class="ax-sparkline-area"/>
        <path d="${pathD}" class="ax-sparkline-line ${isGood ? 'line-good' : 'line-bad'}"/>
        ${circles}
      </svg>
    `;
  }

  // =========================================================================
  // 9. MODERN UI RENDERERS
  // =========================================================================

  function renderSidebar(student) {
    const navItems = [
      { id: 'voti', label: 'Voti & Medie', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', action: 'FAMILY_VOTI' },
      { id: 'registro', label: 'Registro di Classe', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', action: 'FAMILY_REGISTRO_CLASSE' },
      { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', action: 'DASHBOARDLOAD' },
      { id: 'assenze', label: 'Assenze & Ritardi', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', action: 'FAMILY_ASSENZE' },
      { id: 'comunicazioni', label: 'Comunicazioni', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z', action: 'FAMILY_COMUNICAZIONI' },
      { id: 'orario', label: 'Orario Lezioni', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', action: 'FAMILY_ORARIO' },
      { id: 'pagella', label: 'Pagella', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', action: 'FAMILY_PAGELLA' },
    ];

    const navHtml = navItems
      .map(
        (item) => `
      <div class="ax-nav-item ${STATE.currentSection === item.id ? 'active' : ''}" data-nav="${item.id}" data-action="${item.action}">
        <div class="ax-nav-icon">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="${item.icon}"/>
          </svg>
        </div>
        <span class="ax-nav-label">${item.label}</span>
      </div>
    `
      )
      .join('');

    return `
      <aside class="ax-sidebar">
        <div class="ax-sidebar-header">
          <a href="#" class="ax-brand">
            <div class="ax-brand-logo">A</div>
            <div class="ax-brand-text">
              <div class="ax-brand-title">AXIOS <span class="ax-badge-pro">PRO</span></div>
              <div class="ax-brand-subtitle">Registro Elettronico</div>
            </div>
          </a>
        </div>

        <div class="ax-student-profile">
          ${
            student.avatar
              ? `<img src="${student.avatar}" alt="Avatar" class="ax-student-avatar"/>`
              : `<div class="ax-student-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--ax-accent-gradient);color:#fff;font-weight:700;">${student.name.charAt(0)}</div>`
          }
          <div class="ax-student-info">
            <span class="ax-student-name">${student.name}</span>
            <span class="ax-student-meta">${student.institute} ${student.year ? '• ' + student.year : ''}</span>
          </div>
        </div>

        <div class="ax-nav-container">
          <div class="ax-nav-group-title">Menu Principale</div>
          <div class="ax-nav-group-items">${navHtml}</div>
        </div>

        <div class="ax-sidebar-footer">
          <div class="ax-nav-item" id="ax-logout-btn">
            <div class="ax-nav-icon">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </div>
            <span class="ax-nav-label">Esci</span>
          </div>
        </div>
      </aside>
    `;
  }

  function renderTopbar() {
    const titles = {
      voti: 'Voti & Valutazioni',
      registro: 'Registro di Classe',
      dashboard: 'Dashboard',
      assenze: 'Assenze e Giustificazioni',
      comunicazioni: 'Comunicazioni & Circolari',
      orario: 'Orario delle Lezioni',
      pagella: 'Pagella Scolastica',
      generic: 'Sezione Axios',
    };

    return `
      <header class="ax-topbar">
        <div class="ax-topbar-left">
          <div class="ax-breadcrumbs">
            <span>Axios</span>
            <span>/</span>
            <span class="ax-breadcrumbs-current">${titles[STATE.currentSection] || 'Registro'}</span>
          </div>
        </div>

        <div class="ax-topbar-right">
          ${
            STATE.currentSection === 'voti' && STATE.isTableFound
              ? `
            <button class="ax-btn ax-btn-primary" id="ax-open-sim-btn">
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              <span>Simulatore What-If</span>
              ${STATE.simulations.length > 0 ? `<span class="ax-badge-pro" style="background:#fff;color:#000;">${STATE.simulations.length}</span>` : ''}
            </button>
          `
              : ''
          }

          <div class="ax-classic-toggle" id="ax-classic-toggle" title="Disattiva dashboard e rimostra Axios classico">
            <span class="ax-classic-toggle-label">Modalità Classica</span>
            <div class="ax-switch"><div class="ax-switch-thumb"></div></div>
          </div>
        </div>
      </header>
    `;
  }

  // --- VISTA VOTI REDESIGN ---
  function renderVotiView(stats) {
    if (!STATE.isTableFound || stats.subjects.length === 0) {
      return `
        <div class="ax-section-header-card" style="text-align:center;display:flex;flex-direction:column;padding:48px 24px;gap:14px;">
          <div style="width:54px;height:54px;border-radius:50%;background:rgba(99,102,241,0.15);color:var(--ax-accent-light);display:inline-flex;align-items:center;justify-content:center;margin:0 auto;">
            <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <h3 style="font-size:20px;font-weight:700;margin:0;">In attesa della tabella dei voti...</h3>
          <p style="color:var(--ax-text-muted);font-size:14px;max-width:520px;margin:0 auto;">
            Il MutationObserver sta monitorando il DOM di Axios in tempo reale. Se sei su un'altra sezione, clicca il pulsante qui sotto per richiedere ad Axios il caricamento della sezione Voti.
          </p>
          <button class="ax-btn ax-btn-primary" id="ax-load-voti-btn" style="padding:10px 22px;font-size:14px;margin:8px auto 0;">
            Carica Voti da Axios
          </button>
        </div>
      `;
    }

    const isGoodGeneral = stats.arithmeticAverage >= 6.0;

    let filtered = stats.subjects.filter((s) => {
      const match = s.materia.toLowerCase().includes(STATE.searchQuery.toLowerCase());
      if (!match) return false;
      if (STATE.filterStatus === 'good') return s.computedAvg >= 6.0;
      if (STATE.filterStatus === 'bad') return s.computedAvg < 6.0;
      if (STATE.filterStatus === 'simulated') return s.activeSimsCount > 0;
      return true;
    });

    filtered.sort((a, b) => {
      if (STATE.sortOrder === 'avg-desc') return b.computedAvg - a.computedAvg;
      if (STATE.sortOrder === 'avg-asc') return a.computedAvg - b.computedAvg;
      if (STATE.sortOrder === 'name-asc') return a.materia.localeCompare(b.materia);
      if (STATE.sortOrder === 'grades-count') return b.allGrades.length - a.allGrades.length;
      return 0;
    });

    const totalGradesCount = stats.subjects.reduce((a, s) => a + s.voti.length, 0);

    const cardsHtml = filtered
      .map((s) => {
        const isSufficient = s.computedAvg >= 6.0;
        const badgeClass = s.computedAvg >= 6.5 ? 'badge-good' : s.computedAvg >= 6.0 ? 'badge-warn' : 'badge-bad';

        const gradesHtml = s.allGrades
          .map((g) => {
            const isGradeGood = g.voto >= 6.0;
            const simClass = g.isSimulated ? 'grade-simulated' : isGradeGood ? 'grade-good' : 'grade-bad';
            return `
              <div class="ax-grade-pill ${simClass}"
                data-grade="${g.raw || g.voto}"
                data-date="${g.data}"
                data-comment="${g.commento || ''}"
                data-teacher="${g.docente || ''}"
                data-type="${g.tipo || 'S'}"
                data-sim="${g.isSimulated ? '1' : '0'}"
              >
                <span>${g.raw || g.voto}</span>
                <span class="ax-grade-type">${g.tipo || 'S'}</span>
              </div>
            `;
          })
          .join('');

        return `
          <div class="ax-subject-card">
            <div class="ax-subject-card-header">
              <div class="ax-subject-title-area">
                <div class="ax-subject-name">${s.materia}</div>
                <div class="ax-subject-teacher">${s.docente || 'Docente di classe'}</div>
              </div>
              <div class="ax-subject-avg-badge ${badgeClass}" title="Media calcolata sui voti reali">
                <span>${s.computedAvg > 0 ? s.computedAvg.toFixed(2) : '-'}</span>
                ${
                  s.delta !== 0
                    ? `<span style="font-size:10px;font-weight:700;margin-left:2px;">${s.delta > 0 ? '+' : ''}${s.delta.toFixed(2)}</span>`
                    : ''
                }
              </div>
            </div>

            <div class="ax-sparkline-container">
              ${generateSparklineSvg(s.allGrades, isSufficient)}
            </div>

            <div class="ax-grades-strip">
              ${gradesHtml}
            </div>

            <div class="ax-subject-card-footer">
              <span class="ax-grades-count">${s.allGrades.length} voti registrati</span>
              <button class="ax-btn-mini ax-quick-sim-btn" data-subject="${s.materia}">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                <span>Simula voto</span>
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <!-- Stats Overview -->
      <div class="ax-stats-grid">
        <div class="ax-stat-card">
          <div class="ax-stat-header">
            <span class="ax-stat-title">Media Generale</span>
            <div class="ax-stat-icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
          </div>
          <div class="ax-stat-value-group">
            <span class="ax-stat-value ${isGoodGeneral ? 'value-good' : 'value-bad'}">
              ${stats.arithmeticAverage > 0 ? stats.arithmeticAverage.toFixed(2) : '-'}
            </span>
          </div>
          <div class="ax-stat-split">
            <div class="ax-stat-split-item">
              <span class="ax-stat-subtitle">Aritmetica totale</span>
              <span class="ax-stat-split-val">${stats.arithmeticAverage.toFixed(2)}</span>
            </div>
            <div class="ax-stat-split-item" style="border-left:1px solid var(--ax-border-subtle);padding-left:10px;">
              <span class="ax-stat-subtitle">Media delle medie</span>
              <span class="ax-stat-split-val">${stats.averageOfAverages.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="ax-stat-card">
          <div class="ax-stat-header">
            <span class="ax-stat-title">Materie Valutate</span>
            <div class="ax-stat-icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <div class="ax-stat-value-group">
            <span class="ax-stat-value">${stats.evaluatedSubjectsCount}</span>
            <span class="ax-stat-subtitle">materie totali</span>
          </div>
          <div class="ax-stat-split" style="margin-top:8px;">
            <span style="color:var(--ax-success);font-weight:600;">${stats.goodSubjectsCount} con media ≥ 6</span>
            <span>•</span>
            <span style="color:${stats.badSubjectsCount > 0 ? 'var(--ax-danger)' : 'var(--ax-text-muted)'};font-weight:600;">
              ${stats.badSubjectsCount} sotto il 6
            </span>
          </div>
        </div>

        <div class="ax-stat-card">
          <div class="ax-stat-header">
            <span class="ax-stat-title">Voti Rilevati</span>
            <div class="ax-stat-icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </div>
          </div>
          <div class="ax-stat-value-group">
            <span class="ax-stat-value">${totalGradesCount}</span>
            <span class="ax-stat-subtitle">voti registrati</span>
          </div>
          <span class="ax-stat-subtitle" style="margin-top:6px;">Tutti estratti in tempo reale da Axios</span>
        </div>

        <div class="ax-stat-card" style="cursor:pointer;" id="ax-sim-card-trigger">
          <div class="ax-stat-header">
            <span class="ax-stat-title">Simulatore What-If</span>
            <div class="ax-stat-icon" style="background:rgba(99,102,241,0.15);color:var(--ax-accent-light);">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
              </svg>
            </div>
          </div>
          <div class="ax-stat-value-group">
            <span class="ax-stat-value" style="color:var(--ax-accent-light);">${STATE.simulations.length}</span>
            <span class="ax-stat-subtitle">voti simulati</span>
          </div>
          <span class="ax-stat-subtitle" style="color:var(--ax-accent-light);margin-top:6px;">
            ${STATE.simulations.length > 0 ? 'Gestisci simulazioni attive' : 'Clicca per testare voti futuri →'}
          </span>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="ax-toolbar">
        <div class="ax-toolbar-left">
          <div class="ax-search-box">
            <svg class="ax-search-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" id="ax-voti-search" class="ax-search-input" placeholder="Cerca tra le tue materie..." value="${STATE.searchQuery}"/>
          </div>
        </div>

        <div class="ax-toolbar-right">
          <div class="ax-filter-pill ${STATE.filterStatus === 'all' ? 'active' : ''}" data-filter="all">Tutte</div>
          <div class="ax-filter-pill ${STATE.filterStatus === 'good' ? 'active' : ''}" data-filter="good">Sufficienti (≥6)</div>
          <div class="ax-filter-pill ${STATE.filterStatus === 'bad' ? 'active' : ''}" data-filter="bad">Insufficienti (&lt;6)</div>
          ${
            STATE.simulations.length > 0
              ? `<div class="ax-filter-pill ${STATE.filterStatus === 'simulated' ? 'active' : ''}" data-filter="simulated">Con Simulazioni</div>`
              : ''
          }
          
          <select id="ax-sort-select" class="ax-select" style="width: auto; height: 32px; padding: 0 10px; font-size: 12px;">
            <option value="avg-desc" ${STATE.sortOrder === 'avg-desc' ? 'selected' : ''}>Media decrescente</option>
            <option value="avg-asc" ${STATE.sortOrder === 'avg-asc' ? 'selected' : ''}>Media crescente</option>
            <option value="name-asc" ${STATE.sortOrder === 'name-asc' ? 'selected' : ''}>Nome A-Z</option>
            <option value="grades-count" ${STATE.sortOrder === 'grades-count' ? 'selected' : ''}>Numero voti</option>
          </select>
        </div>
      </div>

      <!-- Subjects Grid -->
      <div class="ax-subjects-grid">
        ${cardsHtml}
      </div>
    `;
  }

  // --- VISTA REGISTRO DI CLASSE REDESIGN COMPLETO ---
  function renderRegistroClasseView() {
    const rclaData = scrapeRegistroClasse();

    if (!rclaData || rclaData.days.length === 0) {
      return `
        <div class="ax-section-header-card" style="text-align:center;padding:40px 20px;">
          <h3 style="margin:0 0 8px;font-size:18px;">Registro di Classe non ancora nel DOM</h3>
          <p style="color:var(--ax-text-muted);font-size:13.5px;margin:0 0 16px;">
            Clicca per caricare i compiti, le verifiche e gli argomenti della settimana.
          </p>
          <button class="ax-btn ax-btn-primary" id="ax-rcla-load-btn">Carica Registro di Classe</button>
        </div>
      `;
    }

    const filter = STATE.rclaFilter;

    const daysHtml = rclaData.days
      .map((day) => {
        let verifiche = day.verifiche;
        let compiti = day.compiti;
        let argomenti = day.argomenti;

        if (filter === 'verifiche') {
          compiti = [];
          argomenti = [];
        } else if (filter === 'compiti') {
          verifiche = [];
          argomenti = [];
        } else if (filter === 'argomenti') {
          verifiche = [];
          compiti = [];
        }

        const totalItems = verifiche.length + compiti.length + argomenti.length;

        const verificheHtml =
          verifiche.length > 0
            ? `
          <div>
            <div class="ax-section-title ax-section-verifiche-title">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              <span>Verifiche & Interrogazioni in programma</span>
            </div>
            ${verifiche
              .map(
                (v) => `
              <div class="ax-rcla-item item-verifica">
                <div class="ax-rcla-item-header">
                  <span class="ax-tag-verifica">VERIFICA • ${v.subject}</span>
                </div>
                <div class="ax-rcla-desc"><b>${v.subject}:</b> ${v.description}</div>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : '';

        const compitiHtml =
          compiti.length > 0
            ? `
          <div>
            <div class="ax-section-title ax-section-compiti-title">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
              <span>Compiti per Casa</span>
            </div>
            ${compiti
              .map((c) => {
                const isDone = !!STATE.completedTasks[c.id];
                return `
              <div class="ax-task-card ${isDone ? 'completed' : ''}" style="margin-bottom:8px;">
                <div class="ax-task-checkbox" data-task-id="${c.id}" title="Segna come completato">
                  ${isDone ? `<svg width="12" height="12" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>` : ''}
                </div>
                <div class="ax-task-content">
                  <div class="ax-task-meta">
                    <span class="ax-tag-compito">${c.subject}</span>
                  </div>
                  <div class="ax-task-desc">${c.description}</div>
                </div>
              </div>
            `;
              })
              .join('')}
          </div>
        `
            : '';

        const argomentiHtml =
          argomenti.length > 0
            ? `
          <div>
            <div class="ax-section-title ax-section-argomenti-title">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              <span>Argomenti delle Lezioni Svolte</span>
            </div>
            ${argomenti
              .map(
                (a) => `
              <div class="ax-rcla-item" style="border-left:3px solid #3B82F6;">
                <div class="ax-rcla-item-header">
                  <span class="ax-tag-argomento">${a.subject}</span>
                </div>
                <div class="ax-rcla-desc">${a.description}</div>
              </div>
            `
              )
              .join('')}
          </div>
        `
            : '';

        const bodyContent =
          totalItems > 0
            ? `${verificheHtml}${compitiHtml}${argomentiHtml}`
            : `<p style="color:var(--ax-text-muted);font-size:13px;margin:0;">Nessuna attività registrata per questo giorno.</p>`;

        return `
          <div class="ax-day-card">
            <div class="ax-day-header">
              <div class="ax-day-title">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                <span>${day.dateStr}</span>
              </div>
              <span class="ax-day-badge">${totalItems} elementi</span>
            </div>
            <div class="ax-day-body">
              ${bodyContent}
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="ax-rcla-container">
        <!-- Week Navigation Banner -->
        <div class="ax-week-nav-banner">
          <div class="ax-week-title-area">
            <button class="ax-btn ax-btn-ghost" id="ax-rcla-prev" title="Settimana precedente">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
              <span>Settimana Prec.</span>
            </button>
            <span class="ax-week-title">Settimana del ${rclaData.weekDateStr || 'Corrente'}</span>
            <button class="ax-btn ax-btn-ghost" id="ax-rcla-next" title="Settimana successiva">
              <span>Settimana Succ.</span>
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>

          <div style="display:flex;align-items:center;gap:8px;">
            <div class="ax-filter-pill ${filter === 'all' ? 'active' : ''}" data-rcla-filter="all">Tutti gli eventi</div>
            <div class="ax-filter-pill ${filter === 'verifiche' ? 'active' : ''}" data-rcla-filter="verifiche">🎯 Solo Verifiche</div>
            <div class="ax-filter-pill ${filter === 'compiti' ? 'active' : ''}" data-rcla-filter="compiti">📝 Solo Compiti</div>
            <div class="ax-filter-pill ${filter === 'argomenti' ? 'active' : ''}" data-rcla-filter="argomenti">📖 Solo Argomenti</div>
          </div>
        </div>

        <!-- Weekly Days Cards -->
        <div class="ax-week-days-list">
          ${daysHtml}
        </div>
      </div>
    `;
  }

  // --- VISTA DASHBOARD ---
  function renderDashboardView() {
    const todayInput = document.getElementById('dpToday');
    const dayNumber = document.querySelector('.tm-day-number')?.textContent?.trim();
    const dayName = document.querySelector('.tm-day-name')?.textContent?.trim();
    const monthName = document.querySelector('.tm-month')?.textContent?.trim();
    let displayDate = `${dayName || ''} ${dayNumber || ''} ${monthName || ''}`.trim() || todayInput?.value || 'Oggi';

    const actionEls = document.querySelectorAll('.mt-actions .mt-action');
    const compiti = [];
    const argomenti = [];

    actionEls.forEach((el, index) => {
      const authorText = el.querySelector('.mt-action-author')?.textContent?.trim() || '';
      const descText = el.querySelector('.mt-action-desc')?.textContent?.trim() || '';

      if (authorText.toLowerCase().includes('compito per casa')) {
        compiti.push({
          id: `dash-task-${index}`,
          subject: authorText.replace(/compito per casa di/i, '').trim(),
          description: descText,
        });
      } else {
        argomenti.push({
          id: `dash-topic-${index}`,
          subject: authorText.replace(/argomento di/i, '').trim(),
          description: descText,
        });
      }
    });

    const compitiHtml =
      compiti.length > 0
        ? compiti
            .map((c) => {
              const isDone = !!STATE.completedTasks[c.id];
              return `
          <div class="ax-task-card ${isDone ? 'completed' : ''}">
            <div class="ax-task-checkbox" data-task-id="${c.id}">
              ${isDone ? `<svg width="12" height="12" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>` : ''}
            </div>
            <div class="ax-task-content">
              <div class="ax-task-meta"><span class="ax-tag-compito">${c.subject}</span></div>
              <div class="ax-task-desc">${c.description}</div>
            </div>
          </div>
        `;
            })
            .join('')
        : `<p style="color:var(--ax-text-muted);font-size:13px;">Nessun compito registrato per oggi.</p>`;

    const argomentiHtml =
      argomenti.length > 0
        ? argomenti
            .map(
              (a) => `
          <div class="ax-topic-card">
            <div class="ax-task-meta"><span class="ax-tag-argomento">${a.subject}</span></div>
            <div class="ax-topic-desc">${a.description}</div>
          </div>
        `
            )
            .join('')
        : `<p style="color:var(--ax-text-muted);font-size:13px;">Nessun argomento registrato per oggi.</p>`;

    return `
      <div class="ax-welcome-banner">
        <div class="ax-welcome-text">
          <h2>Panoramica Giornaliera</h2>
          <p>${compiti.length} compiti per casa • ${argomenti.length} lezioni svolte</p>
        </div>

        <div class="ax-date-navigator">
          <button class="ax-date-btn" id="ax-date-prev" title="Giorno precedente">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span class="ax-current-date-pill">${displayDate}</span>
          <button class="ax-date-btn" id="ax-date-today" title="Torna ad oggi">Oggi</button>
          <button class="ax-date-btn" id="ax-date-next" title="Giorno successivo">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>

      <div class="ax-dashboard-columns">
        <div>
          <div class="ax-dash-column-header">
            <div class="ax-dash-column-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
              <span>Compiti per Casa</span>
            </div>
            <span class="ax-nav-counter">${compiti.length}</span>
          </div>
          ${compitiHtml}
        </div>

        <div>
          <div class="ax-dash-column-header">
            <div class="ax-dash-column-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              <span>Argomenti delle Lezioni</span>
            </div>
            <span class="ax-nav-counter">${argomenti.length}</span>
          </div>
          ${argomentiHtml}
        </div>
      </div>
    `;
  }

  // --- VISTA MODERNA GENERICHE PER ALTRE OPZIONI (SENZA INTERFACCIA CLASSICA) ---
  function renderModernGenericSection(sectionKey) {
    const container = document.getElementById('content-alunno') || document.getElementById('page-content');
    if (!container) return `<div class="ax-section-header-card">Caricamento in corso...</div>`;

    // Extract tables inside container
    const originalTables = container.querySelectorAll('table');
    let tablesHtml = '';

    if (originalTables.length > 0) {
      originalTables.forEach((t) => {
        // Skip table-rcla or table-voti already handled
        if (t.id === 'table-rcla' || t.id === 'table-voti') return;

        const ths = Array.from(t.querySelectorAll('thead th, tr:first-child th')).map((th) => th.textContent.trim());
        const trs = Array.from(t.querySelectorAll('tbody tr')).filter((r) => !r.classList.contains('dataTables_empty'));

        if (trs.length > 0) {
          const headerRowsHtml = ths.length > 0 ? `<tr>${ths.map((h) => `<th>${h}</th>`).join('')}</tr>` : '';
          const bodyRowsHtml = trs
            .map((r) => {
              const tds = Array.from(r.querySelectorAll('td')).map((td) => {
                const text = td.textContent.trim();
                const btn = td.querySelector('a, button');
                if (btn) {
                  return `<td><button class="ax-btn ax-btn-ghost ax-table-action-btn" data-action-target="${btn.className}">${btn.textContent.trim() || 'Visualizza'}</button></td>`;
                }
                return `<td>${text}</td>`;
              });
              return `<tr>${tds.join('')}</tr>`;
            })
            .join('');

          tablesHtml += `
            <div class="ax-modern-table-card" style="margin-bottom:20px;">
              <table class="ax-modern-table">
                ${headerRowsHtml ? `<thead>${headerRowsHtml}</thead>` : ''}
                <tbody>${bodyRowsHtml}</tbody>
              </table>
            </div>
          `;
        }
      });
    }

    // Extract text paragraphs or forms
    const paragraphs = Array.from(container.querySelectorAll('p, .alert, .desc-as-header'))
      .map((p) => p.textContent.trim())
      .filter((t) => t.length > 5 && !t.includes('A.S.'));

    const sectionTitles = {
      assenze: 'Assenze, Ritardi e Giustificazioni',
      comunicazioni: 'Bacheca e Comunicazioni Scuola-Famiglia',
      orario: 'Orario delle Lezioni Settimanale',
      pagella: 'Pagella Scolastica e Valutazioni Quadrimestrali',
      generic: 'Dettagli Sezione',
    };

    return `
      <div class="ax-modern-card-container">
        <div class="ax-section-header-card">
          <div>
            <h3 style="margin:0 0 4px;font-size:18px;font-weight:700;">${sectionTitles[sectionKey] || 'Registro'}</h3>
            <span style="color:var(--ax-text-muted);font-size:12.5px;">Dati sincronizzati in tempo reale dal registro</span>
          </div>
        </div>

        ${tablesHtml || '<div class="ax-section-header-card" style="color:var(--ax-text-muted);font-size:13.5px;">Nessun dato tabellare presente in questa sezione.</div>'}

        ${
          paragraphs.length > 0
            ? `
          <div class="ax-section-header-card" style="display:flex;flex-direction:column;gap:8px;">
            ${paragraphs.map((p) => `<div style="font-size:13.5px;color:var(--ax-text-secondary);">${p}</div>`).join('')}
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  // --- WHAT-IF SIMULATOR DRAWER ---
  function renderWhatIfDrawer(stats) {
    const subjectsOptions = stats.subjects
      .map(
        (s) => `
      <option value="${s.materia}" ${STATE.selectedSimSubject === s.materia ? 'selected' : ''}>
        ${s.materia} (Media reale: ${s.realAvg > 0 ? s.realAvg.toFixed(2) : '-'})
      </option>
    `
      )
      .join('');

    const simulationsListHtml =
      STATE.simulations.length > 0
        ? STATE.simulations
            .map(
              (sim, idx) => `
          <div class="ax-sim-item">
            <div class="ax-sim-item-info">
              <span class="ax-tag-compito">${sim.materia}</span>
              <span style="font-weight:700;color:#fff;">Voto: ${sim.voto} (${sim.tipo || 'S'})</span>
            </div>
            <button class="ax-sim-delete" data-sim-index="${idx}" title="Elimina simulazione">
              <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        `
            )
            .join('')
        : `<p style="color:var(--ax-text-muted);font-size:12.5px;margin:0;">Nessun voto simulato attivo.</p>`;

    return `
      <div class="ax-drawer-overlay ${STATE.isDrawerOpen ? 'open' : ''}" id="ax-drawer-overlay">
        <div class="ax-drawer">
          <div class="ax-drawer-header">
            <div class="ax-drawer-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
              <span>Simulatore What-If</span>
            </div>
            <button class="ax-drawer-close" id="ax-drawer-close">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="ax-drawer-body">
            <div class="ax-form-group">
              <label class="ax-form-label">Materia</label>
              <select id="ax-sim-subject" class="ax-select">
                ${subjectsOptions}
              </select>
            </div>

            <div class="ax-form-group">
              <label class="ax-form-label">Voto Futuro da Testare</label>
              <div class="ax-preset-buttons">
                <button type="button" class="ax-preset-btn" data-val="4">4</button>
                <button type="button" class="ax-preset-btn" data-val="5">5</button>
                <button type="button" class="ax-preset-btn" data-val="6">6</button>
                <button type="button" class="ax-preset-btn" data-val="7">7</button>
                <button type="button" class="ax-preset-btn active" data-val="8">8</button>
                <button type="button" class="ax-preset-btn" data-val="9">9</button>
                <button type="button" class="ax-preset-btn" data-val="10">10</button>
              </div>
              <input type="number" id="ax-sim-grade-input" class="ax-input" min="2" max="10" step="0.25" value="8" style="margin-top:6px;"/>
            </div>

            <div class="ax-form-group">
              <label class="ax-form-label">Tipologia Prova</label>
              <select id="ax-sim-type" class="ax-select">
                <option value="S">Scritto (S)</option>
                <option value="O">Orale (O)</option>
                <option value="P">Pratico (P)</option>
              </select>
            </div>

            <button type="button" class="ax-btn ax-btn-primary" id="ax-add-sim-btn" style="width:100%;height:40px;">
              Aggiungi alla Simulazione
            </button>

            <!-- Target Grade Calculator Box -->
            <div class="ax-target-calculator">
              <div class="ax-target-title">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                <span>Calcolatore Obiettivo Voto</span>
              </div>
              <div style="display:flex;gap:8px;margin-bottom:8px;">
                <input type="number" id="ax-target-goal-input" class="ax-input" style="height:34px;width:100px;" value="8.0" min="5" max="10" step="0.1"/>
                <button type="button" class="ax-btn ax-btn-ghost" id="ax-calc-target-btn" style="height:34px;font-size:12px;">Calcola</button>
              </div>
              <div class="ax-target-result" id="ax-target-result-text">
                Imposta una media obiettivo per calcolare quale voto ti serve al prossimo compito.
              </div>
            </div>

            <!-- Active Simulations List -->
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <label class="ax-form-label" style="margin:0;">Simulazioni Attive (${STATE.simulations.length})</label>
                ${
                  STATE.simulations.length > 0
                    ? `<button type="button" id="ax-clear-sims-btn" style="background:none;border:none;color:var(--ax-danger);font-size:12px;cursor:pointer;">Cancella tutte</button>`
                    : ''
                }
              </div>
              <div class="ax-sim-list">
                ${simulationsListHtml}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPopover() {
    return `<div id="ax-grade-popover" class="ax-popover" style="display:none;"></div>`;
  }

  function renderClassicRestorePill() {
    return `
      <div id="ax-classic-restore-pill" style="display: ${STATE.isActive ? 'none' : 'flex'};">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        <span>⚡ Mostra Modern Axios</span>
      </div>
    `;
  }

  // =========================================================================
  // 10. FULL APP MOUNT & UPDATE
  // =========================================================================

  function renderFullApp() {
    // 1. Scrape all real grades
    scrapeAllGrades();

    // 2. Auto-detect active section if needed
    const detectedSec = detectCurrentSection();
    if (detectedSec && STATE.currentSection === 'voti' && !STATE.isTableFound && detectedSec !== 'voti') {
      STATE.currentSection = detectedSec;
    }

    const student = getStudentMetadata();
    const stats = calculateStats(STATE.scrapedSubjects, STATE.simulations);

    let viewHtml = '';
    if (STATE.currentSection === 'voti') {
      viewHtml = renderVotiView(stats);
    } else if (STATE.currentSection === 'registro') {
      viewHtml = renderRegistroClasseView();
    } else if (STATE.currentSection === 'dashboard') {
      viewHtml = renderDashboardView();
    } else {
      viewHtml = renderModernGenericSection(STATE.currentSection);
    }

    let root = document.getElementById('modern-axios-app');
    if (!root) {
      root = document.createElement('div');
      root.id = 'modern-axios-app';
      document.body.prepend(root);
    }

    root.innerHTML = `
      <div id="ax-progress-bar"></div>
      ${renderSidebar(student)}
      <div class="ax-main">
        ${renderTopbar()}
        <main class="ax-content">
          ${viewHtml}
        </main>
      </div>
      ${renderWhatIfDrawer(stats)}
      ${renderPopover()}
    `;

    let pill = document.getElementById('ax-classic-restore-pill');
    if (!pill) {
      const div = document.createElement('div');
      div.innerHTML = renderClassicRestorePill();
      document.body.appendChild(div.firstElementChild);
    }

    bindEvents(stats);
  }

  // =========================================================================
  // 11. EVENT BINDINGS
  // =========================================================================

  function bindEvents(stats) {
    // Navigation
    document.querySelectorAll('.ax-nav-item[data-nav]').forEach((el) => {
      el.addEventListener('click', () => {
        const navId = el.getAttribute('data-nav');
        const action = el.getAttribute('data-action');
        STATE.currentSection = navId;
        renderFullApp();

        if (action) {
          triggerAxiosAction(action);
        }
      });
    });

    // "Carica Voti da Axios" button
    const loadVotiBtn = document.getElementById('ax-load-voti-btn');
    if (loadVotiBtn) {
      loadVotiBtn.addEventListener('click', () => {
        triggerAxiosAction('FAMILY_VOTI');
      });
    }

    // "Carica Registro di Classe" button
    const rclaLoadBtn = document.getElementById('ax-rcla-load-btn');
    if (rclaLoadBtn) {
      rclaLoadBtn.addEventListener('click', () => {
        triggerAxiosAction('FAMILY_REGISTRO_CLASSE');
      });
    }

    // Week navigation in Registro di Classe
    const rclaPrev = document.getElementById('ax-rcla-prev');
    const rclaNext = document.getElementById('ax-rcla-next');
    if (rclaPrev) {
      rclaPrev.addEventListener('click', () => {
        triggerAxiosAction('', 'button.settimana-naviga[data-others="-7"]');
      });
    }
    if (rclaNext) {
      rclaNext.addEventListener('click', () => {
        triggerAxiosAction('', 'button.settimana-naviga[data-others="+7"]');
      });
    }

    // Registro di Classe filter pills
    document.querySelectorAll('.ax-filter-pill[data-rcla-filter]').forEach((pill) => {
      pill.addEventListener('click', () => {
        STATE.rclaFilter = pill.getAttribute('data-rcla-filter');
        renderFullApp();
      });
    });

    // Logout
    const logoutBtn = document.getElementById('ax-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        const origLogout = document.querySelector('a[href*="Logout"]');
        if (origLogout) origLogout.click();
        else window.location.href = 'SD_Logout.aspx';
      });
    }

    // Classic toggle
    const classicToggle = document.getElementById('ax-classic-toggle');
    if (classicToggle) {
      classicToggle.addEventListener('click', () => {
        STATE.isActive = false;
        localStorage.setItem('axios_modern_active', 'false');
        document.body.classList.remove('modern-axios-active');
        const pill = document.getElementById('ax-classic-restore-pill');
        if (pill) pill.style.display = 'flex';
      });
    }

    // Floating restore pill
    const restorePill = document.getElementById('ax-classic-restore-pill');
    if (restorePill) {
      restorePill.addEventListener('click', () => {
        STATE.isActive = true;
        localStorage.setItem('axios_modern_active', 'true');
        document.body.classList.add('modern-axios-active');
        restorePill.style.display = 'none';
        renderFullApp();
      });
    }

    // Simulator drawer
    const openSimBtn = document.getElementById('ax-open-sim-btn');
    const simCardTrigger = document.getElementById('ax-sim-card-trigger');
    const closeDrawerBtn = document.getElementById('ax-drawer-close');
    const drawerOverlay = document.getElementById('ax-drawer-overlay');

    const openDrawer = (subjName = null) => {
      STATE.isDrawerOpen = true;
      if (subjName) STATE.selectedSimSubject = subjName;
      if (drawerOverlay) drawerOverlay.classList.add('open');
      if (subjName) {
        const select = document.getElementById('ax-sim-subject');
        if (select) select.value = subjName;
      }
    };

    const closeDrawer = () => {
      STATE.isDrawerOpen = false;
      if (drawerOverlay) drawerOverlay.classList.remove('open');
    };

    if (openSimBtn) openSimBtn.addEventListener('click', () => openDrawer());
    if (simCardTrigger) simCardTrigger.addEventListener('click', () => openDrawer());
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
    if (drawerOverlay) {
      drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) closeDrawer();
      });
    }

    document.querySelectorAll('.ax-quick-sim-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDrawer(btn.getAttribute('data-subject'));
      });
    });

    document.querySelectorAll('.ax-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ax-preset-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.getAttribute('data-val');
        const inp = document.getElementById('ax-sim-grade-input');
        if (inp) inp.value = val;
      });
    });

    const addSimBtn = document.getElementById('ax-add-sim-btn');
    if (addSimBtn) {
      addSimBtn.addEventListener('click', () => {
        const subjSelect = document.getElementById('ax-sim-subject');
        const gradeInput = document.getElementById('ax-sim-grade-input');
        const typeSelect = document.getElementById('ax-sim-type');
        if (!subjSelect || !gradeInput) return;

        const materia = subjSelect.value;
        const voto = parseFloat(gradeInput.value);
        const tipo = typeSelect ? typeSelect.value : 'S';
        if (isNaN(voto) || voto < 2 || voto > 10) return;

        STATE.simulations.push({
          id: `sim-${Date.now()}`,
          materia,
          voto,
          tipo,
        });

        localStorage.setItem('axios_simulations', JSON.stringify(STATE.simulations));
        renderFullApp();
      });
    }

    document.querySelectorAll('.ax-sim-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-sim-index'), 10);
        if (!isNaN(idx)) {
          STATE.simulations.splice(idx, 1);
          localStorage.setItem('axios_simulations', JSON.stringify(STATE.simulations));
          renderFullApp();
        }
      });
    });

    const clearSimsBtn = document.getElementById('ax-clear-sims-btn');
    if (clearSimsBtn) {
      clearSimsBtn.addEventListener('click', () => {
        STATE.simulations = [];
        localStorage.setItem('axios_simulations', '[]');
        renderFullApp();
      });
    }

    const calcTargetBtn = document.getElementById('ax-calc-target-btn');
    if (calcTargetBtn) {
      calcTargetBtn.addEventListener('click', () => {
        const subjSelect = document.getElementById('ax-sim-subject');
        const goalInput = document.getElementById('ax-target-goal-input');
        const resultEl = document.getElementById('ax-target-result-text');
        if (!subjSelect || !goalInput || !resultEl) return;

        const targetAvg = parseFloat(goalInput.value);
        const subjName = subjSelect.value;
        const subj = stats.subjects.find((s) => s.materia === subjName);
        if (!subj) return;

        const needed = calculateTargetGrade(subj, targetAvg);
        if (needed <= 10 && needed >= 2) {
          resultEl.innerHTML = `Per portare la media di <b>${subjName}</b> a <b>${targetAvg.toFixed(2)}</b>, al prossimo voto ti serve: <span class="ax-target-highlight" style="color:var(--ax-success);font-size:15px;">${needed.toFixed(2)}</span>!`;
        } else if (needed > 10) {
          resultEl.innerHTML = `Con un solo voto non è possibile raggiungere <b>${targetAvg.toFixed(2)}</b> (servirebbe un <b>${needed.toFixed(1)}</b>). Ti serviranno almeno 2 voti alti consecutivi.`;
        } else {
          resultEl.innerHTML = `La tua media attuale è già superiore a <b>${targetAvg.toFixed(2)}</b>! Anche con un voto sufficiente rimarrai sopra.`;
        }
      });
    }

    // Search and filter in Voti
    const searchInput = document.getElementById('ax-voti-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        STATE.searchQuery = e.target.value;
        renderFullApp();
      });
    }

    document.querySelectorAll('.ax-filter-pill[data-filter]').forEach((pill) => {
      pill.addEventListener('click', () => {
        STATE.filterStatus = pill.getAttribute('data-filter');
        renderFullApp();
      });
    });

    const sortSelect = document.getElementById('ax-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        STATE.sortOrder = e.target.value;
        renderFullApp();
      });
    }

    // Checkbox compiti
    document.querySelectorAll('.ax-task-checkbox').forEach((box) => {
      box.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = box.getAttribute('data-task-id');
        STATE.completedTasks[taskId] = !STATE.completedTasks[taskId];
        localStorage.setItem('axios_completed_tasks', JSON.stringify(STATE.completedTasks));
        renderFullApp();
      });
    });

    // Popovers on grades
    const popover = document.getElementById('ax-grade-popover');
    if (popover) {
      const showPopover = (target) => {
        const grade = target.getAttribute('data-grade');
        const date = target.getAttribute('data-date');
        const comment = target.getAttribute('data-comment');
        const teacher = target.getAttribute('data-teacher');
        const type = target.getAttribute('data-type');
        const isSim = target.getAttribute('data-sim') === '1';

        popover.innerHTML = `
          <div class="ax-popover-header">
            <span class="ax-popover-grade">Voto: ${grade} ${isSim ? '(Simulato)' : ''}</span>
            <span class="ax-popover-date">${date || ''}</span>
          </div>
          <div style="font-size:11.5px;color:var(--ax-text-secondary);">
            <b>Tipologia:</b> ${type === 'S' ? 'Scritto' : type === 'O' ? 'Orale' : 'Pratico'}<br/>
            ${teacher ? `<b>Docente:</b> ${teacher}<br/>` : ''}
          </div>
          ${comment ? `<div class="ax-popover-comment">"${comment}"</div>` : ''}
        `;

        const rect = target.getBoundingClientRect();
        popover.style.display = 'flex';
        popover.style.top = `${rect.bottom + window.scrollY + 8}px`;
        popover.style.left = `${Math.max(10, rect.left + window.scrollX - 40)}px`;
      };

      const hidePopover = () => {
        popover.style.display = 'none';
      };

      document.querySelectorAll('.ax-grade-pill, .ax-sparkline-point').forEach((el) => {
        el.addEventListener('mouseenter', () => showPopover(el));
        el.addEventListener('mouseleave', hidePopover);
      });
    }
  }

  // =========================================================================
  // 12. MUTATION OBSERVER (ACTIVE REAL-TIME DOM LISTENER)
  // =========================================================================

  function initMutationObserver() {
    let debounceTimer = null;

    const observer = new MutationObserver((mutations) => {
      let isRelevant = false;

      for (const m of mutations) {
        if (m.target && (m.target.closest?.('#modern-axios-app') || m.target.id === 'modern-axios-app')) {
          continue;
        }

        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (
              node.tagName === 'TABLE' ||
              node.querySelector?.('table') ||
              node.id === 'content-alunno' ||
              node.id === 'page-content' ||
              node.classList?.contains('voto') ||
              node.querySelector?.('.voto') ||
              node.id === 'table-rcla' ||
              node.id === 'table-voti'
            ) {
              isRelevant = true;
              break;
            }
          }
        }
        if (isRelevant) break;
      }

      if (isRelevant) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (STATE.isActive) {
            renderFullApp();
          }
        }, 120);
      }
    });

    const targetNode = document.getElementById('page-content') || document.body;
    observer.observe(targetNode, { childList: true, subtree: true });
  }

  // =========================================================================
  // 13. INITIALIZATION
  // =========================================================================

  function init() {
    if (STATE.isActive) {
      document.body.classList.add('modern-axios-active');
    }
    renderFullApp();
    initMutationObserver();
    console.log('[Modern Axios] Real-Time Extension v1.2 Active.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
