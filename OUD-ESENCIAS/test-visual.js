const puppeteer = require('puppeteer');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Login first
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

  // Check that perfume names are visible
  const nombres = await page.$$eval('.tarjeta-perfume__nombre', els => els.map(e => e.textContent.trim()));
  console.log('1. Nombres visibles:', nombres.length, nombres.slice(0, 3));

  // Check that piramide divs are hidden
  const piramideVisible = await page.$$eval('.tarjeta-perfume__piramide', els => els.filter(e => e.offsetParent !== null).length);
  console.log('2. Pirámides visibles (debería ser 0):', piramideVisible);

  // Check that "Añadir al carrito" buttons exist
  const botones = await page.$$eval('[data-agregar-carrito]', els => els.length);
  console.log('3. Botones Añadir al carrito:', botones);

  // Check that the button is below the price (check parent .tarjeta-perfume__pie has flex-direction column)
  const pieStyle = await page.$eval('.tarjeta-perfume__pie', el => getComputedStyle(el).flexDirection);
  console.log('4. Flex direction del pie (debería ser column):', pieStyle);

  // Check button width
  const btnWidth = await page.$eval('.tarjeta-perfume__pie .btn', el => getComputedStyle(el).width);
  console.log('5. Ancho del botón (debería ser 100%):', btnWidth);

  // Take screenshot
  await page.screenshot({ path: 'OUD-ESENCIAS/catalogo-resultado.png', fullPage: false });
  console.log('6. Screenshot guardado');

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
