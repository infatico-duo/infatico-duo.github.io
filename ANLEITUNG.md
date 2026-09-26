# ANLEITUNG — Website „Duo Infatico"

Stand: aktuelle Version mit drei Sprachen (DE / EN / RU).
Diese Anleitung beschreibt, **wo** Inhalte stehen und **wie** sie ersetzt werden.

> **Hinweis zu Zeilennummern:** Die Nummern gelten für die aktuelle Fassung von
> `index.html`. Nach Änderungen verschieben sie sich — dann einfach nach dem
> angegebenen **Suchbegriff** suchen (Strg+F).

---

## 0. Dateien im Überblick

```
Duo-Website/
├── index.html        ← alle Inhalte (Texte, Bilder, Audio, Video, Kontakt)
├── style.css         ← Design (Farben, Typografie, Layout)
├── script.js         ← Sprachumschaltung DE/EN/RU, Menü, Formularprüfung
├── images/           ← hero.svg, duo.svg, portrait-1.svg, portrait-2.svg
├── audio/            ← hier später die MP3-Dateien (README.txt liegt bereit)
└── ANLEITUNG.md      ← diese Datei
```

Alles ist statisch: kein Server, kein Build, keine Datenbank nötig.

---

## 1. Übersicht: Was wird wo ersetzt?

| Was | Datei + Zeile | Suchbegriff | Wie ersetzen |
|---|---|---|---|
| Hero-Foto (großes Hintergrundbild) | `index.html` Zeile **62** | `images/hero.svg` | Datei in `images/` legen, `src` ändern |
| Foto des Duos | `index.html` Zeile **106** | `images/duo.svg` | dito |
| Porträt Nataliya Salavei | `index.html` Zeile **114** | `images/portrait-1.svg` | dito |
| Porträt Vadim Bektemirov | `index.html` Zeile **125** | `images/portrait-2.svg` | dito |
| Einleitung „Über uns" (2 Absätze) | `index.html` Zeilen **97**, **100** | `about-intro` | Text in allen drei Sprachen (`data-de`/`data-en`/`data-ru`) |
| Funktionsbezeichnung unter dem Namen | `index.html` Zeilen **116**, **127** | `bio-role` | z. B. „Violine · Bielefelder Philharmoniker" — DE/EN/RU |
| Biografien (je 3 Absätze) | `index.html` Zeilen **118–120**, **129–131** | `class="bio-text"` | Absätze einzeln, jeder mit `data-de`/`data-en`/`data-ru` |
| Konzerttermine | `index.html` Zeilen **254**, **260**, **266** | `TT.MM.JJJJ` | Datum/Ort/Stadt in allen drei Sprachen |
| Audio 1–3 | `index.html` Zeilen **160**, **172**, **184** | `AUDIO-PLATZHALTER` | `<source>` einfügen (Abschnitt 3) |
| Titelnamen der Tracks | `index.html` Zeilen **156**, **168**, **180** | `Titel 1 – Platzhalter` | in DE/EN/RU |
| YouTube-Video 1 | `index.html` Zeile **207** | `video-frame` (1. Treffer) | `<iframe>` einsetzen (Abschnitt 4) |
| YouTube-Video 2 | `index.html` Zeile **220** | `video-frame` (2. Treffer) | dito |
| E-Mail-Adresse | `index.html` Zeile **293** | `infatico.duo@gmail.com` | `mailto:`-Link + Text |
| Telefonnummer | `index.html` Zeile **297** | `tel:` (Booking-Nummer) | `tel:`-Link + Text; die Nummer steht zentral in `tools/config.js` (`BOOKING_PHONE`) und im öffentlichen vCard |
| Kontaktformular | `index.html` Zeile **306** | `<form class="contact-form"` | Ziel steht im `action`-Attribut (Cloudflare Worker, Abschnitt 6) |
| Impressum-Link im Footer | `index.html` Zeile **352** | `footer-links` | Link auf `impressum.html` setzen (Abschnitt 7) |

