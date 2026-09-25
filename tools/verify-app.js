'use strict';
/* ==========================================================================
   Duo Infatico – Prüfung der Visitenkarten-App (/card/)
   --------------------------------------------------------------------------
   Aufruf:  node tools/verify-app.js

   Prüft ohne Browser:
     1. Dateien vorhanden, UTF-8 ohne BOM, keine Mojibake-Reste
     2. index.html: charset an erster Stelle, Verweise, DE/EN/RU vollständig
     3. Manifest: JSON, start_url/scope/display, Icons (echte PNGs)
     4. Service Worker: Vorinstallationsliste, Versionierung, same-origin
     5. Öffentliche vCard: Aufbau, CRLF, keine persönlichen Daten
     6. Datenschutz: keine echten Telefonnummern in irgendeiner Datei,
        keine vadim.vcf/nataliya.vcf im Repository
     7. Drei QR-Modi: Website (statisch), Vadim und Nataliya (Laufzeit)
     8. Sicherheit: textContent statt innerHTML, Fragment-Entfernung,
        Feldgrenzen, vCard-Maskierung, keine Netzwerkaufrufe
     9. Einrichtungsseite ist nirgends verlinkt und nicht indexierbar
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const qr = require('../card/qr.js');
const decoder = require('./qr-decode');
const contactData = require('../card/contact-data.js');

const ROOT = path.join(__dirname, '..');
const CARD = path.join(ROOT, 'card');
const FAKE_PHONE = '+491234567890';          // ausdrücklich erlaubte Testnummer
const BOOKING_PHONE = config.BOOKING_PHONE;  // freigegebene Nummer des Duos
const BOOKING_DIGITS = BOOKING_PHONE.replace(/\D/g, '');
/* Nur in diesen Dateien darf die Booking-Nummer stehen (als vollständige
   Nummer mit Vorwahl). Hinweis: weiter unten steht in der Tippfehler-Prüfung
   absichtlich eine reine Ziffernfolge als unabhängiger Sollwert – würde der
   Test sie aus config.js ableiten, könnte er einen Tippfehler dort nicht
   erkennen. */
const BOOKING_ALLOWED = ['index.html', 'card/duo-infatico.vcf', 'tools/config.js'];

/* Anzeigeform der Nummer aus der Konfiguration ableiten – so steht die Nummer
   nicht als Literal im Testcode und die Freigabeliste bleibt eng. */
function displayNumber(phone) {
  const rest = phone.replace(/^\+49/, '');
  return '+49 ' + rest.slice(0, 3) + ' ' + rest.slice(3);
}
const BOOKING_DISPLAY = displayNumber(BOOKING_PHONE);

const results = [];
let failed = 0;

function check(label, condition, detail) {
  const ok = !!condition;
  if (!ok) { failed++; }
  results.push({ ok, label, detail: detail || '' });
}

const read = (p) => fs.readFileSync(p);
const readText = (p) => read(p).toString('utf8');
const exists = (rel) => fs.existsSync(path.join(CARD, rel));

/* ------------------------------------------------------------- Dateiliste */

const FILES = [
  'index.html', 'card.css', 'card.js', 'i18n.js', 'contact-data.js', 'qr.js',
  'manifest.webmanifest', 'sw.js', 'qr.svg', 'duo-infatico.vcf',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'setup/index.html', 'setup/setup.js', 'contact/index.html', 'contact/contact.js'
];

console.log('Prüfung der Visitenkarten-App – /card/\n');

for (const rel of FILES) {
  const abs = path.join(CARD, rel);
  if (!fs.existsSync(abs)) { check(rel + ': vorhanden', false, 'Datei fehlt'); continue; }
  check(rel + ': vorhanden', true, (Math.round(fs.statSync(abs).size / 102.4) / 10) + ' KB');
}

/* ------------------------------------------------------------- Kodierung */

const BAD = ['\u0413\u045a', '\u0413\u00b6', '\u0413\u0458', '\u0413\u00a4',
  '\u0432\u0402\u201c', '\u0420\u00b0', '\u0421\u0403'];

