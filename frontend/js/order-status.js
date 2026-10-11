(() => {
  const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
  const labels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: 'Ready',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  const descriptions = {
    pending: 'Your order has been received.',
    confirmed: 'The café has confirmed your order.',
    preparing: 'Your drinks are being prepared.',
    ready: 'Your order is ready.',
    completed: 'Your order is complete. Enjoy your KAPE.',
    cancelled: 'This order has been cancelled.'
  };
  const flow = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
  const transitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['completed'],
    completed: [],
    cancelled: []
  };
  window.KapeOrderStatus = Object.freeze({
    statuses: Object.freeze(statuses),
    labels: Object.freeze(labels),
    descriptions: Object.freeze(descriptions),
    flow: Object.freeze(flow),
    transitions: Object.freeze(Object.fromEntries(Object.entries(transitions).map(([key, value]) => [key, Object.freeze(value)])))
  });
})();
