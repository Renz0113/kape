document.addEventListener('DOMContentLoaded', async () => {
  const report = document.querySelector('[data-report]');
  try {
    const orders = await adminRequest('/admin/orders');
    const total = orders.reduce((sum, order) => sum + Number(order.total), 0);
    const average = orders.length ? total / orders.length : 0;
    const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    const statusRows = statuses.map(status => `<tr><td>${status}</td><td>${orders.filter(order => order.status === status).length}</td></tr>`).join('');
    const fulfillmentRows = ['pickup', 'delivery'].map(kind => `<tr><td>${kind}</td><td>${orders.filter(order => order.fulfillment === kind).length}</td></tr>`).join('');
    report.innerHTML = `<div class="metric-grid"><article class="metric"><span>Orders in report</span><strong>${orders.length}</strong></article><article class="metric"><span>Order value</span><strong>${window.KapeConfig.formatMoney(total)}</strong></article><article class="metric"><span>Average order</span><strong>${window.KapeConfig.formatMoney(average)}</strong></article><article class="metric"><span>Active orders</span><strong>${orders.filter(order => ['pending','confirmed','preparing','ready'].includes(order.status)).length}</strong></article></div><div class="report-grid"><section><h2>Orders by status</h2><table><thead><tr><th>Status</th><th>Orders</th></tr></thead><tbody>${statusRows}</tbody></table></section><section><h2>Fulfillment</h2><table><thead><tr><th>Type</th><th>Orders</th></tr></thead><tbody>${fulfillmentRows}</tbody></table></section></div><p class="muted">Based on the latest ${orders.length} orders (up to 200). Order value includes all statuses, including cancelled orders.</p>`;
  } catch (error) { showError(error); report.textContent = 'The report could not be loaded.'; }
});
