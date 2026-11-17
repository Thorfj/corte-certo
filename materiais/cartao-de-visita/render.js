const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const base = 'file://' + __dirname + '/';
  await p.goto(base + 'grafica.html'); await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: __dirname + '/cartao-barbozap-grafica.pdf', width: '96mm', height: '56mm', printBackground: true, pageRanges: '1-2' });
  await p.goto(base + 'a4.html'); await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: __dirname + '/cartao-barbozap-a4.pdf', format: 'A4', printBackground: true });
  const v = await b.newPage({ viewport: { width: 900, height: 300 }, deviceScaleFactor: 2 });
  await v.goto(base + 'previa.html'); await v.evaluate(() => document.fonts.ready);
  const box = await v.$eval('.prev', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await v.screenshot({ path: __dirname + '/cartao-barbozap-previa.png', clip: box });
  await b.close();
})();
