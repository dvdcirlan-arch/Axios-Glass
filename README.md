# Axios Glass v2 — Registro Elettronico, riprogettato da zero

[![GitHub](https://img.shields.io/badge/GitHub-dvdcirlan--arch%2FAxios--Glass-006667?style=flat-square&logo=github)](https://github.com/dvdcirlan-arch/Axios-Glass)
[![GitHub Pages](https://img.shields.io/badge/demo-live-48BCBD?style=flat-square&logo=githubpages)](https://dvdcirlan-arch.github.io/Axios-Glass/)
[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-006667?style=flat-square&logo=googlechrome&logoColor=white)](https://github.com/dvdcirlan-arch/Axios-Glass)

Nuova interfaccia **soft pastel glass** per `https://registrofamiglie.axioscloud.it/`,
con palette ricavata dal logo dell'istituto (verde teal `#006667` + aqua `#48BCBD`)
e logo mostrato nella sidebar e nella dashboard.
Questa cartella è un'estensione Chrome Manifest V3 autonoma: non dipende dal vecchio
`content.js` / `styles.css` nella cartella padre.

- **Dati reali**: legge solo il DOM già presente nel registro (nessun dato inventato, nessuna API esterna).
- **Non distruttiva**: il markup ASP.NET originale non viene mai cancellato; viene solo nascosto con CSS.
  `__VIEWSTATE`, form e postback restano funzionanti.
- **Demo inclusa**: `demo.html` mostra la stessa UI con dati di esempio, senza login né estensione.

---

## Installazione

```powershell
git clone https://github.com/dvdcirlan-arch/Axios-Glass.git
cd Axios-Glass/v2
```

1. Apri `chrome://extensions/` e attiva **Modalità sviluppatore**.
2. **Disabilita/rimuovi la vecchia estensione** (`axios-redesign`) per evitare che due content script
   iniettino due interfacce diverse sulla stessa pagina.
3. Clicca **Carica estensione non pacchettizzata** e seleziona la cartella `v2`.
4. Apri il registro Axios ed effettua il login: l'interfaccia si attiva automaticamente.
5. In alto a destra c'è **Modalità classica** per tornare all'HTML originale; da lì il pulsante
   flottante **Mostra Axios Glass** ripristina la nuova UI.

> Scorciatoia: `Ctrl/Cmd + K` mette il focus nella ricerca.

### Anteprima senza estensione

Apri `demo.html` direttamente nel browser, oppure servilo con:

```powershell
cd v2
python -m http.server 8766
```

e visita `http://127.0.0.2:8766/demo.html`.

### GitHub Pages

La landing page bilingue (IT/EN) è in `v2/docs/` ed è pubblicata su:

**https://dvdcirlan-arch.github.io/Axios-Glass/**

Per pubblicarla:

1. Fai il push del repository su `https://github.com/dvdcirlan-arch/Axios-Glass`.
2. Vai su **Settings → Pages**.
3. Imposta **Source: Deploy from a branch**, branch `main`, cartella **`/docs`**.
4. Salva: la demo live sarà disponibile su `https://dvdcirlan-arch.github.io/Axios-Glass/demo.html`.

> `docs/demo.html`, `docs/core.js`, `docs/ui.js`, `docs/demo.js`, `docs/styles.css` e `docs/assets/`
> sono copie dei file della demo standalone. Se modifichi la demo, aggiorna anche queste copie.

---

## Cosa c'è dentro

| File | Ruolo |
|---|---|
| `manifest.json` | Manifest V3, content script solo sui domini Axios |
| `styles.css` | Design system pastel glass: token, shell, card, grafici, responsive |
| `core.js` | Parsing voti, normalizzazione dati, statistiche, storage, simulazioni |
| `scraper.js` | Lettura del DOM Axios (voti, registro, timeline, sezioni generiche) |
| `ui.js` | Rendering di tutte le viste + binding eventi delegati |
| `content.js` | Boot, mount non distruttivo, navigazione Axios, MutationObserver, modalità classica |
| `demo.js` / `demo.html` | Dati di esempio e controller standalone |
| `docs/` | Landing page GitHub Pages bilingue + copia della demo live |
| `assets/logo1.png`, `assets/logo2.png` | Logo dell'istituto (wide per la hero, quadrato per la sidebar) |
| `test-fixture.html`, `test-dashboard.html` | DOM Axios minimale e sanificato usati per verificare scraper e cache tra sezioni |

### Sezioni

Dashboard, Voti, Registro di classe, Presenze, Comunicazioni, Orario, Pagella, Impostazioni.

### Funzionalità

- Media generale, trend, distribuzione dei voti, grafico sparkline SVG (senza librerie).
- Voti: ricerca, filtri (tutti / ≥6 / <6 / simulati), ordinamento, dettaglio per materia.
- Registro: filtri per verifiche/compiti/argomenti, navigazione settimana, attività completate salvate.
- Comunicazioni: clicchi un messaggio e si apre una finestra con testo completo, mittente e data;
  **Precedente / Successiva** navigano tutta la posta, `Esc` o il backdrop chiudono. Quando il
  registro espone un link riga, **Apri nel registro** richiama l'azione originale dell'ASP.NET.
- Pagella: mostra solo le righe realmente lette dalla pagella; se il registro non l'ha pubblicata
  resta vuota e **non** riutilizza le materie/medie della sezione Voti.
- Simulatore what-if: modifichi la media ipotetica di una materia e vedi la nuova media complessiva.
- Calcolatore del voto necessario per raggiungere una media obiettivo.
- Modalità classica con ripristino, observer reattivo ai cambiamenti del DOM, scorciatoia `Ctrl+K`.

---

## Dati e selettori

| Dato | Sorgente |
|---|---|
| Nome studente | `.username` (testo pulito, senza rimuovere la prima lettera) |
| Istituto | `.desc-as-header .pull-left` (`title` preferito, prefisso numerico rimosso) |
| Anno | `.anno-footer` |
| Avatar | `#imgAvatarHeader` |
| Voti tabella | `#table-voti`, `.table-voti`, `#content-alunno table`, `#page-content table` |
| Voti griglia | `.rdoc_full_valutazioni .voto`, `.table .voto` + tooltip `data-original-title` |
| Registro | `#table-rcla` (colonne: data / argomenti / compiti / verifiche), settimana da `#fdData` |
| Timeline | `.mt-actions .mt-action`, `.mt-action-author`, `.mt-action-desc` |
| Altre sezioni | tabelle e paragrafi dentro `#content-alunno` / `#page-content` |
| Comunicazioni | righe di tabella; il link/bottone cliccabile della riga viene memorizzato per "Apri nel registro" |

Il parser gestisce virgole decimali, suffissi `+ ++ - --`, frazioni `½` e `7/8`, e giudizi
(da *insufficiente* a *eccellente*). I voti con `non fa media` restano visibili ma non
entrano nelle medie.

### localStorage

Tutte le chiavi usano il prefisso `axiosglass:`:

`active`, `section`, `simulations`, `completed`, `read`, `gradeFilter`, `registerFilter`,
`sort`, `target` (JSON dove opportuno).

---

## Rispetto alla versione 1

- UI completamente riscritta in stile pastel glass, non più dark Linear/Raycast.
- Cache di sessione: i dati letti in una sezione restano disponibili in dashboard (che non contiene la tabella voti). Quando un dato non è mai stato letto mostra `—` invece di `0`.
- Niente perdita di focus nei campi di ricerca (render con ripristino del caret).
- Parser dei tooltip corretto (il vecchio regex `note|commento` poteva lanciare un'eccezione).
- Nome studente non più troncato (vecchio `replace(/^b/i,'')` su "Bianca" → "ianca").
- Guard sulla pagina di login e observer agganciato anche a `body`, con riaggancio se `#page-content` viene sostituito.
- Tutto il testo interpolato viene escapato prima di finire in `innerHTML`.
- Logica di scraping separata dalla UI: la grafica si può cambiare senza toccare i selettori.

---

## Privacy

Nessun dato viene inviato a server esterni. Le simulazioni e le preferenze rimangono
nel `localStorage` del browser. I file `homepage.html`, `preview.html` e `Login.html`
nella cartella padre sono salvataggi di pagine reali e contengono token di sessione e
dati personali: **non distribuirli** e usali solo come riferimento locale.
