'use strict';
/* ==========================================================================
   Duo Infatico – Sprachumschaltung (Browser + Node)
   --------------------------------------------------------------------------
   Gemeinsam genutzt von /card/, /card/setup/ und /card/contact/.

   Attribute im HTML:
     data-de / data-en / data-ru                      → Textinhalt
     data-de-placeholder / …                          → placeholder
     data-de-aria / …                                 → aria-label

   Standardsprache: Deutsch. Die Wahl wird im localStorage gemerkt
   (Schlüssel „duo-infatico-lang"), damit sie auf allen Kartenseiten gilt.
   ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.DuoI18n = api; }
}(typeof self !== 'undefined' ? self : this, function () {

  var LANGS = ['de', 'en', 'ru'];
  var DEFAULT_LANG = 'de';
  var STORAGE_KEY = 'duo-infatico-lang';

  var TITLES = {
    card: {
      de: 'Duo Infatico – Visitenkarte',
      en: 'Duo Infatico – Business card',
      ru: 'Duo Infatico — визитка'
    },
    setup: {
      de: 'Duo Infatico – Einrichtung',
      en: 'Duo Infatico – Setup',
      ru: 'Duo Infatico — настройка'
    },
    contact: {
      de: 'Duo Infatico – Kontakt speichern',
      en: 'Duo Infatico – Save contact',
      ru: 'Duo Infatico — сохранить контакт'
    }
  };

  var listeners = [];

  function isSupported(lang) { return LANGS.indexOf(lang) !== -1; }

  function current() {
    var lang = (typeof document !== 'undefined') ? document.documentElement.getAttribute('lang') : null;
    return isSupported(lang) ? lang : DEFAULT_LANG;
  }

  function initialLanguage(url) {
    var fromUrl = null;
    try {
      var search = url || (typeof window !== 'undefined' ? window.location.search : '');
      fromUrl = new URLSearchParams(search).get('lang');
    } catch (e) { /* ignore */ }
    if (isSupported(fromUrl)) { return fromUrl; }

    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    if (isSupported(stored)) { return stored; }
    return DEFAULT_LANG;
  }

  function apply(lang, pageKey) {
    if (!isSupported(lang)) { lang = DEFAULT_LANG; }
    var doc = document;

    Array.prototype.forEach.call(doc.querySelectorAll('[data-de]'), function (el) {
      var value = el.getAttribute('data-' + lang);
      if (value === null) { value = el.getAttribute('data-de'); }
      if (value !== null) { el.textContent = value; }
    });

    Array.prototype.forEach.call(doc.querySelectorAll('[data-de-placeholder]'), function (el) {
      var value = el.getAttribute('data-' + lang + '-placeholder');
      if (value === null) { value = el.getAttribute('data-de-placeholder'); }
      if (value !== null) { el.setAttribute('placeholder', value); }
    });

    Array.prototype.forEach.call(doc.querySelectorAll('[data-de-aria]'), function (el) {
      var value = el.getAttribute('data-' + lang + '-aria');
      if (value === null) { value = el.getAttribute('data-de-aria'); }
      if (value !== null) { el.setAttribute('aria-label', value); }
    });

    doc.documentElement.setAttribute('lang', lang);
    if (pageKey && TITLES[pageKey]) {
      doc.title = TITLES[pageKey][lang] || TITLES[pageKey][DEFAULT_LANG];
    }

    Array.prototype.forEach.call(doc.querySelectorAll('.lang-btn'), function (btn) {
      var active = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }

    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](lang); } catch (e) { /* ignore */ }
    }
    return lang;
  }

  /** Verknüpft die DE/EN/RU-Schaltflächen und wendet die Startsprache an. */
  function init(pageKey, onChange) {
    if (typeof onChange === 'function') { listeners.push(onChange); }

    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (btn) {
      btn.addEventListener('click', function () {
        apply(btn.getAttribute('data-lang'), pageKey);
      });
    });

    return apply(initialLanguage(), pageKey);
  }

  return {
    LANGS: LANGS,
    DEFAULT_LANG: DEFAULT_LANG,
    STORAGE_KEY: STORAGE_KEY,
    TITLES: TITLES,
    isSupported: isSupported,
    current: current,
    initialLanguage: initialLanguage,
    apply: apply,
    init: init
  };
}));
