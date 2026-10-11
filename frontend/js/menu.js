async function loadMenu(){
  const grid=document.querySelector('[data-products]');if(!grid)return;
  const search=document.querySelector('[name=search]'),category=document.querySelector('[name=category]');
  async function render(){
    grid.innerHTML='<p class="muted">Loading the menu...</p>';
    try{
      const params=new URLSearchParams();if(search?.value)params.set('search',search.value);if(category?.value)params.set('category',category.value);
      const data=await KapeAPI.request(`/products?${params}`),products=data.items;
      if(!products.length){grid.innerHTML='<p class="empty">No drinks match your search.</p>';return;}
      grid.innerHTML=products.map(p=>{const available=Number(p.available)>0;return `<article class="card${available?'':' is-sold-out-card'}"><a class="product-image-link" href="product.html?id=${p.id}"><img src="${escapeHtml(p.image_path||'../macha1.jpg')}" alt="${escapeHtml(p.name)}">${available?'':'<span class="stock-badge is-sold-out">Sold out</span>'}</a><p class="eyebrow">${escapeHtml(p.category_name||'KAPE')}</p><h3><a href="product.html?id=${p.id}">${escapeHtml(p.name)}</a></h3><p class="muted">${escapeHtml(p.description||'Made fresh for your day.')}</p><p class="price">${window.KapeConfig.formatMoney(p.price)}</p><div class="product-actions"><button class="button" data-add="${p.id}" data-name="${escapeHtml(p.name)}" ${available?'':'disabled'}>${available?'Add to cart':'Sold out'}</button><button class="button secondary" data-buy-now="${p.id}" data-name="${escapeHtml(p.name)}" ${available?'':'disabled'}>${available?'Buy now':'Sold out'}</button></div></article>`;}).join('');
    }catch(error){grid.innerHTML=`<p class="notice error">${escapeHtml(error.message)}</p>`;}
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  async function loadFilters(){try{const categories=await KapeAPI.request('/categories');if(category)category.innerHTML='<option value="">All categories</option>'+categories.map(item=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');}catch{}}
  await loadFilters();render();search?.addEventListener('input',render);category?.addEventListener('change',render);
  grid.addEventListener('click',event=>{
    const add=event.target.closest('[data-add]'),buy=event.target.closest('[data-buy-now]'),button=add||buy;if(!button)return;
    KapeCart.add(button.dataset.add||button.dataset.buyNow,1,button.dataset.name);
    if(buy){location.href='checkout.html';return;}
    button.textContent='Added';setTimeout(()=>{if(button.isConnected)button.textContent='Add to cart';},900);
  });
}
document.addEventListener('DOMContentLoaded',loadMenu);
