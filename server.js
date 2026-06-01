import express from 'express';
import sqlite3 from 'sqlite3';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import BringApi from 'bring-shopping';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploads folder statically
app.use('/uploads', express.static(uploadsDir));

// Multer storage setup for recipe images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Nur Bilder (jpeg, jpg, png, webp, gif) sind erlaubt!'));
  }
});

// SQLite DB initialization
const dbPath = path.join(__dirname, 'database.sqlite');
const dbExists = fs.existsSync(dbPath);
if (!dbExists) {
  console.log('Datenbankdatei "database.sqlite" nicht gefunden. Eine neue SQLite-Datenbank wird erstellt und das Schema initialisiert...');
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Fehler beim Öffnen der SQLite-Datenbank:', err.message);
  } else {
    console.log('Erfolgreich mit SQLite-Datenbank verbunden.');
    initDb();
  }
});

// Promise wrappers for SQLite
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const getSetting = async (key) => {
  const row = await dbGet('SELECT value FROM app_settings WHERE key = ?', [key]);
  return row ? row.value : null;
};

const setSetting = async (key, value) => {
  await dbRun('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [key, value]);
};

// Database Schema creation & Self-Seeding
async function initDb() {
  await dbRun('PRAGMA foreign_keys = ON;');

  // Recipes Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      duration INTEGER,
      notes TEXT
    );
  `);

  // Auto-migration to remove category column from older databases
  try {
    await dbRun('ALTER TABLE recipes DROP COLUMN category;');
    console.log('Datenbank-Migration: Spalte "category" wurde erfolgreich aus Tabelle "recipes" entfernt.');
  } catch (err) {
    // Fehler wird ignoriert, wenn die Spalte bereits nicht mehr existiert
  }

  // Images Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS recipe_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER,
      image_path TEXT NOT NULL,
      is_cover INTEGER DEFAULT 0,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );
  `);

  // Tags Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
  `);

  // Recipe Tags Mapping
  await dbRun(`
    CREATE TABLE IF NOT EXISTS recipe_tags (
      recipe_id INTEGER,
      tag_id INTEGER,
      PRIMARY KEY (recipe_id, tag_id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
  `);

  // Ingredients Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
  `);

  // Recipe Ingredients Mapping
  await dbRun(`
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      recipe_id INTEGER,
      ingredient_id INTEGER,
      PRIMARY KEY (recipe_id, ingredient_id),
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
    );
  `);

  // Weekly Plans Table (with start_date)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS weekly_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Plan Assignments Table (with meal_type and sort_order)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS plan_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER,
      day_of_week TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      recipe_id INTEGER,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    );
  `);

  // Auto-migration to add sort_order column to plan_assignments if missing from older databases
  try {
    await dbRun('ALTER TABLE plan_assignments ADD COLUMN sort_order INTEGER DEFAULT 0;');
    console.log('Datenbank-Migration: Spalte "sort_order" wurde erfolgreich zu "plan_assignments" hinzugefügt.');
  } catch (err) {
    // Fehler wird ignoriert, wenn die Spalte bereits existiert
  }

  // Assignment Ingredients Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS assignment_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      checked INTEGER DEFAULT 0,
      FOREIGN KEY (assignment_id) REFERENCES plan_assignments(id) ON DELETE CASCADE
    );
  `);

  // App Settings Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Link Previews Cache Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS link_previews (
      url TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      image TEXT,
      site_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Datenbanktabellen initialisiert.');
  
  // Trigger self-seeding if database is completely empty
  await seedDatabaseIfEmpty();
}

// -------------------------------------------------------------
// SELF SEEDING LOGIC
// -------------------------------------------------------------
async function seedDatabaseIfEmpty() {
  try {
    const recCount = await dbGet('SELECT COUNT(*) as count FROM recipes');
    if (recCount.count > 0) {
      console.log('Datenbank bereits mit Rezepten befüllt. Seeding übersprungen.');
      return;
    }

    console.log('Führe automatisches Seeding der Datenbank aus...');

    // Starter Recipes
    const seedRecipes = [
      {
        title: 'Cremige Spaghetti Carbonara',
        duration: 20,
        notes: 'Original römisches Rezept mit Guanciale (oder Pancetta), Eigelb und feinstem Pecorino Romano. Keine Sahne verwenden!',
        tags: ['schnell', 'italienisch', 'klassiker'],
        ingredients: ['Spaghetti', 'Guanciale', 'Pecorino Romano', 'Eigelb', 'Schwarzer Pfeffer']
      },
      {
        title: 'Lachs-Spinat-Pfanne mit Zitrone',
        duration: 25,
        notes: 'Eine leckere und cremige Pfanne mit frischem Lachsfilet und Spinat in einer leichten Weißwein-Sahne-Sauce.',
        tags: ['lowcarb', 'gesund', 'schnell'],
        ingredients: ['Lachsfilet', 'Blattspinat', 'Sahne', 'Weißwein', 'Knoblauch', 'Zitrone']
      },
      {
        title: 'Zarter Rinderbraten in Rotweinsauce',
        duration: 120,
        notes: 'Langsam geschmorter Rinderbraten mit Wurzelgemüse und einer kräftigen Rotweinsauce. Perfekt für das Sonntagsessen.',
        tags: ['sonntag', 'klassiker', 'deftig'],
        ingredients: ['Rindfleisch (Schmorbraten)', 'Karotten', 'Sellerie', 'Zwiebeln', 'Rotwein', 'Rinderfond', 'Lorbeerblätter']
      },
      {
        title: 'Frischer Avocado-Mango Salat',
        duration: 15,
        notes: 'Ein fruchtig-frischer Sommersalat mit reifer Mango, cremiger Avocado und knackigem Rucola, verfeinert mit Limetten-Dressing.',
        tags: ['frisch', 'sommer', 'vegan', 'veggie'],
        ingredients: ['Avocado', 'Mango', 'Rucola', 'Limette', 'Olivenöl', 'Koriander', 'Kirschtomaten']
      }
    ];

    for (const r of seedRecipes) {
      const res = await dbRun(
        'INSERT INTO recipes (title, duration, notes) VALUES (?, ?, ?)',
        [r.title, r.duration, r.notes]
      );
      const recipeId = res.lastID;

      // Handle tags
      for (const tag of r.tags) {
        let t = await dbGet('SELECT id FROM tags WHERE name = ?', [tag]);
        let tagId;
        if (!t) {
          const tRes = await dbRun('INSERT INTO tags (name) VALUES (?)', [tag]);
          tagId = tRes.lastID;
        } else {
          tagId = t.id;
        }
        await dbRun('INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)', [recipeId, tagId]);
      }

      // Handle ingredients
      for (const ing of r.ingredients) {
        let i = await dbGet('SELECT id FROM ingredients WHERE name = ?', [ing]);
        let ingId;
        if (!i) {
          const iRes = await dbRun('INSERT INTO ingredients (name) VALUES (?)', [ing]);
          ingId = iRes.lastID;
        } else {
          ingId = i.id;
        }
        await dbRun('INSERT OR IGNORE INTO recipe_ingredients (recipe_id, ingredient_id) VALUES (?, ?)', [recipeId, ingId]);
      }
      console.log(`Rezept geseedet: ${r.title}`);
    }

    // Create a default weekly plan for the current week
    const now = new Date();
    const monday = getMonday(now);
    const formattedMonday = monday.toISOString().split('T')[0];
    const kw = getCalenderWeekNumber(now);

    await dbRun(
      'INSERT INTO weekly_plans (name, start_date) VALUES (?, ?)',
      [`KW ${kw}`, formattedMonday]
    );
    console.log(`Wochenplan geseedet: KW ${kw} (${formattedMonday})`);

  } catch (error) {
    console.error('Fehler beim Seeding:', error);
  }
}

