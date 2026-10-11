document.addEventListener('DOMContentLoaded', async () => {
  const body = document.querySelector('[data-rows]');
  const form = document.querySelector('[data-product-form]');
  const formTitle = document.querySelector('[data-product-form-title]');
  const imageInput = form?.querySelector('[data-image-input]');
  const imagePreview = form?.querySelector('[data-image-preview]');
  const imagePlaceholder = form?.querySelector('[data-image-placeholder]');
  const imageAction = form?.querySelector('[data-image-action]');
  const imageMessage = form?.querySelector('[data-image-message]');
  const removeImageButton = form?.querySelector('[data-remove-image]');
  const saveButton = form?.querySelector('button[type="submit"], button:not([type])');
  if (!body || !form || !imageInput) return;

  const maximumImageBytes = 5 * 1024 * 1024;
  const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);
  let products = [];
  let currentImagePath = '';
  let previewUrl = '';

  imagePreview.addEventListener('error', () => {
    imagePreview.hidden = true;
    imagePlaceholder.hidden = false;
    imagePlaceholder.textContent = 'Image preview unavailable';
  });
  imagePreview.addEventListener('load', () => {
    imagePlaceholder.textContent = 'No image selected';
  });

  function setImageMessage(text = '', isError = false) {
    imageMessage.textContent = text;
    imageMessage.hidden = !text;
    imageMessage.classList.toggle('is-error', isError);
  }

  function safeImagePath(value) {
    const path = String(value || '').trim();
    if (!/^(?:\.\.\/)?[a-zA-Z0-9_./-]+\.(?:jpg|jpeg|png|webp)$/i.test(path)) return '';
    if (path.replace(/^\.\.\//, '').split('/').includes('..')) return '';
    return path;
  }

  function updateImagePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';

    const selectedFile = imageInput.files[0];
    let source = '';
    if (imageAction.value === 'replace' && selectedFile) {
      previewUrl = URL.createObjectURL(selectedFile);
      source = previewUrl;
    } else if (imageAction.value === 'keep') {
      source = safeImagePath(currentImagePath);
    }

    imagePreview.hidden = !source;
    imagePlaceholder.hidden = Boolean(source);
    if (source) imagePreview.src = source;
    removeImageButton.disabled = !currentImagePath && imageAction.value !== 'replace';
    removeImageButton.textContent = imageAction.value === 'remove'
      ? 'Undo Remove'
      : imageAction.value === 'replace' ? 'Clear Selection' : 'Remove Image';
  }

  function clearImageState() {
    currentImagePath = '';
    imageInput.value = '';
    imageAction.value = 'keep';
    setImageMessage();
    updateImagePreview();
  }

  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();
    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedExtensions.has(extension) || (file.type && !allowedMimeTypes.has(file.type))) {
      imageInput.value = '';
      setImageMessage('Choose a valid JPG, JPEG, PNG, or WEBP image.', true);
      imageAction.value = 'keep';
      updateImagePreview();
      return;
    }
    if (file.size > maximumImageBytes) {
      imageInput.value = '';
      setImageMessage('The image is too large. Choose an image smaller than 5 MB.', true);
      imageAction.value = 'keep';
      updateImagePreview();
      return;
    }

    imageAction.value = 'replace';
    setImageMessage(`${file.name} is ready to upload.`);
    updateImagePreview();
  });

  removeImageButton.addEventListener('click', () => {
    if (imageAction.value === 'remove') {
      imageAction.value = 'keep';
      setImageMessage('The current image will be kept.');
    } else if (imageAction.value === 'replace') {
      imageInput.value = '';
      imageAction.value = 'keep';
      setImageMessage(currentImagePath ? 'The current image will be kept.' : 'The selected image was cleared.');
    } else if (currentImagePath) {
      imageAction.value = 'remove';
      setImageMessage('The image will be removed when you save the product.');
    }
    updateImagePreview();
  });

  form.addEventListener('reset', () => {
    clearImageState();
    form.elements.id.value = '';
    formTitle.textContent = 'Add Product';
  });

  async function loadProducts() {
    try {
      products = await adminRequest('/admin/products');
      body.innerHTML = products.map(product => {
        const imagePath = safeImagePath(product.image_path);
        const thumbnail = imagePath
          ? `<div class="product-thumbnail"><img src="${escAdmin(imagePath)}" alt="" loading="lazy" data-product-thumbnail><span class="product-thumbnail-placeholder" hidden>No image</span></div>`
          : '<div class="product-thumbnail"><span class="product-thumbnail-placeholder">No image</span></div>';
        return `<tr><td>${Number(product.id)}</td><td>${thumbnail}</td><td>${escAdmin(product.name)}</td><td>${KapeConfig.formatMoney(product.price)}</td><td>${Number(product.stock_quantity)}</td><td>${product.available ? 'Available' : 'Archived / out of stock'}</td><td><button class="button secondary" type="button" data-edit="${Number(product.id)}">Edit</button> <button class="button secondary" type="button" data-archive="${Number(product.id)}">Archive</button></td></tr>`;
      }).join('');
    } catch (error) {
      showError(error);
    }
  }

  body.addEventListener('error', event => {
    const image = event.target.closest('[data-product-thumbnail]');
    if (!image) return;
    image.hidden = true;
    image.nextElementSibling.hidden = false;
  }, true);

  try {
    const categories = await adminRequest('/admin/categories');
    form.elements.category_id.innerHTML = '<option value="">No category</option>'
      + categories.filter(category => category.is_active)
        .map(category => `<option value="${Number(category.id)}">${escAdmin(category.name)}</option>`).join('');
  } catch (error) {
    showError(error);
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setImageMessage();
    if (imageAction.value === 'replace' && !imageInput.files[0]) {
      setImageMessage('Choose an image file before saving.', true);
      imageInput.focus();
      return;
    }
    if (!form.reportValidity()) return;

    const values = new FormData(form);
    const id = values.get('id');
    values.set('category_id', values.get('category_id') || '');
    saveButton.disabled = true;
    saveButton.textContent = imageAction.value === 'replace' ? 'Uploading…' : 'Saving…';

    try {
      await adminRequest(id ? `/admin/products/${encodeURIComponent(id)}` : '/admin/products', {
        method: id ? 'PATCH' : 'POST',
        body: values
      });
      form.reset();
      setImageMessage('Product saved.');
      await loadProducts();
    } catch (error) {
      showError(error);
      setImageMessage(error.message || 'The product image could not be saved.', true);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save product';
    }
  });

  body.addEventListener('click', async event => {
    const editId = event.target.closest('[data-edit]')?.dataset.edit;
    if (editId) {
      const product = products.find(item => String(item.id) === editId);
      if (!product) return;
      form.reset();
      for (const key of ['id', 'name', 'slug', 'category_id', 'description', 'price', 'stock_quantity']) {
        form.elements[key].value = product[key] ?? '';
      }
      currentImagePath = safeImagePath(product.image_path);
      imageAction.value = 'keep';
      formTitle.textContent = 'Edit Product';
      setImageMessage(currentImagePath ? 'Current product image.' : 'This product has no image yet.');
      updateImagePreview();
      saveButton.textContent = 'Save product';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    const archiveId = event.target.closest('[data-archive]')?.dataset.archive;
    if (!archiveId || !confirm('Archive this product?')) return;
    try {
      await adminRequest(`/admin/products/${encodeURIComponent(archiveId)}`, { method: 'DELETE' });
      await loadProducts();
    } catch (error) {
      showError(error);
    }
  });

  await loadProducts();
});
