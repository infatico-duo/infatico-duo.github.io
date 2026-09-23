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
| Hero-Foto (großes Hintergrundbild) | `index.html` Zeile **60** | `images/hero.svg` | Datei in `images/` legen, `src` ändern |
| Foto des Duos | `index.html` Zeile **103** | `images/duo.svg` | dito |
| Porträt Nataliya Salavei | `index.html` Zeile **111** | `images/portrait-1.svg` | dito |
| Porträt Vadim Bektemirov | `index.html` Zeile **122** | `images/portrait-2.svg` | dito |
| Biografie-Texte | `index.html` Zeilen **115**, **126** | `Biografie wird später ergänzt.` | 3 Fassungen pro Text: `data-de`, `data-en`, `data-ru` |
| Konzerttermine | `index.html` Zeilen **251**, **257**, **263** | `TT.MM.JJJJ` | Datum/Ort/Stadt in allen drei Sprachen |
| Audio 1–3 | `index.html` Zeilen **157**, **169**, **181** | `AUDIO-PLATZHALTER` | `<source>` einfügen (Abschnitt 3) |
| Titelnamen der Tracks | `index.html` Zeilen **153**, **165**, **177** | `Titel 1 – Platzhalter` | in DE/EN/RU |
| YouTube-Video 1 | `index.html` Zeile **204** | `video-frame` (1. Treffer) | `<iframe>` einsetzen (Abschnitt 4) |
| YouTube-Video 2 | `index.html` Zeile **217** | `video-frame` (2. Treffer) | dito |
| E-Mail-Adresse | `index.html` Zeile **290** | `booking@example.com` | `mailto:`-Link + Text |
| Telefonnummer | `index.html` Zeile **294** | `tel:+490000000000` | `tel:`-Link + Text |
| Kontaktformular | `index.html` Zeile **309** | `<form class="contact-form"` | `action` ergänzen (Abschnitt 6) |
| Impressum-Link im Footer | `index.html` Zeile **357** | `footer-links` | Link auf `impressum.html` setzen (Abschnitt 7) |

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

<!-- Foto des Duos (Zeile 103) -->
<img src="images/duo.jpg" alt="Duo Infatico – Nataliya Salavei und Vadim Bektemirov"
     width="1200" height="800" loading="lazy">

<!-- Porträt 1 (Zeile 111) -->
<img class="bio-photo" src="images/nataliya.jpg"
     alt="Nataliya Salavei, Violine" width="600" height="600" loading="lazy">

<!-- Porträt 2 (Zeile 122) -->
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

In `index.html` (Zeilen **204** und **217**) steht jeweils ein Platzhalter-Block.
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

Zeilen **290** und **294** in `index.html`:

```html
<dd><a href="mailto:info@duo-infatico.de">info@duo-infatico.de</a></dd>
<dd><a href="tel:+4952112345678">+49 (0) 521 123 456 78</a></dd>
```

Regeln:
- `mailto:` enthält die Adresse **ohne** Leerzeichen, `tel:` die Nummer im
  Format `+49…` — ohne Leerzeichen, Klammern und Bindestriche.
- Der sichtbare Text zwischen den Tags darf formatiert sein (mit Leerzeichen).
- Diese Zeilen sind sprachneutral — `data-de`/`data-en`/`data-ru` sind hier nicht nötig.
- Tipp gegen Spam: Adresse als `info [at] duo-infatico.de` schreiben? Nein —
  dann funktioniert der Link nicht. Besser: eine Adresse verwenden, die nicht
  im Klartext auf Social Media steht.

---

## 6. Kontaktformular aktivieren

Aktuell ist das Formular eine **Demo**: `script.js` fängt das Absenden ab und
zeigt nur eine Meldung. Es werden keine Daten versendet.

### Variante A — FormSubmit (kein Konto, am schnellsten)

Zeile **309** in `index.html`:

```html
<form class="contact-form" id="contact-form"
      action="https://formsubmit.co/info@duo-infatico.de" method="POST">
  <input type="hidden" name="_subject" value="Neue Booking-Anfrage – Duo Infatico">
  <input type="hidden" name="_template" value="table">
  <input type="hidden" name="_captcha" value="false">
  <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off">
  <!-- ab hier die vorhandenen Felder unverändert lassen -->
```

Danach in `script.js` im Submit-Handler die Demo-Zeilen ersetzen:

```js
// vorher
setStatus(msg.ok, 'is-ok');
form.reset();

// nachher
form.submit();          // Daten wirklich an FormSubmit senden
```

Beim ersten Absenden schickt FormSubmit eine Bestätigungsmail an die Adresse —
erst nach dem Klick darauf werden Anfragen zugestellt.

### Variante B — Formspree (Konto, kostenloser Tarif)

```html
<form class="contact-form" id="contact-form"
      action="https://formspree.io/f/DEINE_FORM_ID" method="POST">
  <input type="hidden" name="_subject" value="Neue Booking-Anfrage – Duo Infatico">
```

Die `DEINE_FORM_ID` steht im Formspree-Dashboard. Die Änderung in `script.js`
ist identisch (`form.submit()`).

### Danach aufräumen

Den Hinweis unter dem Button entfernen (Suchbegriff
`Demo-Formular: Es werden keine Daten versendet.`) — sonst steht dort
fälschlich, es werde nichts gesendet. Der Text existiert dreisprachig.

### Wichtig

Wer ein Kontaktformular anbietet, verarbeitet personenbezogene Daten und
braucht dafür eine **Datenschutzerklärung** (Art. 13 DSGVO) sowie einen Link
darauf im Footer — siehe nächster Abschnitt.

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
aus `index.html` übernehmen) und den Footer-Link darauf setzen — Zeile **357**:

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
- [ ] Hinweistexte zu Platzhaltern entfernt (Audio-Hinweis, Demo-Hinweis)
- [ ] YouTube-Videos eingebettet, `VIDEO_ID` ersetzt
- [ ] Konzerttermine eingetragen (oder Abschnitt entfernt, falls keine anstehen)
- [ ] E-Mail und Telefon real, `mailto:` und `tel:` geprüft (Testanruf/-mail)
- [ ] Formular mit `action` verbunden und einmal testweise abgeschickt
- [ ] Impressum und Datenschutzerklärung verlinkt und vollständig
- [ ] Auf dem Handy geprüft (Menü, Formular, Lesbarkeit)
- [ ] Alle drei Sprachen durchgeklickt (DE / EN / RU)
- [ ] Seite im Browser mit Strg+F5 neu geladen, danach online geprüft
