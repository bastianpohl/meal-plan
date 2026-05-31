import puppeteer from 'puppeteer';

(async () => {
  console.log('Starte automatisierten Puppeteer GUI-Test für den Drag-and-Drop Ziehvorgang aus der Suche...');
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  try {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('.weekly-planner-grid');
    console.log('✓ Wochenplaner-Grid erfolgreich im Browser geladen.');

    // 1. Open the search overlay
    console.log('\n1. Öffne das Unified Spotlight-Suchoverlay...');
    await page.waitForSelector('.search-trigger-btn');
    await page.click('.search-trigger-btn');
    
    await page.waitForSelector('.unified-search-overlay.active');
    console.log('✓ Suchoverlay erfolgreich geöffnet.');

    // 2. Type search query
    console.log('\n2. Gebe Suchbegriff "#schnell" in die Suchleiste ein...');
    await page.waitForSelector('.unified-search-bar input');
    await page.focus('.unified-search-bar input');
    await page.keyboard.type('#schnell');
    
    // Wait for debounce and search results to render
    await new Promise(resolve => setTimeout(resolve, 800));
    
    await page.waitForSelector('.overlay-recipe-card');
    const recipeTitle = await page.$eval('.overlay-recipe-card-title span', el => el.textContent.trim());
    console.log(`✓ Rezept-Karte gefunden: "${recipeTitle}"`);

    // 3. Find a future, empty slot to drop the recipe card into
    console.log('\n3. Suche nach einem freien zukünftigen Slot im Wochenplaner...');
    const dropzoneExists = await page.evaluate(() => {
      const slot = document.querySelector('.planner-day-col:not(.is-past) .day-slot-dropzone:not(.filled)');
      return !!slot;
    });
    
    if (!dropzoneExists) {
      throw new Error('Kein freier zukünftiger Planungs-Slot gefunden!');
    }
    console.log('✓ Freier zukünftiger Slot gefunden.');

    // 4. Simulate the HTML5 Drag & Drop event chain
    console.log('\n4. Simuliere HTML5 Drag & Drop vom Cover-Flow zum Planungs-Slot...');
    
    await page.evaluate(() => {
      const source = document.querySelector('.overlay-recipe-card');
      const target = document.querySelector('.planner-day-col:not(.is-past) .day-slot-dropzone:not(.filled)');
      
      if (!source || !target) {
        throw new Error('Source oder Target-Element fehlt im DOM!');
      }

      console.log('--- JS-Klick-Simulationsstart ---');
      
      const dataTransfer = {
        data: {},
        setData(type, val) { this.data[type] = val; },
        getData(type) { return this.data[type]; },
        effectAllowed: 'copyMove',
        dropEffect: 'none'
      };

      function emitDragEvent(element, type, extra = {}) {
        const event = new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: 100,
          clientY: 100,
          ...extra
        });
        element.dispatchEvent(event);
      }

      // Start drag
      console.log('Triggering dragstart on recipe card...');
      emitDragEvent(source, 'dragstart');

      // Drag enters and moves over target
      console.log('Triggering dragenter & dragover on slot dropzone...');
      emitDragEvent(target, 'dragenter');
      emitDragEvent(target, 'dragover');

      // Drop on target
      console.log('Triggering drop on slot dropzone...');
      emitDragEvent(target, 'drop');

      // End drag
      console.log('Triggering dragend on recipe card...');
      emitDragEvent(source, 'dragend');
      
      console.log('--- JS-Klick-Simulationsende ---');
    });

    // Wait for the drop actions and DB persist
    await new Promise(resolve => setTimeout(resolve, 800));

    // 5. Verify the results
    console.log('\n5. Verifiziere das Ergebnis...');
    
    const isSearchClosed = await page.evaluate(() => {
      const overlay = document.querySelector('.unified-search-overlay');
      return !overlay.classList.contains('active');
    });
    
    console.log(`   - Ist das Suchoverlay geschlossen? ${isSearchClosed}`);
    if (!isSearchClosed) {
      throw new Error('Suchoverlay hat sich nach dem Drop nicht geschlossen!');
    }

    // Verify if any slot now has an assigned card containing our recipe title
    const assignedRecipesCount = await page.$$eval('.assigned-recipe-card', els => els.length);
    console.log(`   - Anzahl zugeordneter Rezepte im Planer: ${assignedRecipesCount}`);
    
    if (assignedRecipesCount === 0) {
      throw new Error('Kein Rezept wurde im Wochenplaner zugeordnet!');
    }

    console.log('\n🎉 ALL DRAG & DROP TESTS SUCCESSFUL! 🎉');
  } catch (error) {
    console.error('❌ DRAG & DROP TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
