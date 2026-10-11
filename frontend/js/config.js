(() => {
  const script = document.currentScript;
  const apiBaseUrl = new URL('../../api/v1', script.src).href.replace(/\/$/, '');
  const shopName = 'KAPE';
  const currency = 'PHP';
  const currencyFormatter = new Intl.NumberFormat('en-PH', {
    style: 'currency', currency, currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  window.KapeConfig = Object.freeze({
    shopName,
    currency,
    currencySymbol: '\u20B1',
    apiBaseUrl,
    formatMoney: amount => currencyFormatter.format(Number(amount) || 0)
  });
  document.querySelectorAll('.brand').forEach(brand => {
    const name = [...brand.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
    if (name) name.nodeValue = name.nodeValue.replace(/KAPE/i, shopName);
  });
  document.title = document.title.replace(/\bKAPE\b/gi, shopName);
})();
