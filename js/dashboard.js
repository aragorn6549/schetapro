supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // Загружаем профиль из таблицы profiles
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('full_name, role')
        .eq('id', session.user.id)
        .single();

    if (error || !profile) {
        document.getElementById('user-name').textContent = 'Пользователь';
        document.getElementById('user-role').textContent = 'engineer';
        showPanel('engineer');
        return;
    }

    document.getElementById('user-name').textContent = profile.full_name;
    document.getElementById('user-role').textContent = profile.role;

    // Показываем панель по роли
    const allowedRoles = ['engineer', 'security', 'director', 'accountant', 'admin'];
    showPanel(allowedRoles.includes(profile.role) ? profile.role : 'no-access');
});

function showPanel(role) {
    document.querySelectorAll('.role-section').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById(`${role}-panel`);
    if (panel) panel.classList.add('active');
}

document.getElementById('logout').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
});