**Grundregel für alle Texte:** Jedes Element hat drei Attribute —
`data-de` (Deutsch), `data-en` (Englisch), `data-ru` (Russisch).
Der sichtbare Text im HTML ist nur der Startwert (Deutsch).
Wird ein Attribut geändert, ändert sich die Anzeige nach dem Sprachwechsel automatisch.

---

## 2. Fotos einsetzen

1. Bilddateien nach `images/` kopieren, z. B. `hero.jpg`, `duo.jpg`, `nataliya.jpg`, `vadim.jpg`.
2. Empfohlene Größen:
   - `hero.jpg` — 1920 × 1080 px (oder größer, querformat)
   - `duo.jpg` — 1200 × 800 px
   - Porträts — 600 × 600 px (quadratisch)
3. Jeweilige Zeile in `index.html` ersetzen:

```html
<!-- Hero (Zeile 60). alt="" ist richtig, weil das Bild rein dekorativ ist. -->
<img src="images/hero.jpg" alt="" width="1920" height="1080">

<!-- Foto des Duos (Zeile 104) -->
<img src="images/duo.jpg" alt="Duo Infatico – Nataliya Salavei und Vadim Bektemirov"
     width="1200" height="800" loading="lazy">

<!-- Porträt 1 (Zeile 112) -->
<img class="bio-photo" src="images/nataliya.jpg"
     alt="Nataliya Salavei, Violine" width="600" height="600" loading="lazy">

<!-- Porträt 2 (Zeile 123) -->
<img class="bio-photo" src="images/vadim.jpg"
     alt="Vadim Bektemirov, Gitarre" width="600" height="600" loading="lazy">
```

Tipp: `width`/`height` immer mit angeben — der Browser reserviert dann schon
Platz und die Seite „springt" beim Laden nicht. Die Werte dürfen von der
echten Pixelgröße abweichen, solange das Seitenverhältnis stimmt.

---

## 3. Audio einsetzen

1. MP3-Dateien nach `audio/` legen (z. B. `track-1.mp3`).
   Empfehlung: 192–320 kbps, Ausschnitte von 60–120 Sekunden.
2. In `index.html` den Kommentar `AUDIO-PLATZHALTER` finden und **den gesamten
   `<audio>`-Block** so ersetzen:

```html
<!-- Vorher -->
<audio class="track-audio" controls preload="none"></audio>

<!-- Nachher -->
<audio class="track-audio" controls preload="metadata">
  <source src="audio/track-1.mp3" type="audio/mpeg">
  <source src="audio/track-1.ogg" type="audio/ogg">
  Ihr Browser unterstützt kein HTML5-Audio.
</audio>
```

3. Dasselbe für Track 2 und 3.
4. Titel und Komponist nicht vergessen — die Zeilen mit
   `Titel 1 – Platzhalter` / `Komponist · ca. 0:00` anpassen, **in allen drei Sprachen**:

```html
<h3 class="track-title" data-de="Sonate in e-Moll" data-en="Sonata in E minor" data-ru="Соната ми минор">Sonate in e-Moll</h3>
<p class="track-meta" data-de="J. S. Bach · ca. 3:20" data-en="J. S. Bach · approx. 3:20" data-ru="И. С. Бах · ок. 3:20">J. S. Bach · ca. 3:20</p>
```

5. Danach den Hinweistext unter der Liste entfernen (Suchbegriff:
   `Hinweis: Die Player sind Platzhalter`).

**Bei sehr großen Dateien:** MP3s von mehreren Minuten sind schnell 5–10 MB.
Für eine reine Visitenkarte reichen kurze Ausschnitte; alternativ die Stücke
bei YouTube/SoundCloud hosten und verlinken.

---

## 4. YouTube-Videos einbetten

In `index.html` (Zeilen **207** und **220**) steht jeweils ein Platzhalter-Block.
Diesen komplett ersetzen — die Videokennung aus der YouTube-URL übernehmen
(`youtube.com/watch?v=**VIDEO_ID**`):

