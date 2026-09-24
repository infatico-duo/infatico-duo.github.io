'use strict';
/* ==========================================================================
   Duo Infatico – Kontaktdaten-Schicht (Browser + Node)
   --------------------------------------------------------------------------
   Trennt strikt zwischen ÖFFENTLICH und PRIVAT:

     ÖFFENTLICH (hier im Repository): Name, Instrument, E-Mail, Ort, Website
     PRIVAT    (nur im localStorage des jeweiligen Telefons): Telefonnummer

   Der persönliche QR enthält deshalb NUR ein kompaktes Array:
       ["1","vadim","+49…"]
   (Formatversion, Profil, Telefonnummer) – Name, Instrument, E-Mail und Ort
   ergänzt die Seite /card/contact/ aus den öffentlichen Daten.

   Kodierung: UTF-8 → Base64URL (kein Gzip, keine externen Dienste).
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.DuoContact = api; }
}(typeof self !== 'undefined' ? self : this, function () {

  var FORMAT_VERSION = '1';

  /* ------------------------------------------------------ öffentliche Daten */

  var PROFILES = {
    vadim: {
      id: 'vadim',
      name: 'Vadim Bektemirov',
      instrument: { de: 'Gitarre', en: 'Guitar', ru: 'Гитара' },
      storageKey: 'duo-infatico-vadim'
    },
    nataliya: {
      id: 'nataliya',
      name: 'Nataliya Salavei',
      instrument: { de: 'Violine', en: 'Violin', ru: 'Скрипка' },
      storageKey: 'duo-infatico-nataliya'
    }
  };

  var PROFILE_ORDER = ['vadim', 'nataliya'];

  var PUBLIC = {
    email: 'infatico.duo@gmail.com',   // steht so auf der Website
    city: 'Bielefeld',
    region: 'Nordrhein-Westfalen',
    country: 'Deutschland',
    org: 'Duo Infatico'
  };

  /* Feldgrenzen (Schutz vor überlangen Eingaben) */
  var LIMITS = { name: 100, phone: 20, email: 100 };

  /* ------------------------------------------------------------- Base64URL */

  function utf8Encode(text) {
    if (typeof TextEncoder !== 'undefined') { return new TextEncoder().encode(text); }
    return Uint8Array.from(Buffer.from(text, 'utf8'));
  }

  function utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') { return new TextDecoder('utf-8').decode(bytes); }
    return Buffer.from(bytes).toString('utf8');
  }

  function bytesToBase64Url(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i++) { binary += String.fromCharCode(bytes[i]); }
    var b64 = (typeof btoa === 'function')
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64UrlToBytes(value) {
    var b64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) { b64 += '='; }
    var binary;
    if (typeof atob === 'function') {
      binary = atob(b64);
    } else {
      binary = Buffer.from(b64, 'base64').toString('binary');
    }
    var out = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) { out[i] = binary.charCodeAt(i); }
    return out;
  }

  /* ------------------------------------------------------------- Payload */

  /** ["1","vadim","+49…"] → Base64URL */
  function encodePayload(profileId, phone) {
    var payload = JSON.stringify([FORMAT_VERSION, profileId, phone]);
    return bytesToBase64Url(utf8Encode(payload));
  }

  /**
   * Base64URL → { profile, phone } oder null.
   * Prüft Formatversion, Profilnamen und Telefonnummer.
   */
  function decodePayload(fragment) {
    if (!fragment) { return null; }
    var raw = String(fragment).replace(/^#/, '').trim();
    if (!raw || !/^[A-Za-z0-9\-_]+$/.test(raw)) { return null; }

    var data;
    try {
      data = JSON.parse(utf8Decode(base64UrlToBytes(raw)));
    } catch (err) {
      return null;
    }

    if (!Array.isArray(data) || data.length < 3) { return null; }
    if (String(data[0]) !== FORMAT_VERSION) { return null; }

    var profileId = String(data[1] || '').toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(PROFILES, profileId)) { return null; }

    var phone = validatePhone(data[2]);
    if (!phone.ok) { return null; }

    return { profile: profileId, phone: phone.value };
  }

  /** Vollständiger Link zur Kontaktseite, relativ zur aktuellen Dokumentbasis. */
  function contactUrl(baseUrl, profileId, phone) {
    var base = baseUrl || (typeof document !== 'undefined' ? document.baseURI : 'https://example.invalid/card/');
    var url = new URL('contact/', base);
    url.hash = encodePayload(profileId, phone);
    return url.href;
  }

  /* ---------------------------------------------------------- Validierung */

  function limit(value, max) {
    var text = String(value === undefined || value === null ? '' : value).trim();
    return text.length > max ? text.slice(0, max) : text;
  }

  /** Telefon: optional führendes +, danach nur Ziffern, Leerzeichen, Bindestriche. */
  function validatePhone(value) {
    var phone = limit(value, LIMITS.phone);
    if (!phone) { return { ok: false, reason: 'empty', value: '' }; }
    if (String(value).trim().length > LIMITS.phone) { return { ok: false, reason: 'too-long', value: phone }; }
    if (!/^\+?[0-9][0-9 -]*$/.test(phone)) { return { ok: false, reason: 'chars', value: phone }; }
    var digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 6) { return { ok: false, reason: 'too-short', value: phone }; }
    return { ok: true, reason: '', value: phone };
  }

  function validateEmail(value) {
    var email = limit(value, LIMITS.email);
    if (!email) { return { ok: true, value: '' }; }              // optional
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { return { ok: false, reason: 'format', value: email }; }
    return { ok: true, reason: '', value: email };
  }

  function sanitizeName(value) { return limit(value, LIMITS.name); }

  /* -------------------------------------------------------------- vCard */

  /** vCard 3.0: \\ ; , und Zeilenumbrüche maskieren. */
  function escapeVCard(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n');
  }

  /**
   * Baut den vCard-Text aus öffentlichen Daten + (nur zur Laufzeit) der Nummer.
   * @param {{profile:string, phone:string, name?:string, email?:string, city?:string, site?:string}} contact
   */
  function buildVCard(contact) {
    contact = contact || {};
    var profile = PROFILES[contact.profile] || null;
    var name = sanitizeName(contact.name || (profile ? profile.name : PUBLIC.org)) || PUBLIC.org;
    var instrument = profile ? profile.instrument.de : '';
    var phone = validatePhone(contact.phone);
    var email = validateEmail(contact.email === undefined ? PUBLIC.email : contact.email);
    var city = sanitizeName(contact.city || PUBLIC.city);

    var lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:;' + escapeVCard(name) + ';;;',
      'FN:' + escapeVCard(name),
      'ORG:' + escapeVCard(PUBLIC.org)
    ];
    if (instrument) { lines.push('TITLE:' + escapeVCard(instrument)); }
    if (phone.ok) { lines.push('TEL;TYPE=CELL:' + escapeVCard(phone.value)); }
    if (email.ok && email.value) { lines.push('EMAIL;TYPE=WORK,INTERNET:' + escapeVCard(email.value)); }
    if (contact.site) { lines.push('URL:' + escapeVCard(contact.site)); }
    if (city) {
      lines.push('ADR;TYPE=WORK:;;;' + escapeVCard(city) + ';' +
        escapeVCard(PUBLIC.region) + ';;' + escapeVCard(PUBLIC.country));
    }
    lines.push('NOTE:' + escapeVCard('Duo Infatico – Violine & Gitarre'));
    lines.push('END:VCARD');
    return lines.join('\r\n') + '\r\n';
  }

  function vcardFileName(name) {
    var slug = String(name || PUBLIC.org)
      .toLowerCase()
      .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return (slug || 'kontakt') + '.vcf';
  }

  return {
    FORMAT_VERSION: FORMAT_VERSION,
    PROFILES: PROFILES,
    PROFILE_ORDER: PROFILE_ORDER,
    PUBLIC: PUBLIC,
    LIMITS: LIMITS,
    encodePayload: encodePayload,
    decodePayload: decodePayload,
    contactUrl: contactUrl,
    validatePhone: validatePhone,
    validateEmail: validateEmail,
    sanitizeName: sanitizeName,
    escapeVCard: escapeVCard,
    buildVCard: buildVCard,
    vcardFileName: vcardFileName
  };
}));
