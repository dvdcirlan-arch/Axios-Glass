# Axios Glass per Android

Applicazione Android basata su **WebView** che apre il registro Axios e applica la stessa interfaccia pastel-glass dell'estensione Chrome.

## Come funziona

1. L'app apre `https://registrofamiglie.axioscloud.it/` in una WebView con user agent desktop.
2. Dopo il caricamento, inietta nell'ordine:
   - `styles.css`
   - `core.js`
   - `ui.js`
   - `scraper.js`
   - `content.js`
3. `content.js` legge il DOM già renderizzato da Axios e monta l'interfaccia Axios Glass sopra la pagina originale, senza cancellare i nodi ASP.NET (`__VIEWSTATE`, form, postback).
4. La modalità classica resta disponibile dal pulsantenell'app e dal pulsante “Mostra Axios Glass” dentro la pagina.

I file JS/CSS iniettati sono copie di quelli usati dall'estensione in `v2/`. Aggiornandoli, aggiorna anche `app/src/main/assets/axiosglass/`.

## Privacy

- Nessun server esterno, nessun tracciamento, nessun dato inventato.
- Vengono letti solo i dati già presenti nella pagina Axios.
- Cookie e sessione restano nel profilo WebView dell'app, sul dispositivo.
- Nessuna credenziale viene inviata a questo progetto.

## Limitazioni

- Non è un PWA puro: Android non permette a una PWA di leggere il DOM di un altro sito come fa un content script.
- Chrome Android non supporta le estensioni MV3, quindi serve questa WebView nativa.
- Il layout dipende dal DOM Axios: se cambiano i selettori, va aggiornato `scraper.js`.
- L'APK generato dal workflow è **debug**, firmato con la chiave di default di Android. Va bene per installarlo, non per il Play Store.

## Build

### Opzione A — GitHub Actions (consigliata)

Il workflow `.github/workflows/build-apk.yml` costruisce l'APK su Ubuntu con JDK 17 e Gradle 8.7.

1. Fai commit/push della cartella `android/` e del workflow.
2. Vai su **Actions → Build Android APK → Run workflow**.
3. Scarica l'artifact `ax glass-debug-apk`.
4. Installa `app-debug.apk` sul telefono.

### Opzione B — locale

Serve JDK 17 + Gradle 8.7 + Android SDK Platform 34.

```powershell
cd android
gradle assembleDebug --no-daemon
```

L'APK sarà in `app/build/outputs/apk/debug/app-debug.apk`.

## Segnalazioni

Commenta sul repository o apri una issue: https://github.com/dvdcirlan-arch/Axios-Glass/issues
