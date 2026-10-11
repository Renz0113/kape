(() => {
  const summary = document.querySelector('[data-summary]');
  const chart = document.querySelector('[data-sales-chart]');
  const rangeButtons = [...document.querySelectorAll('[data-range]')];
  const rangeForm = document.querySelector('[data-custom-range]');
  const caption = document.querySelector('[data-range-caption]');
  if (!summary || !chart || !rangeForm) return;

  let requestId = 0;
  let selectedRange = '7d';
  const money = value => KapeConfig.formatMoney(Number(value) || 0);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const utcDate = date => date.toISOString().slice(0, 10);
  const rangeDescription = (range, start, end) => {
    if (range === 'today') return 'Today';
    if (range === '7d') return 'Last 7 days';
    if (range === '30d') return 'Last 30 days';
    const format = value => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
    return `${format(start)} – ${format(end)}`;
  };

  function metric(label, value, detail = '') {
    return `<article class="metric"><span>${label}</span><strong>${value}</strong>${detail ? `<small>${detail}</small>` : ''}</article>`;
  }

  function renderMetrics(data) {
    const top = data.top_selling;
    const periodName = data.range.type === 'today' ? 'today' : data.range.type === 'custom' ? 'selected dates' : `last ${data.range.type === '7d' ? '7' : '30'} days`;
    const topValue = top ? escapeHtml(top.name) : 'No sales yet';
    const topDetail = top ? `${Number(top.quantity)} sold` : 'Selected period';
    summary.innerHTML = [
      metric('Sales today', money(data.sales_today)),
      metric('Orders today', Number(data.orders_today)),
      metric('Average order', money(data.average_order), periodName),
      metric('Pending orders', Number(data.pending_orders)),
      metric('Low stock', Number(data.low_stock), 'Products below 5 units'),
      metric(`Top selling · ${periodName}`, topValue, topDetail)
    ].join('');
  }

  function completeSeries(data) {
    const start = new Date(`${data.range.start}T00:00:00Z`);
    const end = new Date(`${data.range.end}T00:00:00Z`);
    const values = new Map((data.sales_series || []).map(item => [item.date, Number(item.sales) || 0]));
    const days = [];
    for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
      const key = utcDate(date);
      days.push({ date: key, sales: values.get(key) || 0 });
    }
    return days;
  }

  function renderChart(data) {
    const days = completeSeries(data);
    const width = 760;
    const height = 270;
    const left = 62;
    const right = 744;
    const top = 18;
    const bottom = 205;
    const max = Math.max(1, ...days.map(day => day.sales));
    const points = days.map((day, index) => ({
      ...day,
      x: days.length === 1 ? (left + right) / 2 : left + index * (right - left) / (days.length - 1),
      y: bottom - day.sales / max * (bottom - top)
    }));
    const lines = [0, 0.5, 1].map(fraction => {
      const y = bottom - fraction * (bottom - top);
      const label = money(max * fraction).replace(/\.00(?=\s|$)/, '');
      return `<line class="chart-grid-line" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text class="chart-axis-label" x="${left - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(label)}</text>`;
    }).join('');

    let graph;
    if (points.length === 1) {
      const point = points[0];
      const barHeight = Math.max(3, bottom - point.y);
      graph = `<rect class="chart-single-bar" x="${point.x - 25}" y="${bottom - barHeight}" width="50" height="${barHeight}" rx="8"/><circle class="chart-point" cx="${point.x}" cy="${point.y}" r="5"/>`;
    } else {
      const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
      const area = `${path} L ${right} ${bottom} L ${left} ${bottom} Z`;
      graph = `<path class="chart-area" d="${area}"/><path class="chart-line" d="${path}"/>${points.map(point => `<circle class="chart-point" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.5"><title>${escapeHtml(point.date)}: ${escapeHtml(money(point.sales))}</title></circle>`).join('')}`;
    }

    const labelCount = Math.min(7, points.length);
    const labelIndexes = new Set(Array.from({ length: labelCount }, (_, index) => Math.round(index * (points.length - 1) / Math.max(1, labelCount - 1))));
    const labels = [...labelIndexes].map(index => {
      const point = points[index];
      const label = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${point.date}T00:00:00Z`));
      return `<text class="chart-date-label" x="${point.x}" y="${bottom + 27}" text-anchor="middle">${escapeHtml(label)}</text>`;
    }).join('');

    chart.innerHTML = `<svg class="sales-chart-svg" viewBox="0 0 ${width} ${height}" role="presentation" focusable="false"><g>${lines}</g>${graph}<g>${labels}</g></svg><div class="sales-chart-summary"><span><i></i>Sales</span><strong>${escapeHtml(money(data.sales))} <small>${escapeHtml(rangeDescription(data.range.type, data.range.start, data.range.end))}</small></strong></div>`;
    chart.setAttribute('aria-label', `Sales from ${data.range.start} to ${data.range.end}: ${money(data.sales)} total.`);
  }

  async function loadRange(range, dates = {}) {
    const activeRequest = ++requestId;
    selectedRange = range;
    rangeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.range === range)));
    chart.classList.add('is-loading');
    chart.setAttribute('aria-busy', 'true');
    try {
      const params = new URLSearchParams({ range });
      if (range === 'custom') {
        params.set('start', dates.start);
        params.set('end', dates.end);
      }
      const data = await adminRequest(`/admin/dashboard?${params}`);
      if (activeRequest !== requestId) return;
      renderMetrics(data);
      renderChart(data);
      caption.textContent = `Sales from ${rangeDescription(data.range.type, data.range.start, data.range.end).toLowerCase()}.`;
    } catch (error) {
      if (activeRequest !== requestId) return;
      chart.innerHTML = '<p class="sales-chart-empty">Sales overview could not be loaded. Please try again.</p>';
      showError(error);
    } finally {
      if (activeRequest === requestId) {
        chart.classList.remove('is-loading');
        chart.setAttribute('aria-busy', 'false');
      }
    }
  }

  rangeButtons.forEach(button => button.addEventListener('click', () => {
    const range = button.dataset.range;
    if (range === 'custom') {
      rangeButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      rangeForm.hidden = false;
      if (!rangeForm.elements.start.value || !rangeForm.elements.end.value) {
        const end = new Date(`${utcDate(new Date())}T00:00:00Z`);
        const start = new Date(end);
        start.setUTCDate(start.getUTCDate() - 6);
        rangeForm.elements.start.value = utcDate(start);
        rangeForm.elements.end.value = utcDate(end);
      }
      return;
    }
    rangeForm.hidden = true;
    loadRange(range);
  }));

  rangeForm.addEventListener('submit', event => {
    event.preventDefault();
    const dates = Object.fromEntries(new FormData(rangeForm));
    if (!dates.start || !dates.end || dates.start > dates.end) {
      rangeForm.elements.end.setCustomValidity('Choose an end date on or after the start date.');
      rangeForm.elements.end.reportValidity();
      return;
    }
    rangeForm.elements.end.setCustomValidity('');
    loadRange('custom', dates);
  });
  rangeForm.elements.end.addEventListener('input', () => rangeForm.elements.end.setCustomValidity(''));

  loadRange(selectedRange);
})();

