const adminRequest = (path, options = {}) => window.KapeAPI.request(path, options);

function showError(error) {
  let el = document.querySelector('[data-error]');
  if (!el) {
    el = document.createElement('p');
    el.className = 'notice error';
    el.dataset.error = '';
    document.querySelector('.admin-content')?.prepend(el);
  }
  el.textContent = error.message;
  el.hidden = false;
}

function escAdmin(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const adminNavigation = [
  ['index.html', 'Dashboard'],
  ['products.html', 'Products'],
  ['categories.html', 'Categories'],
  ['orders.html', 'Orders'],
  ['customers.html', 'Customers'],
  ['inventory.html', 'Inventory'],
  ['payments.html', 'Payments'],
  ['reports.html', 'Reports'],
  ['settings.html', 'Settings']
];

function setupAdminShell(header, sidebar) {
  const currentFile = location.pathname.split('/').filter(Boolean).at(-1) || 'index.html';
  header.innerHTML = `
    <button class="admin-menu-toggle" type="button" aria-label="Open admin navigation" aria-controls="admin-sidebar" aria-expanded="false" data-menu-toggle>
      <span></span><span></span><span></span>
    </button>
    <a class="brand admin-brand" href="index.html" aria-label="KAPE Admin dashboard"><span class="admin-brand-name">KAPE<span>.</span></span><span class="admin-brand-section">ADMIN</span></a>
    <nav class="admin-header-links" aria-label="Admin shortcuts">
      <a class="admin-store-link" href="../frontend/home.html">View storefront <span aria-hidden="true">↗</span></a>
      <div class="admin-userbar" data-userbar><span class="admin-muted">Checking access…</span></div>
    </nav>`;

  sidebar.id = 'admin-sidebar';
  sidebar.setAttribute('aria-hidden', String(window.matchMedia('(max-width: 900px)').matches));
  sidebar.innerHTML = `<div class="sidebar-heading">YOUR WORKSPACE</div><nav aria-label="Admin pages">${adminNavigation.map(([href, label]) =>
    `<a href="${href}"${href === currentFile ? ' class="is-current" aria-current="page"' : ''}>${label}</a>`
  ).join('')}<a href="users.html" data-admin-users-link${currentFile === 'users.html' ? ' class="is-current" aria-current="page"' : ''} hidden>Admin users</a></nav>`;

  const backdrop = document.createElement('button');
  backdrop.className = 'sidebar-backdrop';
  backdrop.type = 'button';
  backdrop.setAttribute('aria-label', 'Close admin navigation');
  backdrop.dataset.sidebarBackdrop = '';
  backdrop.hidden = true;
  header.after(backdrop);

  const toggle = header.querySelector('[data-menu-toggle]');
  const closeMenu = () => {
    document.body.classList.remove('admin-menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', String(window.matchMedia('(max-width: 900px)').matches));
    toggle.setAttribute('aria-label', 'Open admin navigation');
    backdrop.hidden = true;
  };
  toggle.addEventListener('click', () => {
    const open = !document.body.classList.contains('admin-menu-open');
    document.body.classList.toggle('admin-menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    sidebar.setAttribute('aria-hidden', String(!open && window.matchMedia('(max-width: 900px)').matches));
    toggle.setAttribute('aria-label', open ? 'Close admin navigation' : 'Open admin navigation');
    backdrop.hidden = !open;
  });
  backdrop.addEventListener('click', closeMenu);
  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 901px)').matches) {
      closeMenu();
      sidebar.setAttribute('aria-hidden', 'false');
    }
  });
  sidebar.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });

  return {
    currentFile,
    adminUsersLink: sidebar.querySelector('[data-admin-users-link]'),
    userbar: header.querySelector('[data-userbar]')
  };
}

async function setupAdminAccess() {
  const header = document.querySelector('[data-admin-header]');
  const sidebar = document.querySelector('[data-admin-sidebar]');
  const main = document.querySelector('.admin-content');
  if (!header || !sidebar || !main || location.pathname.endsWith('/login.html')) return;

  const { adminUsersLink, userbar } = setupAdminShell(header, sidebar);
  const panel = document.createElement('section');
  panel.className = 'admin-auth-panel';
  panel.hidden = true;
  panel.dataset.authPanel = '';
  panel.innerHTML = '<div><span class="admin-kicker">ADMIN ACCESS</span><h2>Sign in to your store</h2><p class="admin-muted" data-auth-note>Use an account with the admin role to manage KAPE. For local XAMPP access, set your account role to <code>admin</code> in phpMyAdmin &rarr; kape &rarr; users.</p><a href="login.html">Open the admin sign-in page</a></div><form class="admin-login-form" data-admin-login><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button class="button">Sign in</button></form>';
  main.prepend(panel);

  const form = panel.querySelector('form');
  const note = panel.querySelector('[data-auth-note]');
  const showUser = user => {
    if (user?.role === 'admin') {
      panel.hidden = true;
      adminUsersLink.hidden = false;
      userbar.innerHTML = `<span class="admin-user-dot" aria-hidden="true"></span><span class="admin-user-name">${escAdmin(user.name)} <small>ADMIN</small></span><a class="admin-manage-link" href="users.html">Admin users</a><button class="admin-logout" type="button" data-admin-logout>Sign out</button>`;
      userbar.querySelector('[data-admin-logout]').onclick = async () => {
        try { await adminRequest('/auth/logout', { method: 'POST', body: '{}' }); }
        finally { sessionStorage.removeItem('kape-csrf'); location.reload(); }
      };
    } else {
      panel.hidden = false;
      userbar.innerHTML = user
        ? `<span class="admin-muted">Signed in as ${escAdmin(user.email)} · customer account</span>`
        : '<span class="admin-muted">Not signed in</span>';
      adminUsersLink.hidden = true;
      userbar.insertAdjacentHTML('beforeend', '<a class="admin-login-link" href="login.html">Admin login</a>');
      if (user) note.textContent = 'This account is currently a customer. In phpMyAdmin, update this account in kape.users and set role to admin, then sign in again.';
    }
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Signing in…';
    note.textContent = 'Checking your account…';
    try {
      const data = await adminRequest('/auth/login', {
        method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      if (data.user?.role !== 'admin') {
        showUser(data.user);
        note.textContent = 'This account does not have administrator access. Change its role in the users table, then sign in again.';
        return;
      }
      location.reload();
    } catch (error) {
      note.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });

  try {
    const data = await adminRequest('/auth/session');
    showUser(data.user);
  } catch (error) {
    showUser(null);
    note.textContent = error.message;
  }
}

document.addEventListener('DOMContentLoaded', setupAdminAccess);



