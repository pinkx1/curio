const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const url = process.env.CURIO_URL || 'http://127.0.0.1:8765/';
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  try {
    const page = await browser.newPage({reducedMotion: 'reduce'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    const sizes = [[320,480],[568,320],[1024,400],[320,568],[360,640],[390,844],[430,932],[600,800],[700,844],[701,844],[768,1024],[844,390],[1024,600],[1101,768],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1080],[2560,1440],[3440,1440],[3840,1080],[3840,800]];
    for (const [width, height] of sizes) {
      await page.setViewportSize({width, height});
      await page.evaluate(() => scrollTo({top: 0, behavior: 'instant'}));
      const layout = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        const font = selector => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
        return {
          screen: rect('.site'), header: rect('.header'), hero: rect('.hero'), copy: rect('.hero-copy'),
          figures: [...document.querySelectorAll('.hero-cat')].map(e => e.getBoundingClientRect().toJSON()),
          foreground: ['.hero-cat.white', '.hero-cat.frog', '.hero-cat.yozhik'].map(rect),
          custom: rect('#custom'), customCopy: rect('.custom-copy'), photo: rect('.pet-photo'), figurine: rect('.pet-figurine'),
          price: rect('.custom-price'), order: rect('.custom-order'),
          aboutTitle: rect('#about-title'), aboutText: rect('.about-section>p'), contact: rect('.contact-button'),
          customFont: font('.custom-copy p'), introFont: font('.catalog-intro p'),
          overflow: document.documentElement.scrollWidth > innerWidth
        };
      });
      const label = `${width}×${height}`;
      assert.equal(layout.screen.width, width, label + ': full width');
      assert(Math.abs(layout.hero.bottom - height) < 1, label + ': all figures fit in the first viewport');
      assert.equal(layout.overflow, false, label + ': no page overflow');
      assert(layout.copy.top >= layout.header.bottom - 1, label + ': title clears header');
      assert(layout.copy.bottom <= Math.min(...layout.foreground.map(r => r.top)) + 1, label + ': title clears foreground');
      for (const r of layout.figures) {
        assert(r.height > 30 && r.top >= layout.hero.top - 1 && r.bottom <= layout.hero.bottom + 1, label + ': figures fit vertically');
      }
      if (width >= 1101) {
        const [black, ginger, white, frog, yozhik] = layout.figures;
        for (const [left, right] of [[black, frog], [frog, white], [white, yozhik], [yozhik, ginger]]) {
          assert(left.right >= right.left, label + ': neighboring figure frames overlap');
        }
      }
      assert(layout.customFont >= 16 && layout.introFont >= 16, label + ': readable body text');
      assert(layout.aboutTitle.bottom <= layout.aboutText.top, label + ': author title clears description');
      assert(layout.aboutText.bottom + 8 <= layout.contact.top, label + ': author text clears button');
      if (width <= 700) {
        assert(layout.customCopy.bottom + 8 <= Math.min(layout.photo.top, layout.figurine.top), label + ': custom text clears photos');
        assert(Math.max(layout.photo.bottom, layout.figurine.bottom) <= Math.min(layout.price.top, layout.order.top) + 1, label + ': custom photos clear purchase row');
        assert(layout.customCopy.width >= width - 50, label + ': custom content uses available width');
        assert(layout.order.right <= layout.custom.right && layout.order.left >= 0, label + ': purchase button fits');
      }
      console.log('PASS', label);
    }
    for (const [width, height] of [[390,844],[2560,1080],[3840,800]]) {
      await page.setViewportSize({width, height});
      await page.evaluate(() => scrollTo({top: 0, behavior: 'instant'}));
      const hideFigures = await page.addStyleTag({content: '.hero-cat{visibility:hidden!important}'});
      const edge = await page.screenshot({clip: {x: 0, y: height - 32, width, height: 32}});
      const solidPaper = await page.evaluate(async data => {
        const image = new Image();
        image.src = 'data:image/png;base64,' + data;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        return pixels.every((value, index) => value === [255, 252, 247, 255][index % 4]);
      }, edge.toString('base64'));
      await hideFigures.evaluate(element => element.remove());
      assert(solidPaper, `${width}×${height}: lower section cannot show through transparent figure edges`);
    }
    for (const [width, height] of [[390,568],[844,390],[1366,600]]) {
      await page.setViewportSize({width, height});
      await page.locator('#cat-jewelry .product-hit').click();
      const dialog = page.locator('.product-dialog');
      const bounds = await dialog.boundingBox();
      assert(bounds.y >= 0 && bounds.y + bounds.height <= height, 'product dialog fits short viewport');
      await page.locator('#add-to-cart').click();
      assert(await page.locator('.cart-dialog').evaluate(e => e.open));
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors, []);
    console.log('PASS: all characters visible in the first viewport, overlapping figure frames, readable type, no horizontal page scrolling');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
