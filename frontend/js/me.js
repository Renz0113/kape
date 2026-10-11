document.addEventListener('DOMContentLoaded', () => {
  const $ = selector => document.querySelector(selector);
  const loading = $('[data-loading]');
  const dashboard = $('[data-dashboard]');
  const errorPanel = $('[data-error]');
  const addressFields = ['address_unit', 'address_subdivision', 'address_barangay', 'address_city', 'address_postal'];
  let legacySavedAddress = '';
  let locationTouched = false;
  let deliveryMap = null;
  let deliveryMarker = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const money = value => KapeConfig.formatMoney(value);
  const date = value => value
    ? new Date(String(value).replace(' ', 'T')).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  const dateOnly = value => value
    ? new Date(String(value).replace(' ', 'T')).toLocaleDateString('en-PH', { dateStyle: 'medium' })
    : '—';
  const statusText = (status, order = null) => {
    if (status === 'ready' && order?.fulfillment === 'delivery') return 'Out for delivery';
    if (status === 'ready' && order?.fulfillment === 'pickup') return 'Ready for pickup';
    return window.KapeOrderStatus?.labels?.[status] || 'Status unavailable';
  };
  const message = (selector, text, isError = false) => {
    const element = $(selector);
    element.textContent = text;
    element.hidden = !text;
    element.classList.toggle('is-error', isError);
  };

  function updateLocation(latitude, longitude, touched = true) {
    const latitudeField = $('[name="delivery_latitude"]');
    const longitudeField = $('[name="delivery_longitude"]');
    const state = $('[data-location-state]');
    const feedback = $('[data-location-feedback]');
    const clearButton = $('[data-clear-location]');
    locationTouched = touched || locationTouched;
    if (latitude === null || longitude === null) {
      latitudeField.value = '';
      longitudeField.value = '';
      if (deliveryMarker && deliveryMap) deliveryMap.removeLayer(deliveryMarker);
      deliveryMarker = null;
      state.textContent = 'Optional';
      feedback.textContent = 'No map pin selected. Your written address will be used.';
      clearButton.disabled = true;
      return;
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    latitudeField.value = lat.toFixed(7);
    longitudeField.value = lng.toFixed(7);
    if (deliveryMap && window.L) {
      if (!deliveryMarker) {
        deliveryMarker = window.L.marker([lat, lng], { draggable: true }).addTo(deliveryMap);
        deliveryMarker.on('dragend', () => {
          const point = deliveryMarker.getLatLng();
          updateLocation(point.lat, point.lng);
        });
      } else deliveryMarker.setLatLng([lat, lng]);
      deliveryMap.setView([lat, lng], Math.max(deliveryMap.getZoom(), 15));
    }
    state.textContent = 'Pin saved';
    feedback.textContent = `Selected location: ${lat.toFixed(5)}, ${lng.toFixed(5)}.`;
    clearButton.disabled = false;
  }

  function initializeLocationPicker(user) {
    const mapElement = $('[data-location-map]');
    const feedback = $('[data-location-feedback]');
    if (!mapElement) return;
    if (!window.L) {
      feedback.textContent = 'The map could not load. You can still save your written address and try again later.';
      return;
    }
    const hasSavedLocation = user.delivery_latitude !== null && user.delivery_latitude !== '' && user.delivery_longitude !== null && user.delivery_longitude !== '';
    const initial = hasSavedLocation && Number.isFinite(Number(user.delivery_latitude)) && Number.isFinite(Number(user.delivery_longitude))
      ? [Number(user.delivery_latitude), Number(user.delivery_longitude)] : [14.5995, 120.9842];
    deliveryMap = window.L.map(mapElement, { scrollWheelZoom: false }).setView(initial, user.delivery_latitude ? 15 : 11);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(deliveryMap);
    if (hasSavedLocation) {
      updateLocation(user.delivery_latitude, user.delivery_longitude, false);
    }
    deliveryMap.on('click', event => updateLocation(event.latlng.lat, event.latlng.lng));
    $('[data-locate-me]').addEventListener('click', () => {
      if (!navigator.geolocation) {
        feedback.textContent = 'Location services are not available in this browser. Click the map to place your pin.';
        return;
      }
      feedback.textContent = 'Finding your location…';
      navigator.geolocation.getCurrentPosition(
        position => updateLocation(position.coords.latitude, position.coords.longitude),
        error => {
          const reasons = { 1: 'Location permission was denied.', 2: 'Your location is unavailable right now.', 3: 'Location lookup took too long.' };
          feedback.textContent = `${reasons[error.code] || 'Could not find your location.'} Click the map to place your pin instead.`;
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    });
    $('[data-clear-location]').addEventListener('click', () => updateLocation(null, null));
    window.setTimeout(() => deliveryMap.invalidateSize(), 100);
  }

  function parseAddress(address) {
    const fields = { address_unit: '', address_subdivision: '', address_barangay: '', address_city: '', address_postal: '' };
    const labels = {
      'House / Street': 'address_unit',
      'Subdivision / Village / Community': 'address_subdivision',
      'Barangay': 'address_barangay',
      'City / Municipality': 'address_city',
      'Postal Code': 'address_postal'
    };
    const lines = String(address || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    let matched = false;
    for (const line of lines) {
      const separator = line.indexOf(':');
      if (separator < 0) continue;
      const key = line.slice(0, separator).trim();
      if (Object.prototype.hasOwnProperty.call(labels, key)) {
        fields[labels[key]] = line.slice(separator + 1).trim();
        matched = true;
      }
    }
    const raw = String(address || '').trim();
    if (!matched && lines.length) fields.address_unit = raw;
    return { ...fields, isLegacy: !matched && Boolean(raw), raw };
  }

  function serializeAddress(form) {
    const values = Object.fromEntries(addressFields.map(name => [name, String(form.elements[name].value || '').trim().replace(/\s+/g, ' ')]));
    const hasAddress = Object.values(values).some(Boolean);
    const requiredFields = ['address_unit', 'address_barangay', 'address_city', 'address_postal'];
    for (const name of addressFields) form.elements[name].setCustomValidity('');
    if (!hasAddress) return '';
    if (legacySavedAddress && values.address_unit && !values.address_subdivision && !values.address_barangay && !values.address_city && !values.address_postal) {
      return values.address_unit;
    }

    for (const name of requiredFields) {
      if (!values[name]) form.elements[name].setCustomValidity('Complete this field to save your delivery address.');
    }
    if (values.address_postal && !/^\d{4}$/.test(values.address_postal)) {
      form.elements.address_postal.setCustomValidity('Enter exactly 4 digits for the Philippine postal code.');
    }
    if (!form.reportValidity()) return null;

    const lines = [
      `House / Street: ${values.address_unit}`,
      values.address_subdivision ? `Subdivision / Village / Community: ${values.address_subdivision}` : '',
      `Barangay: ${values.address_barangay}`,
      `City / Municipality: ${values.address_city}`,
      `Postal Code: ${values.address_postal}`
    ].filter(Boolean);
    const address = lines.join('\n');
    if (address.length > 500) {
      message('[data-profile-message]', 'This address is too long. Please shorten the address details and save again.', true);
      return null;
    }
    return address;
  }

  function displayAddress(address) {
    const target = $('[data-profile-address]');
    const fields = parseAddress(address);
    legacySavedAddress = fields.isLegacy ? fields.raw : '';
    const displayFields = [
      ['House / Street', fields.address_unit],
      ['Subdivision / Village', fields.address_subdivision],
      ['Barangay', fields.address_barangay],
      ['City / Municipality', fields.address_city],
      ['Postal Code', fields.address_postal]
    ].filter(([, value]) => value);
    target.innerHTML = displayFields.length
      ? displayFields.map(([label, value]) => `<span><strong>${label}</strong>${esc(value)}</span>`).join('')
      : '<span class="address-not-set">No saved address yet.</span>';
    return fields;
  }

  function timeline(order) {
    const config = window.KapeOrderStatus;
    const steps = config?.flow || [];
    const current = steps.indexOf(order.status);
    if (order.status === 'cancelled') return '<p class="order-status-text is-cancelled">This order was cancelled. Its progress has stopped.</p>';
    if (current < 0) return `<p class="order-status-text">Current status: ${esc(statusText(order.status))}</p>`;
    return `<ol class="me-timeline" aria-label="Order progress">${steps.map((step, index) => `<li class="${index < current ? 'is-complete' : ''} ${index === current ? 'is-current' : ''}"${index === current ? ' aria-current="step"' : ''}><span class="timeline-dot" aria-hidden="true"></span><span class="timeline-label">${esc(statusText(step, order))}</span></li>`).join('')}</ol>`;
  }

  function deliveryPinLink(order) {
    if (!order || order.fulfillment !== 'delivery' || order.delivery_latitude === null || order.delivery_latitude === '' || order.delivery_longitude === null || order.delivery_longitude === '') return '';
    const latitude = Number(order.delivery_latitude);
    const longitude = Number(order.delivery_longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return '';
    const url = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=17/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`;
    return `<a class="order-map-link" href="${url}" target="_blank" rel="noopener noreferrer">View delivery pin</a>`;
  }

  function currentOrder(order) {
    if (!order) return '<div class="current-order-empty"><p class="muted">No active order right now. Your next favorite is waiting on the menu.</p><a class="button secondary" href="menu.html">Explore the menu</a></div>';
    const items = order.items || [];
    return `<div class="current-order-top"><div><strong>${esc(order.reference)}</strong><p class="order-date-line">${date(order.created_at)} <span>·</span> ${esc(order.fulfillment || 'pickup')}</p><span class="status-pill${order.status === 'cancelled' ? ' is-cancelled' : ''}">${esc(statusText(order.status, order))}</span>${order.payment_status ? `<p class="payment-line">Payment <strong>${esc(order.payment_status)}</strong></p>` : ''}${deliveryPinLink(order)}</div><div class="current-order-total"><span>Order total</span><strong>${money(order.total)}</strong></div></div>${timeline(order)}<ul class="current-order-items">${items.map(item => `<li><span>${esc(item.product_name || item.name)} × ${Number(item.quantity)}</span><span>${money(item.line_total)}</span></li>`).join('')}</ul>`;
  }

  function renderHistory(orders) {
    $('[data-order-count]').textContent = `${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`;
    const target = $('[data-order-history]');
    target.innerHTML = orders.length ? orders.map((order, index) => `<article class="history-order"><div class="history-summary"><strong>${esc(order.reference)}</strong><time>${date(order.created_at)}</time><span class="status-pill order-status-text${order.status === 'cancelled' ? ' is-cancelled' : ''}">${esc(statusText(order.status, order))}</span></div><div class="history-items">${(order.items || []).map(item => `<div class="history-item"><span><strong>${esc(item.product_name || item.name)}</strong><small>${Number(item.quantity)} × ${money(item.unit_price)}</small></span><img src="${esc(item.image_path || '../macha1.jpg')}" alt="" loading="lazy"></div>`).join('')}</div><div class="history-bottom"><strong class="order-total">${money(order.total)}</strong><div class="history-actions"><button type="button" data-reorder="${index}" ${order.items?.length ? '' : 'disabled'}>Order again <span aria-hidden="true">↗</span></button></div></div></article>`).join('') : '<p class="me-empty">Your order history will appear here after your first order.</p>';
    target.onclick = event => {
      const button = event.target.closest('[data-reorder]');
      if (!button) return;
      const order = orders[Number(button.dataset.reorder)];
      (order.items || []).forEach(item => KapeCart.add(item.product_id, item.quantity, item.product_name || item.name));
      location.href = 'cart.html';
    };
  }

  async function load() {
    loading.hidden = false;
    dashboard.hidden = true;
    errorPanel.hidden = true;
    try {
      const data = await KapeAPI.request('/account/dashboard');
      const user = data.profile || {};
      const form = $('[data-profile-form]');
      loading.hidden = true;
      dashboard.hidden = false;
      $('[data-welcome]').textContent = `Hello, ${user.name || 'there'}.`;
      $('[data-profile-name]').textContent = user.name || '';
      $('[data-profile-email]').textContent = user.email || '';
      $('[data-profile-phone]').textContent = user.phone || 'Not added';
      $('[data-profile-joined]').textContent = dateOnly(user.created_at);
      $('[data-avatar]').textContent = (user.name || 'K').trim().charAt(0).toUpperCase();
      for (const key of ['name', 'email', 'phone']) form.elements[key].value = user[key] || '';
      const address = displayAddress(user.delivery_address);
      for (const key of addressFields) form.elements[key].value = address[key] || '';
      if (!deliveryMap) initializeLocationPicker(user);
      $('[data-current-status]').textContent = data.current_order ? statusText(data.current_order.status, data.current_order) : 'All caught up';
      $('[data-current-order]').innerHTML = currentOrder(data.current_order);
      renderHistory(data.orders || []);
      const notices = data.notifications || [];
      $('[data-notifications]').innerHTML = notices.length ? notices.map(notice => `<article class="notification"><span class="notification-mark" aria-hidden="true"></span><div><strong>${esc(notice.message || statusText(notice.status))}</strong><small>${esc(notice.reference)} · ${date(notice.created_at)}</small></div><time>${esc(notice.kind || 'order')}</time></article>`).join('') : '<p class="me-empty">Order updates will appear here.</p>';
    } catch (error) {
      loading.hidden = true;
      if (error.status === 401) {
        location.replace(`login.html?return=${encodeURIComponent('me.html' + location.hash)}`);
        return;
      }
      errorPanel.hidden = false;
      $('[data-error-message]').textContent = error.message || 'Please try again.';
    }
  }

  $('[data-retry]').addEventListener('click', load);
  $('[data-edit-profile]').addEventListener('click', () => window.setTimeout(() => $('[data-profile-form] [name="name"]').focus(), 0));
  $('[data-edit-address]').addEventListener('click', () => window.setTimeout(() => $('[data-profile-form] [name="address_unit"]').focus(), 0));

  const profileForm = $('[data-profile-form]');
  profileForm.addEventListener('input', event => {
    if (addressFields.includes(event.target.name)) event.target.setCustomValidity('');
  });
  profileForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const deliveryAddress = serializeAddress(form);
    if (deliveryAddress === null || !form.reportValidity()) return;
    button.disabled = true;
    message('[data-profile-message]', 'Saving your details…');
    try {
      const payload = Object.fromEntries(['name', 'email', 'phone'].map(key => [key, form.elements[key].value.trim()]));
      payload.delivery_address = deliveryAddress;
      if (locationTouched) {
        payload.delivery_latitude = form.elements.delivery_latitude.value || null;
        payload.delivery_longitude = form.elements.delivery_longitude.value || null;
      }
      await KapeAPI.request('/account', { method: 'PATCH', body: JSON.stringify(payload) });
      message('[data-profile-message]', 'Your profile and delivery details have been saved.');
      await load();
    } catch (error) {
      message('[data-profile-message]', error.message || 'Your details could not be saved. Please try again.', true);
    } finally {
      button.disabled = false;
    }
  });

  $('[data-password-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    button.disabled = true;
    message('[data-password-message]', 'Updating password…');
    try {
      await KapeAPI.request('/account/password', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      form.reset();
      message('[data-password-message]', 'Your password has been updated.');
    } catch (error) {
      message('[data-password-message]', error.message || 'Your password could not be updated.', true);
    } finally {
      button.disabled = false;
    }
  });

  $('[data-logout]').addEventListener('click', async () => {
    const button = $('[data-logout]');
    button.disabled = true;
    try {
      await KapeAPI.request('/auth/logout', { method: 'POST', body: '{}' });
    } finally {
      sessionStorage.removeItem('kape-csrf');
      location.href = 'login.html';
    }
  });

  load();
});