// Seeding helpers
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getCalenderWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

// -------------------------------------------------------------
// RECIPE ENDPOINTS
// -------------------------------------------------------------

// Helper: Populate recipe detailed fields
async function populateRecipeDetails(recipesList) {
  const result = [];
  for (const r of recipesList) {
    const images = await dbAll('SELECT id, image_path, is_cover FROM recipe_images WHERE recipe_id = ?', [r.id]);
    const tags = await dbAll(`
      SELECT t.name FROM tags t 
      JOIN recipe_tags rt ON t.id = rt.tag_id 
      WHERE rt.recipe_id = ?
    `, [r.id]);
    const ingredients = await dbAll(`
      SELECT i.name FROM ingredients i 
      JOIN recipe_ingredients ri ON i.id = ri.ingredient_id 
      WHERE ri.recipe_id = ?
      ORDER BY i.name COLLATE NOCASE ASC
    `, [r.id]);

    const coverImg = images.find(img => img.is_cover === 1) || images[0];

    result.push({
      ...r,
      images,
      cover_image: coverImg ? coverImg.image_path : null,
      tags: tags.map(t => t.name),
      ingredients: ingredients.map(i => i.name)
    });
  }
  return result;
}

// GET all recipes (with query-search)
app.get('/api/recipes', async (req, res) => {
  try {
    const queryStr = req.query.q || '';
    if (!queryStr.trim()) {
      const basicRecipes = await dbAll('SELECT * FROM recipes ORDER BY id DESC');
      const fullRecipes = await populateRecipeDetails(basicRecipes);
      return res.json(fullRecipes);
    }

    const tokens = queryStr.split(/\s+/).filter(Boolean);
    const tagFilters = [];
    const textFilters = [];

    for (const token of tokens) {
      if (token.startsWith('#')) {
        const tag = token.slice(1).trim();
        if (tag) tagFilters.push(tag);
      } else {
        textFilters.push(token);
      }
    }

    let sql = 'SELECT DISTINCT r.* FROM recipes r';
    const params = [];
    const conditions = [];

    if (tagFilters.length > 0) {
      const tagPlaceholders = tagFilters.map(() => '?').join(',');
      conditions.push(`r.id IN (
        SELECT rt.recipe_id FROM recipe_tags rt
        JOIN tags t ON rt.tag_id = t.id
        WHERE t.name IN (${tagPlaceholders})
        GROUP BY rt.recipe_id
        HAVING COUNT(DISTINCT t.name) = ?
      )`);
      params.push(...tagFilters, tagFilters.length);
    }

    if (textFilters.length > 0) {
      const textConditions = [];
      for (const filter of textFilters) {
        const p = `%${filter}%`;
        textConditions.push(`(
          r.title LIKE ? OR 
          r.id IN (
            SELECT ri.recipe_id FROM recipe_ingredients ri
            JOIN ingredients i ON ri.ingredient_id = i.id
            WHERE i.name LIKE ?
          ) OR
          r.id IN (
            SELECT rt.recipe_id FROM recipe_tags rt
            JOIN tags t ON rt.tag_id = t.id
            WHERE t.name LIKE ?
          )
        )`);
        params.push(p, p, p);
      }
      conditions.push(textConditions.join(' AND '));
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY r.id DESC';

    const basicRecipes = await dbAll(sql, params);
    const fullRecipes = await populateRecipeDetails(basicRecipes);
    res.json(fullRecipes);
  } catch (error) {
    console.error('Fehler bei GET /api/recipes:', error);
    res.status(500).json({ error: 'Serverfehler bei der Rezeptsuche' });
  }
});

// GET single recipe
app.get('/api/recipes/:id', async (req, res) => {
  try {
    const r = await dbGet('SELECT * FROM recipes WHERE id = ?', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Rezept nicht gefunden' });
    const full = await populateRecipeDetails([r]);
    res.json(full[0]);
  } catch (error) {
    res.status(500).json({ error: 'Serverfehler bei Rezeptabfrage' });
  }
});

// POST Create recipe
app.post('/api/recipes', upload.array('images', 20), async (req, res) => {
  try {
    const { title, duration, notes, tags, ingredients } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Ein Rezept-Titel ist erforderlich!' });
    }

    const result = await dbRun(
      'INSERT INTO recipes (title, duration, notes) VALUES (?, ?, ?)',
      [title.trim(), duration ? parseInt(duration) : null, notes || null]
    );
    const recipeId = result.lastID;

    // Handle Uploaded Images
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const imagePath = `uploads/${req.files[i].filename}`;
        const isCover = i === 0 ? 1 : 0;
        await dbRun(
          'INSERT INTO recipe_images (recipe_id, image_path, is_cover) VALUES (?, ?, ?)',
          [recipeId, imagePath, isCover]
        );
      }
    }

    // Handle Tags
    if (tags) {
      const tagList = (Array.isArray(tags) ? tags : tags.split(/[,\s]+/))
        .map(t => t.replace('#', '').trim())
        .filter(Boolean);

      for (const tagName of tagList) {
        let tag = await dbGet('SELECT id FROM tags WHERE name = ?', [tagName]);
        let tagId;
        if (!tag) {
          const tRes = await dbRun('INSERT INTO tags (name) VALUES (?)', [tagName]);
          tagId = tRes.lastID;
        } else {
          tagId = tag.id;
        }
        await dbRun('INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)', [recipeId, tagId]);
      }
    }

    // Handle Ingredients
    if (ingredients) {
      let ingList = [];
      try {
        ingList = JSON.parse(ingredients);
      } catch (e) {
        ingList = ingredients.split('\n').map(i => i.trim()).filter(Boolean);
      }

      if (Array.isArray(ingList)) {
        for (const ingName of ingList) {
          const nameTrim = ingName.trim();
          if (!nameTrim) continue;
          let ing = await dbGet('SELECT id FROM ingredients WHERE name = ?', [nameTrim]);
          let ingId;
          if (!ing) {
            const iRes = await dbRun('INSERT INTO ingredients (name) VALUES (?)', [nameTrim]);
            ingId = iRes.lastID;
          } else {
            ingId = ing.id;
          }
          await dbRun('INSERT OR IGNORE INTO recipe_ingredients (recipe_id, ingredient_id) VALUES (?, ?)', [recipeId, ingId]);
        }
      }
    }

    const created = await dbGet('SELECT * FROM recipes WHERE id = ?', [recipeId]);
    const full = await populateRecipeDetails([created]);
    res.status(201).json(full[0]);
  } catch (error) {
    console.error('Fehler bei POST /api/recipes:', error);
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Rezepts' });
  }
});

