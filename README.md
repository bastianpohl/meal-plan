# 🗓️ Wochen-Essensplaner & Rezept-Portfolio (Apple-Style)

Ein hoch-interaktiver, modularer **Wochen-Essensplaner** und eine **Rezept-Bibliothek** im eleganten Apple/iOS-Design. Die Anwendung wurde vollständig auf **Vue 3** (Composition API) und **Vite** portiert, läuft mit einem schlanken **Express.js-Backend** und speichert Rezepte und Zuweisungen persistent in einer relationalen **SQLite-Datenbank**.

---

## ✨ Features & Highlights

### 🎨 Apple Design System & Haptik
* **Frosted Glass & HSL-Akzentfarben**: Edles Light/Dark-Theme (synchronisiert mit den Systemeinstellungen) mit weichen Grautönen, echten OLED-Kontrasten und transluzenten Hintergründen.
* **Ionicons (SF Symbols Look)**: Geometrisch präzise Outlines im minimalistischen iOS/macOS-Stil.
* **Taktiler Filmstreifen & Double-Buffer Caching**: Kontinuierliches, freies Wischen der Tage auf Touch-Displays mit Apple-typischem Snapping und 20-Tage preloading (absolut latenzfrei, ohne Spinner oder leere Platzhalter).

### 🔍 Spotlight-Suche & 3D Cover Flow Deck
* **Command+K Spotlight-Eingabe**: Drücken Sie jederzeit `⌘K` (Mac) oder `Strg+K` (Windows/Linux) für eine zentrierte, tief weichgezeichnete Spotlight-Suche.
* **Spotlight-to-Header Bogen-Animation**: Sobald Sie tippen, fliegt das Eingabefeld in einer geschmeidigen Bogen-Animation nach oben in den Header.
* **3D iTunes Cover Flow Carousel**: Die Suchergebnisse werden als prachtvolle, symmetrisch in 3D rotierte Polaroid-Karten im Verhältnis `1:1.2` präsentiert.
* **Interaktive Tag-Taxonomie**: Ein Klick auf ein limettenfarbenes Tag (z.B. `#schnell`) im gesamten System befüllt und startet die Suche sofort neu.

### 📅 Stufenlose rollierende Timeline (1–10 Tage View)
* **Variabler Scope**: Ändern Sie über ein edles Header-Dropdown stufenlos die Anzeige von 1 bis 10 Tagen.
* **Tagesbasiertes Sliden**: Die Navigations-Chevrons bewegen die Timeline stufenlos um genau einen Tag.
* **Dynamischer "Heute"-Button**: Erscheint reaktiv im Header, sobald der aktuelle Tag aus dem Viewport gescrollt wird, und setzt die Ausrichtung butterweich zurück.
* **Historischer Schreibschutz**: Tage in der Vergangenheit werden abgedunkelt dargestellt, wobei Drag-and-Drop, Platthalter-Knöpfe und Löschoptionen zum Schutz der Historie blockiert sind.

### 🍽️ Multi-Planning & Sortier-Haptik
* **Mehrfachbelegung**: Planen Sie beliebig viele Gerichte pro Mahlzeiten-Slot (Mittags / Abends) parallel ein (Dashed Hairline Listenstapel im Apple-Stil).
* **Chevron Reordering**: Hovern Sie eine Karte im Planer, um Pfeiltasten einzublenden und Gerichte flüssig innerhalb des Stacks zu sortieren. Die Sortierung wird in Echtzeit in der SQLite-Datenbank persistiert.
* **Kollabierbare Leer-Slots**: Leere Slots schrumpfen im Ruhezustand auf ultra-kompakte `38px` zusammen und expandieren beim Ziehen (`dragstart`) reaktiv auf `80px` für eine komfortable Trefferfläche.

### 🔒 Fehlerfreies Drag & Drop
* **Chromium Drag-Safe-Verhalten**: Um das berüchtigte Chrome-Drag-Cancellation-Problem zu umgehen, blendet sich die Suche beim Drag-Start über eine extrem feine `opacity: 0.01` aus. Das Suchoverlay ist somit für den Nutzer völlig unsichtbar und der Planer liegt kristallklar frei, während Chrome den Drag-Snapshot beibehält.
* **Polaroid-in-Thumbnail Transformation**: Beim Greifen schrumpft das wuchtige Polaroid geschmeidig auf eine kompakte `140px x 180px` große Thumbnail-Karte unter Ihrem Cursor.

---

## 🛠️ Tech Stack & Datenbank

* **Frontend**: Vue 3 (Composition API), Vite, Vanilla CSS.
* **Backend**: Node.js, Express.js, Multer (Bilder-Uploads).
* **Datenbank**: Relationales SQLite (`database.sqlite`).
  * Normalisierte Tabellenstruktur für Rezepte, Tags (`tags`), Zutaten (`ingredients`), Zuweisungen (`assignments`), Wochenpläne (`weekly_plans`) und Bilder (`recipe_images`).
  * Erste hochgeladene Bilder werden automatisch als Titelbild (`is_cover = 1`) definiert.

---

## 🚀 Installation & Start

### 1. Repository klonen & Abhängigkeiten installieren
```bash
git clone https://github.com/bastianpohl/meal-plan.git
cd meal-plan
npm install
```

### 2. Datenbank mit Demodaten initialisieren (Seeding)
```bash
node seed.js
```

### 3. Server starten (Frontend & Backend parallel)

**Backend-Server (Express API & SQLite auf Port 3000):**
```bash
npm run start
```

**Frontend-Server (Vite Dev Server auf Port 5173):**
```bash
npm run dev
```

*Der Vite-Entwicklungsserver proxy-t alle API- und Upload-Anfragen automatisch an den Port 3000.*

---

## 🧪 UI- & GUI-Tests
Das Projekt enthält automatisierte Puppeteer GUI-Tests zur Validierung der Core-Feature-Stabilität:
* `test-rolling-calendar.js`: Validiert das N-Tage Dropdown, stufenloses Sliden, den Heute-Button und den Schreibschutz der Vergangenheit.
* `test-search.js`: Prüft die Spotlight-Suchinteraktion und Tag-Wechsel.
* `test-drag-drop-from-search.js`: Simuliert die exakte HTML5 Drag-and-Drop-Eventkette vom Cover-Flow-Suchoverlay in die Planungs-Dropzone.

---

## 📜 Lizenz
Dieses Projekt ist lizenziert unter der MIT-Lizenz.
