'use strict';
/* ==========================================================================
   Duo Infatico – zentrale URL-Konfiguration
   --------------------------------------------------------------------------
   Hier die Adressen pflegen. tools/verify-qr.js prüft, dass der Inhalt des
   erzeugten QR-Codes mit CARD_URL übereinstimmt.

   Wenn die Domain infatico-duo.de live ist, bleibt CARD_URL unverändert.
   Beim Umzug auf eine andere Domain: hier und in card/card.js anpassen,
   danach `node tools/build-assets.js` und `node tools/verify-qr.js` ausführen.
   ========================================================================== */

module.exports = {
  // Ziel des QR-Codes = diese Installations-/Visitenkarten-Seite
  CARD_URL: 'https://infatico-duo.de/card/',

  // Öffentliche Website (Startseite) – wie auf der Seite hinterlegt
  SITE_URL: 'https://infatico-duo.github.io/',

  // Öffentliche Kontaktadresse (steht so auf der Website)
  EMAIL: 'infatico.duo@gmail.com'
};
