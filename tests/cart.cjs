const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const markup = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const products = JSON.parse(markup.match(/<script id="product-data" type="application\/json">(.*?)<\/script>/s)[1]);
const source = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
function boot(saved, storageBlocked = false) {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {textContent: '', innerHTML: '', handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; }, showModal() { this.open = true; }, close() { this.open = false; }, reset() {}, focus() {}});
    return nodes.get(selector);
  };
  node('#product-data').textContent = JSON.stringify(products);
  const document = {querySelector: node, querySelectorAll: () => [], addEventListener(type, fn) { this[type] = fn; }};
  const localStorage = {getItem() { if (storageBlocked) throw Error('Blocked'); return saved; }, setItem(key, value) { if (storageBlocked) throw Error('Blocked'); this.saved = value; }};
  const context = vm.createContext({document, localStorage, Intl, window: {matchMedia: () => ({matches: false})}});
  vm.runInContext(source, context);
  return {node, document, localStorage, run: code => vm.runInContext(code, context)};
}
assert.equal(products.length, 15);
assert.equal(new Set(products.map(p => p.id)).size, 15);
for (const p of products) {
  assert(Number.isInteger(p.price) && p.price > 0);
  assert(p.size && p.weight && p.name);
  for (const field of ['photo', 'card', 'mobile']) assert(fs.statSync(path.join(root, p[field])).size > 0);
}
const app = boot('{"cat-jewelry":1,"frog-minis":2,"missing":4,"krosh":-1,"nyusha":1.5,"barash":100}');
assert.equal(app.run('subtotal()'), 5700);
assert.equal(app.node('#cart-count').textContent, 3);
app.run("openProduct('cat-vase')");
app.node('#add-to-cart').handlers.click();
assert.equal(app.run('subtotal()'), 10500);
assert.equal(JSON.parse(app.localStorage.saved)['cat-vase'], 1);
function quantity(id, delta) {
  const button = {dataset: {id, quantity: String(delta)}, hasAttribute: attr => attr === 'data-quantity', getAttribute: () => '', classList: {contains: () => false}};
  app.document.click({target: {closest: () => button}});
}
quantity('frog-minis', -1);
assert.equal(app.run('subtotal()'), 9600);
quantity('frog-minis', -1);
assert.equal(app.run("Object.hasOwn(cart, 'frog-minis')"), false);
app.run("cart['cat-jewelry'] = 99; openProduct('cat-jewelry')");
app.node('#add-to-cart').handlers.click();
assert.equal(app.run("cart['cat-jewelry']"), 99);
app.node('#select-delivery').handlers.click();
assert.equal(app.node('#pay-button').disabled, false);
assert.equal(app.node('#cart-total').textContent, app.run('money(subtotal() + 650)'));
let prevented = false;
app.node('#checkout-form').handlers.submit({preventDefault() { prevented = true; }});
assert(prevented);
assert(app.node('#checkout-result').textContent.includes('деньги не списаны'));
assert.equal(boot('broken JSON').node('#cart-count').textContent, 0);
assert.equal(boot('[1,2,3]').node('#cart-count').textContent, 0);
const blocked = boot(null, true);
blocked.run("openProduct('krosh')");
blocked.node('#add-to-cart').handlers.click();
assert.equal(blocked.run('subtotal()'), 4200);
console.log('PASS: 15 products; cart validation, totals, persistence, quantity limits, demo checkout, unavailable storage');
