document.addEventListener('DOMContentLoaded', async () => {
  const target = document.querySelector('[data-cart]');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const money = value => window.KapeConfig.formatMoney(value);

  const render = async () => {
    target.innerHTML = '<p class="cart-loading" role="status">Gathering your cart…</p>';
    try {
      const data = await KapeAPI.request('/cart/validate', {
        method: 'POST', body: JSON.stringify({ items: KapeCart.get() })
      });
      if (!data.items.length) {
        target.innerHTML = '<section class="empty-cart"><span class="empty-cart-mark" aria-hidden="true">K.</span><h2>Your cart is taking a little break.</h2><p>Find something lovely on the menu and we’ll save it here.</p><a class="button" href="menu.html">Explore the menu <span aria-hidden="true">↗</span></a></section>';
        return;
      }
      const count = data.items.reduce((sum, item) => sum + Number(item.quantity), 0);
      const unavailable = data.items.some(item => !item.available);
      target.innerHTML = `<div class="cart-layout"><section class="cart-items" aria-label="Items in your cart">${data.items.map(item => `<article class="cart-line${item.available ? '' : ' is-unavailable'}"><div class="cart-line-image"><img src="${escapeHtml(item.image_path || '../macha1.jpg')}" alt="${escapeHtml(item.name)}"></div><div class="cart-line-info"><p class="eyebrow">${item.available ? 'FRESHLY MADE' : 'STOCK UPDATED'}</p><h2>${escapeHtml(item.name)}</h2><p>${item.available ? 'A little something for your day.' : 'There isn’t enough stock for this quantity. Please adjust it.'}</p><button class="cart-remove" type="button" data-remove="${Number(item.product_id)}">Remove</button></div><div class="cart-line-controls"><span class="cart-line-price">${money(item.line_total)}</span><small>${money(item.unit_price)} each</small><div class="quantity-control" aria-label="Quantity for ${escapeHtml(item.name)}"><button type="button" data-step="-1" data-quantity="${Number(item.product_id)}" aria-label="Remove one ${escapeHtml(item.name)}">−</button><output>${Number(item.quantity)}</output><button type="button" data-step="1" data-quantity="${Number(item.product_id)}" aria-label="Add one ${escapeHtml(item.name)}" ${Number(item.quantity) >= 50 ? 'disabled' : ''}>+</button></div></div></article>`).join('')}</section><aside class="cart-summary"><p class="eyebrow">JUST FOR YOU</p><h2>Order summary</h2><p class="cart-summary-count">${count} ${count === 1 ? 'item' : 'items'} in your order</p><div class="cart-subtotal"><span>Subtotal</span><strong>${money(data.subtotal)}</strong></div><p class="cart-summary-note">Delivery and any applicable discounts will be confirmed at checkout.</p>${unavailable ? '<button class="button cart-checkout-button is-disabled" type="button" disabled>Update quantities to continue</button>' : '<a class="button cart-checkout-button" href="checkout.html">Proceed to checkout <span aria-hidden="true">↗</span></a>'}<a class="continue-shopping" href="menu.html">Continue shopping</a></aside></div>`;
    } catch (error) {
      target.innerHTML = `<p class="notice error">${escapeHtml(error.message || 'We could not load your cart.')}</p><button class="button secondary" type="button" data-retry>Try again</button>`;
    }
  };

  target.addEventListener('click', event => {
    const step = event.target.closest('[data-quantity]');
    const remove = event.target.closest('[data-remove]');
    if (step) {
      const id = Number(step.dataset.quantity);
      const item = KapeCart.get().find(row => Number(row.product_id) === id);
      if (item) KapeCart.set(id, Number(item.quantity) + Number(step.dataset.step));
      render();
    } else if (remove) {
      KapeCart.remove(remove.dataset.remove);
      render();
    } else if (event.target.closest('[data-retry]')) render();
  });
  await render();
});
