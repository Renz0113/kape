document.addEventListener('DOMContentLoaded', async () => {
  const cartCount = document.querySelector('[data-checkout-cart-count]');
  const updateCartCount = () => {
    if (!cartCount || !window.KapeCart) return;
    const count = KapeCart.get().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    cartCount.textContent = count;
    cartCount.hidden = count === 0;
  };
  updateCartCount();
  window.addEventListener('kape:cart-change', updateCartCount);
  window.addEventListener('storage', updateCartCount);

  const form = document.querySelector('[data-checkout]');
  if (!form) return;
  const message = form.querySelector('[data-message]');
  const checkoutError = document.querySelector('[data-checkout-error]');
  const deliverySummary = form.querySelector('[data-delivery-summary]');
  const deliveryAddressLabel = form.querySelector('[data-delivery-address]');
  const pickupDetail = form.querySelector('[data-pickup-detail]');
  const fulfillmentOptions = [...form.querySelectorAll('input[name="fulfillment"]')];
  const button = form.querySelector('[data-place-order]');
  const notes = form.elements.order_notes;
  let savedAddress = '';
  let savedLatitude = null;
  let savedLongitude = null;
  let submitting = false;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const money = amount => window.KapeConfig.formatMoney(amount);
  const setMessage = text => {
    message.textContent = text;
    message.hidden = !text;
    if (text) message.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const selectedFulfillment = () => form.querySelector('input[name="fulfillment"]:checked')?.value || 'pickup';
  const syncFulfillment = () => {
    const selected = selectedFulfillment();
    form.querySelectorAll('.fulfillment-card').forEach(card => {
      const input = card.querySelector('input');
      card.classList.toggle('is-selected', input.checked);
    });
    pickupDetail.hidden = selected !== 'pickup';
    deliverySummary.hidden = selected !== 'delivery';
  };
  fulfillmentOptions.forEach(input => input.addEventListener('change', syncFulfillment));
  notes.addEventListener('input', () => {
    form.querySelector('[data-notes-count]').textContent = `${notes.value.length} / 1000`;
  });

  try {
    const account = await KapeAPI.request('/account');
    form.hidden = false;
    form.elements.name.value = account.name || '';
    form.elements.email.value = account.email || '';
    form.elements.phone.value = account.phone || '';
    savedAddress = account.delivery_address || '';
    savedLatitude = account.delivery_latitude === null || account.delivery_latitude === '' ? null : Number(account.delivery_latitude);
    savedLongitude = account.delivery_longitude === null || account.delivery_longitude === '' ? null : Number(account.delivery_longitude);
    const hasSavedLocation = Number.isFinite(savedLatitude) && Number.isFinite(savedLongitude);
    const locationDetails = hasSavedLocation
      ? `<br><a href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(savedLatitude)}&mlon=${encodeURIComponent(savedLongitude)}#map=17/${encodeURIComponent(savedLatitude)}/${encodeURIComponent(savedLongitude)}" target="_blank" rel="noopener noreferrer">View saved map pin</a>`
      : '';
    deliveryAddressLabel.innerHTML = savedAddress
      ? `${escapeHtml(savedAddress)}${locationDetails}`
      : 'No saved address. <a href="me.html?return=checkout.html#settings">Add a delivery address in your account</a>.';
    syncFulfillment();
  } catch (error) {
    if (error.status === 401) {
      location.replace('login.html?return=checkout.html');
      return;
    }
    checkoutError.textContent = error.message || 'We could not check your account. Please try again.';
    checkoutError.hidden = false;
    return;
  }

  let cart;
  try {
    cart = await KapeAPI.request('/cart/validate', {
      method: 'POST', body: JSON.stringify({ items: KapeCart.get() })
    });
  } catch (error) {
    setMessage(error.message || 'We could not load your cart. Please return to your cart and try again.');
    button.disabled = true;
    return;
  }

  const itemsTarget = form.querySelector('[data-order-items]');
  const items = cart.items || [];
  const count = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  itemsTarget.innerHTML = items.length ? items.map(item => `
    <article class="summary-item">
      <div class="summary-item-image"><img src="${escapeHtml(item.image_path || '../macha1.jpg')}" alt="${escapeHtml(item.name)}"></div>
      <div class="summary-item-info"><strong>${escapeHtml(item.name)}</strong><small>Freshly made · ${money(item.unit_price)} each</small><span>Quantity × ${Number(item.quantity)}</span></div>
      <strong class="summary-item-total">${money(item.line_total)}</strong>
    </article>`).join('') : '<p class="summary-empty">Your cart is empty. <a href="menu.html">Browse the menu</a>.</p>';
  form.querySelector('[data-item-count]').textContent = `${count} ${count === 1 ? 'item' : 'items'}`;

  const subtotal = Number(cart.subtotal || 0);
  const deliveryFee = 0;
  const discount = 0;
  form.querySelector('[data-subtotal]').textContent = money(subtotal);
  form.querySelector('[data-delivery-fee]').textContent = money(deliveryFee);
  form.querySelector('[data-discount]').textContent = `−${money(discount)}`;
  form.querySelector('[data-total]').textContent = money(subtotal + deliveryFee - discount);

  if (!items.length) {
    setMessage('Your cart is empty. Add something from the menu before placing your order.');
    button.disabled = true;
  } else if (items.some(item => !item.available)) {
    setMessage('A drink in your cart no longer has enough stock. Update your cart and try again.');
    button.disabled = true;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || button.disabled) return;
    const fulfillment = selectedFulfillment();
    if (fulfillment === 'delivery' && !savedAddress) {
      setMessage('Please add a delivery address in your account settings, then return to checkout.');
      return;
    }
    if (!form.reportValidity()) return;

    submitting = true;
    setMessage('');
    button.disabled = true;
    button.textContent = 'Processing…';
    try {
      const values = Object.fromEntries(new FormData(form));
      const result = await KapeAPI.request('/orders', {
        method: 'POST',
        body: JSON.stringify({ ...values, address: fulfillment === 'delivery' ? savedAddress : '', delivery_latitude: fulfillment === 'delivery' ? savedLatitude : null, delivery_longitude: fulfillment === 'delivery' ? savedLongitude : null, items: KapeCart.get() })
      });
      KapeCart.clear();
      sessionStorage.setItem('kape-order', result.reference);
      button.textContent = 'Order Placed ✓';
      window.setTimeout(() => {
        location.href = `order-success.html?reference=${encodeURIComponent(result.reference)}`;
      }, 650);
    } catch (error) {
      if (error.status === 401) {
        location.href = 'login.html?return=checkout.html';
        return;
      }
      setMessage(error.message || 'We could not place your order. Please try again.');
      submitting = false;
      button.disabled = false;
      button.innerHTML = 'Place Order <span aria-hidden="true">↗</span>';
    }
  });
});
