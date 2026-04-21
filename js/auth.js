const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');
const messageBox = document.getElementById('message');

// Переключение между формами входа и регистрации
showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); });
showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });

function showMessage(text, type) {
    messageBox.textContent = text;
    messageBox.className = `message ${type}`;
    messageBox.classList.remove('hidden');
    setTimeout(() => messageBox.classList.add('hidden'), 4000);
}

// РЕГИСТРАЦИЯ
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Сохраняем профиль (таблица profiles создадим на следующем шаге)
        if (data.user) {
            const { error: profileError } = await supabase.from('profiles').insert({
                id: data.user.id,
                full_name: name,
                role: 'engineer' // Роль по умолчанию
            });
            if (profileError) console.log('⚠️ Таблица profiles пока не создана. Профиль будет добавлен после настройки БД.');
        }

        showMessage('Аккаунт создан! Проверьте почту для подтверждения.', 'success');
        setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
        showMessage(err.message, 'error');
    }
});

// ВХОД
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = 'dashboard.html';
    } catch (err) {
        showMessage(err.message, 'error');
    }
});

// Если пользователь уже залогинен, сразу кидаем в панель
supabase.auth.onAuthStateChange((event, session) => {
    if (session && window.location.pathname.includes('index.html')) {
        window.location.href = 'dashboard.html';
    }
});