```html
<figure class="video-item">
  <div class="video-frame">
    <iframe class="video-embed"
            src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
            title="Duo Infatico – Live"
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen></iframe>
  </div>
  <figcaption data-de="Live-Aufnahme, Bielefeld 2025"
              data-en="Live recording, Bielefeld 2025"
              data-ru="Живая запись, Билефельд 2025">Live-Aufnahme, Bielefeld 2025</figcaption>
</figure>
```

Zusätzlich **einmalig** in `style.css` ergänzen (damit das Video im
16:9-Rahmen sitzt):

```css
/* Video-Einbettung */
.video-frame > .video-embed { width: 100%; height: 100%; border: 0; }
```

`youtube-nocookie.com` lädt erst beim Abspielen Cookies von YouTube —
das ist datenschutzfreundlicher und in Deutschland empfehlenswert.

---

## 5. E-Mail und Telefon

Zeilen **293** und **297** in `index.html`:

```html
<dd><a href="mailto:infatico.duo@gmail.com">infatico.duo@gmail.com</a></dd>
<dd><a href="tel:+491234567890">+49 123 456 7890</a></dd>
```

> Die Nummer im Beispiel oben ist ein **ausdrücklich fiktiver Platzhalter**
> (`+491234567890`) — im Projekt steht an dieser Stelle die freigegebene
> Booking-Nummer des Duos. Sie ist zentral in `tools/config.js` als
> `BOOKING_PHONE` hinterlegt und wird von dort in den öffentlichen vCard
> (`card/duo-infatico.vcf`) geschrieben: nach einer Änderung
> `node tools/build-assets.js` ausführen, damit beides gleich bleibt.
>
> **Persönliche** Nummern von Vadim und Nataliya gehören nicht ins Repository:
> Sie werden nur über `/card/setup/` lokal im Browser der beiden hinterlegt und
> verlassen das Gerät ausschließlich im URL-Fragment des persönlichen QR-Codes.
> `tools/verify-app.js` prüft, dass die Booking-Nummer nur an den drei
> freigegebenen Stellen (`index.html`, `card/duo-infatico.vcf`,
> `tools/config.js`) vorkommt.

Regeln:
- `mailto:` enthält die Adresse **ohne** Leerzeichen, `tel:` die Nummer im
  Format `+49…` — ohne Leerzeichen, Klammern und Bindestriche.
- Der sichtbare Text zwischen den Tags darf formatiert sein (mit Leerzeichen).
- Diese Zeilen sind sprachneutral — `data-de`/`data-en`/`data-ru` sind hier nicht nötig.
- Tipp gegen Spam: Adresse als `info [at] duo-infatico.de` schreiben? Nein —
  dann funktioniert der Link nicht. Besser: eine Adresse verwenden, die nicht
  im Klartext auf Social Media steht.

---

## 6. Kontaktformular (Cloudflare Worker + Resend)

Das Formular sendet **nativ** — ohne JavaScript-Eingriff — per POST an einen
Cloudflare Worker. Der Worker prüft den Bot-Schutz, verschickt zwei Mails über
Resend und leitet auf `danke.html` weiter.

| Baustein | Wert |
|---|---|
| Formular-Ziel (`action`) | `https://infatico-form-handler.infatico-duo.workers.dev` |
| Turnstile Sitekey (öffentlich) | `0x4AAAAAAFDs1nZawZnkWJSD` |
| Sende-Domain (Resend, verifiziert) | `send.infatico-duo.de` |
| Absender | `Duo Infatico <kontakt@send.infatico-duo.de>` |
| Empfänger | `infatico.duo@gmail.com` |
| Danke-Seite | `https://infatico-duo.de/danke.html` |

Zeile **306** in `index.html`:

```html
<form class="contact-form" id="contact-form"
      action="https://infatico-form-handler.infatico-duo.workers.dev" method="POST">
  <!-- sichtbare Felder: name, email, message -->
  <!-- Cloudflare Turnstile — sitekey öffentlich -->
  <div class="cf-turnstile" data-sitekey="0x4AAAAAAFDs1nZawZnkWJSD" data-theme="light"></div>
```

Der Turnstile-Aufruf steht im `<head>`:

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

### Ablauf beim Absenden

