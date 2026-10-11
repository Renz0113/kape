document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('[data-login-form]');
  const message = document.querySelector('[data-login-message]');
  const button = form.querySelector('button');
  const showMessage = value => { message.textContent = value; message.hidden = false; };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    button.textContent = 'Signing in...';
    message.hidden = true;
    try {
      const data = await adminRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      if (String(data.user?.role || '').toLowerCase() !== 'admin') {
        showMessage('The password is correct, but this account is not an administrator. Set its role to admin in the same database used by the app, then sign in again.');
        return;
      }
      location.replace('index.html');
    } catch (error) {
      showMessage(error.message === 'Failed to fetch'
        ? `Could not reach the KAPE API at ${window.KapeAPI.base}. Check that Apache and MySQL are running.`
        : error.message);
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });

  // Keep the form usable even if this optional existing-session check is slow.
  adminRequest('/auth/session').then(session => {
    if (session.user?.role === 'admin') location.replace('index.html');
  }).catch(() => {});
});
