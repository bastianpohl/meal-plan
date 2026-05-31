import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to SQLite database
const dbPath = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Fehler beim Öffnen der Datenbank:', err.message);
    process.exit(1);
  }
  console.log('Verbunden mit der SQLite-Datenbank zum Seeden.');
  seedData();
});

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
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

async function seedData() {
  try {
    // 1. Insert seed recipes
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
      // Check if recipe already exists to avoid duplicates
      const existing = await dbGet('SELECT id FROM recipes WHERE title = ?', [r.title]);
      if (existing) {
        console.log(`Rezept "${r.title}" existiert bereits.`);
        continue;
      }

      // Insert base recipe
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

      console.log(`Erfolgreich hinzugefügt: ${r.title}`);
    }

    console.log('Seeding erfolgreich beendet!');
    db.close();
  } catch (error) {
    console.error('Fehler beim Seeden:', error);
    db.close();
  }
}
