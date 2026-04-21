let currentUser = null;

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session) { window.location.href = 'index.html'; return; }
    currentUser = session.user;

    const { data: profile, error } = await supabaseClient.from('profiles').select('full_name, role').eq('id', session.user.id).single();
    const role = profile?.role || 'engineer';
    document.getElementById('user-name').textContent = profile?.full_name || 'Пользователь';
    document.getElementById('user-role').textContent = role;
    showPanel(role);
});

function showPanel(role) {
    document.querySelectorAll('.role-section').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById(`${role}-panel`);
    if (panel) panel.classList.add('active');

    // Автозагрузка данных для активной роли
    if (role === 'engineer') loadRequests();
    if (role === 'security') loadCounterparties();
    if (role === 'director') loadDirectorRequests();
    if (role === 'accountant') loadAccountantRequests();
    if (role === 'admin') loadJournal();
}

// === ИНЖЕНЕР: ЗАГРУЗКА ЗАЯВОК ===
async function loadRequests() {
    const tbody = document.getElementById('requests-table-body');
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    const { data, error } = await supabaseClient.from('requests')
        .select('id, project_name, request_number, invoice_url, status, supplier_id:counterparties(name)')
        .eq('created_by', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) { tbody.innerHTML = `<tr><td colspan="6">Ошибка: ${error.message}</td></tr>`; return; }
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="6">Нет заявок. Создайте первую!</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(req => {
        const cls = { 'новая':'status-new', 'ожидает директора':'status-check', 'согласован':'status-approved', 'оплачен':'status-paid' }[req.status] || 'status-check';
        tbody.innerHTML += `
            <tr>
                <td><strong>${req.request_number}</strong></td>
                <td>${req.project_name}</td>
                <td>${req.supplier_id?.name || '—'}</td>
                <td><a href="${req.invoice_url}" target="_blank" style="color:var(--accent2)">🔗 Открыть</a></td>
                <td><span class="${cls}">${req.status}</span></td>
                <td>${req.status === 'согласован' ? `<button class="btn-action btn-blue pp-btn" data-num="${req.request_number}">Запросить ПП</button>` : '—'}</td>
            </tr>`;
    });

    document.querySelectorAll('.pp-btn').forEach(btn => btn.onclick = () => alert(`Письмо для бухгалтерии:\n\nСчёт: ${btn.dataset.num}\nПрошу оплатить. Спасибо!`));
}

// === ИНЖЕНЕР: СОЗДАНИЕ ЗАЯВКИ ===
document.getElementById('btn-new-request')?.addEventListener('click', () => {
    document.getElementById('request-modal').classList.remove('hidden');
    loadSuppliers();
});
document.getElementById('close-modal')?.addEventListener('click', () => document.getElementById('request-modal').classList.add('hidden'));
document.getElementById('req-supplier')?.addEventListener('change', e => {
    document.getElementById('new-supplier-fields').classList.toggle('hidden', e.target.value !== 'new');
});

async function loadSuppliers() {
    const sel = document.getElementById('req-supplier');
    sel.innerHTML = '<option value="">Выберите контрагента</option><option value="new">+ Добавить нового</option>';
    const { data } = await supabaseClient.from('counterparties').select('id, name, inn').eq('status', 'одобрен');
    data?.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = `${s.name} (ИНН: ${s.inn})`; sel.appendChild(o); });
}

document.getElementById('request-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('req-message');
    const project = document.getElementById('req-project').value.trim();
    const deal = document.getElementById('req-deal').value.trim();
    const invoice = document.getElementById('req-invoice').value.trim();
    const url = document.getElementById('req-url').value.trim();
    const supId = document.getElementById('req-supplier').value;

    if (!project || !deal || !invoice || !url || !supId) { showMsg(msg, 'Заполните все поля', 'error'); return; }

    try {
        let finalSupId = supId;
        if (supId === 'new') {
            const inn = document.getElementById('new-sup-inn').value.trim();
            const name = document.getElementById('new-sup-name').value.trim();
            if (!inn || !name) throw new Error('Укажите ИНН и название контрагента');
            const { data: ns, error: se } = await supabaseClient.from('counterparties').insert({ inn, name, created_by: currentUser.id }).select().single();
            if (se) throw se;
            finalSupId = ns.id;
        }

        // Генерация порядкового номера
        const { data: existing } = await supabaseClient.from('requests').select('id').ilike('project_name', project).eq('deal_number', deal);
        const seq = String((existing?.length || 0) + 1).padStart(3, '0');
        const reqNum = `${project}_${deal}_${seq}`;

        const { data: reqData, error: re } = await supabaseClient.from('requests').insert({
            project_name: project, deal_number: deal, request_number: reqNum,
            invoice_number: invoice, invoice_url: url, supplier_id: finalSupId,
            status: 'новая', created_by: currentUser.id
        }).select().single();
        if (re) throw re;

        // Лог в журнал
        await supabaseClient.from('journal').insert({ action: `Создана заявка ${reqNum}`, entity_type: 'request', entity_id: reqData.id, user_id: currentUser.id });

        showMsg(msg, '✅ Заявка создана!', 'success');
        setTimeout(() => { document.getElementById('request-modal').classList.add('hidden'); document.getElementById('request-form').reset(); loadRequests(); }, 1200);
    } catch (err) { showMsg(msg, err.message, 'error'); }
});

function showMsg(el, text, type) { el.textContent = text; el.className = `message ${type}`; el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 3000); }

// === ЗАГЛУШКИ ДЛЯ ДРУГИХ РОЛЕЙ (будут реализованы на следующих этапах) ===
function loadCounterparties() { document.getElementById('security-table-body').innerHTML = '<tr><td colspan="4">Панель безопасности (в разработке)</td></tr>'; }
function loadDirectorRequests() { document.getElementById('director-table-body').innerHTML = '<tr><td colspan="5">Панель директора (в разработке)</td></tr>'; }
function loadAccountantRequests() { document.getElementById('accountant-table-body').innerHTML = '<tr><td colspan="4">Панель бухгалтера (в разработке)</td></tr>'; }
function loadJournal() { document.getElementById('admin-journal-body').innerHTML = '<tr><td colspan="3">Журнал действий (в разработке)</td></tr>'; }

// Выход
document.getElementById('logout')?.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = 'index.html'; });
