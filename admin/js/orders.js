document.addEventListener('DOMContentLoaded', async () => {
  const body = document.querySelector('[data-rows]');
  const search = document.querySelector('[data-order-search]');
  const filter = document.querySelector('[data-order-filter]');
  const count = document.querySelector('[data-order-count]');
  const refresh = document.querySelector('[data-order-refresh]');
  const statusConfig = window.KapeOrderStatus;
  let orders = [];

  if (!statusConfig) {
    showError(new Error('Order status settings could not be loaded. Refresh the page and try again.'));
    return;
  }

  const selectedFilter = filter.value || 'all';
  filter.innerHTML = '<option value="all">All statuses</option>' + statusConfig.statuses.map(status =>
    `<option value="${status}">${statusConfig.labels[status]}</option>`
  ).join('');
  filter.value = selectedFilter;

  function statusControl(order) {
    const current = String(order.status || '');
    const allowed = statusConfig.transitions[current] || [];
    const unknownCurrent = !statusConfig.statuses.includes(current);
    const currentOption = unknownCurrent
      ? `<option value="${escAdmin(current)}" selected>${escAdmin(current || 'Unknown status')}</option>`
      : '';
    const options = statusConfig.statuses.map(status => {
      const isCurrent = status === current;
      const disabled = !isCurrent && !allowed.includes(status);
      return `<option value="${status}"${isCurrent ? ' selected' : ''}${disabled ? ' disabled' : ''}>${statusConfig.labels[status]}</option>`;
    }).join('');
    return `<select aria-label="Update status for ${escAdmin(order.reference)}" data-status="${Number(order.id)}" data-current-status="${escAdmin(current)}">${currentOption}${options}</select>`;
  }

  function deliveryLocation(order) {
    if (order.fulfillment !== 'delivery') return '';
    const address = order.delivery_address ? `<br><small class="order-address">${escAdmin(order.delivery_address)}</small>` : '';
    const hasPin = order.delivery_latitude !== null && order.delivery_latitude !== ''
      && order.delivery_longitude !== null && order.delivery_longitude !== '';
    const latitude = Number(order.delivery_latitude);
    const longitude = Number(order.delivery_longitude);
    const validPin = hasPin && Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
    const map = validPin
      ? `<br><a class="order-location-link" href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=17/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}" target="_blank" rel="noopener noreferrer">View delivery pin</a>`
      : '';
    return `${address}${map}`;
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    const visible = orders.filter(order => (filter.value === 'all' || order.status === filter.value)
      && `${order.reference} ${order.customer_name} ${order.customer_email}`.toLowerCase().includes(query));
    count.textContent = `${visible.length} of ${orders.length} orders`;
    body.innerHTML = visible.length ? visible.map(order => `<tr>
      <td><strong>${escAdmin(order.reference)}</strong><br><small>${escAdmin(order.fulfillment || '')}</small>${deliveryLocation(order)}${order.order_notes ? `<br><small>Note: ${escAdmin(order.order_notes)}</small>` : ''}</td>
      <td>${escAdmin(order.customer_name)}<br><a href="mailto:${encodeURIComponent(order.customer_email || '')}">${escAdmin(order.customer_email)}</a></td>
      <td>${KapeConfig.formatMoney(order.total)}</td>
      <td>${statusControl(order)}</td>
      <td>${escAdmin(order.created_at)}</td>
    </tr>`).join('') : '<tr><td colspan="5">No matching orders.</td></tr>';
  }

  async function load() {
    refresh.disabled = true;
    try {
      orders = await adminRequest('/admin/orders');
      render();
    } catch (error) {
      showError(error);
    } finally {
      refresh.disabled = false;
    }
  }

  search.addEventListener('input', render);
  filter.addEventListener('change', render);
  refresh.addEventListener('click', load);
  body.addEventListener('change', async event => {
    const select = event.target.closest('[data-status]');
    if (!select || !select.value || select.value === select.dataset.currentStatus) return;
    const previous = select.dataset.currentStatus;
    const requested = select.value;
    if (requested === 'cancelled' && !window.confirm('Cancel this order and return its items to stock?')) {
      select.value = previous;
      return;
    }
    select.disabled = true;
    try {
      await adminRequest(`/admin/orders/${select.dataset.status}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: requested })
      });
      await load();
    } catch (error) {
      showError(error);
      select.disabled = false;
      select.value = previous;
    }
  });

  await load();
});
