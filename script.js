'use strict';
const products = JSON.parse(document.querySelector('#product-data').textContent);
const byId = new Map(products.map(product => [product.id, product]));
const money = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
const storageKey = 'curio-cart-v1';
let cart = {};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const [id, quantity] of Object.entries(saved)) {
      if (byId.has(id) && Number.isInteger(quantity) && quantity > 0 && quantity <= 99) cart[id] = quantity;
    }
  }
} catch { /* A blocked or damaged store must not prevent shopping in this tab. */ }
let selectedProduct;
let deliverySelected = false;
const productDialog = document.querySelector('.product-dialog');
const cartDialog = document.querySelector('.cart-dialog');
const deliveryDialog = document.querySelector('.delivery-dialog');
const checkoutDialog = document.querySelector('.checkout-dialog');
const subtotal = () => Object.entries(cart).reduce((sum, [id, quantity]) => sum + byId.get(id).price * quantity, 0);
const announce = message => { document.querySelector('#announcement').textContent = message; };
function saveCart() {
  try { localStorage.setItem(storageKey, JSON.stringify(cart)); } catch { /* Keep the in-memory cart when storage is unavailable. */ }
  updateCart();
}
function updateCart() {
  const entries = Object.entries(cart);
  document.querySelector('#cart-count').textContent = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
  document.querySelector('#cart-summary').hidden = !entries.length;
  document.querySelector('#cart-items').innerHTML = entries.length ? entries.map(([id, quantity]) => {
    const product = byId.get(id);
    return `<article class="cart-item"><img src="${product.photo}" alt="${product.name}"><p>${product.name}</p><p class="cart-item-price">${money(product.price)}${id === 'frog-minis' ? '/шт.' : ''}</p><div class="cart-controls"><div class="quantity"><button type="button" data-quantity="-1" data-id="${id}" aria-label="Уменьшить: ${product.name}">−</button><output aria-label="Количество: ${product.name}">${quantity}</output><button type="button" data-quantity="1" data-id="${id}" aria-label="Увеличить: ${product.name}" ${quantity === 99 ? 'disabled' : ''}>+</button></div><button class="remove-item" type="button" data-remove="${id}" aria-label="Убрать: ${product.name}">Убрать</button></div></article>`;
  }).join('') : '<div class="empty-cart"><img src="assets/curio/93b767e7-b030-4b56-b256-df0a80da6bd4.svg" alt="" width="48" height="48"><h3>Пока пусто</h3><p>Здесь будут фигурки,<br>которые вы выберете.</p><button type="button" class="button dark" data-close data-catalog>Вернуться к фигуркам</button></div>';
  const value = subtotal();
  document.querySelector('#cart-subtotal').textContent = money(value);
  document.querySelector('#checkout-subtotal').textContent = money(value);
  document.querySelector('#cart-total').textContent = money(value + 650);
  document.querySelector('#checkout-total').textContent = money(value + 650);
  if (deliverySelected) document.querySelector('#pay-button').textContent = 'Оплатить ' + money(value + 650);
}
function openProduct(id) {
  const product = byId.get(id);
  if (!product) return;
  selectedProduct = id;
  document.querySelector('#product-title').textContent = product.name;
  const photo = document.querySelector('#product-photo');
  photo.src = product.photo;
  photo.alt = product.name;
  document.querySelector('#product-price').textContent = money(product.price);
  document.querySelector('#product-specs').innerHTML = [['Размер', product.size], ['Вес', product.weight], ['Материал', 'Керамика, глазурь'], ...(id === 'cat-vase' ? [['Отверстие', 'Ø уточняется']] : [])].map(([label, value]) => `<div class="spec-row"><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  document.querySelector('#product-note').textContent = product.note;
  productDialog.showModal();
}
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-product')) openProduct(button.dataset.product);
  if (button.hasAttribute('data-close')) button.closest('dialog').close();
  if (button.hasAttribute('data-catalog')) document.querySelector('#catalog').scrollIntoView();
  if (button.hasAttribute('data-quantity')) {
    const id = button.dataset.id;
    if (!byId.has(id)) return;
    const quantity = (cart[id] || 0) + Number(button.dataset.quantity);
    if (quantity <= 0) delete cart[id];
    else cart[id] = Math.min(quantity, 99);
    const label = button.getAttribute('aria-label');
    saveCart();
    const next = Array.from(document.querySelectorAll('[data-quantity]')).find(item => item.getAttribute('aria-label') === label && !item.disabled);
    (next || document.querySelector('.cart-dialog .close-button')).focus();
    announce('Корзина обновлена. Товары: ' + money(subtotal()));
  }
  if (button.hasAttribute('data-remove')) {
    delete cart[button.dataset.remove];
    saveCart();
    document.querySelector('.cart-dialog .close-button').focus();
    announce('Фигурка удалена из корзины');
  }
  if (button.classList.contains('delivery-toggle')) deliveryDialog.showModal();
});
document.querySelector('.cart-toggle').addEventListener('click', () => cartDialog.showModal());
document.querySelector('#add-to-cart').addEventListener('click', () => {
  if (!byId.has(selectedProduct)) return;
  cart[selectedProduct] = Math.min((cart[selectedProduct] || 0) + 1, 99);
  saveCart();
  productDialog.close();
  cartDialog.showModal();
  announce(byId.get(selectedProduct).name + ' — в корзине');
});
document.querySelector('#checkout-button').addEventListener('click', () => {
  if (!Object.keys(cart).length) return;
  cartDialog.close();
  checkoutDialog.showModal();
});
document.querySelector('#select-delivery').addEventListener('click', () => {
  deliverySelected = true;
  document.querySelector('#delivery-label').textContent = '650 ₽';
  document.querySelector('#delivery-hint').textContent = 'Москва, пункт на Лесной · 2–4 рабочих дня. Учебный пример.';
  document.querySelector('.cart-summary .total-line').hidden = false;
  document.querySelector('#checkout-delivery').textContent = 'Москва, пункт на Лесной';
  document.querySelector('#checkout-shipping').textContent = '650 ₽';
  document.querySelector('#checkout-total-line').hidden = false;
  const payButton = document.querySelector('#pay-button');
  payButton.disabled = false;
  payButton.textContent = 'Оплатить ' + money(subtotal() + 650);
  updateCart();
  deliveryDialog.close();
});
document.querySelector('#checkout-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!deliverySelected || !Object.keys(cart).length) return;
  // shortcut: checkout is a classroom demo; add a backend only for a real shop.
  document.querySelector('#checkout-result').textContent = 'Это учебный проект: заказ не отправлен, деньги не списаны. Спасибо, что посмотрели CURIO!';
});
checkoutDialog.addEventListener('close', () => {
  document.querySelector('#checkout-form').reset();
  document.querySelector('#checkout-result').textContent = '';
});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  });
});
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
document.querySelectorAll('.hero-cat').forEach(cat => {
  function nudge() { if (!reducedMotion.matches) cat.classList.add('wiggle'); }
  cat.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') nudge(); });
  cat.addEventListener('click', nudge);
  cat.addEventListener('animationend', () => cat.classList.remove('wiggle'));
});
updateCart();

// Edge copies keep both neighboring cards visible, including at the ends of each mobile row.
const mobileCatalog = window.matchMedia('(max-width: 700px)');
document.querySelectorAll('.product-track').forEach(track => {
  const cards = Array.from(track.children);
  let copies = [];
  let activeIndex = 0;
  let settleTimer;
  function center(card, behavior = 'instant') {
    const offset = card.getBoundingClientRect().left - track.getBoundingClientRect().left;
    track.scrollTo({left: track.scrollLeft + offset - (track.clientWidth - card.offsetWidth) / 2, behavior});
  }
  function settle() {
    if (!mobileCatalog.matches) return;
    const middle = track.getBoundingClientRect().left + track.clientWidth / 2;
    const nearest = Array.from(track.children).reduce((a, b) => {
      const distance = card => Math.abs(card.getBoundingClientRect().left + card.offsetWidth / 2 - middle);
      return distance(a) < distance(b) ? a : b;
    });
    if (nearest === copies[0]) activeIndex = cards.length - 1;
    else if (nearest === copies[1]) activeIndex = 0;
    else activeIndex = cards.indexOf(nearest);
    if (copies.includes(nearest)) center(cards[activeIndex]);
  }
  function configure() {
    clearTimeout(settleTimer);
    copies.forEach(copy => copy.remove());
    copies = [];
    if (!mobileCatalog.matches) return;
    copies = [cards.at(-1), cards[0]].map(card => {
      const copy = card.cloneNode(true);
      copy.removeAttribute('id');
      copy.dataset.carouselCopy = '';
      copy.setAttribute('aria-hidden', 'true');
      copy.inert = true;
      return copy;
    });
    track.prepend(copies[0]);
    track.append(copies[1]);
    center(cards[activeIndex]);
  }
  track.addEventListener('scroll', () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 180);
  }, {passive: true});
  track.addEventListener('keydown', event => {
    if (!mobileCatalog.matches || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const step = cards[0].offsetWidth + 16;
    track.scrollBy({left: event.key === 'ArrowRight' ? step : -step, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
  });
  mobileCatalog.addEventListener('change', configure);
  window.addEventListener('resize', () => {
    if (mobileCatalog.matches) center(cards[activeIndex]);
  });
  configure();
});