for (const rel of FILES) {
  const abs = path.join(CARD, rel);
  if (!fs.existsSync(abs) || /\.png$/i.test(rel)) { continue; }
  const buf = read(abs);
  const bom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
  const text = buf.toString('utf8');
  const valid = Buffer.from(text, 'utf8').equals(buf);
  const bad = BAD.reduce((n, p) => n + (text.split(p).length - 1), 0);
  check(rel + ': UTF-8 ohne BOM, kein Mojibake', !bom && valid && bad === 0,
    (bom ? 'BOM; ' : '') + (valid ? '' : 'ungültiges UTF-8; ') + (bad ? bad + ' Mojibake' : ''));
}

/* ----------------------------------------------------------- index.html */

const html = readText(path.join(CARD, 'index.html'));

const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
const firstTag = (head.match(/<[a-z][^>]*>/i) || [''])[0];
check('index.html: <meta charset="UTF-8"> ist der erste Eintrag im <head>',
  /^<meta charset="UTF-8">$/i.test(firstTag), firstTag);

check('index.html: Manifest verlinkt', /<link rel="manifest" href="manifest.webmanifest">/.test(html));
check('index.html: theme-color gesetzt', /<meta name="theme-color"/.test(html));

const refs = (html.match(/(?:src|href)="([^"]+)"/g) || [])
  .map((m) => m.replace(/^(?:src|href)="/, '').replace(/"$/, ''))
  .filter((u) => !/^(https?:|mailto:|tel:|#)/.test(u));
const missingRefs = refs.filter((u) => !fs.existsSync(path.join(CARD, u.split('?')[0].split('#')[0])));
check('index.html: alle lokalen Verweise existieren', missingRefs.length === 0,
  missingRefs.join(', ') || refs.length + ' Verweise geprüft');

const deCount = (html.match(/data-de="/g) || []).length;
const enCount = (html.match(/data-en="/g) || []).length;
const ruCount = (html.match(/data-ru="/g) || []).length;
check('index.html: DE/EN/RU vollständig', deCount === enCount && enCount === ruCount,
  deCount + ' / ' + enCount + ' / ' + ruCount);

const withoutRu = (html.match(/<[^>]*data-de="[^"]*"[^>]*>/g) || []).filter((t) => !/data-ru="/.test(t));
check('index.html: jedes data-de hat auch data-en und data-ru', withoutRu.length === 0,
  withoutRu.slice(0, 2).join(' | '));

check('index.html: Bedienelemente für Teilen, Installation, Vollbild-QR vorhanden',
  ['id="share"', 'id="install"', 'id="qr-fullscreen"', 'id="qr-overlay"', 'duo-infatico.vcf']
    .every((id) => html.indexOf(id) !== -1));

check('index.html: Schaltflächen für persönliche Kontakt-QR vorhanden',
  ['id="qr-person-vadim"', 'id="qr-person-nataliya"'].every((id) => html.indexOf(id) !== -1));

check('index.html: iPhone-Anleitung vorhanden (Safari → Teilen → Home-Bildschirm → Web-App)',
  /class="steps"/.test(html) && /data-en="Open Safari"/.test(html) && /data-ru="Откройте Safari"/.test(html));

check('index.html: kein Verweis auf /card/setup/ (Seite bleibt unverlinkt)',
  !/href="[^"]*setup/i.test(html));

/* -------------------------------------------------- Unterseiten / Setup */

const setupHtml = readText(path.join(CARD, 'setup', 'index.html'));
check('setup/index.html: nicht indexierbar (robots noindex)',
  /name="robots"[^>]*noindex/i.test(setupHtml));
check('setup/index.html: Warnung „nur für Vadim und Nataliya" in DE/EN/RU',
  /Diese Seite ist nur für Vadim und Nataliya/.test(setupHtml) &&
  /This page is for Vadim and Nataliya only/.test(setupHtml) &&
  /Эта страница только для Вадима и Наталии/.test(setupHtml));
check('setup/index.html: Hinweis zum Origin-Wechsel (infatico-duo.de) in DE/EN/RU',
  /Nach dem Wechsel auf infatico-duo\.de/.test(setupHtml) &&
  /After switching to infatico-duo\.de/.test(setupHtml) &&
  /После перехода на infatico-duo\.de/.test(setupHtml));
check('setup/index.html: Feldgrenzen (Name ≤ 100, Telefon ≤ 20, E-Mail ≤ 100)',
  /id="setup-name"[^>]*maxlength="100"/.test(setupHtml) &&
  /id="setup-phone"[^>]*maxlength="20"/.test(setupHtml) &&
  /id="setup-email"[^>]*maxlength="100"/.test(setupHtml));
check('setup/index.html: beide Profile auswählbar',
  /name="profile" value="vadim"/.test(setupHtml) && /name="profile" value="nataliya"/.test(setupHtml));

const setupJs = readText(path.join(CARD, 'setup', 'setup.js'));
check('setup.js: speichert unter duo-infatico-vadim / duo-infatico-nataliya',
  /storageKey/.test(setupJs) &&
  contactData.PROFILES.vadim.storageKey === 'duo-infatico-vadim' &&
  contactData.PROFILES.nataliya.storageKey === 'duo-infatico-nataliya');
check('setup.js: kein innerHTML', !/\.innerHTML\s*=/.test(setupJs));
check('setup.js: keine Netzwerkaufrufe (fetch/XHR/WebSocket)',
  !/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(setupJs));

/* --------------------------------------------------------- Kontaktseite */

const contactHtml = readText(path.join(CARD, 'contact', 'index.html'));
const contactJs = readText(path.join(CARD, 'contact', 'contact.js'));

check('contact/index.html: Fehlermeldung „Kein Kontakt in dieser URL" in DE/EN/RU',
  /Kein Kontakt in dieser URL/.test(contactHtml) &&
  /No contact in this URL/.test(contactHtml) &&
  /В этой ссылке нет контакта/.test(contactHtml));
check('contact/index.html: Rückfall-Schaltflächen Anrufen und E-Mail vorhanden',
  /id="call"/.test(contactHtml) && /id="mail"/.test(contactHtml));
check('contact/index.html: iPhone-Hinweis vorhanden',
  /iPhone/.test(contactHtml) && /Kontakte/.test(contactHtml));
check('contact/index.html: nicht indexierbar (robots noindex)',
  /name="robots"[^>]*noindex/i.test(contactHtml));
check('contact.js: Fragment wird sofort aus der Adresszeile entfernt',
  contactJs.indexOf('history.replaceState(null') !== -1);
check('contact.js: Kontakt nur im Speicher (kein localStorage/sessionStorage)',
  !/(localStorage|sessionStorage)\.(get|set|remove)Item/.test(contactJs));
check('contact.js: kein innerHTML', !/\.innerHTML\s*=/.test(contactJs));
check('contact.js: vCard entsteht als Blob im Browser',
  /new Blob\(\[state\.vcard\]/.test(contactJs));
check('contact.js: keine Netzwerkaufrufe (fetch/XHR/WebSocket)',
  !/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(contactJs));

/* -------------------------------------------------------------- Manifest */

let manifest = null;
try {
  manifest = JSON.parse(readText(path.join(CARD, 'manifest.webmanifest')));
  check('manifest.webmanifest: gültiges JSON', true);
} catch (e) {
  check('manifest.webmanifest: gültiges JSON', false, e.message);
}

if (manifest) {
  check('Manifest: start_url = /card/', manifest.start_url === '/card/', manifest.start_url);
  check('Manifest: scope = /card/', manifest.scope === '/card/', manifest.scope);
  check('Manifest: display = standalone', manifest.display === 'standalone', manifest.display);

  const sizes = manifest.icons.map((i) => i.sizes + ':' + (i.purpose || ''));
  check('Manifest: Icons 192, 512 und maskable vorhanden',
    sizes.some((s) => s.indexOf('192x192') === 0) &&
    sizes.some((s) => s.indexOf('512x512:any') === 0) &&
    sizes.some((s) => s.indexOf('maskable') !== -1), sizes.join(', '));

  const missingIcons = manifest.icons.filter((i) => !exists(i.src));
  check('Manifest: alle Icon-Dateien vorhanden', missingIcons.length === 0,
    missingIcons.map((i) => i.src).join(', '));

  for (const icon of manifest.icons.filter((i) => i.type === 'image/png')) {
    const buf = read(path.join(CARD, icon.src));
    const isPng = buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG';
    const w = isPng ? buf.readUInt32BE(16) : 0;
    const h = isPng ? buf.readUInt32BE(20) : 0;
    check('Icon ' + icon.src + ': echtes PNG ' + w + '×' + h,
      isPng && String(w) + 'x' + h === icon.sizes, isPng ? w + 'x' + h : 'keine PNG-Signatur');
  }
}

/* -------------------------------------------------------- Service Worker */

const sw = readText(path.join(CARD, 'sw.js'));
const precache = (sw.match(/const PRECACHE = \[([\s\S]*?)\];/) || [])[1] || '';
const precacheList = (precache.match(/'([^']+)'/g) || []).map((s) => s.replace(/'/g, ''));
const missingPrecache = precacheList.filter((u) => {
  const clean = u.replace(/^\.\//, '');
  if (clean === '') { return false; }
  return !fs.existsSync(path.join(CARD, clean));
});
check('sw.js: alle vorinstallierten Dateien existieren (' + precacheList.length + ' Einträge)',
  missingPrecache.length === 0, missingPrecache.join(', '));
check('sw.js: Einrichtungs- und Kontaktseite werden vorinstalliert',
  precacheList.indexOf('./setup/') !== -1 && precacheList.indexOf('./contact/') !== -1);
check('sw.js: Cache-Name versioniert', /CACHE_NAME = 'duo-infatico-card-v\d+'/.test(sw));
check('sw.js: räumt alte Caches auf', sw.indexOf('caches.delete') !== -1);
check('sw.js: nur same-origin', sw.indexOf('url.origin !== self.location.origin') !== -1);
check('sw.js: Navigation wird pro Adresse gespeichert (nicht alles auf index.html)',
  /cache\.put\(key/.test(sw) && /caches\.match\(key\)/.test(sw));

/* ------------------------------------------------------------ vCard (öffentlich) */

const vcf = readText(path.join(CARD, 'duo-infatico.vcf'));

/** Zerlegt eine vCard in Felder (Name ohne Parameter, Werte als Liste). */
function parseVCard(text) {
  const fields = {};
  for (const line of text.split(/\r\n/)) {
    const i = line.indexOf(':');
    if (i <= 0) { continue; }
    const name = line.slice(0, i).split(';')[0].toUpperCase();
    if (!fields[name]) { fields[name] = []; }
    fields[name].push(line.slice(i + 1));
  }
  return fields;
}

const vcfFields = parseVCard(vcf);

check('duo-infatico.vcf: BEGIN/END korrekt',
  vcf.startsWith('BEGIN:VCARD') && vcf.trim().endsWith('END:VCARD'));
check('duo-infatico.vcf: CRLF-Zeilenenden', vcf.indexOf('\r\n') !== -1 && !/[^\r]\n/.test(vcf));
check('duo-infatico.vcf: VERSION 3.0', vcfFields.VERSION && vcfFields.VERSION[0] === '3.0');
check('duo-infatico.vcf: FN und ORG gesetzt',
  vcfFields.FN && vcfFields.FN[0] === 'Duo Infatico' && vcfFields.ORG && vcfFields.ORG[0] === 'Duo Infatico');
check('duo-infatico.vcf: öffentliche E-Mail', vcf.indexOf(config.EMAIL) !== -1, config.EMAIL);
check('duo-infatico.vcf: Website', vcf.indexOf(config.SITE_URL) !== -1, config.SITE_URL);
check('duo-infatico.vcf: keine Anschrift', !/^ADR/mi.test(vcf));

/* Ohne diesen Eintrag normalisiert Git (core.autocrlf=true) die CRLF-Zeilenenden
   zu LF – die ausgelieferte vCard wäre dann nicht mehr RFC-2426-konform. */
const gitattributesPath = path.join(ROOT, '.gitattributes');
const gitattributes = fs.existsSync(gitattributesPath) ? readText(gitattributesPath) : '';
check('duo-infatico.vcf: .gitattributes schützt die CRLF-Zeilenenden (*.vcf -text)',
  /^\*\.vcf[ \t]+-text[ \t]*$/m.test(gitattributes),
  gitattributes ? 'Eintrag gefunden' : '.gitattributes fehlt');

/* Telefonnummer im öffentlichen Kontakt */
check('duo-infatico.vcf: Booking-Nummer als TEL;TYPE=CELL',
  vcf.indexOf('TEL;TYPE=CELL:' + BOOKING_PHONE) !== -1, BOOKING_PHONE);
check('duo-infatico.vcf: genau ein TEL-Feld mit genau dieser Nummer',
  (vcfFields.TEL || []).length === 1 && vcfFields.TEL[0] === BOOKING_PHONE,
  (vcfFields.TEL || []).join(' | ') || 'kein TEL');
check('duo-infatico.vcf: keine weiteren/persönlichen Nummern',
  (vcfFields.TEL || []).every((t) => t === BOOKING_PHONE) &&
  (vcf.match(/TEL/gi) || []).length === 1,
  (vcf.match(/TEL/gi) || []).length + ' TEL-Zeilen');

/* Website-Kontaktbereich: Nummer als Link und als sichtbarer Text */
const rootHtml = readText(path.join(ROOT, 'index.html'));
check('index.html (Website): tel:-Link mit der Booking-Nummer',
  rootHtml.indexOf('tel:' + BOOKING_PHONE) !== -1, 'tel:' + BOOKING_PHONE);
check('index.html (Website): Nummer auch als sichtbarer Text im Kontaktbereich',
  rootHtml.indexOf(BOOKING_DISPLAY) !== -1, BOOKING_DISPLAY);
check('index.html (Website): kein Telefon-Platzhalter mehr',
  rootHtml.indexOf('+49 (0) 000 000 000') === -1 && rootHtml.indexOf('tel:+490000000000') === -1);

/* Tippfehler-Schutz: dieselbe Ziffernfolge in allen drei Quellen */
check('Booking-Nummer ohne Tippfehler in config.js und vCard',
  readText(path.join(ROOT, 'tools', 'config.js')).indexOf(BOOKING_PHONE) !== -1 &&
  BOOKING_DIGITS === '4915679017511',
  'Ziffern: ' + BOOKING_DIGITS);
check('Booking-Nummer hat gültiges Format (+49 und 10–11 Ziffern)',
  /^\+49\d{10,11}$/.test(BOOKING_PHONE), BOOKING_PHONE + ' (' + BOOKING_DIGITS.length + ' Ziffern)');

/* Persönliche vCards dürfen die Booking-Nummer NICHT enthalten */
const contactDataJs = readText(path.join(CARD, 'contact-data.js'));
check('contact-data.js: öffentliche Daten enthalten keine Telefonnummer',
  findPhoneLike(contactDataJs, 'card/contact-data.js').length === 0 &&
  !/PUBLIC\s*=\s*\{[^}]*phone/i.test(contactDataJs));
check('contact-data.js: persönliche vCard nutzt nur die Nummer aus dem Fragment',
  contactDataJs.indexOf("'TEL;TYPE=CELL:' + escapeVCard(phone.value)") !== -1);

/* --------------------------------------------- Datenschutz: Nummern-Scan */

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') { continue; }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full, out); }
    else if (!/\.(png|jpg|jpeg|webp|ico|woff2?)$/i.test(entry.name)) { out.push(full); }
  }
  return out;
}

/** Findet telefonartige Zahlen. Erlaubt sind:
      – Platzhalter aus lauter Nullen (000 …)
      – die ausdrückliche Testnummer (FAKE_PHONE, überall)
      – die freigegebene Booking-Nummer (BOOKING_PHONE) NUR in den Dateien,
        in denen sie bewusst steht (Website-Kontakt, öffentliche vCard, config).
    Jede andere Nummer ist ein Fehler – so bleiben persönliche Nummern draußen.
    Absichtlich streng: die Ziffernfolge muss mit „+<Ziffer>" oder „0<Ziffer>"
    beginnen, damit Maßangaben wie viewBox="0 0 1920 1080" nicht zählen. */
function findPhoneLike(text, relPath) {
  const hits = [];
  const re = /(\+[0-9][0-9 ()\/.\-]{7,}|\b0[0-9][0-9 ()\/.\-]{6,})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length < 9) { continue; }
    if (/^0+$/.test(digits) || /^490+$/.test(digits)) { continue; }          // Platzhalter 000…
    if (digits === FAKE_PHONE.replace(/\D/g, '')) { continue; }               // Testnummer
    if (digits === BOOKING_DIGITS) {
      if (relPath && BOOKING_ALLOWED.indexOf(relPath) === -1) {
        hits.push(m[0].trim() + ' (nicht freigegebene Datei)');
      }
      continue;
    }
    hits.push(m[0].trim());
  }
  return hits;
}

const allFiles = walk(ROOT, []);
const phoneHits = [];
for (const file of allFiles) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const hits = findPhoneLike(readText(file), rel);
  if (hits.length) {
    phoneHits.push(rel + ': ' + hits.join(', '));
  }
}
check('Datenschutz: keine fremden/persönlichen Telefonnummern (' + allFiles.length + ' Dateien geprüft)',
  phoneHits.length === 0, phoneHits.join(' | '));

check('Datenschutz: Booking-Nummer erscheint nur an den freigegebenen Stellen',
  allFiles.filter((f) => {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    return readText(f).indexOf(config.BOOKING_PHONE) !== -1;
  }).map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
    .filter((rel) => BOOKING_ALLOWED.indexOf(rel) === -1).length === 0,
  'erlaubt: ' + BOOKING_ALLOWED.join(', '));

check('Datenschutz: keine persönlichen vCard-Dateien im Repository',
  !fs.existsSync(path.join(CARD, 'vadim.vcf')) &&
  !fs.existsSync(path.join(CARD, 'nataliya.vcf')) &&
  !fs.readdirSync(CARD).some((f) => /^(vadim|nataliya).*\.vcf$/i.test(f)));

const cardJs = readText(path.join(CARD, 'card.js'));
check('Datenschutz: card.js enthält keine Nummer', findPhoneLike(cardJs).length === 0);
check('Datenschutz: card.js baut keine Adresse aus einer festen Domain',
  !/new\s+URL\(\s*['"]http/.test(cardJs));
check('Datenschutz: Kontakt-Link wird relativ zu document.baseURI gebaut',
  /document\.baseURI/.test(cardJs) && /document\.baseURI/.test(readText(path.join(CARD, 'contact-data.js'))));

/* ------------------------------------------- Kontaktformular (FormSubmit) */

const scriptJs = readText(path.join(ROOT, 'script.js'));
const formTag = (rootHtml.match(/<form[^>]*id="contact-form"[^>]*>/) || [''])[0];

check('Kontaktformular gefunden', formTag !== '');
check('Kontaktformular: action zeigt auf FormSubmit mit der öffentlichen Adresse',
  formTag.indexOf('action="https://formsubmit.co/' + config.EMAIL + '"') !== -1,
  formTag || 'nicht gefunden');
check('Kontaktformular: method="POST"', /\smethod="POST"/.test(formTag));

function hiddenValue(name) {
  const m = rootHtml.match(new RegExp('<input type="hidden" name="' + name + '" value="([^"]*)">'));
  return m ? m[1] : null;
}

check('Kontaktformular: _subject gesetzt',
  hiddenValue('_subject') === 'Neue Anfrage von Duo Infatico Website', hiddenValue('_subject'));
check('Kontaktformular: _captcha = true', hiddenValue('_captcha') === 'true', hiddenValue('_captcha'));
check('Kontaktformular: _template = table', hiddenValue('_template') === 'table', hiddenValue('_template'));
check('Kontaktformular: _next zeigt auf die Danke-Seite',
  hiddenValue('_next') === config.SITE_URL + 'danke.html', hiddenValue('_next'));

check('Kontaktformular: kein Demo-Hinweis mehr (DE/EN/RU)',
  !/Demo-Formular|Demo form|Демо-форма/i.test(rootHtml + scriptJs));

check('script.js: Absenden wird nicht mehr pauschal verhindert (nur bei Fehlern)',
  (scriptJs.match(/event\.preventDefault\(\)/g) || []).length === 2 &&
  scriptJs.indexOf('setStatus(msg.sending') !== -1,
  (scriptJs.match(/event\.preventDefault\(\)/g) || []).length + ' preventDefault-Aufrufe, sending-Text: ' +
  (scriptJs.indexOf('setStatus(msg.sending') !== -1 ? 'ja' : 'nein'));
check('script.js: kein Demo-Erfolgstext mehr',
  !/msg\.ok|keine Daten versendet|no data has been sent/.test(scriptJs));

/* ------------------------------------------------------------ Danke-Seite */

const dankePath = path.join(ROOT, 'danke.html');
check('danke.html: vorhanden', fs.existsSync(dankePath));

if (fs.existsSync(dankePath)) {
  const dankeBuf = read(dankePath);
  const danke = dankeBuf.toString('utf8');

  check('danke.html: UTF-8 ohne BOM',
    !(dankeBuf[0] === 0xEF && dankeBuf[1] === 0xBB && dankeBuf[2] === 0xBF) &&
    Buffer.from(danke, 'utf8').equals(dankeBuf));

  const dankeHead = danke.slice(danke.indexOf('<head>') + 6, danke.indexOf('</head>'));
  check('danke.html: <meta charset="UTF-8"> ist der erste Eintrag im <head>',
    /^<meta charset="UTF-8">$/i.test((dankeHead.match(/<[a-z][^>]*>/i) || [''])[0]));

  check('danke.html: Dankestext in DE/EN/RU',
    danke.indexOf('Vielen Dank für Ihre Anfrage!') !== -1 &&
    danke.indexOf('Thank you for your request!') !== -1 &&
    danke.indexOf('Спасибо за вашу заявку!') !== -1);
  check('danke.html: Sprachumschaltung DE/EN/RU',
    (danke.match(/data-lang="/g) || []).length === 3,
    (danke.match(/data-lang="/g) || []).length + ' Schaltflächen');
  check('danke.html: nutzt das Design der Website', danke.indexOf('href="style.css"') !== -1);
  check('danke.html: nicht indexierbar', /name="robots"[^>]*noindex/i.test(danke));

  const dankeRefs = (danke.match(/(?:src|href)="([^"]+)"/g) || [])
    .map((m) => m.replace(/^(?:src|href)="/, '').replace(/"$/, ''))
    .filter((u) => !/^(https?:|mailto:|tel:|#|\.\/$)/.test(u));
  const dankeMissing = dankeRefs.filter((u) => !fs.existsSync(path.join(ROOT, u)));
  check('danke.html: alle lokalen Verweise existieren', dankeMissing.length === 0,
    dankeMissing.join(', ') || dankeRefs.length + ' Verweise geprüft');
}

/* --------------------------------------------------- Drei QR-Modi (Dekodierung) */

function decodeQr(matrix) { return decoder.decode(matrix); }

/* Modus 1: Website – statisches SVG */
const svgText = readText(path.join(CARD, 'qr.svg'));
const view = Number((svgText.match(/viewBox="0 0 (\d+)/) || [])[1]);
const group = svgText.match(/<g fill="#[0-9a-f]{6}">([\s\S]*?)<\/g>/);
let websiteOk = false;
let websiteDetail = '';

if (group && view > 0) {
  const qsize = view - 8;
  const matrix = Array.from({ length: qsize }, () => new Array(qsize).fill(0));
  for (const rect of (group[1].match(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/g) || [])) {
    const m = rect.match(/x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/);
    for (let dy = 0; dy < Number(m[4]); dy++) {
      for (let dx = 0; dx < Number(m[3]); dx++) {
        matrix[Number(m[2]) + dy - 4][Number(m[1]) + dx - 4] = 1;
      }
    }
  }
  try {
    const out = decodeQr(matrix);
    websiteOk = out.text === config.CARD_URL && out.syndromesOk;
    websiteDetail = 'V' + out.version + '-' + out.eccLevel + ' → ' + out.text;
  } catch (err) {
    websiteDetail = err.message;
  }
}
check('QR-Modus 1 (Website): statischer Code dekodiert zur öffentlichen Adresse',
  websiteOk, websiteDetail);

/* Modi 2 und 3: persönliche Kontakte – im Browser erzeugt, hier nachgestellt */
for (const profileId of contactData.PROFILE_ORDER) {
  const profile = contactData.PROFILES[profileId];
  const base = 'https://infatico-duo.github.io/card/';
  const url = contactData.contactUrl(base, profileId, FAKE_PHONE);
  let ok = false;
  let detail = '';
  try {
    const res = qr.encode(url);
    const out = decodeQr(res.modules);
    const parsed = contactData.decodePayload(url.slice(url.indexOf('#') + 1));
    ok = out.text === url && out.syndromesOk && parsed &&
      parsed.profile === profileId && parsed.phone === FAKE_PHONE;
    detail = 'V' + res.version + ' (' + res.size + '×' + res.size + ') → ' + profile.name +
      ', Nummer im Fragment: ' + (parsed ? parsed.phone : '—');
  } catch (err) {
    detail = err.message;
  }
  check('QR-Modus ' + (profileId === 'vadim' ? 2 : 3) + ' (' + profile.name + '): persönlicher QR dekodiert korrekt',
    ok, detail);
}

/* Testnummer nur als ausdrücklich erlaubter Platzhalter */
const payloadRaw = Buffer.from(
  contactData.encodePayload('vadim', FAKE_PHONE).replace(/-/g, '+').replace(/_/g, '/') + '===', 'base64').toString('utf8');
check('QR-Nutzdaten enthalten nur Version, Profil und Nummer',
  payloadRaw === '["1","vadim","' + FAKE_PHONE + '"]', payloadRaw);

/* ---------------------------------------------------------- card.js */

check('card.js: Service Worker nur über http/https',
  cardJs.indexOf('/^https?:$/.test(window.location.protocol)') !== -1);
check('card.js: kein Tracking/Analytics',
  !/gtag|analytics|googletagmanager|matomo|plausible/i.test(cardJs));
check('card.js: persönlicher QR wird zur Laufzeit erzeugt (nicht aus einer Datei geladen)',
  /QR\.encode\(/.test(cardJs) && /QR\.renderToCanvas\(/.test(cardJs));
check('card.js: kein innerHTML', cardJs.indexOf('innerHTML') === -1);

/* --------------------------------------------------------- Bericht */

console.log('');
for (const r of results) {
  console.log((r.ok ? '  PASS  ' : '  FAIL  ') + r.label + (r.detail ? '\n          → ' + r.detail : ''));
}
console.log('');
if (failed === 0) {
  console.log('ERGEBNIS: alle ' + results.length + ' Prüfungen bestanden.');
} else {
  console.log('ERGEBNIS: ' + failed + ' von ' + results.length + ' Prüfungen FEHLGESCHLAGEN.');
  process.exitCode = 1;
}
