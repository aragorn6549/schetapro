// Проверяем сессию и загружаем панель
supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // Пытаемся загрузить профиль
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', session.user.id)
        .single();

    if (error || !profile) {
        console.warn('Профиль не загружен (БД ещё не настроена). Отображаем базовый интерфейс.');
        document.getElementById('user-name').textContent = 'Пользователь';
        document.getElementById('user-role').textContent = 'engineer';
        showPanel('engineer'); // Временно показываем панель инженера
        return;
    }

    document.getElementById('user-name').textContent = profile.full_name;
    document.getElementById('user-role').textContent = profile.role;

    // Маппинг ролей на блоки
    const roleMap = {
        'engineer': 'engineer',
        'security': 'security',
        'director': 'director',
        'accountant': 'accountant',
        'admin': 'admin'
    };

    showPanel(roleMap[profile.role] || 'no-access');
});

function showPanel(role) {
    document.querySelectorAll('.role-section').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById(`${role}-panel`);
    if (panel) panel.classList.add('active');
}

// Выход из системы
document.getElementById('logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
});