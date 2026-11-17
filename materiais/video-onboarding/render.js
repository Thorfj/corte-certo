const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const fps = 30;
  const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'video.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const dur = await page.evaluate(() => window.DURACAO);
  const ts = only || Array.from({ length: Math.round(dur * fps) }, (_, i) => i / fps);
  const dir = path.join(__dirname, only ? 'check' : 'frames');
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < ts.length; i++) {
    await page.evaluate(t => window.render(t), ts[i]);
    const f = only ? `t${ts[i]}.jpg` : `${String(i).padStart(5, '0')}.jpg`;
    await page.screenshot({ path: path.join(dir, f), type: 'jpeg', quality: 90 });
  }
  console.log('ok', ts.length, dur);
  await browser.close();
})();