// PUT Update recipe details
app.put('/api/recipes/:id', async (req, res) => {
  try {
    const { title, duration, notes, tags, ingredients } = req.body;
    const recipeId = req.params.id;

    const r = await dbGet('SELECT id FROM recipes WHERE id = ?', [recipeId]);
    if (!r) return res.status(404).json({ error: 'Rezept nicht gefunden' });

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Titel ist erforderlich' });
    }

    await dbRun(
      'UPDATE recipes SET title = ?, duration = ?, notes = ? WHERE id = ?',
      [title.trim(), duration ? parseInt(duration) : null, notes || null, recipeId]
    );

    // Re-handle Tags
    await dbRun('DELETE FROM recipe_tags WHERE recipe_id = ?', [recipeId]);
    if (tags) {
      const tagList = (Array.isArray(tags) ? tags : tags.split(/[,\s]+/))
        .map(t => t.replace('#', '').trim())
        .filter(Boolean);

      for (const tagName of tagList) {
        let tag = await dbGet('SELECT id FROM tags WHERE name = ?', [tagName]);
        let tagId;
        if (!tag) {
          const tRes = await dbRun('INSERT INTO tags (name) VALUES (?)', [tagName]);
          tagId = tRes.lastID;
        } else {
          tagId = tag.id;
        }
        await dbRun('INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)', [recipeId, tagId]);
      }
    }

    // Re-handle Ingredients
    await dbRun('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);
    if (ingredients) {
      let ingList = [];
      try {
        ingList = Array.isArray(ingredients) ? ingredients : JSON.parse(ingredients);
      } catch (e) {
        ingList = ingredients.split('\n').map(i => i.trim()).filter(Boolean);
      }

      for (const ingName of ingList) {
        const nameTrim = ingName.trim();
        if (!nameTrim) continue;
        let ing = await dbGet('SELECT id FROM ingredients WHERE name = ?', [nameTrim]);
        let ingId;
        if (!ing) {
          const iRes = await dbRun('INSERT INTO ingredients (name) VALUES (?)', [nameTrim]);
          ingId = iRes.lastID;
        } else {
          ingId = ing.id;
        }
        await dbRun('INSERT OR IGNORE INTO recipe_ingredients (recipe_id, ingredient_id) VALUES (?, ?)', [recipeId, ingId]);
      }
    }

    const updated = await dbGet('SELECT * FROM recipes WHERE id = ?', [recipeId]);
    const full = await populateRecipeDetails([updated]);
    res.json(full[0]);
  } catch (error) {
    console.error('Fehler bei PUT /api/recipes:', error);
    res.status(500).json({ error: 'Serverfehler beim Bearbeiten des Rezepts' });
  }
});

