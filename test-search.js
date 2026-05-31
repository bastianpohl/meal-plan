import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto('http://localhost:5173');
  await page.waitForSelector('.recipe-card');
  
  console.log('Clicking the first recipe card to open detail view...');
  await page.click('.recipe-card');
  
  await page.waitForSelector('#recipe-details-modal.active');
  console.log('Modal opened!');
  
  const tagContent = await page.$eval('#detail-tags .tag-pill', el => el.textContent);
  console.log('Found tag in modal:', tagContent);
  
  console.log('Clicking the tag...');
  await page.click('#detail-tags .tag-pill');
  
  // Wait to see if search input gets populated
  await page.waitForTimeout(500);
  const searchVal = await page.$eval('#recipe-search', el => el.value);
  console.log('Search input value is now:', searchVal);
  
  const overlayDisplay = await page.$eval('#search-overlay-container', el => getComputedStyle(el).display);
  console.log('Search overlay display:', overlayDisplay);
  
  await browser.close();
})();
