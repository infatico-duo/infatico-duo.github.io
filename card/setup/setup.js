'use strict';
/* ==========================================================================
   Duo Infatico – Einrichtungsseite (/card/setup/)
   --------------------------------------------------------------------------
   Speichert die persönliche Telefonnummer AUSSCHLIESSLICH im localStorage
   dieses Browsers (Schlüssel duo-infatico-vadim / duo-infatico-nataliya).
   Nichts wird gesendet, nichts landet im Repository.

   Alle Eingaben werden über textContent/Attributwerte gesetzt – kein innerHTML.
   ========================================================================== */
(function () {
  'use strict';

  var i18n = window.DuoI18n;
  var data = window.DuoContact;
  var QR = window.DuoQR;

  var form = document.getElementById('setup-form');
  var nameInput = document.getElementById('setup-name');
  var phoneInput = document.getElementById('setup-phone');
  var emailInput = document.getElementById('setup-email');
  var statusEl = document.getElementById('status');
  var preview = document.getElementById('preview');
  var previewPerson = document.getElementById('preview-person');
  var previewUrl = document.getElementById('preview-url');
  var previewCanvas = document.getElementById('preview-canvas');
  var deleteBtn = document.getElementById('setup-delete');
  var radios = Array.prototype.slice.call(document.querySelectorAll('input[name="profile"]'));

  var MSG = {
    de: {
      saved: 'Gespeichert in diesem Browser.',
      deleted: 'Aus diesem Browser gelöscht.',
      nothing: 'Es war nichts gespeichert.',
      errName: 'Bitte einen Namen eingeben (höchstens 100 Zeichen).',
      errPhoneEmpty: 'Bitte eine Telefonnummer eingeben.',
      errPhone: 'Ungültige Telefonnummer. Erlaubt sind +, Ziffern, Leerstellen und Bindestriche.',
      errPhoneShort: 'Die Telefonnummer ist zu kurz.',
      errEmail: 'Bitte eine gültige E-Mail-Adresse eingeben (oder das Feld leer lassen).',
      previewPerson: 'Vorschau für: ',
      storageBlocked: 'Dieser Browser erlaubt kein localStorage – bitte keine privaten Fenster verwenden.'
    },
    en: {
      saved: 'Saved in this browser.',
      deleted: 'Deleted from this browser.',
      nothing: 'Nothing was saved.',
      errName: 'Please enter a name (100 characters maximum).',
      errPhoneEmpty: 'Please enter a phone number.',
      errPhone: 'Invalid phone number. Allowed: +, digits, spaces and hyphens.',
      errPhoneShort: 'The phone number is too short.',
      errEmail: 'Please enter a valid email address (or leave the field empty).',
      previewPerson: 'Preview for: ',
      storageBlocked: 'This browser does not allow localStorage – please avoid private windows.'
    },
    ru: {
      saved: 'Сохранено в этом браузере.',
      deleted: 'Удалено из этого браузера.',
      nothing: 'Сохранённых данных не было.',
      errName: 'Введите имя (не более 100 символов).',
      errPhoneEmpty: 'Введите номер телефона.',
      errPhone: 'Неверный номер. Допустимы +, цифры, пробелы и дефисы.',
      errPhoneShort: 'Номер слишком короткий.',
      errEmail: 'Введите корректный email (или оставьте поле пустым).',
      previewPerson: 'Предпросмотр для: ',
      storageBlocked: 'Браузер не разрешает localStorage — не используйте приватные окна.'
    }
  };

  function msg() { return MSG[i18n.current()] || MSG[i18n.DEFAULT_LANG]; }

  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', !!isError);
  }

  function storageAvailable() {
    try {
      localStorage.setItem('duo-infatico-test', '1');
      localStorage.removeItem('duo-infatico-test');
      return true;
    } catch (e) {
      return false;
    }
  }

  function selectedProfile() {
    for (var i = 0; i < radios.length; i++) {
      if (radios[i].checked) { return radios[i].value; }
    }
    return data.PROFILE_ORDER[0];
  }

  function profileKey(id) {
    var profile = data.PROFILES[id];
    return profile ? profile.storageKey : null;
  }

  function readStored(id) {
    var key = profileKey(id);
    if (!key) { return null; }
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function fillForm(id) {
    var profile = data.PROFILES[id];
    var stored = readStored(id);
    nameInput.value = (stored && stored.n) || (profile ? profile.name : '');
    phoneInput.value = (stored && stored.tel) || '';
    emailInput.value = (stored && stored.e) || data.PUBLIC.email;
    renderPreview();
  }

  /* ------------------------------------------------------------- Vorschau */

  function cardBase() {
    // /card/setup/ → /card/
    return new URL('../', document.baseURI).href;
  }

  function renderPreview() {
    var id = selectedProfile();
    var profile = data.PROFILES[id];
    var phone = data.validatePhone(phoneInput.value);

    if (!profile || !phone.ok) {
      preview.hidden = true;
      return;
    }

    var url = data.contactUrl(cardBase(), id, phone.value);
    var instrument = profile.instrument[i18n.current()] || profile.instrument.de;

    previewPerson.textContent = msg().previewPerson + profile.name + ' · ' + instrument;
    previewUrl.textContent = url;

    var result = QR.encode(url);
    QR.renderToCanvas(previewCanvas, result, { scale: 8, quiet: 4 });
    preview.hidden = false;
    preview.setAttribute('data-qr-version', String(result.version));
  }

  /* ------------------------------------------------------------ Speichern */

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setStatus('');

    if (!storageAvailable()) { setStatus(msg().storageBlocked, true); return; }

    var id = selectedProfile();
    var key = profileKey(id);
    var profile = data.PROFILES[id];

    var name = data.sanitizeName(nameInput.value) || (profile ? profile.name : '');
    if (!name) { setStatus(msg().errName, true); nameInput.focus(); return; }

    var rawPhone = phoneInput.value.trim();
    if (!rawPhone) { setStatus(msg().errPhoneEmpty, true); phoneInput.focus(); return; }
    var phone = data.validatePhone(rawPhone);
    if (!phone.ok) {
      setStatus(phone.reason === 'too-short' ? msg().errPhoneShort : msg().errPhone, true);
      phoneInput.focus();
      return;
    }

    var email = data.validateEmail(emailInput.value);
    if (!email.ok) { setStatus(msg().errEmail, true); emailInput.focus(); return; }

    var record = { n: name, t: profile ? profile.instrument.de : '', tel: phone.value, e: email.value };
    try {
      localStorage.setItem(key, JSON.stringify(record));
    } catch (e) {
      setStatus(msg().storageBlocked, true);
      return;
    }

    nameInput.value = name;
    phoneInput.value = phone.value;
    emailInput.value = email.value;
    setStatus(msg().saved, false);
    renderPreview();
  });

  deleteBtn.addEventListener('click', function () {
    var id = selectedProfile();
    var key = profileKey(id);
    var existed = false;
    try {
      existed = localStorage.getItem(key) !== null;
      localStorage.removeItem(key);
    } catch (e) { /* ignore */ }

    setStatus(existed ? msg().deleted : msg().nothing, false);
    nameInput.value = data.PROFILES[id].name;
    phoneInput.value = '';
    emailInput.value = data.PUBLIC.email;
    renderPreview();
  });

  /* ---------------------------------------------------------------- Start */

  radios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      setStatus('');
      fillForm(selectedProfile());
    });
  });

  phoneInput.addEventListener('input', function () {
    var phone = data.validatePhone(phoneInput.value);
    phoneInput.classList.toggle('is-invalid', phoneInput.value.trim() !== '' && !phone.ok);
    renderPreview();
  });
  nameInput.addEventListener('input', renderPreview);

  i18n.init('setup', function () {
    var stored = readStored(selectedProfile());
    if (!stored) { emailInput.value = data.PUBLIC.email; }
    renderPreview();
  });

  if (!storageAvailable()) { setStatus(MSG[i18n.current()].storageBlocked, true); }
  fillForm(selectedProfile());
})();