// DELETE Recipe
app.delete('/api/recipes/:id', async (req, res) => {
  try {
    const recipeId = req.params.id;
    const r = await dbGet('SELECT id FROM recipes WHERE id = ?', [recipeId]);
    if (!r) return res.status(404).json({ error: 'Rezept nicht gefunden' });

    const images = await dbAll('SELECT image_path FROM recipe_images WHERE recipe_id = ?', [recipeId]);

    // DB deletion (triggers cascade)
    await dbRun('DELETE FROM recipe_images WHERE recipe_id = ?', [recipeId]);
    await dbRun('DELETE FROM recipe_tags WHERE recipe_id = ?', [recipeId]);
    await dbRun('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);
    await dbRun('DELETE FROM plan_assignments WHERE recipe_id = ?', [recipeId]);
    await dbRun('DELETE FROM recipes WHERE id = ?', [recipeId]);

    // Physical deletion
    for (const img of images) {
      const fullPath = path.join(__dirname, img.image_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    res.json({ message: 'Rezept erfolgreich gelöscht' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Serverfehler beim Löschen des Rezepts' });
  }
});

// -------------------------------------------------------------
// IMAGE ENDPOINTS
// -------------------------------------------------------------
app.post('/api/recipes/:id/images', upload.array('images', 20), async (req, res) => {
  try {
    const recipeId = req.params.id;
    const r = await dbGet('SELECT id FROM recipes WHERE id = ?', [recipeId]);
    if (!r) return res.status(404).json({ error: 'Rezept nicht gefunden' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Keine Bilder übergeben' });
    }

    const existingCover = await dbGet('SELECT id FROM recipe_images WHERE recipe_id = ? AND is_cover = 1', [recipeId]);

    for (let i = 0; i < req.files.length; i++) {
      const imagePath = `uploads/${req.files[i].filename}`;
      const isCover = (!existingCover && i === 0) ? 1 : 0;
      await dbRun(
        'INSERT INTO recipe_images (recipe_id, image_path, is_cover) VALUES (?, ?, ?)',
        [recipeId, imagePath, isCover]
      );
    }

    const updated = await dbGet('SELECT * FROM recipes WHERE id = ?', [recipeId]);
    const full = await populateRecipeDetails([updated]);
    res.json(full[0]);
  } catch (error) {
    res.status(500).json({ error: 'Serverfehler beim Bilder-Upload' });
  }
});

app.put('/api/recipes/:id/images/:imageId/cover', async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const img = await dbGet('SELECT id FROM recipe_images WHERE id = ? AND recipe_id = ?', [imageId, id]);
    if (!img) return res.status(404).json({ error: 'Bild existiert nicht' });

    await dbRun('UPDATE recipe_images SET is_cover = 0 WHERE recipe_id = ?', [id]);
    await dbRun('UPDATE recipe_images SET is_cover = 1 WHERE id = ?', [imageId]);

    const updated = await dbGet('SELECT * FROM recipes WHERE id = ?', [id]);
    const full = await populateRecipeDetails([updated]);
    res.json(full[0]);
  } catch (error) {
    res.status(500).json({ error: 'Serverfehler bei Titelbildänderung' });
  }
});

app.delete('/api/recipes/:id/images/:imageId', async (req, res) => {
  try {
    const { id, imageId } = req.params;
    const img = await dbGet('SELECT * FROM recipe_images WHERE id = ? AND recipe_id = ?', [imageId, id]);
    if (!img) return res.status(404).json({ error: 'Bild nicht gefunden' });

    await dbRun('DELETE FROM recipe_images WHERE id = ?', [imageId]);

    const fullPath = path.join(__dirname, img.image_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    if (img.is_cover === 1) {
      const remainingImg = await dbGet('SELECT id FROM recipe_images WHERE recipe_id = ? ORDER BY id ASC LIMIT 1', [id]);
      if (remainingImg) {
        await dbRun('UPDATE recipe_images SET is_cover = 1 WHERE id = ?', [remainingImg.id]);
      }
    }

    const updated = await dbGet('SELECT * FROM recipes WHERE id = ?', [id]);
    const full = await populateRecipeDetails([updated]);
    res.json(full[0]);
  } catch (error) {
    res.status(500).json({ error: 'Serverfehler beim Bildlöschen' });
  }
});

// -------------------------------------------------------------
// PLAN ENDPOINTS
// -------------------------------------------------------------
app.get('/api/plans', async (req, res) => {
  try {
    const plans = await dbAll('SELECT * FROM weekly_plans ORDER BY start_date DESC');
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/plans', async (req, res) => {
  try {
    const { name, start_date } = req.body;
    if (!name || !name.trim() || !start_date) {
      return res.status(400).json({ error: 'Name und Startdatum (Montag) sind Pflichtfelder!' });
    }
    
    // Enforce check: is start_date unique? E.g. avoid duplicate plans for the exact same week
    const existing = await dbGet('SELECT id FROM weekly_plans WHERE start_date = ?', [start_date]);
    if (existing) {
      return res.status(400).json({ error: 'Für diese Woche existiert bereits ein Wochenplan!' });
    }

    const result = await dbRun('INSERT INTO weekly_plans (name, start_date) VALUES (?, ?)', [name.trim(), start_date]);
    const newPlan = await dbGet('SELECT * FROM weekly_plans WHERE id = ?', [result.lastID]);
    res.status(201).json(newPlan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Serverfehler beim Erstellen' });
  }
});

app.get('/api/plans/:id', async (req, res) => {
  try {
    const planId = req.params.id;
    const plan = await dbGet('SELECT * FROM weekly_plans WHERE id = ?', [planId]);
    if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });

    const assignments = await dbAll('SELECT id, day_of_week, meal_type, recipe_id, sort_order FROM plan_assignments WHERE plan_id = ? ORDER BY sort_order ASC', [planId]);

    const populated = [];
    for (const asg of assignments) {
      const recipe = await dbGet('SELECT id, title FROM recipes WHERE id = ?', [asg.recipe_id]);
      if (recipe) {
        const coverImg = await dbGet('SELECT image_path FROM recipe_images WHERE recipe_id = ? AND is_cover = 1', [recipe.id]);
        populated.push({
          id: asg.id,
          day_of_week: asg.day_of_week,
          meal_type: asg.meal_type,
          recipe: {
            ...recipe,
            cover_image: coverImg ? coverImg.image_path : null
          }
        });
      }
    }

    res.json({
      ...plan,
      assignments: populated
    });
  } catch (error) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// Update assignments (accepts meal_type and maintains assignment stability)
app.put('/api/plans/:id/assignments', async (req, res) => {
  try {
    const planId = req.params.id;
    const { assignments } = req.body; // Array of { id, day_of_week, meal_type, recipe_id }

    const plan = await dbGet('SELECT id FROM weekly_plans WHERE id = ?', [planId]);
    if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });

    if (!Array.isArray(assignments)) {
      return res.status(400).json({ error: 'Ungültiges Assignments-Format' });
    }

    // Incremental Update to keep existing assignment IDs
    const existingAsgs = await dbAll('SELECT id FROM plan_assignments WHERE plan_id = ?', [planId]);
    const existingIds = existingAsgs.map(a => a.id);
    const incomingIds = assignments.map(a => a.id).filter(id => id != null);

    // Delete assignments no longer present in incoming list
    const deleteIds = existingIds.filter(id => !incomingIds.includes(id));
    if (deleteIds.length > 0) {
      const placeholders = deleteIds.map(() => '?').join(',');
      await dbRun(`DELETE FROM plan_assignments WHERE id IN (${placeholders})`, deleteIds);
    }

    // Insert or update assignments with sort_order
    for (let index = 0; index < assignments.length; index++) {
      const asg = assignments[index];
      const { id, day_of_week, meal_type, recipe_id } = asg;
      if (!day_of_week || !meal_type || !recipe_id) continue;

      if (id && existingIds.includes(id)) {
        // Update existing assignment
        await dbRun(
          'UPDATE plan_assignments SET day_of_week = ?, meal_type = ?, recipe_id = ?, sort_order = ? WHERE id = ?',
          [day_of_week, meal_type, recipe_id, index, id]
        );
      } else {
        // Insert new assignment
        await dbRun(
          'INSERT INTO plan_assignments (plan_id, day_of_week, meal_type, recipe_id, sort_order) VALUES (?, ?, ?, ?, ?)',
          [planId, day_of_week, meal_type, recipe_id, index]
        );
      }
    }

    // Return populated plan (ordered by sort_order)
    const updatedPlan = await dbGet('SELECT * FROM weekly_plans WHERE id = ?', [planId]);
    const finalAssignments = await dbAll('SELECT id, day_of_week, meal_type, recipe_id, sort_order FROM plan_assignments WHERE plan_id = ? ORDER BY sort_order ASC', [planId]);
    
    const populated = [];
    for (const asg of finalAssignments) {
      const recipe = await dbGet('SELECT id, title FROM recipes WHERE id = ?', [asg.recipe_id]);
      if (recipe) {
        const coverImg = await dbGet('SELECT image_path FROM recipe_images WHERE recipe_id = ? AND is_cover = 1', [recipe.id]);
        populated.push({
          id: asg.id,
          day_of_week: asg.day_of_week,
          meal_type: asg.meal_type,
          recipe: {
            ...recipe,
            cover_image: coverImg ? coverImg.image_path : null
          }
        });
      }
    }

    res.json({
      ...updatedPlan,
      assignments: populated
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.delete('/api/plans/:id', async (req, res) => {
  try {
    const planId = req.params.id;
    const plan = await dbGet('SELECT id FROM weekly_plans WHERE id = ?', [planId]);
    if (!plan) return res.status(404).json({ error: 'Plan nicht gefunden' });

    await dbRun('DELETE FROM plan_assignments WHERE plan_id = ?', [planId]);
    await dbRun('DELETE FROM weekly_plans WHERE id = ?', [planId]);

    res.json({ message: 'Plan erfolgreich gelöscht' });
  } catch (error) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET custom ingredients for plan assignment
app.get('/api/assignments/:id/ingredients', async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const asg = await dbGet('SELECT * FROM plan_assignments WHERE id = ?', [assignmentId]);
    if (!asg) return res.status(404).json({ error: 'Zuweisung nicht gefunden' });

    // Check if assignment has custom ingredients
    const customIngs = await dbAll('SELECT id, name, checked FROM assignment_ingredients WHERE assignment_id = ? ORDER BY name COLLATE NOCASE ASC', [assignmentId]);

    if (customIngs.length > 0) {
      return res.json({
        isCustom: true,
        ingredients: customIngs.map(i => ({ id: i.id, name: i.name, checked: i.checked === 1 }))
      });
    }

    // Fallback: Fetch recipe standard ingredients
    const recipeIngs = await dbAll(`
      SELECT i.name FROM ingredients i 
      JOIN recipe_ingredients ri ON i.id = ri.ingredient_id 
      WHERE ri.recipe_id = ?
      ORDER BY i.name COLLATE NOCASE ASC
    `, [asg.recipe_id]);

    res.json({
      isCustom: false,
      ingredients: recipeIngs.map((i, idx) => ({ id: null, name: i.name, checked: false }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Zutaten' });
  }
});

// GET shopping list (aggregated ingredients for N days)
app.get('/api/shopping-list', async (req, res) => {
  try {
    const startDateStr = req.query.startDate;
    const daysCount = parseInt(req.query.days, 10) || 7;

    if (!startDateStr) {
      return res.status(400).json({ error: 'startDate ist erforderlich (Format: YYYY-MM-DD)' });
    }

    if (isNaN(daysCount) || daysCount < 1 || daysCount > 10) {
      return res.status(400).json({ error: 'days muss zwischen 1 und 10 liegen' });
    }

    const parts = startDateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const dayVal = parseInt(parts[2], 10);
    const start = new Date(year, month, dayVal);

    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Ungültiges startDate' });
    }

    const EnglishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Helper to get ISO date string YYYY-MM-DD
    const formatISO = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Helper to get Monday of the week
    const getMondayOfDate = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(d.setDate(diff));
    };

    const ingredientCounts = {}; // lowercase_name -> { name, count }

    // Loop through N days
    for (let i = 0; i < daysCount; i++) {
      const current = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);

      const mondayStr = formatISO(getMondayOfDate(current));
      const dayOfWeekKey = EnglishDays[current.getDay()];

      // Find plan for this week
      const plan = await dbGet('SELECT id FROM weekly_plans WHERE start_date = ?', [mondayStr]);
      if (plan) {
        // Find assignments for this day
        const assignments = await dbAll(
          'SELECT id, recipe_id FROM plan_assignments WHERE plan_id = ? AND day_of_week = ?',
          [plan.id, dayOfWeekKey]
        );

        for (const asg of assignments) {
          // Check if custom ingredients exist
          const customIngs = await dbAll(
            'SELECT name FROM assignment_ingredients WHERE assignment_id = ?',
            [asg.id]
          );

          let ings = [];
          if (customIngs.length > 0) {
            ings = customIngs.map(ci => ci.name);
          } else {
            // Get standard ingredients
            const standardIngs = await dbAll(`
              SELECT i.name FROM ingredients i
              JOIN recipe_ingredients ri ON i.id = ri.ingredient_id
              WHERE ri.recipe_id = ?
            `, [asg.recipe_id]);
            ings = standardIngs.map(si => si.name);
          }

          // Aggregate ingredients
          for (const name of ings) {
            const trimmed = name.trim();
            if (!trimmed) continue;
            const lower = trimmed.toLowerCase();
            if (ingredientCounts[lower]) {
              ingredientCounts[lower].count += 1;
            } else {
              ingredientCounts[lower] = {
                name: trimmed, // keep original casing
                count: 1
              };
            }
          }
        }
      }
    }

    // Convert to sorted array
    const result = Object.values(ingredientCounts).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );

    res.json(result);
  } catch (error) {
    console.error('Fehler bei Einkaufsliste:', error);
    res.status(500).json({ error: 'Serverfehler beim Erstellen der Einkaufsliste' });
  }
});

// GET Bring! settings
app.get('/api/settings/bring', async (req, res) => {
  try {
    const email = await getSetting('bring_email') || '';
    const listUuid = await getSetting('bring_list_uuid') || '';
    const listName = await getSetting('bring_list_name') || '';
    const password = await getSetting('bring_password');
    res.json({
      email,
      listUuid,
      listName,
      hasPassword: !!password
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Bring-Einstellungen' });
  }
});

// POST Save Bring! settings
app.post('/api/settings/bring', async (req, res) => {
  try {
    const { email, password, listUuid, listName } = req.body;
    if (email !== undefined) await setSetting('bring_email', email.trim());
    if (password !== undefined && password.trim() !== '') {
      await setSetting('bring_password', password.trim());
    }
    if (listUuid !== undefined) await setSetting('bring_list_uuid', listUuid.trim());
    if (listName !== undefined) await setSetting('bring_list_name', listName.trim());

    res.json({ message: 'Bring-Einstellungen erfolgreich gespeichert' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Serverfehler beim Speichern der Bring-Einstellungen' });
  }
});

// GET Unsplash settings
app.get('/api/settings/unsplash', async (req, res) => {
  try {
    const key = await getSetting('unsplash_access_key') || '';
    res.json({ unsplashAccessKey: key, isConfigured: !!key });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Unsplash-Einstellungen' });
  }
});

// POST Save Unsplash settings
app.post('/api/settings/unsplash', async (req, res) => {
  try {
    const { unsplashAccessKey } = req.body;
    if (unsplashAccessKey !== undefined) {
      await setSetting('unsplash_access_key', unsplashAccessKey.trim());
    }
    res.json({ message: 'Unsplash-Einstellungen erfolgreich gespeichert' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Serverfehler beim Speichern der Unsplash-Einstellungen' });
  }
});

// POST Test Bring! connection & Load Lists
app.post('/api/settings/bring/test', async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email) email = await getSetting('bring_email');
    if (!password) password = await getSetting('bring_password');

    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich' });
    }

    const bring = new BringApi({ mail: email, password: password });
    await bring.login();
    const listsResponse = await bring.loadLists();

    res.json({
      success: true,
      message: `Erfolgreich verbunden als ${bring.name || email}`,
      lists: listsResponse.lists || []
    });
  } catch (error) {
    console.error('Bring Connection Test Fehler:', error);
    res.status(400).json({ error: `Verbindung fehlgeschlagen: ${error.message || error}` });
  }
});

// GET active Bring! list items
app.get('/api/settings/bring/items', async (req, res) => {
  try {
    const email = await getSetting('bring_email');
    const password = await getSetting('bring_password');
    const listUuid = await getSetting('bring_list_uuid');

    if (!email || !password || !listUuid) {
      return res.json({ configured: false, items: [] });
    }

    const bring = new BringApi({ mail: email, password: password });
    await bring.login();
    const listData = await bring.getItems(listUuid);

    const activeItems = (listData.purchase || []).map(item => ({
      name: item.name,
      specification: item.specification || ''
    }));

    res.json({
      configured: true,
      items: activeItems
    });
  } catch (error) {
    console.error('Bring GetItems Fehler:', error);
    res.status(500).json({ error: `Fehler beim Laden der Bring!-Einträge: ${error.message || error}` });
  }
});

// POST Export shopping list items to Bring!
app.post('/api/shopping-list/export', async (req, res) => {
  try {
    const { ingredients } = req.body;
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Keine Zutaten zum Exportieren angegeben' });
    }

    const email = await getSetting('bring_email');
    const password = await getSetting('bring_password');
    const listUuid = await getSetting('bring_list_uuid');

    if (!email || !password || !listUuid) {
      return res.status(400).json({ error: 'Bring! ist nicht oder unvollständig konfiguriert. Bitte überprüfe die Einstellungen.' });
    }

    const bring = new BringApi({ mail: email, password: password });
    await bring.login();

    // Export each item, respecting specification details
    for (const ing of ingredients) {
      if (typeof ing === 'object' && ing !== null) {
        const name = ing.name;
        const spec = ing.specification || '';
        await bring.saveItem(listUuid, name, spec);
      } else {
        await bring.saveItem(listUuid, ing, '');
      }
    }

    res.json({ success: true, message: `${ingredients.length} Zutat(en) erfolgreich an Bring! übertragen.` });
  } catch (error) {
    console.error('Bring Export Fehler:', error);
    res.status(500).json({ error: `Export an Bring! fehlgeschlagen: ${error.message || error}` });
  }
});

// PUT custom ingredients for plan assignment
app.put('/api/assignments/:id/ingredients', async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { ingredients } = req.body; // Array of { name, checked }
    const asg = await dbGet('SELECT id FROM plan_assignments WHERE id = ?', [assignmentId]);
    if (!asg) return res.status(404).json({ error: 'Zuweisung nicht gefunden' });

    if (!Array.isArray(ingredients)) {
      return res.status(400).json({ error: 'Ungültiges Zutaten-Format' });
    }

    // Delete existing custom ingredients
    await dbRun('DELETE FROM assignment_ingredients WHERE assignment_id = ?', [assignmentId]);

    // Insert new custom ingredients
    for (const ing of ingredients) {
      const nameTrim = ing.name ? ing.name.trim() : '';
      if (!nameTrim) continue;
      await dbRun(
        'INSERT INTO assignment_ingredients (assignment_id, name, checked) VALUES (?, ?, ?)',
        [assignmentId, nameTrim, ing.checked ? 1 : 0]
      );
    }

    const saved = await dbAll('SELECT id, name, checked FROM assignment_ingredients WHERE assignment_id = ? ORDER BY name COLLATE NOCASE ASC', [assignmentId]);
    res.json({
      isCustom: true,
      ingredients: saved.map(i => ({ id: i.id, name: i.name, checked: i.checked === 1 }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Serverfehler beim Speichern der Zutaten' });
  }
});

// DELETE custom ingredients for plan assignment (reset to defaults)
app.delete('/api/assignments/:id/ingredients', async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const asg = await dbGet('SELECT id FROM plan_assignments WHERE id = ?', [assignmentId]);
    if (!asg) return res.status(404).json({ error: 'Zuweisung nicht gefunden' });

    await dbRun('DELETE FROM assignment_ingredients WHERE assignment_id = ?', [assignmentId]);
    res.json({ message: 'Zutaten erfolgreich auf Standard zurückgesetzt' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Serverfehler beim Zurücksetzen der Zutaten' });
  }
});

// Helper functions for metadata parsing
function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&ouml;/g, 'ö')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&auml;/g, 'ä')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&uuml;/g, 'ü')
    .replace(/&szlig;/g, 'ß');
}

function extractMeta(html, propertyOrName) {
  const regex = new RegExp(`<meta[^>]*?(?:property|name)=["']${propertyOrName}["'][^>]*?content=["']([^"']*)["']`, 'i');
  const match = html.match(regex);
  if (match) return match[1];
  // Try alternate attribute order: content first
  const altRegex = new RegExp(`<meta[^>]*?content=["']([^"']*)["'][^>]*?(?:property|name)=["']${propertyOrName}["']`, 'i');
  const altMatch = html.match(altRegex);
  return altMatch ? altMatch[1] : null;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : null;
}

// GET URL Link Preview metadata
app.get('/api/link-preview', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'URL Parameter fehlt' });
  }

  try {
    // 1. Check SQLite Cache
    const cached = await dbGet('SELECT * FROM link_previews WHERE url = ?', [url]);
    if (cached) {
      return res.json({
        title: cached.title,
        description: cached.description,
        image: cached.image,
        siteName: cached.site_name
      });
    }

    // 2. Fetch page HTML
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    let html = '';
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP Fehler: ${response.status}`);
      }

      // Check content-type to make sure it's HTML
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new Error('Kein HTML-Dokument');
      }

      html = await response.text();
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      console.warn(`Fehler beim Fetchen der URL (${url}):`, fetchErr.message);
      // Return minimalist fallback response without caching to retry later if it was a temporary network issue
      let domain = '';
      try { domain = new URL(url).hostname.replace('www.', ''); } catch (_) {}
      return res.json({
        title: domain || url,
        description: '',
        image: '',
        siteName: domain
      });
    }

    // 3. Parse Metadata
    let title = extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title') || extractTitle(html) || '';
    let description = extractMeta(html, 'og:description') || extractMeta(html, 'twitter:description') || extractMeta(html, 'description') || '';
    let image = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image') || '';
    let siteName = extractMeta(html, 'og:site_name') || '';

    // Clean html entities
    title = decodeHtmlEntities(title);
    description = decodeHtmlEntities(description);
    siteName = decodeHtmlEntities(siteName);

    // Resolve relative image URLs
    if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
      try {
        image = new URL(image, url).href;
      } catch (_) {}
    }

    // Generate siteName fallback
    let domain = '';
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch (_) {}
    if (!siteName) {
      siteName = domain;
    }
    if (!title) {
      title = domain || url;
    }

    // 4. Save to Cache
    await dbRun(
      'INSERT OR REPLACE INTO link_previews (url, title, description, image, site_name) VALUES (?, ?, ?, ?, ?)',
      [url, title, description, image, siteName]
    );

    res.json({ title, description, image, siteName });
  } catch (error) {
    console.error('Fehler bei Link-Preview Generierung:', error);
    res.status(500).json({ error: 'Serverfehler bei der Linkvorschau-Generierung' });
  }
});

// GET Search images for recipe title
app.get('/api/recipes/search-images', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Suchbegriff fehlt' });
  }

  try {
    const accessKey = await getSetting('unsplash_access_key');
    if (!accessKey) {
      return res.json({ unsplashConfigured: false });
    }

    // Call Unsplash API
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=6`,
      {
        headers: {
          'Authorization': `Client-ID ${accessKey}`
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Ungültiger Unsplash API-Key' });
      }
      throw new Error(`Unsplash HTTP Fehler: ${response.status}`);
    }

    const data = await response.json();
    const results = (data.results || []).map(photo => ({
      id: photo.id,
      url: photo.urls.regular,
      thumbnail: photo.urls.small,
      author: photo.user.name,
      authorUrl: photo.user.links.html
    }));

    res.json({ unsplashConfigured: true, results });
  } catch (error) {
    console.error('Fehler bei Unsplash Bildsuche:', error);
    res.status(500).json({ error: 'Serverfehler bei der Bildsuche' });
  }
});

// POST Download online image and set as cover image
app.post('/api/recipes/:id/download-image', async (req, res) => {
  const recipeId = req.params.id;
  const { imageUrl } = req.body;

  try {
    const recipe = await dbGet('SELECT * FROM recipes WHERE id = ?', [recipeId]);
    if (!recipe) {
      return res.status(404).json({ error: 'Rezept nicht gefunden' });
    }

    let finalImageUrl = imageUrl;
    
    // Keyless-Modus: Fetch matching image from Lorem Flickr if no imageUrl is supplied
    if (!finalImageUrl) {
      // Use the recipe title for Lorem Flickr
      const cleanTitle = recipe.title.replace(/[^\w\söäüßÄÖÜ]/gi, '').trim();
      finalImageUrl = `https://loremflickr.com/800/600/${encodeURIComponent(cleanTitle)}`;
      console.log(`Keyless Mode: Laden von Lorem Flickr mit Begriff "${cleanTitle}"...`);
    }

    // Download the image using fetch
    const response = await fetch(finalImageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Bild-Download HTTP Fehler: ${response.status}`);
    }

    // Handle redirects (Lorem Flickr redirects to a concrete flickr URL)
    const finalDownloadedUrl = response.url || finalImageUrl;

    const buffer = Buffer.from(await response.arrayBuffer());
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = `downloaded-${uniqueSuffix}.jpg`;
    const filepath = path.join(uploadsDir, filename);

    // Save image to disk
    fs.writeFileSync(filepath, buffer);
    const relativePath = `uploads/${filename}`;

    // SQLite Transaction-like logic to set as cover
    // 1. Reset current cover images for this recipe to 0
    await dbRun('UPDATE recipe_images SET is_cover = 0 WHERE recipe_id = ?', [recipeId]);

    // 2. Insert new image as cover
    await dbRun(
      'INSERT INTO recipe_images (recipe_id, image_path, is_cover) VALUES (?, ?, ?)',
      [recipeId, relativePath, 1]
    );

    // Fetch the updated recipe with all images and ingredients to return
    const updatedRecipe = await dbGet('SELECT * FROM recipes WHERE id = ?', [recipeId]);
    const images = await dbAll('SELECT * FROM recipe_images WHERE recipe_id = ?', [recipeId]);
    
    // Fetch ingredients
    const ingsRows = await dbAll(`
      SELECT i.name 
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id = ?
    `, [recipeId]);
    const ingredients = ingsRows.map(r => r.name);

    // Fetch tags
    const tagsRows = await dbAll(`
      SELECT t.name 
      FROM recipe_tags rt
      JOIN tags t ON rt.tag_id = t.id
      WHERE rt.recipe_id = ?
    `, [recipeId]);
    const tags = tagsRows.map(r => r.name);

    res.json({
      ...updatedRecipe,
      images,
      ingredients,
      tags
    });
  } catch (error) {
    console.error('Fehler beim Herunterladen des Rezeptbilds:', error);
    res.status(500).json({ error: 'Serverfehler beim Herunterladen des Rezeptbilds' });
  }
});

// POST Reset database (Dev only)
app.post('/api/dev/reset', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Reset-Prozess ist in der Produktionsumgebung deaktiviert!' });
  }

  try {
    console.log('Dev-Reset: Datenbank wird zurückgesetzt...');

    // 1. Tabellen löschen (geordnete Reihenfolge wegen Foreign Keys)
    await dbRun('PRAGMA foreign_keys = OFF;');
    await dbRun('DROP TABLE IF EXISTS recipe_ingredients;');
    await dbRun('DROP TABLE IF EXISTS recipe_tags;');
    await dbRun('DROP TABLE IF EXISTS recipe_images;');
    await dbRun('DROP TABLE IF EXISTS plan_assignments;');
    await dbRun('DROP TABLE IF EXISTS weekly_plans;');
    await dbRun('DROP TABLE IF EXISTS ingredients;');
    await dbRun('DROP TABLE IF EXISTS tags;');
    await dbRun('DROP TABLE IF EXISTS recipes;');
    await dbRun('PRAGMA foreign_keys = ON;');

    console.log('✓ Alle Tabellen erfolgreich gelöscht.');

    // 2. Schema neu initialisieren
    await initDb();
    console.log('✓ Schema neu initialisiert und Seeding abgeschlossen.');

    // 3. Uploads bereinigen
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        if (file !== '.gitkeep') {
          fs.unlinkSync(path.join(uploadsDir, file));
        }
      }
      console.log('✓ uploads/ Ordner bereinigt.');
    }

    res.json({ message: 'Datenbank erfolgreich in den Auslieferungszustand zurückgesetzt!' });
  } catch (error) {
    console.error('Fehler beim Dev-Reset:', error);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen der Datenbank' });
  }
});

// Serve frontend build if exists
const clientDistDir = path.join(__dirname, 'dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
