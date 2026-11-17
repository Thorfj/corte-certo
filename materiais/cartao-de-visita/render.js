const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const base = 'file://' + __dirname + '/';
  // arquivo da Printi em 9 x 5 cm (medida pedida no envio)
  await p.goto(base + 'printi9x5.html'); await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: __dirname + '/cartao-barbozap-printi-9x5cm.pdf', width: '90mm', height: '50mm', printBackground: true, pageRanges: '1-2' });
  await p.goto(base + 'a4.html'); await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: __dirname + '/cartao-barbozap-a4.pdf', format: 'A4', printBackground: true });
  const v = await b.newPage({ viewport: { width: 900, height: 300 }, deviceScaleFactor: 2 });
  await v.goto(base + 'previa.html'); await v.evaluate(() => document.fonts.ready);
  let box = await v.$eval('.prev', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await v.screenshot({ path: __dirname + '/cartao-barbozap-previa.png', clip: box });
  const c = await b.newPage({ viewport: { width: 500, height: 600 }, deviceScaleFactor: 3 });
  await c.goto(base + 'conferencia.html'); await c.evaluate(() => document.fonts.ready);
  box = await c.$eval('.conf', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await c.screenshot({ path: __dirname + '/conferencia-guias.png', clip: box });
  await b.close();
})();
