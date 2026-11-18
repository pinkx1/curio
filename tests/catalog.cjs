const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const url = process.env.CURIO_URL || 'http://127.0.0.1:8765/';
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}, reducedMotion: 'reduce', hasTouch: true});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    async function checkNeighbors(track, expectedId) {
      const geometry = await track.evaluate(row => {
        const rect = row.getBoundingClientRect();
        const cards = [...row.children];
        const current = cards.findIndex(card => {
          const r = card.getBoundingClientRect();
          return Math.abs(r.left + r.width / 2 - (rect.left + rect.width / 2)) < 2;
        });
        const left = cards[current - 1]?.getBoundingClientRect();
        const right = cards[current + 1]?.getBoundingClientRect();
        const caption = cards[current]?.querySelector('.product-caption').getBoundingClientRect();
        return {
          id: cards[current]?.id,
          leftPeek: left ? left.right - rect.left : 0,
          rightPeek: right ? rect.right - right.left : 0,
          captionFits: caption && caption.left >= rect.left && caption.right <= rect.right
        };
      });
      assert.equal(geometry.id, expectedId);
      assert(geometry.leftPeek >= 16, JSON.stringify(geometry));
      assert(geometry.rightPeek >= 16, JSON.stringify(geometry));
      assert(geometry.captionFits, JSON.stringify(geometry));
    }
    for (const width of [320, 390, 430, 700]) {
      await page.setViewportSize({width, height: 844});
      await page.waitForTimeout(300);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for (const track of await page.locator('.product-track').all()) {
        await track.scrollIntoViewIfNeeded();
        const ids = await track.locator('.product:not([data-carousel-copy])').evaluateAll(cards => cards.map(c => c.id));
        assert.equal(await track.locator('[data-carousel-copy][inert][aria-hidden="true"]').count(), 2);
        for (const id of ids) {
          await checkNeighbors(track, id);
          await track.focus();
          await page.keyboard.press('ArrowRight');
          await page.waitForTimeout(450);
        }
        await checkNeighbors(track, ids[0]);
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(450);
        await checkNeighbors(track, ids.at(-1));
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(450);
      }
    }
    await page.setViewportSize({width: 390, height: 844});
    const track = page.locator('.product-track').first();
    await track.scrollIntoViewIfNeeded();
    const touch = await page.context().newCDPSession(page);
    const box = await track.boundingBox();
    await touch.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 290, y: box.y + 90}]});
    for (let x = 270; x >= 90; x -= 30) {
      await touch.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y: box.y + 90}]});
      await page.waitForTimeout(30);
    }
    await touch.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await page.waitForTimeout(700);
    const swipedId = await track.evaluate(row => [...row.children].find(card => {
      const r = card.getBoundingClientRect();
      return Math.abs(r.left + r.width / 2 - innerWidth / 2) < 2;
    })?.id);
    assert(swipedId && swipedId !== 'cat-jewelry');
    await checkNeighbors(track, swipedId);
    await track.locator('.product:not([data-carousel-copy]) .product-hit').first().click();
    assert(await page.locator('.product-dialog').evaluate(dialog => dialog.open));
    await page.locator('#add-to-cart').click();
    assert.equal(await page.locator('#cart-count').textContent(), '1');
    await page.keyboard.press('Escape');
    for (const width of [768, 1440]) {
      await page.setViewportSize({width, height: 960});
      await page.waitForTimeout(250);
      assert.equal(await page.locator('[data-carousel-copy]').count(), 0);
      assert.equal(await page.locator('.product').count(), 15);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.setViewportSize({width: 390, height: 844});
    await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-carousel-copy]').count(), 6);
    assert.equal(await page.locator('[id]').evaluateAll(nodes => new Set(nodes.map(n => n.id)).size === nodes.length), true);
    assert.deepEqual(errors, []);
    console.log('PASS: neighbor previews at 320/390/430/700px; all cards, looping, keyboard, touch swipe, modal/cart, desktop resize, unique IDs');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
