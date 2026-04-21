document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const messageBox = document.getElementById('message');

    showRegister.addEventListener('click', e => { e.preventDefault(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); });
    showLogin.addEventListener('click', e => { e.preventDefault(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });

    function showMessage(text, type) {
        messageBox.textContent = text;
        messageBox.className = `message ${type}`;
        messageBox.classList.remove('hidden');
        setTimeout(() => messageBox.classList.add('hidden'), 4000);
    }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        try {
            const { error } = await supabaseClient.auth.signUp({ 
                email, 
                password, 
                options: { data: { full_name: name } }
            });
            if (error) throw error;
            showMessage('Аккаунт создан! Перенаправляем...', 'success');
            setTimeout(() => window.location.href = 'dashboard.html', 1000);
        } catch (err) { showMessage(err.message, 'error'); }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        try {
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            window.location.href = 'dashboard.html';
        } catch (err) { showMessage(err.message, 'error'); }
    });
});
