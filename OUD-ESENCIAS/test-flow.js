const puppeteer = require('puppeteer');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));

  // Login
  await page.goto('http://localhost:8080/login.html', { waitUntil: 'networkidle0' });
  await page.type('#email', 'admin@oudesencias.com');
  await page.type('#password', 'admin1234');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type=submit]'),
  ]);

  // Go to catalog
  await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle0' });
  await sleep(2000);

  // Clear carrito, then add item via evaluate
  await page.evaluate(() => localStorage.removeItem('oud_carrito'));
  await page.evaluate(() => document.querySelector('[data-agregar-carrito]').click());
  await sleep(800);

  const carrito = await page.evaluate(() => localStorage.getItem('oud_carrito'));
  console.log('1. Carrito localStorage:', carrito);

  // Open cart panel
  await page.evaluate(() => document.querySelector('[data-abrir-carrito]').click());
  await sleep(1500);

  const cartItems = await page.$$eval('.carrito-item', els => els.length);
  console.log('2. Cart items rendered:', cartItems);

  const cartName = await page.$eval('.carrito-item__nombre', el => el.textContent.trim()).catch(() => 'NO NAME');
  console.log('3. Cart item name:', cartName);

  const cartSubtotal = await page.$eval('.carrito-item__subtotal', el => el.textContent.trim()).catch(() => 'NO SUBTOTAL');
  console.log('4. Cart item subtotal (price):', cartSubtotal);

  const totalsText = await page.$eval('[data-carrito-totales]', el => el.textContent.trim()).catch(() => 'NO TOTALS');
  console.log('5. Totals:', totalsText);

  const badgeText = await page.$eval('[data-badge-carrito]', el => el.textContent).catch(() => 'NO BADGE');
  console.log('6. Badge:', badgeText);

  // Check perfume card price
  const cardPrice = await page.$eval('.tarjeta-perfume__precio', el => el.textContent.trim()).catch(() => 'NO PRICE');
  console.log('7. Perfume card price:', cardPrice);

  // Check that before login the button is NOT "Añadir al carrito"
  await page.evaluate(() => sessionStorage.removeItem('oud_sesion'));
  await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle0' });
  await sleep(1500);
  const hasLoginLink = await page.evaluate(() => document.body.textContent.includes('Iniciá sesión para comprar'));
  const hasAddBtn = await page.evaluate(() => document.body.textContent.includes('Añadir al carrito'));
  console.log('8. Before login - login link:', hasLoginLink, '| add button:', hasAddBtn);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
