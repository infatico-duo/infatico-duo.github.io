/* ==========================================================================
   Duo Infatico – script.js
   Vanilla JavaScript, keine Abhängigkeiten.
   Sprachumschaltung DE / EN / RU über data-Attribute:
     data-de / data-en / data-ru                          -> Textinhalt
     data-de-placeholder / data-en-placeholder / ...      -> Formular-Platzhalter
   Standardsprache: Deutsch.
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY  = 'duo-infatico-lang';
  var DEFAULT_LANG = 'de';
  var LANGS        = ['de', 'en', 'ru'];

  var TITLES = {
    de: 'Duo Infatico – Violine & Gitarre | Bielefeld',
    en: 'Duo Infatico – Violin & Guitar | Bielefeld',
    ru: 'Duo Infatico — скрипка и гитара | Билефельд'
  };

  var LABELS = {
    de: { open: 'Menü öffnen',    close: 'Menü schließen',    nav: 'Hauptnavigation' },
    en: { open: 'Open menu',      close: 'Close menu',        nav: 'Main navigation' },
    ru: { open: 'Открыть меню',   close: 'Закрыть меню',      nav: 'Главная навигация' }
  };

  var MESSAGES = {
    de: {
      empty:   'Bitte alle Felder ausfüllen.',
      badMail: 'Bitte eine gültige E-Mail-Adresse angeben.',
      ok:      'Vielen Dank! Dies ist eine Demo – es wurden keine Daten versendet.'
    },
    en: {
      empty:   'Please fill in all fields.',
      badMail: 'Please enter a valid email address.',
      ok:      'Thank you! This is a demo – no data has been sent.'
    },
    ru: {
      empty:   'Пожалуйста, заполните все поля.',
      badMail: 'Пожалуйста, укажите корректный email.',
      ok:      'Спасибо! Это демо-форма — данные никуда не отправлены.'
    }
  };

  var html       = document.documentElement;
  var navToggle  = document.getElementById('nav-toggle');
  var primaryNav = document.getElementById('primary-nav');
  var header     = document.getElementById('site-header');
  var langButtons = Array.prototype.slice.call(document.querySelectorAll('.lang-btn'));

  function isSupported(lang) { return LANGS.indexOf(lang) !== -1; }
  function currentLang() {
    var lang = html.getAttribute('lang');
    return isSupported(lang) ? lang : DEFAULT_LANG;
  }

  /* ---------------------------------------------------------------- Sprache */

  function applyLanguage(lang) {
    if (!isSupported(lang)) { lang = DEFAULT_LANG; }

    // Alle Texte: data-de / data-en / data-ru (Rückfall auf Deutsch)
    var nodes = document.querySelectorAll('[data-de]');
    Array.prototype.forEach.call(nodes, function (el) {
      var value = el.getAttribute('data-' + lang);
      if (value === null) { value = el.getAttribute('data-de'); }
      if (value !== null) { el.textContent = value; }
    });

    // Platzhalter in Formularfeldern
    var phNodes = document.querySelectorAll('[data-de-placeholder]');
    Array.prototype.forEach.call(phNodes, function (el) {
      var value = el.getAttribute('data-' + lang + '-placeholder');
      if (value === null) { value = el.getAttribute('data-de-placeholder'); }
      if (value !== null) { el.setAttribute('placeholder', value); }
    });

    // Dokument-Sprache, Titel, Bedienelemente
    html.setAttribute('lang', lang);
    document.title = TITLES[lang] || TITLES[DEFAULT_LANG];

    if (navToggle) {
      var isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-label', isOpen ? LABELS[lang].close : LABELS[lang].open);
    }
    if (primaryNav) { primaryNav.setAttribute('aria-label', LABELS[lang].nav); }

    // Zustand der Umschalter
    langButtons.forEach(function (btn) {
      var active = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
  }

  langButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLanguage(btn.getAttribute('data-lang'));
    });
  });

  function initialLanguage() {
    // 1) Direkte Vorgabe per URL: index.html?lang=en
    var fromUrl = null;
    try {
      fromUrl = new URLSearchParams(window.location.search).get('lang');
    } catch (e) { /* ignore */ }
    if (isSupported(fromUrl)) { return fromUrl; }

    // 2) Zuletzt gewählte Sprache
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    if (isSupported(stored)) { return stored; }

    // 3) Standard ist Deutsch (Hauptsprache der Seite)
    return DEFAULT_LANG;
  }

  /* ------------------------------------------------------------- Navigation */

  function closeNav() {
    if (!navToggle || !primaryNav) { return; }
    primaryNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', LABELS[currentLang()].open);
  }

  if (navToggle && primaryNav) {
    navToggle.addEventListener('click', function () {
      var willOpen = !primaryNav.classList.contains('is-open');
      primaryNav.classList.toggle('is-open', willOpen);
      navToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      var labels = LABELS[currentLang()];
      navToggle.setAttribute('aria-label', willOpen ? labels.close : labels.open);
    });

    // Nach Klick auf einen Ankerlink schließen
    primaryNav.addEventListener('click', function (event) {
      if (event.target.closest('a')) { closeNav(); }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { closeNav(); }
    });
  }

  /* ------------------------------------------------ Header beim Scrollen */

  function onScroll() {
    if (!header) { return; }
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  }

  var scrollTicking = false;
  window.addEventListener('scroll', function () {
    if (scrollTicking) { return; }
    scrollTicking = true;
    window.requestAnimationFrame(function () {
      onScroll();
      scrollTicking = false;
    });
  }, { passive: true });

  /* --------------------------------------------------------------- Formular */

  var form   = document.getElementById('contact-form');
  var status = document.getElementById('form-status');

  function setStatus(text, kind) {
    if (!status) { return; }
    status.textContent = text || '';
    status.classList.remove('is-ok', 'is-error');
    if (kind) { status.classList.add(kind); }
  }

  function clearErrors() {
    Array.prototype.forEach.call(document.querySelectorAll('.field.has-error'), function (field) {
      field.classList.remove('has-error');
    });
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearErrors();

      var msg = MESSAGES[currentLang()] || MESSAGES[DEFAULT_LANG];

      var nameField = document.getElementById('cf-name');
      var mailField = document.getElementById('cf-email');
      var textField = document.getElementById('cf-message');

      var empty = [nameField, mailField, textField].filter(function (el) {
        return el && el.value.trim() === '';
      });

      if (empty.length) {
        empty.forEach(function (el) {
          if (el.parentElement) { el.parentElement.classList.add('has-error'); }
        });
        setStatus(msg.empty, 'is-error');
        if (empty[0]) { empty[0].focus(); }
        return;
      }

      var mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mailField.value.trim());
      if (!mailOk) {
        if (mailField.parentElement) { mailField.parentElement.classList.add('has-error'); }
        setStatus(msg.badMail, 'is-error');
        mailField.focus();
        return;
      }

      setStatus(msg.ok, 'is-ok');
      form.reset();
    });
  }

  /* ------------------------------------------------------------------- Jahr */

  var year = document.getElementById('year');
  if (year) { year.textContent = String(new Date().getFullYear()); }

  /* ------------------------------------------------------------------ Start */

  applyLanguage(initialLanguage());
  onScroll();
})();
