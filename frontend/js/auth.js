document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const returnTo = params.get('return');
  const isAllowedReturn = value => value === 'checkout.html' || value === 'me.html' || /^me\.html#(?:orders|current-order|settings|order-\d+)$/.test(value || '');
  const safeReturn = isAllowedReturn(returnTo) ? returnTo : 'me.html';
  const checkoutNotice = document.querySelector('[data-checkout-login-notice]');
  if (checkoutNotice && returnTo === 'checkout.html') checkoutNotice.hidden = false;
  const switchLink = document.querySelector('a[href="register.html"],a[href="login.html"]');
  if (switchLink && isAllowedReturn(returnTo)) switchLink.href = `${switchLink.getAttribute('href')}?return=${encodeURIComponent(returnTo)}`;

  const registrationForm = document.querySelector('[data-register-form]');
  const updatePasswordRules = () => {
    if (!registrationForm) return;
    const password = registrationForm.elements.password.value;
    const met = { length: password.length >= 10, uppercase: /[A-Z]/.test(password), number: /\d/.test(password) };
    for (const [rule, passes] of Object.entries(met)) registrationForm.querySelector(`[data-rule="${rule}"]`).classList.toggle('is-met', passes);
  };
  const setFieldError = (form, name, message, reveal) => {
    const input = form.elements[name];
    const output = form.querySelector(`[data-error-for="${name}"]`);
    if (!input || !output) return;
    const show = reveal && Boolean(message);
    output.textContent = show ? message : '';
    output.hidden = !show;
    input.setAttribute('aria-invalid', show ? 'true' : 'false');
  };
  const validateRegistration = (form, reveal = true) => {
    const values = Object.fromEntries(new FormData(form));
    const password = values.password || '';
    const rulesMet = password.length >= 10 && /[A-Z]/.test(password) && /\d/.test(password);
    const errors = {
      name: values.name?.trim() ? '' : 'Please enter your full name.',
      email: !values.email ? 'Please enter your email address.' : !form.elements.email.validity.valid ? 'Please enter a valid email address.' : '',
      phone: values.phone?.trim() ? '' : 'Please enter your phone number.',
      password: rulesMet ? '' : 'Please create a stronger password using at least 10 characters, one uppercase letter, and one number.',
      confirm_password: values.confirm_password === password && password ? '' : 'Passwords do not match.',
      terms_accepted: form.elements.terms_accepted.checked ? '' : 'Please agree to the Terms of Service and Privacy Policy to continue.'
    };
    for (const [name, message] of Object.entries(errors)) setFieldError(form, name, message, reveal || form.elements[name].dataset.touched === 'true');
    return Object.values(errors).every(message => !message);
  };

  document.querySelectorAll('[data-toggle-password]').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const input = document.getElementById(toggle.dataset.togglePassword);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Hide' : 'Show';
      toggle.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} ${input.id === 'register-password' ? 'password' : 'confirmation password'}`);
      input.focus();
    });
  });
  if (registrationForm) {
    registrationForm.addEventListener('input', event => {
      if (event.target.name) event.target.dataset.touched = 'true';
      updatePasswordRules();
      if (event.target.name === 'confirm_password' || event.target.name === 'password') {
        const confirmInput = registrationForm.elements.confirm_password;
        if (confirmInput.value) setFieldError(registrationForm, 'confirm_password', confirmInput.value === registrationForm.elements.password.value ? '' : 'Passwords do not match.', true);
      }
      if (event.target.type === 'checkbox') validateRegistration(registrationForm, false);
    });
    registrationForm.addEventListener('blur', event => {
      if (event.target.name) {
        event.target.dataset.touched = 'true';
        validateRegistration(registrationForm, false);
      }
    }, true);
  }

  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!form.matches('[data-auth]')) return;
    event.preventDefault();
    const output = form.querySelector('[data-message]');
    const button = form.querySelector('button[type="submit"],button:not([type])');
    if (form.dataset.auth === 'register' && !validateRegistration(form, true)) {
      const firstInvalid = form.querySelector('[aria-invalid="true"],input[type="checkbox"]:invalid');
      firstInvalid?.focus();
      return;
    }

    let redirecting = false;
    output.hidden = true;
    output.classList.remove('is-success');
    if (button) { button.disabled = true; button.textContent = form.dataset.auth === 'register' ? 'Creating account...' : 'Please wait...'; }
    try {
      const values = Object.fromEntries(new FormData(form));
      delete values.confirm_password;
      delete values.terms_accepted;
      const data = await KapeAPI.request(`/auth/${form.dataset.auth}`, { method: 'POST', body: JSON.stringify(values) });
      if (data.csrf_token) sessionStorage.setItem('kape-csrf', data.csrf_token);
      if (form.dataset.auth === 'register') {
        output.textContent = 'Welcome to Kapeling Ka! Your account has been created.';
        output.classList.add('is-success');
        output.hidden = false;
        if (button) button.textContent = 'Welcome to KAPE';
        redirecting = true;
        window.setTimeout(() => { location.href = safeReturn; }, 900);
      } else {
        location.href = safeReturn;
      }
    } catch (error) {
      output.textContent = error.message;
      output.hidden = false;
      if (button) { button.disabled = false; button.textContent = form.dataset.auth === 'login' ? 'Sign in' : 'Create Account'; }
    } finally {
      if (!redirecting && button && !button.disabled) button.textContent = form.dataset.auth === 'login' ? 'Sign in' : 'Create Account';
    }
  });
});
