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
  EMAIL: 'infatico.duo@gmail.com',

  // Freigegebene Booking-Nummer des Duos – erscheint im Kontaktbereich der
  // Website und im öffentlichen vCard (card/duo-infatico.vcf).
  // ACHTUNG: Nicht die persönlichen Nummern von Vadim und Nataliya eintragen;
  // diese gehören ausschließlich in den localStorage ihrer Geräte.
  BOOKING_PHONE: '+4915679017511'
};