1. Der Browser prüft die Pflichtfelder selbst (`required`, `type="email"`) —
   deshalb **kein** `novalidate` und **kein** JavaScript-Handler mehr.
2. Turnstile legt ein Token in das Feld `cf-turnstile-response`.
3. Der Worker prüft das Token bei Cloudflare (`siteverify`).
4. Der Worker verschickt über Resend zwei Mails (Benachrichtigung an das Duo,
   Bestätigung an den Absender) und antwortet mit `303` auf `danke.html`.

Antworten des Workers:

| Code | Bedeutung |
|---|---|
| `405` | alles außer POST (z. B. ein normaler Seitenaufruf) |
| `400` | Pflichtfeld fehlt, Feld zu lang oder E-Mail ungültig |
| `401` | Turnstile-Token ungültig |
| `500` | Resend hat abgelehnt |
| `303` | Erfolg — Weiterleitung auf `danke.html` |

### Worker

| Eigenschaft | Wert |
|---|---|
| Name | `infatico-form-handler` |
| URL | `https://infatico-form-handler.infatico-duo.workers.dev` |
| Cloudflare-Konto | `4ccd1077dc0b9102c1a596de543dfeb6` |
| Modul | `worker.mjs` (ES-Modul, `handlers: ["fetch"]`) |
| Bindings | `RESEND_API_KEY`, `TURNSTILE_SECRET` (beide `secret_text`) |

Optionale Variablen — ohne sie greifen die Standardwerte:

| Variable | Standard |
|---|---|
| `EMAIL_FROM` | `Duo Infatico <kontakt@send.infatico-duo.de>` |
| `EMAIL_TO` | `infatico.duo@gmail.com` |

Zum Ändern der Zieladresse genügt die Variable `EMAIL_TO` im Worker; das
Formular in `index.html` bleibt unverändert.

### Secrets

Alle Zugangsdaten liegen **außerhalb** des Repositories:

```
C:\Users\bladw\.secrets\duo-infatico.env
```

Enthalten: `CLOUDFLARE_ACCOUNT_ID`, `TURNSTILE_WIDGET_ID`,
`TURNSTILE_SITEKEY`, `TURNSTILE_SECRET`, `WORKER_URL`.
Die Datei ist nur für den eigenen Benutzer lesbar (Vererbung entfernt).

Die beiden Worker-Geheimnisse liegen zusätzlich als Cloudflare-Bindings.
Sie dürfen **niemals** im Code, in `index.html` oder im Repository stehen —
der Sitekey dagegen ist öffentlich und gehört in die Seite.

### Danke-Seite

`danke.html` ist dreisprachig, trägt `noindex` und liest die zuletzt gewählte
Sprache aus dem localStorage. Der Worker leitet mit `303` dorthin weiter.

### Wichtig (DSGVO)

Mit dem Formular werden personenbezogene Daten verarbeitet. In der
**Datenschutzerklärung** (Art. 13 DSGVO) müssen Cloudflare (Turnstile und
Worker) sowie Resend als Empfänger genannt werden; der Link gehört in den
Footer — siehe nächster Abschnitt.

### Archiv: frühere FormSubmit-Konfiguration

