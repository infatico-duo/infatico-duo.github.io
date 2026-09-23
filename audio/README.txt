AUDIO-PLATZHALTER / АУДИО-ПЛЕЙСХОЛДЕРЫ
=====================================

Hier die endgültigen Audiodateien ablegen / Положите сюда финальные аудиофайлы:

  track-1.mp3   -> Titel 1 / Трек 1
  track-2.mp3   -> Titel 2 / Трек 2
  track-3.mp3   -> Titel 3 / Трек 3

Empfohlen / Рекомендуется:
  - Format: MP3, 192-320 kbps, 44.1 kHz
  - Zusätzlich OGG oder M4A für breitere Browser-Unterstützung
  - Dauer der Ausschnitte: 60-120 Sekunden

Nach dem Ablegen der Dateien in index.html die <source>-Tags ergänzen:

  <audio controls preload="metadata">
    <source src="audio/track-1.mp3" type="audio/mpeg">
  </audio>

Cover-Bilder (optional) / Обложки (опционально):
  images/cover-1.svg, images/cover-2.svg, images/cover-3.svg
