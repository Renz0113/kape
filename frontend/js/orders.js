document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.querySelector('[data-order-loading]');
  const errorPanel = document.querySelector('[data-order-error]');
  const content = document.querySelector('[data-order-content]');
  const referenceNode = document.querySelector('[data-order-reference]');
  const params = new URLSearchParams(location.search);
  const reference = (params.get('reference') || sessionStorage.getItem('kape-order') || '').trim();
  const orderStatus = window.KapeOrderStatus;
  let currentStatus = null;
  let currentPaymentStatus = null;
  let refreshing = false;
  let pollingTimer = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const money = value => window.KapeConfig.formatMoney(Number(value) || 0);
  const isTerminal = status => status === 'completed' || status === 'cancelled';

  function showLookupError() {
    loading.hidden = true;
    content.hidden = true;
    errorPanel.hidden = false;
  }

  function renderTimeline(status) {
    const timeline = document.querySelector('[data-order-timeline]');
    if (status === 'cancelled') {
      timeline.innerHTML = `<li class="is-cancelled is-current" aria-current="step"><span class="status-step-marker" aria-hidden="true">!</span><span><strong>${orderStatus.labels.cancelled}</strong><small>${orderStatus.descriptions.cancelled} This order will not continue through the preparation steps.</small></span></li>`;
      return;
    }
    if (!orderStatus.flow.includes(status)) {
      timeline.innerHTML = '<li class="is-current"><span class="status-step-marker" aria-hidden="true">?</span><span><strong>Status update unavailable</strong><small>Please check your account for the latest order information.</small></span></li>';
      return;
    }
    const current = orderStatus.flow.indexOf(status);
    timeline.innerHTML = orderStatus.flow.map((step, index) => {
      const state = index < current ? 'is-complete' : index === current ? 'is-current' : 'is-upcoming';
      const marker = index < current ? '✓' : index === current ? '•' : '';
      return `<li class="${state}"${index === current ? ' aria-current="step"' : ''}><span class="status-step-marker" aria-hidden="true">${marker}</span><span><strong>${orderStatus.labels[step]}</strong><small>${orderStatus.descriptions[step]}</small></span></li>`;
    }).join('');
  }

  function updateStatus(status) {
    const validStatus = orderStatus.statuses.includes(status) ? status : 'unknown';
    currentStatus = validStatus;
    const statusNode = document.querySelector('[data-order-status]');
    statusNode.textContent = validStatus === 'unknown' ? 'Status unavailable' : orderStatus.labels[validStatus];
    statusNode.classList.toggle('is-cancelled', validStatus === 'cancelled');
    document.querySelector('[data-status-intro]').textContent = validStatus === 'unknown'
      ? 'We could not read the latest status. Please check your account for updates.'
      : orderStatus.descriptions[validStatus];
    renderTimeline(validStatus);
  }

  function updatePaymentStatus(status) {
    currentPaymentStatus = String(status || 'pending');
    const label = currentPaymentStatus.charAt(0).toUpperCase() + currentPaymentStatus.slice(1);
    document.querySelector('[data-payment-status]').textContent = label;
  }

  function renderOrder(order) {
    referenceNode.textContent = order.reference;
    const items = order.items || [];
    const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    document.querySelector('[data-order-item-count]').textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
    document.querySelector('[data-order-items]').innerHTML = items.map(item => `
      <li><span class="success-item-name"><strong>${escapeHtml(item.product_name || item.name)}</strong><small>${Number(item.quantity)} × ${money(item.unit_price)} each</small></span><strong class="success-item-total">${money(item.line_total)}</strong></li>
    `).join('');
    document.querySelector('[data-order-subtotal]').textContent = money(order.subtotal);
    updatePaymentStatus(order.payment_status);
    const deliveryFee = Number(order.delivery_fee) || 0;
    document.querySelector('[data-delivery-fee-row]').hidden = deliveryFee <= 0;
    document.querySelector('[data-delivery-fee]').textContent = money(deliveryFee);
    document.querySelector('[data-order-total]').textContent = money(order.total);

    const fulfillment = order.fulfillment === 'delivery' ? 'delivery' : 'pickup';
    const hasCoordinatePair = order.delivery_latitude !== null && order.delivery_latitude !== ''
      && order.delivery_longitude !== null && order.delivery_longitude !== '';
    const hasDeliveryPin = fulfillment === 'delivery'
      && hasCoordinatePair
      && Number.isFinite(Number(order.delivery_latitude)) && Number.isFinite(Number(order.delivery_longitude))
      && Number(order.delivery_latitude) >= -90 && Number(order.delivery_latitude) <= 90
      && Number(order.delivery_longitude) >= -180 && Number(order.delivery_longitude) <= 180;
    const deliveryPinLink = hasDeliveryPin
      ? `<a href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(Number(order.delivery_latitude))}&mlon=${encodeURIComponent(Number(order.delivery_longitude))}#map=17/${encodeURIComponent(Number(order.delivery_latitude))}/${encodeURIComponent(Number(order.delivery_longitude))}" target="_blank" rel="noopener noreferrer">View delivery pin</a>`
      : '';
    const fulfillmentDetails = fulfillment === 'delivery'
      ? `<strong>Delivery</strong><span>${escapeHtml(order.delivery_address || 'Your saved delivery address')}</span>${deliveryPinLink}`
      : '<strong>Pickup</strong><span>We’ll let you know when your order is ready for pickup.</span>';
    document.querySelector('[data-fulfillment-summary]').innerHTML = `<span class="fulfillment-mark" aria-hidden="true">${fulfillment === 'delivery' ? '↗' : '⌂'}</span><span class="fulfillment-copy"><small>ORDER TYPE</small>${fulfillmentDetails}</span>`;
    updateStatus(String(order.status || ''));
    loading.hidden = true;
    errorPanel.hidden = true;
    content.hidden = false;
  }

  async function refreshOrder(initial = false) {
    if (refreshing || (!initial && document.visibilityState === 'hidden')) return;
    refreshing = true;
    try {
      const dashboard = await KapeAPI.request('/account/dashboard');
      const order = (dashboard.orders || []).find(item => item.reference === reference);
      if (!order) {
        if (initial) showLookupError();
        return;
      }
      if (initial) renderOrder(order);
      else {
        if (String(order.status || '') !== currentStatus) updateStatus(String(order.status || ''));
        if (String(order.payment_status || 'pending') !== currentPaymentStatus) updatePaymentStatus(order.payment_status);
      }
      if (isTerminal(currentStatus) && pollingTimer) {
        window.clearInterval(pollingTimer);
        pollingTimer = null;
      }
    } catch {
      if (initial) showLookupError();
    } finally {
      refreshing = false;
    }
  }

  document.querySelector('[data-copy-reference]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const value = referenceNode.textContent;
    const label = document.querySelector('[data-copy-label]');
    const status = document.querySelector('[data-copy-status]');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const field = document.createElement('textarea');
        field.value = value;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.append(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        if (!copied) throw new Error('Copy unavailable');
      }
      label.textContent = 'Copied!';
      status.textContent = 'Order reference copied.';
      button.classList.add('is-copied');
      window.setTimeout(() => {
        label.textContent = 'Copy';
        status.textContent = '';
        button.classList.remove('is-copied');
      }, 1800);
    } catch {
      status.textContent = 'Could not copy. You can select the reference and copy it.';
    }
  });

  if (!reference || !orderStatus) {
    showLookupError();
    return;
  }

  await refreshOrder(true);
  if (currentStatus && !isTerminal(currentStatus)) {
    pollingTimer = window.setInterval(() => refreshOrder(), 12000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !isTerminal(currentStatus)) refreshOrder();
    });
  }
});
