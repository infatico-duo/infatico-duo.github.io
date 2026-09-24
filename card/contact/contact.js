'use strict';
/* ==========================================================================
   Duo Infatico – Kontaktseite (/card/contact/)
   --------------------------------------------------------------------------
   Liest den Kontakt aus dem URL-Fragment (Teil nach dem #):

       #<Base64URL(UTF-8["1","vadim","+49…"])>

   Das Fragment wird niemals an einen Server gesendet. Nach dem Auslesen wird
   es sofort aus der Adresszeile entfernt (history.replaceState), damit die
   Nummer beim Kopieren der URL nicht weitergegeben wird.

   Die vCard entsteht ausschließlich im Browser (Blob) – kein Netzzugriff.
   Alle Ausgaben laufen über textContent, niemals über innerHTML.
   ========================================================================== */
(function () {
  'use strict';

  var i18n = window.DuoI18n;
  var data = window.DuoContact;

  var errorBox = document.getElementById('error');
  var view = document.getElementById('contact-view');
  var nameEl = document.getElementById('contact-name');
  var instrumentEl = document.getElementById('contact-instrument');
  var phoneEl = document.getElementById('contact-phone');
  var emailEl = document.getElementById('contact-email');
  var cityEl = document.getElementById('contact-city');
  var callLink = document.getElementById('call');
  var mailLink = document.getElementById('mail');
  var saveBtn = document.getElementById('save-vcf');
  var statusEl = document.getElementById('status');

  var MSG = {
    de: { created: 'Kontaktdatei erstellt. Prüfe deine Downloads.', blocked: 'Download wurde vom Browser blockiert.' },
    en: { created: 'Contact file created. Please check your downloads.', blocked: 'The browser blocked the download.' },
    ru: { created: 'Файл контакта создан. Проверьте загрузки.', blocked: 'Браузер заблокировал загрузку.' }
  };

  /* Nur im Speicher dieser Seite – bewusst keine Speicherung im localStorage. */
  var state = { contact: null, vcard: '' };

  function msg() { return MSG[i18n.current()] || MSG[i18n.DEFAULT_LANG]; }

  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  function websiteUrl() {
    // Öffentliche Website = eine Ebene über /card/ – relativ, ohne feste Domain
    return new URL('../', document.baseURI).href;
  }

  /* ------------------------------------------------------------- Einlesen */

  function readContact() {
    var parsed = data.decodePayload(window.location.hash);
    if (!parsed) { return null; }

    var profile = data.PROFILES[parsed.profile];
    if (!profile) { return null; }

    return {
      profile: profile.id,
      name: data.sanitizeName(profile.name),
      instrument: profile.instrument,
      phone: parsed.phone,
      email: data.PUBLIC.email,
      city: data.PUBLIC.city,
      site: websiteUrl()
    };
  }

  function stripFragment() {
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) { /* z. B. file:// – dann bleibt das Fragment stehen */ }
  }

  /* ------------------------------------------------------------ Darstellung */

  function render() {
    var contact = state.contact;
    var lang = i18n.current();

    nameEl.textContent = contact.name;
    instrumentEl.textContent = contact.instrument[lang] || contact.instrument.de;
    phoneEl.textContent = contact.phone;
    emailEl.textContent = contact.email;
    cityEl.textContent = contact.city;

    callLink.setAttribute('href', 'tel:' + contact.phone.replace(/[^+0-9]/g, ''));
    mailLink.setAttribute('href', 'mailto:' + contact.email);

    state.vcard = data.buildVCard({
      profile: contact.profile,
      phone: contact.phone,
      name: contact.name,
      email: contact.email,
      city: contact.city,
      site: contact.site
    });
  }

  function showError() {
    errorBox.hidden = false;
    view.hidden = true;
    stripFragment();
  }

  function showContact(contact) {
    state.contact = contact;
    errorBox.hidden = true;
    view.hidden = false;
    render();
  }

  /* -------------------------------------------------------------- Download */

  function downloadVCard() {
    if (!state.vcard) { return; }
    try {
      var blob = new Blob([state.vcard], { type: 'text/vcard;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', data.vcardFileName(state.contact.name));
      link.setAttribute('rel', 'noopener');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      setStatus(msg().created, false);
    } catch (e) {
      setStatus(msg().blocked, true);
    }
  }

  saveBtn.addEventListener('click', downloadVCard);

  /* ---------------------------------------------------------------- Start */

  i18n.init('contact', function () {
    if (state.contact) { render(); }
  });

  var contact = readContact();
  if (contact) {
    showContact(contact);
    stripFragment();          // Fragment sofort aus der Adresszeile entfernen
  } else {
    showError();
  }
})();
