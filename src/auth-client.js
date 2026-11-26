import { createClient } from '@supabase/supabase-js';

let clientPromise;
export function authClient() {
  clientPromise ||= fetch('/api/config', { cache: 'no-store' }).then(async (response) => {
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || 'Không tải được cấu hình đăng nhập.');
    if (config.auth !== 'supabase') return null;
    return createClient(config.supabaseUrl, config.supabaseKey);
  });
  return clientPromise;
}

export async function accessToken(refresh = false) {
  const client = await authClient();
  if (!client) return '';
  const { data, error } = refresh
    ? await client.auth.refreshSession()
    : await client.auth.getSession();
  if (error || !data.session) {
    location.assign('/login.html');
    throw new Error('Hãy đăng nhập lại.');
  }
  return data.session.access_token;
}

export async function startWorkspace() {
  const client = await authClient();
  if (!client) return;
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    location.replace('/login.html');
    await new Promise(() => {});
  }
  document.documentElement.dataset.userId = data.session.user.id;
  const email = data.session.user.email || 'Tài khoản';
  document.querySelector('.profile-mini > div').textContent = email;
  document.querySelector('.avatar').textContent = email.slice(0, 2).toUpperCase();
  const button = document.createElement('button');
  button.className = 'theme-toggle';
  button.type = 'button';
  button.textContent = 'Đăng xuất';
  button.title = email;
  button.onclick = async () => {
    if (!window.confirm('Đăng xuất? Hãy lưu bản nháp đang viết trước khi tiếp tục.')) return;
    const { error } = await client.auth.signOut();
    if (error) {
      window.alert('Chưa đăng xuất được. Hãy thử lại.');
      return;
    }
    location.replace('/login.html');
  };
  document.querySelector('.sidebar-bottom').prepend(button);
}

async function login() {
  const form = document.querySelector('#login-form');
  if (!form) return;
  const message = document.querySelector('#auth-message');
  const buttons = [...form.querySelectorAll('button')];
  let client;
  let recovering = false;
  const reset = new URLSearchParams(location.search).has('reset');
  function showRecovery() {
    recovering = true;
    document.querySelector('h1').textContent = 'Đặt mật khẩu mới';
    document.querySelector('#auth-password').autocomplete = 'new-password';
    document.querySelector('#auth-email').required = false;
    document.querySelector('#email-field').hidden = true;
    buttons.forEach((button) => {
      button.hidden = button.value !== 'signin';
    });
    document.querySelector('#signin').textContent = 'Lưu mật khẩu';
  }
  try {
    client = await authClient();
    if (!client) {
      location.replace('/');
      return;
    }
    client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') showRecovery();
    });
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session && reset) showRecovery();
    else if (data.session) {
      location.replace('/');
      return;
    }
    buttons.forEach((button) => {
      button.disabled = false;
    });
    message.textContent = '';
  } catch (error) {
    message.textContent = error.message;
    return;
  }

  async function submit(action) {
    const email = document.querySelector('#auth-email').value.trim();
    const password = document.querySelector('#auth-password').value;
    buttons.forEach((button) => {
      button.disabled = true;
    });
    form.setAttribute('aria-busy', 'true');
    message.textContent = 'Đang xử lý…';
    try {
      if (recovering) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        location.replace('/');
      } else if (action === 'reset') {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/login.html?reset=1`,
        });
        if (error) throw error;
        message.textContent = 'Nếu email có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu.';
      } else {
        const result =
          action === 'signup'
            ? await client.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: `${location.origin}/login.html` },
              })
            : await client.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (result.data.session) location.replace('/');
        else
          message.textContent = 'Kiểm tra email và xác nhận tài khoản, sau đó quay lại đăng nhập.';
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
      });
      form.setAttribute('aria-busy', 'false');
    }
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    submit(event.submitter?.value || 'signin');
  };
  document.querySelector('#reset-password').onclick = () => {
    if (document.querySelector('#auth-email').reportValidity()) submit('reset');
  };
}

login();
