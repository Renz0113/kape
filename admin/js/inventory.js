document.addEventListener('DOMContentLoaded', async () => {
  const adjustForm = document.querySelector('[data-adjust]');
  const productSelect = document.querySelector('[data-adjust-product]');
  const stockRows = document.querySelector('[data-stock-rows]');
  const movementRows = document.querySelector('[data-movement-rows]');
  const filterForm = document.querySelector('[data-movement-filters]');
  const pageError = document.querySelector('[data-error]');
  const successMessage = document.querySelector('[data-success]');
  if (!adjustForm || !productSelect || !stockRows || !movementRows || !filterForm) return;

  const LOW_STOCK_THRESHOLD = 5;
  const MOVEMENT_PAGE_SIZE = 100;
  let products = [];
  let movementsOffset = 0;
  let movementsTotal = 0;
  let stockFilter = 'all';
  let adjustmentDirection = 'add';
  let loading = false;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function showPageError(error) {
    pageError.textContent = error?.message || 'Inventory could not be loaded. Please try again.';
    pageError.hidden = false;
    successMessage.hidden = true;
  }

  function clearPageError() {
    pageError.textContent = '';
    pageError.hidden = true;
  }

  function stockState(product) {
    if (!Number(product.is_active)) return 'archived';
    const stock = Number(product.stock_quantity);
    if (stock <= 0) return 'out';
    return stock < LOW_STOCK_THRESHOLD ? 'low' : 'in';
  }

  function statusMarkup(product) {
    const state = stockState(product);
    const labels = {
      in: ['In Stock', 'Available to customers'],
      low: ['Low Stock', 'Restock soon'],
      out: ['Out of Stock', 'Unavailable'],
      archived: ['Archived', 'Hidden from menu']
    };
    const [label, detail] = labels[state];
    return `<span class="stock-status stock-status-${state}"><i aria-hidden="true"></i><strong>${label}</strong><small>${detail}</small></span>`;
  }

  function visibleProducts() {
    const query = document.querySelector('[data-product-search]').value.trim().toLowerCase();
    return products.filter(product => {
      const matchesText = `${product.name} ${product.category_name || ''}`.toLowerCase().includes(query);
      const matchesState = stockFilter === 'all' || stockState(product) === stockFilter;
      return matchesText && matchesState;
    });
  }

  function renderProducts() {
    const visible = visibleProducts();
    document.querySelector('[data-stock-empty]').hidden = visible.length > 0;
    stockRows.innerHTML = visible.length ? visible.map(product => {
      const state = stockState(product);
      const action = Number(product.is_active)
        ? `<button class="button secondary stock-adjust-action" type="button" data-adjust-product="${Number(product.id)}" data-direction="add">${state === 'out' ? 'Restock' : 'Adjust stock'}</button>`
        : '<span class="stock-archived-note">Archived product</span>';
      return `<tr><td><strong class="inventory-product-name">${escapeHtml(product.name)}</strong><small class="inventory-product-category">${escapeHtml(product.category_name || 'Uncategorized')}</small></td><td><strong class="stock-quantity">${Number(product.stock_quantity)}</strong><small>units</small></td><td>${statusMarkup(product)}</td><td>${action}</td></tr>`;
    }).join('') : '';
  }

  function updateSummary(summary) {
    document.querySelector('[data-total-products]').textContent = Number(summary.total_products);
    document.querySelector('[data-low-stock]').textContent = Number(summary.low_stock);
    document.querySelector('[data-out-of-stock]').textContent = Number(summary.out_of_stock);
    document.querySelector('[data-recent-movements]').textContent = Number(summary.movements_last_7_days);
  }

  function updateProductSelects() {
    const adjustValue = productSelect.value;
    const historySelect = filterForm.elements.product_id;
    const historyValue = historySelect.value;
    productSelect.innerHTML = '<option value="">Choose a product</option>' + products.map(product =>
      `<option value="${Number(product.id)}">${escapeHtml(product.name)} · Current stock: ${Number(product.stock_quantity)} units${Number(product.is_active) ? '' : ' · Archived'}</option>`
    ).join('');
    historySelect.innerHTML = '<option value="">All products</option>' + products.map(product =>
      `<option value="${Number(product.id)}">${escapeHtml(product.name)}</option>`
    ).join('');
    if (products.some(product => String(product.id) === adjustValue)) productSelect.value = adjustValue;
    if (products.some(product => String(product.id) === historyValue)) historySelect.value = historyValue;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function movementType(movement) {
    if (movement.movement_source === 'manual') return '<span class="movement-type movement-type-manual">Manual</span>';
    if (String(movement.reason).toLowerCase().includes('cancel')) return '<span class="movement-type movement-type-cancel">Automatic · Cancellation</span>';
    return '<span class="movement-type movement-type-order">Automatic · Order</span>';
  }

  function renderMovements(items, append) {
    const html = items.map(movement => {
      const change = Number(movement.quantity_change);
      const changeLabel = `${change > 0 ? '+' : ''}${change}`;
      const order = movement.order_reference
        ? `<a href="orders.html" class="movement-order-link" title="Open orders">${escapeHtml(movement.order_reference)}</a>`
        : '';
      const reason = `${escapeHtml(movement.reason)}${order ? `<small class="movement-order-reference">${order}</small>` : ''}`;
      const by = movement.admin_name ? escapeHtml(movement.admin_name) : movement.movement_source === 'automatic' ? 'System' : 'Admin';
      return `<tr><td><strong class="inventory-product-name">${escapeHtml(movement.product_name || 'Product unavailable')}</strong></td><td><span class="movement-change ${change > 0 ? 'movement-change-added' : 'movement-change-removed'}">${changeLabel}<small>${change > 0 ? 'Added' : 'Removed'}</small></span></td><td>${movementType(movement)}</td><td>${reason}</td><td>${formatDate(movement.created_at)}</td><td>${by}</td></tr>`;
    }).join('');
    if (!append) movementRows.innerHTML = html;
    else if (html) movementRows.insertAdjacentHTML('beforeend', html);
    document.querySelector('[data-movement-empty]').hidden = items.length > 0 || movementsOffset > 0;
  }

  function filterParams(offset = 0) {
    const values = new FormData(filterForm);
    const params = new URLSearchParams();
    params.set('search', String(values.get('search') || '').trim());
    params.set('product_id', String(values.get('product_id') || ''));
    params.set('type', String(values.get('type') || 'all'));
    params.set('offset', String(offset));
    params.set('limit', String(MOVEMENT_PAGE_SIZE));
    const dateRange = String(values.get('date_range') || 'all');
    const today = new Date().toISOString().slice(0, 10);
    if (dateRange === 'today') {
      params.set('date_from', today); params.set('date_to', today);
    } else if (dateRange === '7d' || dateRange === '30d') {
      const start = new Date(`${today}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() - (dateRange === '7d' ? 6 : 29));
      params.set('date_from', start.toISOString().slice(0, 10)); params.set('date_to', today);
    } else if (dateRange === 'custom') {
      params.set('date_from', String(values.get('date_from') || ''));
      params.set('date_to', String(values.get('date_to') || ''));
    }
    return params;
  }

  async function loadInventory({ append = false } = {}) {
    if (loading) return;
    loading = true;
    const offset = append ? movementsOffset : 0;
    try {
      const params = filterParams(offset);
      const data = await adminRequest(`/admin/inventory?${params}`);
      products = data.products || [];
      movementsTotal = Number(data.movement_total) || 0;
      if (!append) movementsOffset = 0;
      updateSummary(data.summary || {});
      updateProductSelects();
      renderProducts();
      if (!append) movementsOffset = 0;
      renderMovements(data.movements || [], append);
      movementsOffset += (data.movements || []).length;
      document.querySelector('[data-history-count]').textContent = `${movementsOffset} of ${movementsTotal} movement${movementsTotal === 1 ? '' : 's'}`;
      document.querySelector('[data-load-more]').hidden = movementsOffset >= movementsTotal;
      clearPageError();
      updateAdjustmentPreview();
    } catch (error) {
      showPageError(error);
    } finally {
      loading = false;
      updateAdjustmentPreview();
    }
  }

  function selectedProduct() {
    return products.find(product => String(product.id) === productSelect.value) || null;
  }

  function selectedReason() {
    const type = adjustForm.elements.reason_type.value;
    if (type === 'other') return adjustForm.elements.other_reason.value.trim();
    return type;
  }

  function updateAdjustmentPreview() {
    const product = selectedProduct();
    const name = document.querySelector('[data-preview-name]');
    const status = document.querySelector('[data-preview-status]');
    const current = document.querySelector('[data-preview-current]');
    const adjustment = document.querySelector('[data-preview-adjustment]');
    const next = document.querySelector('[data-preview-new]');
    const quantityInput = adjustForm.elements.quantity;
    const quantity = Number(quantityInput.value);
    const amount = Number.isInteger(quantity) && quantity > 0 ? quantity : 0;
    const signed = amount ? (adjustmentDirection === 'add' ? amount : -amount) : 0;
    const button = adjustForm.querySelector('[data-adjust-submit]');

    if (!product) {
      name.textContent = 'Choose a product';
      status.textContent = 'Current stock and adjustment preview will appear here.';
      current.textContent = '—';
      adjustment.textContent = '—';
      next.textContent = '—';
      button.disabled = loading;
      return;
    }

    const stock = Number(product.stock_quantity);
    const resulting = stock + signed;
    name.textContent = product.name;
    status.innerHTML = `${statusMarkup(product)}${Number(product.is_active) ? '' : '<span class="archived-preview-note">Stock can still be adjusted for archived products.</span>'}`;
    current.textContent = String(stock);
    adjustment.textContent = amount ? `${signed > 0 ? '+' : ''}${signed}` : 'Enter units to preview';
    next.textContent = amount ? String(resulting) : String(stock);
    adjustment.classList.toggle('is-negative', signed < 0);
    next.classList.toggle('is-invalid', resulting < 0);
    button.disabled = loading || !amount || resulting < 0;
  }

  function selectStockFilter(filter) {
    stockFilter = filter;
    document.querySelectorAll('[data-stock-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.stockFilter === filter)));
    renderProducts();
  }

  document.querySelector('[data-product-search]').addEventListener('input', renderProducts);
  document.querySelectorAll('[data-stock-filter]').forEach(button => button.addEventListener('click', () => selectStockFilter(button.dataset.stockFilter)));
  document.querySelectorAll('[data-summary-filter]').forEach(button => button.addEventListener('click', () => {
    document.querySelector('[data-product-search]').value = '';
    selectStockFilter(button.dataset.summaryFilter);
    document.querySelector('#stock-overview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  document.querySelector('[data-summary-action="history"]').addEventListener('click', () => {
    filterForm.elements.date_range.value = '7d';
    updateDateFields();
    loadInventory();
    document.querySelector('#inventory-history').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.querySelectorAll('[data-quick-filter]').forEach(button => button.addEventListener('click', () => {
    document.querySelector('[data-product-search]').value = '';
    selectStockFilter(button.dataset.quickFilter);
    document.querySelector('#stock-overview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  document.querySelectorAll('[data-scroll]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' })));

  stockRows.addEventListener('click', event => {
    const button = event.target.closest('[data-adjust-product]');
    if (!button) return;
    productSelect.value = button.dataset.adjustProduct;
    adjustmentDirection = button.dataset.direction || 'add';
    setAdjustmentDirection(adjustmentDirection);
    adjustForm.elements.quantity.value = '';
    updateAdjustmentPreview();
    document.querySelector('#adjust-stock').scrollIntoView({ behavior: 'smooth', block: 'start' });
    adjustForm.elements.quantity.focus({ preventScroll: true });
  });

  function setAdjustmentDirection(direction) {
    adjustmentDirection = direction;
    document.querySelectorAll('[data-adjust-type]').forEach(button => {
      const selected = button.dataset.adjustType === direction;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    updateAdjustmentPreview();
  }
  document.querySelectorAll('[data-adjust-type]').forEach(button => button.addEventListener('click', () => setAdjustmentDirection(button.dataset.adjustType)));
  productSelect.addEventListener('change', updateAdjustmentPreview);
  adjustForm.elements.quantity.addEventListener('input', updateAdjustmentPreview);
  adjustForm.elements.reason_type.addEventListener('change', () => {
    const other = adjustForm.querySelector('[data-other-reason-field]');
    const input = adjustForm.elements.other_reason;
    const show = adjustForm.elements.reason_type.value === 'other';
    other.hidden = !show;
    input.disabled = !show;
    input.required = show;
    if (show) input.focus();
  });

  adjustForm.addEventListener('reset', () => setTimeout(() => {
    adjustmentDirection = 'add';
    setAdjustmentDirection('add');
    productSelect.value = '';
    const other = adjustForm.querySelector('[data-other-reason-field]');
    other.hidden = true;
    adjustForm.elements.other_reason.disabled = true;
    adjustForm.elements.other_reason.required = false;
    updateAdjustmentPreview();
  }, 0));

  adjustForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!adjustForm.reportValidity()) return;
    const product = selectedProduct();
    const quantity = Number(adjustForm.elements.quantity.value);
    const change = adjustmentDirection === 'add' ? quantity : -quantity;
    const reason = selectedReason();
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000 || !reason || reason.length > 160) {
      showPageError(new Error('Choose a product, enter 1 to 10,000 units, and provide a valid reason.'));
      return;
    }
    const current = Number(product.stock_quantity);
    const resulting = current + change;
    if (resulting < 0) {
      showPageError(new Error('There is not enough stock to remove that quantity.'));
      return;
    }
    if ((quantity >= 10 || resulting === 0) && !window.confirm(`Confirm stock adjustment\n\nProduct: ${product.name}\nCurrent stock: ${current} units\nAdjustment: ${change > 0 ? '+' : ''}${change}\nNew stock: ${resulting} units\nReason: ${reason}`)) return;

    const button = adjustForm.querySelector('[data-adjust-submit]');
    button.disabled = true;
    button.textContent = 'Saving adjustment…';
    clearPageError();
    successMessage.hidden = true;
    try {
      const result = await adminRequest('/admin/inventory', {
        method: 'POST',
        body: JSON.stringify({ product_id: Number(product.id), quantity_change: change, reason })
      });
      successMessage.textContent = `${product.name}: stock updated to ${Number(result.stock_quantity)} units. The movement was added to inventory activity.`;
      successMessage.hidden = false;
      adjustForm.elements.quantity.value = '';
      adjustForm.elements.reason_type.value = '';
      adjustForm.elements.other_reason.value = '';
      adjustForm.elements.reason_type.dispatchEvent(new Event('change'));
      await loadInventory();
    } catch (error) {
      showPageError(error);
    } finally {
      button.textContent = 'Record adjustment';
      button.disabled = false;
      updateAdjustmentPreview();
    }
  });

  const dateRange = filterForm.elements.date_range;
  function updateDateFields() {
    const custom = dateRange.value === 'custom';
    for (const selector of ['[data-date-from-field]', '[data-date-to-field]']) {
      const field = filterForm.querySelector(selector);
      field.hidden = !custom;
      field.querySelector('input').disabled = !custom;
      field.querySelector('input').required = custom;
    }
  }
  dateRange.addEventListener('change', updateDateFields);
  filterForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!filterForm.reportValidity()) return;
    if (dateRange.value === 'custom' && filterForm.elements.date_from.value > filterForm.elements.date_to.value) {
      showPageError(new Error('Choose an end date on or after the start date.'));
      return;
    }
    await loadInventory();
  });
  filterForm.addEventListener('reset', () => setTimeout(() => {
    updateDateFields();
    loadInventory();
  }, 0));
  document.querySelector('[data-load-more]').addEventListener('click', () => loadInventory({ append: true }));

  await loadInventory();
});