Bis September 2026 lief der Versand über [FormSubmit](https://formsubmit.co).
Beim Wechsel auf den Worker wurden **alle** diese Felder aus `index.html`
entfernt. Sie stehen hier nur noch als Referenz:

```html
<form class="contact-form" id="contact-form"
      action="https://formsubmit.co/infatico.duo@gmail.com" method="POST" novalidate>
  <input type="hidden" name="_subject" value="Neue Anfrage von Duo Infatico Website">
  <input type="hidden" name="_captcha" value="true">
  <input type="hidden" name="_template" value="table">
  <input type="hidden" name="_next" value="https://infatico-duo.github.io/danke.html">
  <input type="hidden" name="_autoresponse" value="Vielen Dank für Ihre Nachricht an Duo Infatico! …">
</form>
```

| Feld | Bedeutung |
|---|---|
| `_subject` | Betreff der eingehenden Mail |
| `_captcha` | `true` = reCAPTCHA vor dem Absenden |
| `_template` | `table` = Tabellen-Layout in der Mail |
| `_next` | Seite nach dem Absenden |
| `_autoresponse` | Zweisprachiger Autoresponder-Text (DE + EN in einem Feld) |
| `_autoresponse_en` | **existiert bei FormSubmit nicht** — wurde wieder entfernt |
| `_honey` | Honigtopf-Feld (optional, nie eingebaut) |

Ein Wechsel zu einem anderen Dienst (z. B. Formspree) wäre weiterhin möglich:
dazu nur `action` und die versteckten Felder anpassen.

---

## 7. Impressum und Datenschutz (Deutschland)

In Deutschland ist ein Impressum **Pflicht** für geschäftsmäßige Websites —
auch für eine Visitenkarte mit Booking-Angebot. Rechtsgrundlage ist seit
Mai 2024 **§ 5 DDG** (Digitale-Dienste-Gesetz, hat das frühere § 5 TMG abgelöst).

### Pflichtangaben nach § 5 DDG

| Angabe | Bedeutung für das Duo |
|---|---|
| Name und Rechtsform | beide Namen, z. B. „Nataliya Salavei und Vadim Bektemirov, GbR" |
| Vertretungsberechtigte | bei einer GbR: alle Gesellschafter |
| **Ladungsfähige Anschrift** | echte Straße + Hausnummer, PLZ, Ort — **kein Postfach** |
| Kontakt | E-Mail **und** Telefon (E-Mail allein genügt nicht) |
| Umsatzsteuer-ID | falls vorhanden: „USt-IdNr. gemäß § 27a UStG: DE…" |
| Berufsbezogene Angaben | Berufsbezeichnung, zuständige Kammer/Verband, berufsrechtliche Regelungen |
| Inhaltlich verantwortlich | Name + Anschrift (§ 18 Abs. 2 MStV) |

### Empfohlener Aufbau

Am einfachsten eine zweite Seite `impressum.html` anlegen (Kopf und Footer
aus `index.html` übernehmen) und den Footer-Link darauf setzen — Zeile **352**:

```html
<p class="footer-links">
  <a href="impressum.html" data-de="Impressum" data-en="Imprint" data-ru="Импрессум">Impressum</a>
  ·
  <a href="datenschutz.html" data-de="Datenschutz" data-en="Privacy" data-ru="Конфиденциальность">Datenschutz</a>
</p>
```

### Zusätzlich beachten

- **Datenschutzerklärung:** Kontaktformular, Server-Logs des Hosters,
  ggf. YouTube-Einbettung und Schriftarten nennen. Die Seite nutzt
  **keine** Google Fonts vom Server (Playfair Display/Inter werden lokal
  bzw. als Systemschriften geladen) — das ist datenschutzfreundlich.
- **YouTube:** Einbettung über `youtube-nocookie.com` (siehe Abschnitt 4).
- **Fotos:** Nutzungsrechte an allen Bildern müssen geklärt sein
  (Fotograf/in, bei Personen ggf. Einwilligung).
- **GEMA:** Bei öffentlichen Konzerten ist die GEMA-Abmeldung Sache des
  Veranstalters — das gehört nicht auf die Website, ist aber gut zu wissen.
- ⚠️ Diese Hinweise sind **keine Rechtsberatung**. Vor der Veröffentlichung
  einmal von einer Anwältin/einem Anwalt oder der Steuerberatung prüfen lassen.

---

## 8. Veröffentlichen mit GitHub Pages (kostenlos)

1. **Konto** auf [github.com](https://github.com) anlegen (falls noch nicht vorhanden).
2. **Repository** erstellen: „New repository" → Name z. B. `duo-infatico-website`
   → Sichtbarkeit **Public** → „Create".
3. **Dateien hochladen:** „Add file" → „Upload files" → den kompletten Inhalt
   des Ordners `Duo-Website` hineinziehen (`index.html`, `style.css`, `script.js`,
   `images/`, `audio/`) → „Commit changes".
   - `index.html` **muss** im Hauptverzeichnis liegen (nicht in einem Unterordner).
   - Groß-/Kleinschreibung der Dateinamen ist wichtig (der Server läuft unter Linux).
4. **Pages aktivieren:** „Settings" → „Pages" → Source: „Deploy from a branch"
   → Branch: `main`, Ordner: `/ (root)` → „Save".
5. Nach etwa 1–2 Minuten ist die Seite erreichbar unter
   `https://BENUTZERNAME.github.io/duo-infatico-website/`
6. **Eigene Domain** (optional): „Settings" → „Pages" → „Custom domain"
   → z. B. `duo-infatico.de` eintragen. Beim Domain-Anbieter dann die
   DNS-Einträge setzen (A-Records auf die GitHub-Pages-IPs oder CNAME auf
   `BENUTZERNAME.github.io`). Danach „Enforce HTTPS" aktivieren.
7. **Aktualisieren:** Neue Datei hochladen → Seite ist nach ein paar Minuten
   aktuell. Im Browser mit **Strg+F5** neu laden, falls noch die alte Fassung
   erscheint (Browser-Cache).

**Grenzen des kostenlosen Tarifs:** maximal 1 GB pro Repository, 100 MB pro
Datei, ca. 100 GB Traffic pro Monat. Für eine Visitenkarte mit kurzen
Audiobeispielen reicht das problemlos.

---

## 9. Sprachen: Texte ändern oder ergänzen

Jeder übersetzbare Text hat drei Attribute:

```html
<p class="bio-text"
   data-de="Biografie wird später ergänzt."
   data-en="Biography will be added later"
   data-ru="Биография будет добавлена позже.">Biografie wird später ergänzt.</p>
```

- Der Text **zwischen den Tags** ist der Startwert (Deutsch) — er wird beim
  Laden der Seite sofort durch die aktive Sprache ersetzt.
- Neue Elemente immer mit **allen drei** Attributen anlegen, sonst bleibt der
  Text beim Sprachwechsel deutsch (der Code fällt bewusst auf Deutsch zurück).
- Formular-Platzhalter nutzen `data-de-placeholder` / `data-en-placeholder` /
  `data-ru-placeholder`.
- Standardsprache beim ersten Besuch: **Deutsch**. Die Wahl wird im Browser
  gespeichert (`localStorage`), zusätzlich funktioniert ein Direktlink:
  `index.html?lang=en` bzw. `?lang=ru`.

---

## 10. Checkliste vor der Veröffentlichung

- [ ] Fotos in `images/` ersetzt und `src` in `index.html` angepasst
- [ ] Porträts und Alt-Texte (Bildbeschreibungen) eingetragen
- [ ] Biografien in DE / EN / RU geschrieben
- [ ] Audio-Dateien in `audio/` und `<source>`-Tags aktiviert, Titel benannt
- [ ] Hinweistexte zu Platzhaltern entfernt (Audio-Hinweis ist noch offen)
- [ ] YouTube-Videos eingebettet, `VIDEO_ID` ersetzt
- [ ] Konzerttermine eingetragen (oder Abschnitt entfernt, falls keine anstehen)
- [ ] E-Mail und Telefon real, `mailto:` und `tel:` geprüft (Testanruf/-mail)
- [x] Formular mit dem Cloudflare Worker verbunden (`action` + Turnstile-Widget)
- [x] Turnstile-Sitekey im Formular, Skript im `<head>`
- [ ] **Testanfrage über die Live-Seite** – Benachrichtigung an
      `infatico.duo@gmail.com` und Autoantwort an den Absender erhalten
- [ ] Danke-Seite `danke.html` online erreichbar (der Worker leitet mit `303` dorthin)
- [ ] Impressum und Datenschutzerklärung verlinkt und vollständig
      (darin Cloudflare und Resend als Empfänger der Formulardaten nennen)
- [ ] Auf dem Handy geprüft (Menü, Formular, Lesbarkeit)
- [ ] Alle drei Sprachen durchgeklickt (DE / EN / RU)
- [ ] Seite im Browser mit Strg+F5 neu geladen, danach online geprüft
