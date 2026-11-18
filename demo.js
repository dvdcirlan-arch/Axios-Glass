/* =========================================================================
   AXIOS GLASS — standalone demo data + controller
   Open demo.html directly in a browser. No extension, no login, no network.
   ========================================================================= */

(function (global) {
  'use strict';

  const Core = global.AxiosGlassCore;
  const UI = global.AxiosGlassUI;
  const ROOT = document.getElementById('axglass-app');

  function g(subject, display, date, type, teacher, comment) {
    return { subject: subject, display: display, date: date, type: type, teacher: teacher, comment: comment };
  }

  const RAW = {
    meta: {
      student: 'Giulia Rossi',
      institute: 'Istituto di esempio',
      year: 'Anno scolastico 2026/27',
      className: '4ª B',
      avatar: ''
    },
    grades: [
      g('Matematica', '8', '12/10/2026', 'Scritto', 'Prof.ssa Bianchi', 'Funzioni esponenziali'),
      g('Italiano', '7+', '14/10/2026', 'Orale', 'Prof. Ricci', 'Analisi del testo'),
      g('Fisica', '6', '16/10/2026', 'Scritto', 'Prof. Verdi', 'Leggi di Newton'),
      g('Storia', '8½', '20/10/2026', 'Orale', 'Prof.ssa Conti', 'La Guerra Fredda'),
      g('Inglese', '9', '22/10/2026', 'Scritto', 'Prof.ssa Moretti', 'Essay: climate change'),
      g('Latino', '6-', '23/10/2026', 'Scritto', 'Prof. Rinaldi', 'Versione da Cesare'),
      g('Filosofia', '7,5', '27/10/2026', 'Orale', 'Prof.ssa Galli', 'Cartesio e il dubbio'),
      g('Scienze', '8', '29/10/2026', 'Pratico', 'Prof.ssa Ferri', 'Laboratorio: ossidazione'),
      g('Matematica', '7,5', '03/11/2026', 'Orale', 'Prof.ssa Bianchi', 'Derivate'),
      g('Italiano', '8', '05/11/2026', 'Scritto', 'Prof. Ricci', 'Tema argomentativo'),
      g('Fisica', '7', '07/11/2026', 'Orale', 'Prof. Verdi', 'Energia e lavoro'),
      g('Inglese', '8+', '10/11/2026', 'Orale', 'Prof.ssa Moretti', 'Speaking test'),
      g('Latino', '6½', '12/11/2026', 'Scritto', 'Prof. Rinaldi', 'Sintassi dei casi'),
      g('Storia', '8', '13/11/2026', 'Scritto', 'Prof.ssa Conti', 'Verifica sulla Rivoluzione francese'),
      g('Matematica', '8+', '14/11/2026', 'Scritto', 'Prof.ssa Bianchi', 'Integrali indefinite'),
      g('Filosofia', '8', '16/11/2026', 'Scritto', 'Prof.ssa Galli', 'Kant e la critica'),
      g('Scienze', '7,5', '17/11/2026', 'Orale', 'Prof.ssa Ferri', 'Genetica mendeliana')
    ],
    register: [
      { id: 'r1', type: 'verifica', title: 'Verifica di matematica — Integrali', subject: 'Matematica', date: '24/11/2026', teacher: 'Prof.ssa Bianchi', description: 'Argomenti: integrali indefinite e definiti, metodo di sostituzione.' },
      { id: 'r2', type: 'compito', title: 'Esercizi su derivate e monotonia', subject: 'Matematica', date: '25/11/2026', teacher: 'Prof.ssa Bianchi', description: 'Esercizi 12–18 a pagina 214.' },
      { id: 'r3', type: 'argomento', title: 'Il romanticismo europeo', subject: 'Italiano', date: '18/11/2026', teacher: 'Prof. Ricci', description: 'Leopardi, Manzoni e il romanticismo europeo.' },
      { id: 'r4', type: 'verifica', title: 'Test di inglese — Unit 5', subject: 'Inglese', date: '27/11/2026', teacher: 'Prof.ssa Moretti', description: 'Vocabolario e grammar: present perfect vs past simple.' },
      { id: 'r5', type: 'compito', title: 'Versione da Tacito', subject: 'Latino', date: '26/11/2026', teacher: 'Prof. Rinaldi', description: 'Annali, libro I, capitoli 1–3.' },
      { id: 'r6', type: 'argomento', title: 'Termodinamica: primo e secondo principio', subject: 'Fisica', date: '19/11/2026', teacher: 'Prof. Verdi', description: 'Calore, lavoro ed entropia.' }
    ],
    attendance: [
      { date: '06/10/2026', kind: 'assenza', subject: 'Matematica', hours: '2', justified: 'Sì' },
      { date: '21/10/2026', kind: 'ritardo', subject: 'Italiano', hours: '0,25', justified: 'Sì' },
      { date: '04/11/2026', kind: 'assenza', subject: 'Fisica', hours: '1', justified: 'No' },
      { date: '11/11/2026', kind: 'ritardo', subject: 'Inglese', hours: '0,25', justified: 'Sì' },
      { date: '15/11/2026', kind: 'assenza', subject: '', hours: '5', justified: 'Sì' }
    ],
    communications: [
      { id: 'c1', title: 'Colloqui generali — prenotazioni', from: 'Segreteria didattica', date: '17/11/2026', body: 'Sono aperte le prenotazioni per i colloqui generali di dicembre. Potete prenotarvi entro il 30 novembre.' },
      { id: 'c2', title: 'Uscita didattica al Museo della Scienza', from: 'Prof.ssa Ferri', date: '12/11/2026', body: 'Martedì 1 dicembre la classe 4ªB visiterà il Museo della Scienza. Ritrovo alle ore 8:45 davanti all’ingresso principale.' },
      { id: 'c3', title: 'Avviso: sospensione lezioni pomeridiane', from: 'Dirigente scolastico', date: '05/11/2026', body: 'Si informa che giovedì 19 novembre le lezioni pomeridiane sono sospese per un evento istituzionale.' },
      { id: 'c4', title: 'Esito verifica di storia', from: 'Prof.ssa Conti', date: '28/10/2026', body: 'Le valutazioni della verifica sulla Rivoluzione francese sono state pubblicate nel registro.' }
    ],
    events: [
      { date: '24/11/2026', title: 'Verifica di matematica', subject: 'Matematica' },
      { date: '27/11/2026', title: 'Test di inglese', subject: 'Inglese' },
      { date: '01/12/2026', title: 'Uscita didattica', subject: 'Scienze' },
      { date: '05/12/2026', title: 'Consiglio di classe', subject: '' }
    ],
    timetable: [
      { day: 'Lunedì', lessons: [{ subject: 'Matematica', time: '08:00 – 09:00', teacher: 'Bianchi' }, { subject: 'Italiano', time: '09:00 – 10:00', teacher: 'Ricci' }, { subject: 'Fisica', time: '10:00 – 11:00', teacher: 'Verdi' }, { subject: 'Storia', time: '11:00 – 12:00', teacher: 'Conti' }] },
      { day: 'Martedì', lessons: [{ subject: 'Latino', time: '08:00 – 09:00', teacher: 'Rinaldi' }, { subject: 'Inglese', time: '09:00 – 10:00', teacher: 'Moretti' }, { subject: 'Filosofia', time: '10:00 – 11:00', teacher: 'Galli' }, { subject: 'Scienze', time: '11:00 – 12:00', teacher: 'Ferri' }] },
      { day: 'Mercoledì', lessons: [{ subject: 'Matematica', time: '08:00 – 09:00', teacher: 'Bianchi' }, { subject: 'Italiano', time: '09:00 – 10:00', teacher: 'Ricci' }, { subject: 'Inglese', time: '10:00 – 11:00', teacher: 'Moretti' }] },
      { day: 'Giovedì', lessons: [{ subject: 'Fisica', time: '08:00 – 09:00', teacher: 'Verdi' }, { subject: 'Latino', time: '09:00 – 10:00', teacher: 'Rinaldi' }, { subject: 'Storia', time: '10:00 – 11:00', teacher: 'Conti' }, { subject: 'Filosofia', time: '11:00 – 12:00', teacher: 'Galli' }] },
      { day: 'Venerdì', lessons: [{ subject: 'Scienze', time: '08:00 – 09:00', teacher: 'Ferri' }, { subject: 'Matematica', time: '09:00 – 10:00', teacher: 'Bianchi' }, { subject: 'Italiano', time: '10:00 – 11:00', teacher: 'Ricci' }, { subject: 'Inglese', time: '11:00 – 12:00', teacher: 'Moretti' }] }
    ],
    summary: { presenceRate: '96%', absenceCount: 3, lateCount: 2, justifiedCount: 2 }
  };

  const state = {
    section: 'dashboard',
    search: '',
    gradeQuery: '',
    gradeFilter: 'all',
    registerFilter: 'all',
    sort: 'date-desc',
    subjectFilter: '',
    target: 8,
    simulations: {},
    completed: {},
    read: {},
    openMessageId: null
  };

  let data;

  function refresh() {
    data = Core.normalize(Object.assign({}, RAW, state));
    Core.rerender(ROOT, data, handlers);
  }

  function toast(message) {
    const old = document.querySelector('.ag-toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'ag-toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  function moveMessage(step) {
    const list = (data && data.communications) || [];
    let index = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === state.openMessageId) { index = i; break; }
    }
    const next = index + step;
    if (next < 0 || next >= list.length) return;
    state.openMessageId = list[next].id;
    state.read[state.openMessageId] = true;
    refresh();
  }

  const handlers = {
    nav: function (p) {
      state.section = p.section;
      state.subjectFilter = '';
      state.openMessageId = null;
      if (p.section === 'compiti') state.registerFilter = 'compito';
      refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    search: function (p) { state.search = p.value; state.gradeQuery = p.value; refresh(); },
    'grade-search': function (p) { state.gradeQuery = p.value; refresh(); },
    'grade-filter': function (p) { state.gradeFilter = p.filter; refresh(); },
    'register-filter': function (p) { state.registerFilter = p.filter; refresh(); },
    sort: function (p) { state.sort = p.sort; refresh(); },
    subject: function (p) { state.subjectFilter = p.subject; state.section = 'voti'; refresh(); },
    'toggle-task': function (p) {
      state.completed[p.id] = !state.completed[p.id];
      refresh();
      toast(state.completed[p.id] ? 'Attività segnata come completata' : 'Attività ripristinata');
    },
    'open-message': function (p) {
      state.openMessageId = p.id;
      state.read[p.id] = true;
      refresh();
    },
    'message-prev': function () { moveMessage(-1); },
    'message-next': function () { moveMessage(1); },
    'close-modal': function () { state.openMessageId = null; refresh(); },
    'open-original': function () { toast('Nel demo non è presente il registro originale.'); },
    'sim-input': function (p) {
      state.simulations[p.subject] = Number(p.value);
      refresh();
    },
    'sim-reset': function (p) { delete state.simulations[p.subject]; refresh(); },
    'sim-clear': function () { state.simulations = {}; refresh(); toast('Simulazioni azzerate'); },
    'target-input': function (p) { state.target = Number(p.value); refresh(); },
    notifications: function () { state.section = 'comunicazioni'; refresh(); },
    classic: function () { toast('La modalità classica è disponibile con l’estensione installata.'); },
    'reload-data': function () { refresh(); toast('Dati ricaricati'); }
  };

  document.body.classList.add('ag-demo');
  refresh();
})(window);
