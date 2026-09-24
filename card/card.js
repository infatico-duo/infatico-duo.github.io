/* ==========================================================================
   Duo Infatico – Digitale Visitenkarte (/card/)
   card.js · Vanilla JavaScript, keine Abhängigkeiten, kein Tracking

   Enthält:
     - Sprachumschaltung über i18n.js (DE / EN / RU)
     - Teilen (Web Share API mit Zwischenablage als Rückfall)
     - Vollbild-QR: öffentlicher Code (qr.svg) und persönliche Kontakt-Codes,
       die ausschließlich hier im Browser aus dem localStorage erzeugt werden
     - Installations-Knopf (beforeinstallprompt, nur wenn unterstützt)
     - Service Worker für den Offline-Betrieb (nur über http/https)

   Es werden KEINE Telefonnummern gespeichert, gesendet oder eingebaut –
   die persönlichen Nummern liegen nur im localStorage des jeweiligen Geräts.
   ========================================================================== */
(function () {
  'use strict';

  var i18n = window.DuoI18n;
  var data = window.DuoContact;
  var QR = window.DuoQR;

  var html = document.documentElement;
  var statusEl = document.getElementById('status');
  var overlay = document.getElementById('qr-overlay');
  var overlayClose = document.getElementById('qr-close');
  var overlayPerson = document.getElementById('qr-overlay-person');
  var overlayImg = document.getElementById('qr-overlay-img');
  var overlayCanvas = document.getElementById('qr-overlay-canvas');
  var overlayUrl = document.getElementById('qr-overlay-url');
  var qrOpen = document.getElementById('qr-open');
  var qrFullscreen = document.getElementById('qr-fullscreen');
  var installBtn = document.getElementById('install');
  var yearEl = document.getElementById('year');

  /* Reine Beschriftung unter dem STATISCHEN QR (card/qr.svg).
     Sie nennt die kanonische Adresse, die dieser Code enthält – es wird
     daraus keine URL gebaut und keine Domain fest verdrahtet. */
  var PUBLIC_CAPTION = 'infatico-duo.de/card/';

  /* Aktuell gezeigter Modus: null = öffentlicher QR, sonst Profilkennung */
  var activeProfile = null;
  var wakeLock = null;

  var MSG = {
    de: {
      shared: 'Geteilt.',
      copied: 'Link kopiert.',
      copyManual: 'Link zum Kopieren:',
      installAccepted: 'Installation gestartet …',
      installed: 'App installiert.',
      notConfigured: 'Kontakt ist auf diesem Gerät nicht eingerichtet. Öffne /card/setup/ zur Einrichtung auf diesem Gerät.',
      badPhone: 'Die gespeicherte Nummer ist ungültig. Bitte in /card/setup/ neu eingeben.',
      generating: 'QR-Code wird auf diesem Gerät erzeugt.',
      qrTooLong: 'Die Kontaktdaten sind zu lang für einen QR-Code.'
    },
    en: {
      shared: 'Shared.',
      copied: 'Link copied.',
      copyManual: 'Link to copy:',
      installAccepted: 'Installation started …',
      installed: 'App installed.',
      notConfigured: 'Contact is not set up on this device. Open /card/setup/ to set it up on this device.',
      badPhone: 'The saved number is invalid. Please enter it again in /card/setup/.',
      generating: 'QR code is generated on this device.',
      qrTooLong: 'The contact data is too long for a QR code.'
    },
    ru: {
      shared: 'Отправлено.',
      copied: 'Ссылка скопирована.',
      copyManual: 'Ссылка для копирования:',
      installAccepted: 'Установка началась …',
      installed: 'Приложение установлено.',
      notConfigured: 'Контакт не настроен на этом устройстве. Откройте /card/setup/ для настройки на этом устройстве.',
      badPhone: 'Сохранённый номер некорректен. Введите его заново в /card/setup/.',
      generating: 'QR-код создаётся на этом устройстве.',
      qrTooLong: 'Контактные данные слишком длинные для QR-кода.'
    }
  };

  function messages() { return MSG[i18n.current()] || MSG[i18n.DEFAULT_LANG]; }

  function setStatus(text, isError) {
    if (!statusEl) { return; }
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  /* --------------------------------------------------------------- Pfade */

  /** Basis der Kartenseite, relativ zum aktuellen Dokument – ohne feste Domain. */
  function cardBase() { return new URL('./', document.baseURI).href; }

  /* -------------------------------------------------------------- Teilen */

  function share() {
    var url = cardBase();
    var payload = {
      title: 'Duo Infatico – Violine & Gitarre',
      text: 'Duo Infatico – Nataliya Salavei · Vadim Bektemirov',
      url: url
    };

    if (navigator.share) {
      navigator.share(payload).then(function () {
        setStatus(messages().shared);
      }).catch(function (err) {
        if (err && err.name === 'AbortError') { return; }
        copyFallback(url);
      });
      return;
    }
    copyFallback(url);
  }

  function copyFallback(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        setStatus(messages().copied);
      }).catch(function () {
        window.prompt(messages().copyManual, text);
      });
      return;
    }
    window.prompt(messages().copyManual, text);
  }

  var shareBtn = document.getElementById('share');
  if (shareBtn) { shareBtn.addEventListener('click', share); }

  /* --------------------------------------------------------- Vollbild-QR */

  function requestWakeLock() {
    if (!('wakeLock' in navigator)) { return; }
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
    }).catch(function () { /* nicht unterstützt */ });
  }

  function releaseWakeLock() {
    if (wakeLock) {
      try { wakeLock.release(); } catch (e) { /* ignore */ }
      wakeLock = null;
    }
  }

  function showOverlay() {
    if (!overlay) { return; }
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    if (overlay.requestFullscreen) {
      overlay.requestFullscreen().catch(function () { /* optional */ });
    }
    requestWakeLock();
    if (overlayClose) { overlayClose.focus(); }
  }

  function closeOverlay() {
    if (!overlay || overlay.hidden) { return; }
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () { /* ignore */ });
    }
    releaseWakeLock();
  }

  function openPublicQr() {
    activeProfile = null;
    overlayImg.hidden = false;
    overlayCanvas.hidden = true;
    overlayPerson.textContent = '';
    overlayUrl.textContent = PUBLIC_CAPTION;
    showOverlay();
  }

  function readStoredPhone(profileId) {
    var profile = data.PROFILES[profileId];
    if (!profile || !profile.storageKey) { return null; }
    var raw = null;
    try { raw = localStorage.getItem(profile.storageKey); } catch (e) { return null; }
    if (!raw) { return null; }
    var record = null;
    try { record = JSON.parse(raw); } catch (e) { return null; }
    if (!record || !record.tel) { return null; }
    var phone = data.validatePhone(record.tel);
    return phone.ok ? phone.value : null;
  }

  function openPersonalQr(profileId) {
    var profile = data.PROFILES[profileId];
    if (!profile) { return; }

    var phone = readStoredPhone(profileId);
    if (!phone) {
      setStatus(readStoredPhone(profileId) === null ? messages().notConfigured : messages().badPhone, true);
      return;
    }

    var url = data.contactUrl(cardBase(), profileId, phone);
    var result = null;
    try {
      result = QR.encode(url);
    } catch (e) {
      setStatus(messages().qrTooLong, true);
      return;
    }

    QR.renderToCanvas(overlayCanvas, result, { scale: 8, quiet: 4 });
    activeProfile = profileId;
    overlayImg.hidden = true;
    overlayCanvas.hidden = false;
    overlayPerson.textContent = profile.name + ' · ' +
      (profile.instrument[i18n.current()] || profile.instrument.de);
    overlayCanvas.setAttribute('aria-label', profile.name + ' – QR');
    overlayUrl.textContent = '';
    setStatus(messages().generating);
    showOverlay();
  }

  if (qrOpen) {
    qrOpen.addEventListener('click', function (event) {
      event.preventDefault();
      openPublicQr();
    });
  }
  if (qrFullscreen) { qrFullscreen.addEventListener('click', openPublicQr); }

  ['vadim', 'nataliya'].forEach(function (id) {
    var btn = document.getElementById('qr-person-' + id);
    if (btn) {
      btn.addEventListener('click', function () { openPersonalQr(id); });
    }
  });

  if (overlayClose) { overlayClose.addEventListener('click', closeOverlay); }
  if (overlay) {
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay || event.target.classList.contains('qr-overlay-inner')) {
        closeOverlay();
      }
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeOverlay(); }
  });

  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement && overlay && !overlay.hidden) { closeOverlay(); }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && overlay && !overlay.hidden) { requestWakeLock(); }
  });

  /* ---------------------------------------------------- App installieren */

  var deferredPrompt = null;

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (installBtn && !isStandalone()) { installBtn.classList.remove('is-hidden'); }
  });

  if (installBtn) {
    if (isStandalone()) { installBtn.classList.add('is-hidden'); }
    installBtn.addEventListener('click', function () {
      if (!deferredPrompt) { return; }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        if (choice && choice.outcome === 'accepted') { setStatus(messages().installAccepted); }
        deferredPrompt = null;
        installBtn.classList.add('is-hidden');
      }).catch(function () {
        deferredPrompt = null;
        installBtn.classList.add('is-hidden');
      });
    });
  }

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    if (installBtn) { installBtn.classList.add('is-hidden'); }
    setStatus(messages().installed);
  });

  /* ------------------------------------------------------ Service Worker */

  if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {
        /* Offline-Modus nicht verfügbar – Seite funktioniert normal weiter */
      });
    });
  }

  /* ------------------------------------------------------------------ Jahr */

  if (yearEl) { yearEl.textContent = String(new Date().getFullYear()); }

  /* ----------------------------------------------------------------- Start */

  i18n.init('card', function () {
    if (activeProfile) {
      var profile = data.PROFILES[activeProfile];
      overlayPerson.textContent = profile.name + ' · ' +
        (profile.instrument[i18n.current()] || profile.instrument.de);
    }
  });
})();
