import puppeteer from 'puppeteer';

(async () => {
  console.log('Starte automatisierten Puppeteer GUI-Test für die rollierende Kalender-Timeline...');
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  try {
    await page.goto('http://localhost:5173');
    await page.waitForSelector('.weekly-planner-grid');
    console.log('✓ Wochenplaner-Grid erfolgreich im Browser geladen.');

    // 1. Check days dropdown selection and responsive columns
    console.log('\n1. Prüfe N-Tage Dropdown und responsive Spaltenanzahl...');
    await page.waitForSelector('.days-select-wrapper select');
    
    // Select 3 days
    await page.select('.days-select-wrapper select', '3');
    await new Promise(resolve => setTimeout(resolve, 500));
    let cols = await page.$$eval('.planner-day-col', els => els.length);
    console.log(`   - Gewählt: 3 Tage. Sichtbare Spalten im Grid: ${cols}`);
    if (cols !== 3) throw new Error(`Spaltenanzahl falsch! Erwartet: 3, Erhalten: ${cols}`);

    // Select 10 days
    await page.select('.days-select-wrapper select', '10');
    await new Promise(resolve => setTimeout(resolve, 500));
    cols = await page.$$eval('.planner-day-col', els => els.length);
    console.log(`   - Gewählt: 10 Tage. Sichtbare Spalten im Grid: ${cols}`);
    if (cols !== 10) throw new Error(`Spaltenanzahl falsch! Erwartet: 10, Erhalten: ${cols}`);

    // Select 7 days (default)
    await page.select('.days-select-wrapper select', '7');
    await new Promise(resolve => setTimeout(resolve, 500));
    cols = await page.$$eval('.planner-day-col', els => els.length);
    console.log(`   - Zurückgesetzt auf: 7 Tage. Sichtbare Spalten: ${cols}`);
    if (cols !== 7) throw new Error(`Spaltenanzahl falsch! Erwartet: 7, Erhalten: ${cols}`);

    // 2. Check sliding navigation & back to today button
    console.log('\n2. Prüfe stufenlose Navigation (Tages-Sliden)...');
    
    let isTodayBtnVisible = await page.$('.btn-today') !== null;
    console.log(`   - Ist "Heute"-Button anfangs unsichtbar? ${!isTodayBtnVisible}`);
    if (isTodayBtnVisible) throw new Error('"Heute"-Button sollte anfangs unsichtbar sein!');

    console.log('   - Klicke 8-mal auf den rechten Navigationspfeil (Tage vorwärts)...');
    for(let i=0; i<8; i++) {
      await page.click('.plan-navigator .btn-nav[title="1 Tag vorwärts"]');
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    
    isTodayBtnVisible = await page.$('.btn-today') !== null;
    console.log(`   - Ist "Heute"-Button sichtbar, nachdem Heute den Viewport verlassen hat? ${isTodayBtnVisible}`);
    if (!isTodayBtnVisible) throw new Error('"Heute"-Button sollte jetzt sichtbar sein!');

    console.log('   - Klicke auf "Heute" Button...');
    await page.click('.btn-today');
    await new Promise(resolve => setTimeout(resolve, 500));

    isTodayBtnVisible = await page.$('.btn-today') !== null;
    console.log(`   - Ist "Heute"-Button nach Rückkehr wieder unsichtbar? ${!isTodayBtnVisible}`);
    if (isTodayBtnVisible) throw new Error('"Heute"-Button sollte nach Rückkehr unsichtbar sein!');

    // 3. Check past columns write protection
    console.log('\n3. Prüfe Vergangenheit-Schreibschutz...');
    
    console.log('   - Klicke 5-mal auf den linken Navigationspfeil (Tage zurück)...');
    for(let i=0; i<5; i++) {
      await page.click('.plan-navigator .btn-nav[title="1 Tag zurück"]');
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const pastColsCount = await page.$$eval('.planner-day-col.is-past', els => els.length);
    console.log(`   - Anzahl sichtbarer Spalten in der Vergangenheit: ${pastColsCount}`);
    
    if (pastColsCount > 0) {
      const plansBtnInPast = await page.$$('.planner-day-col.is-past .slot-placeholder-prompt');
      const emptyPastSlots = await page.$$('.planner-day-col.is-past .slot-placeholder-empty-past');
      
      console.log(`   - "Planen" Knöpfe in der Vergangenheit: ${plansBtnInPast.length} (erwartet: 0)`);
      console.log(`   - "Kein Eintrag" Platzhalter in der Vergangenheit: ${emptyPastSlots.length} (erwartet: >0)`);
      
      if (plansBtnInPast.length > 0) {
        throw new Error('Fehler: "Planen" Knöpfe in der Vergangenheit gefunden! Schreibschutz verletzt.');
      }
      if (emptyPastSlots.length === 0) {
        throw new Error('Fehler: Keine schreibgeschützten Platzhalter in der Vergangenheit gefunden!');
      }
      console.log('   ✓ Vergangenheit-Schreibschutz funktioniert einwandfrei!');
    } else {
      console.log('   Keine vergangenen Tage sichtbar. Überspringe Untertest.');
    }

    console.log('\n🎉 ALLE GUI-TESTS ERFOLGREICH BESTANDEN! 🎉');
  } catch (error) {
    console.error('❌ GUI-TEST FEHLGESCHLAGEN:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
