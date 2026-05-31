import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../database.sqlite');
const uploadsDir = path.resolve(__dirname, '../uploads');

console.log('\x1b[33m%s\x1b[0m', 'Starte Zurücksetzen der Datenbank in den Auslieferungszustand...');

// 1. Lösche database.sqlite
if (fs.existsSync(dbPath)) {
  try {
    fs.unlinkSync(dbPath);
    console.log('\x1b[32m%s\x1b[0m', '✓ database.sqlite erfolgreich gelöscht.');
  } catch (err) {
    console.error('Fehler beim Löschen der database.sqlite:', err.message);
  }
} else {
  console.log('database.sqlite existiert nicht, kein Löschen nötig.');
}

// 2. Bereinige den uploads/ Ordner (außer .gitkeep falls vorhanden)
if (fs.existsSync(uploadsDir)) {
  try {
    const files = fs.readdirSync(uploadsDir);
    let clearedCount = 0;
    for (const file of files) {
      if (file !== '.gitkeep') {
        fs.unlinkSync(path.join(uploadsDir, file));
        clearedCount++;
      }
    }
    console.log('\x1b[32m%s\x1b[0m', `✓ uploads/ Ordner erfolgreich bereinigt (${clearedCount} Bilder gelöscht).`);
  } catch (err) {
    console.error('Fehler beim Bereinigen von uploads/:', err.message);
  }
} else {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('\x1b[32m%s\x1b[0m', '✓ uploads/ Ordner erstellt.');
  } catch (err) {
    console.error('Fehler beim Erstellen von uploads/:', err.message);
  }
}

// 3. Neue leere SQLite-Datenbank öffnen und Schema anlegen
console.log('Initialisiere frische Datenbank und erstelle Tabellen-Schemata...');
const db = new sqlite3.Database(dbPath, async (err) => {
  if (err) {
    console.error('Fehler beim Initialisieren der Datenbank:', err.message);
    process.exit(1);
  }

  const runQuery = (sql) => {
    return new Promise((resolve, reject) => {
      db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  try {
    await runQuery('PRAGMA foreign_keys = ON;');

    await runQuery(`
      CREATE TABLE recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        duration INTEGER,
        notes TEXT
      );
    `);

    await runQuery(`
      CREATE TABLE recipe_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER,
        image_path TEXT NOT NULL,
        is_cover INTEGER DEFAULT 0,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
      );
    `);

    await runQuery(`
      CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );
    `);

    await runQuery(`
      CREATE TABLE recipe_tags (
        recipe_id INTEGER,
        tag_id INTEGER,
        PRIMARY KEY (recipe_id, tag_id),
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
    `);

    await runQuery(`
      CREATE TABLE ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );
    `);

    await runQuery(`
      CREATE TABLE recipe_ingredients (
        recipe_id INTEGER,
        ingredient_id INTEGER,
        PRIMARY KEY (recipe_id, ingredient_id),
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
      );
    `);

    await runQuery(`
      CREATE TABLE weekly_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await runQuery(`
      CREATE TABLE plan_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER,
        day_of_week TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        recipe_id INTEGER,
        FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
      );
    `);

    console.log('\x1b[32m%s\x1b[0m', '✓ Datenbankschemata erfolgreich angelegt.');
    db.close();

    // Jetzt seeden!
    console.log('Starte Seeding-Prozess...');
    import('../seed.js');
  } catch (error) {
    console.error('Fehler bei der Tabelleninitialisierung:', error.message);
    db.close();
  }
});
