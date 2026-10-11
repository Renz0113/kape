document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('[data-admin-form]');
  const rows = document.querySelector('[data-admin-rows]');
  const success = document.querySelector('[data-success]');
  const load = async () => {
    try {
      const users = await adminRequest('/admin/users');
      rows.innerHTML = users.length
        ? users.map(user => `<tr><td>${escAdmin(user.name)}</td><td><a href="mailto:${encodeURIComponent(user.email)}">${escAdmin(user.email)}</a></td><td>${escAdmin(user.created_at || '-')}</td></tr>`).join('')
        : '<tr><td colspan="3">No admin accounts found.</td></tr>';
    } catch (error) {
      rows.innerHTML = error.status === 401 || error.status === 403
        ? '<tr><td colspan="3">Admin sign-in required. <a href="login.html">Sign in to continue</a>.</td></tr>'
        : `<tr><td colspan="3">${escAdmin(error.message)}</td></tr>`;
      showError(error);
    }
  };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    success.hidden = true;
    try {
      const user = await adminRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      form.reset();
      success.textContent = `Admin account created for ${user.email}.`;
      success.hidden = false;
      await load();
    } catch (error) {
      showError(error);
    } finally {
      button.disabled = false;
    }
  });
  load();
});
