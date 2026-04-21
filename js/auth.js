document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showReg = document.getElementById('show-register');
  const showLog = document.getElementById('show-login');
  const msgBox = document.getElementById('message');

  showReg?.addEventListener('click', e => { e.preventDefault(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); });
  showLog?.addEventListener('click', e => { e.preventDefault(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });

  const showMsg = (txt, type) => {
    msgBox.textContent = txt; msgBox.className = `message ${type}`; msgBox.classList.remove('hidden');
    setTimeout(() => msgBox.classList.add('hidden'), 4000);
  };

  registerForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-password').value;
    try {
      const { error } = await supabaseClient.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
      if (error) throw error;
      showMsg('Аккаунт создан! Перенаправляем...', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 1200);
    } catch (err) { showMsg(err.message, 'error'); }
  });

  loginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    try {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      window.location.href = 'dashboard.html';
    } catch (err) { showMsg(err.message, 'error'); }
  });
});
