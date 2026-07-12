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

  // Clear carrito
  await page.evaluate(() => localStorage.removeItem('oud_carrito'));

  // Click add button via evaluate (works with event delegation)
  await page.evaluate(() => {
    document.querySelector('[data-agregar-carrito]').click();
  });
  await sleep(800);

  // Check localStorage
  const carritoAfter = await page.evaluate(() => localStorage.getItem('oud_carrito'));
  console.log('Carrito after click:', carritoAfter);

  // Check toast
  const toastText = await page.$eval('.toast', el => el.textContent.trim()).catch(() => 'NO TOAST');
  console.log('Toast:', toastText);

  // Open cart
  await page.evaluate(() => document.querySelector('[data-abrir-carrito]').click());
  await sleep(1000);

  const cartItems = await page.$$eval('.carrito-item', els => els.length);
  console.log('Cart items:', cartItems);

  const cartHtml = await page.$eval('[data-lista-carrito]', el => el.innerHTML.substring(0, 800)).catch(() => 'NO CART');
  console.log('Cart HTML:', cartHtml);

  const totalsText = await page.$eval('[data-carrito-totales]', el => el.textContent.trim()).catch(() => 'NO TOTALS');
  console.log('Totals:', totalsText);

  const badgeText = await page.$eval('[data-badge-carrito]', el => el.textContent).catch(() => 'NO BADGE');
  console.log('Badge:', badgeText);

  // Check perfume price visible in card
  const priceText = await page.$eval('.tarjeta-perfume__precio', el => el.textContent.trim()).catch(() => 'NO PRICE');
  console.log('First perfume price:', priceText);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
