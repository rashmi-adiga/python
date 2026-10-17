async function api(endpoint, data) {
  const response = await fetch('api/' + endpoint, {
    method: data === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error(
      'Sign-in is unavailable on this website. Please contact your program coordinator for the program login address.',
    );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}
const demoPages =
  location.hostname === 'rashmi-adiga.github.io' &&
  location.pathname.startsWith('/python/');
const demoAccount = { username: 'rashmi', password: 'demo' };
function demoLogin(data) {
  if (
    data.username.trim().toLowerCase() !== demoAccount.username ||
    data.password !== demoAccount.password
  )
    throw new Error('The username or password is incorrect. Please try again.');
  sessionStorage.setItem('pathfinder_demo_user', demoAccount.username);
  return { role: 'student' };
}
const login = document.querySelector('#login-form');
const reset = document.querySelector('#reset-form');
const result = document.querySelector('.password-result');
const generated = document.querySelector('#new-password');
const recovery = document.querySelector('#recovery');
if (demoPages && login) {
  const notice = document.createElement('p');
  notice.className = 'form-status';
  notice.setAttribute('role', 'status');
  notice.textContent =
    'Demo access only. This browser-side sign-in does not protect the public course.';
  login.before(notice);
}
function revealRecovery() {
  if (recovery && location.hash === '#recovery') recovery.open = true;
}
revealRecovery();
window.addEventListener('hashchange', revealRecovery);
document
  .querySelector('[data-toggle-password]')
  ?.addEventListener('click', (event) => {
    const input = document.querySelector('#password');
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    event.currentTarget.textContent = visible ? 'Hide' : 'Show';
    event.currentTarget.setAttribute('aria-pressed', String(visible));
  });
login?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = login.querySelector('[type=submit]');
  const status = document.querySelector('#login-status');
  button.disabled = true;
  status.textContent = 'Signing you in…';
  try {
    const data = Object.fromEntries(new FormData(login));
    const user = demoPages ? demoLogin(data) : await api('login', data);
    location.assign(
      user.role === 'coordinator' ? 'coordinator.html' : 'course.html',
    );
  } catch (error) {
    status.textContent =
      error.message === 'Failed to fetch'
        ? 'Unable to connect. Check your connection and try again.'
        : error.message;
  } finally {
    button.disabled = false;
  }
});
if (reset) {
  api('session')
    .then((user) => {
      if (user.role !== 'coordinator') {
        location.replace('login.html');
        return;
      }
      document.querySelector('[data-account-name]').textContent = user.username;
    })
    .catch(() => location.replace('login.html'));
  reset.addEventListener('submit', async (event) => {
    event.preventDefault();
    result.hidden = true;
    generated.value = '';
    const button = reset.querySelector('[type=submit]');
    const status = document.querySelector('#reset-status');
    button.disabled = true;
    status.textContent = 'Generating a new password…';
    try {
      const response = await api(
        'reset-password',
        Object.fromEntries(new FormData(reset)),
      );
      generated.value = response.password;
      result.hidden = false;
      status.textContent =
        'Password updated. Share it privately with the student.';
      reset.querySelector('[type=checkbox]').checked = false;
      generated.focus();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}
document
  .querySelector('[data-copy-password]')
  ?.addEventListener('click', async () => {
    const status = document.querySelector('#reset-status');
    try {
      await navigator.clipboard.writeText(generated.value);
      status.textContent =
        'Password copied. Share it privately with the student.';
    } catch {
      generated.focus();
      generated.select();
      status.textContent =
        'Copy is unavailable. Select and copy the password manually.';
    }
  });
document
  .querySelector('[data-clear-password]')
  ?.addEventListener('click', () => {
    generated.value = '';
    result.hidden = true;
    document.querySelector('#reset-status').textContent =
      'Password cleared from this screen. The new password remains active.';
    document.querySelector('#student-username').focus();
  });
window.addEventListener('pagehide', () => {
  if (generated) {
    generated.value = '';
    result.hidden = true;
  }
});
document
  .querySelector('[data-sign-out]')
  ?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try {
      if (demoPages) sessionStorage.removeItem('pathfinder_demo_user');
      else await api('logout', {});
      location.assign('login.html');
    } catch (error) {
      let status = document.querySelector('[data-account-status]');
      if (!status) {
        status = document.createElement('p');
        status.setAttribute('role', 'status');
        document.querySelector('main').prepend(status);
      }
      status.textContent = error.message;
      const button = document.querySelector('[data-sign-out]');
      button.disabled = false;
    }
  });
