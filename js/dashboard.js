let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!window.supabaseClient) { console.error('Supabase не подключён'); return; }

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (!session) { window.location.href = 'index.html'; return; }
        currentUser = session.user;
        await loadUserProfile();
    });
});

async function loadUserProfile() {
    const { data: profile, error } = await supabaseClient.from('profiles').select('full_name, role').eq('id', currentUser.id).single();
    const role = profile?.role || 'engineer';
    document.getElementById('user-name').textContent = profile?.full_name || 'Пользователь';
    document.getElementById('user-role').textContent = role;
    showPanel(role);
}

function showPanel(role) {
    document.querySelectorAll('.role-section').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById(`${role}-panel`);
    if (panel) panel.classList.add('active');

    if (role === 'engineer') loadRequests();
    else if (role === 'security') loadSecurity();
    else if (role === 'director') loadDirector();
    else if (role === 'accountant') loadAccountant();
    else if (role === 'admin') loadAdmin();
}

// ================= ИНЖЕНЕР =================
async function loadRequests() {
    const tbody = document.getElementById('requests-table-body');
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    const { data, error } = await supabaseClient.from('requests').select('id, project_name, request_number, invoice_url, status, supplier_id:counterparties(name)').eq('created_by', currentUser.id).order('created_at', { ascending: false });
    if (error) { tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red)">Ошибка: ${error.message}</td></tr>`; return; }
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="6">Нет заявок. Создайте первую!</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(req => {
        const cls = { 'новая':'status-new', 'ожидает директора':'status-check', 'согласован':'status-approved', 'оплачен':'status-paid' }[req.status] || 'status-new';
        const btn = req.status === 'согласован' ? `<button class="btn-action btn-blue pp-btn" data-num="${req.request_number}" data-url="${req.invoice_url}">Запросить ПП</button>` : '—';
        tbody.innerHTML += `<tr><td><strong>${req.request_number}</strong></td><td>${req.project_name}</td><td>${req.supplier_id?.name || '—'}</td><td><a href="${req.invoice_url}" target="_blank" style="color:var(--accent2)">🔗 Открыть</a></td><td><span class="${cls}">${req.status}</span></td><td>${btn}</td></tr>`;
    });

    document.querySelectorAll('.pp-btn').forEach(btn => btn.onclick = () => {
        const text = `Коллеги, добрый день!\nПрошу оплатить счёт.\nЗаявка: ${btn.dataset.num}\nСчёт: ${btn.dataset.url}\nСогласовано директором. Спасибо!`;
        document.getElementById('pp-text').textContent = text;
        document.getElementById('pp-modal').classList.remove('hidden');
    });
}

document.getElementById('btn-new-request')?.addEventListener('click', () => { document.getElementById('request-modal').classList.remove('hidden'); loadSuppliers(); });
document.getElementById('close-modal')?.addEventListener('click', () => document.getElementById('request-modal').classList.add('hidden'));
document.getElementById('req-supplier')?.addEventListener('change', e => document.getElementById('new-supplier-fields').classList.toggle('hidden', e.target.value !== 'new'));

async function loadSuppliers() {
    const sel = document.getElementById('req-supplier');
    sel.innerHTML = '<option value="">Выберите контрагента</option><option value="new">+ Добавить нового</option>';
    const { data } = await supabaseClient.from('counterparties').select('id, name, inn').eq('status', 'одобрен').order('name');
    data?.forEach(s => { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = `${s.name} (ИНН: ${s.inn})`; sel.appendChild(opt); });
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
            if (!inn || !name) throw new Error('Укажите ИНН и название');
            const { data: ns, error: se } = await supabaseClient.from('counterparties').insert({ inn, name, status: 'на проверке', created_by: currentUser.id }).select().single();
            if (se) throw se; finalSupId = ns.id;
        }
        const { data: existing } = await supabaseClient.from('requests').select('id').ilike('project_name', project).eq('deal_number', deal);
        const seq = String((existing?.length || 0) + 1).padStart(3, '0');
        const reqNum = `${project}_${deal}_${seq}`;
        const { data: reqData, error: re } = await supabaseClient.from('requests').insert({ project_name: project, deal_number: deal, request_number: reqNum, invoice_number: invoice, invoice_url: url, supplier_id: finalSupId, status: 'новая', created_by: currentUser.id }).select().single();
        if (re) throw re;
        await supabaseClient.from('journal').insert({ action: `Создана заявка ${reqNum}`, user_id: currentUser.id });
        showMsg(msg, '✅ Заявка создана!', 'success');
        setTimeout(() => { document.getElementById('request-modal').classList.add('hidden'); document.getElementById('request-form').reset(); document.getElementById('new-supplier-fields').classList.add('hidden'); loadRequests(); }, 1000);
    } catch (err) { showMsg(msg, err.message, 'error'); }
});

// ================= БЕЗОПАСНОСТЬ =================
async function loadSecurity() {
    const tbody = document.getElementById('security-table-body');
    tbody.innerHTML = '<tr><td colspan="4">Загрузка...</td></tr>';
    const { data, error } = await supabaseClient.from('counterparties').select('id, inn, name, status').eq('status', 'на проверке').order('created_at', { ascending: false });
    if (error) { tbody.innerHTML = `<tr><td colspan="4">Ошибка: ${error.message}</td></tr>`; return; }
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="4">Нет новых контрагентов на проверке</td></tr>'; return; }
    tbody.innerHTML = '';
    data.forEach(c => {
        tbody.innerHTML += `<tr><td>${c.inn}</td><td>${c.name}</td><td><span class="status-check">На проверке</span></td><td><button class="btn-action btn-green approve-btn" data-id="${c.id}">✓</button> <button class="btn-action btn-red reject-btn" data-id="${c.id}">✕</button></td></tr>`;
    });
    document.querySelectorAll('.approve-btn').forEach(btn => btn.onclick = async () => { await updateCounterpartyStatus(btn.dataset.id, 'одобрен'); loadSecurity(); });
    document.querySelectorAll('.reject-btn').forEach(btn => btn.onclick = async () => { await updateCounterpartyStatus(btn.dataset.id, 'отклонён'); loadSecurity(); });
}

async function updateCounterpartyStatus(id, status) {
    await supabaseClient.from('counterparties').update({ status }).eq('id', id);
    await supabaseClient.from('journal').insert({ action: `Контрагент ${id} -> статус: ${status}`, user_id: currentUser.id });
    if (status === 'одобрен') {
        await supabaseClient.from('requests').update({ status: 'ожидает директора' }).eq('supplier_id', id).eq('status', 'новая');
    }
}

// ================= ДИРЕКТОР =================
async function loadDirector() {
    const tbody = document.getElementById('director-table-body');
    tbody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
    const { data, error } = await supabaseClient.from('requests').select('id, request_number, project_name, supplier_id:counterparties(name,status), status').order('created_at', { ascending: false });
    if (error) { tbody.innerHTML = `<tr><td colspan="5">Ошибка: ${error.message}</td></tr>`; return; }
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="5">Нет заявок</td></tr>'; return; }
    tbody.innerHTML = '';
    data.forEach(req => {
        const approved = req.supplier_id?.status === 'одобрен';
        const cls = { 'ожидает директора':'status-check', 'согласован':'status-approved', 'оплачен':'status-paid' }[req.status] || 'status-check';
        const btn = req.status === 'ожидает директора' 
            ? `<button class="btn-action btn-green dir-approve" data-id="${req.id}">Согласовать</button> <button class="btn-action btn-red dir-reject" data-id="${req.id}">Отклонить</button>` 
            : '—';
        tbody.innerHTML += `<tr><td><strong>${req.request_number}</strong></td><td>${req.project_name}</td><td>${req.supplier_id?.name || '—'}</td><td><span class="${cls}">${req.status}</span></td><td>${btn}</td></tr>`;
    });
    document.querySelectorAll('.dir-approve').forEach(btn => btn.onclick = async () => { await supabaseClient.from('requests').update({ status: 'согласован' }).eq('id', btn.dataset.id); await supabaseClient.from('journal').insert({ action: `Заявка ${btn.dataset.id} согласована`, user_id: currentUser.id }); loadDirector(); });
    document.querySelectorAll('.dir-reject').forEach(btn => btn.onclick = async () => { await supabaseClient.from('requests').update({ status: 'отклонён' }).eq('id', btn.dataset.id); await supabaseClient.from('journal').insert({ action: `Заявка ${btn.dataset.id} отклонена`, user_id: currentUser.id }); loadDirector(); });
}

// ================= БУХГАЛТЕР =================
async function loadAccountant() {
    const tbody = document.getElementById('accountant-table-body');
    tbody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
    const { data, error } = await supabaseClient.from('requests').select('id, request_number, supplier_id:counterparties(name), invoice_url, status').in('status', ['согласован', 'оплачен']).order('created_at', { ascending: false });
    if (error) { tbody.innerHTML = `<tr><td colspan="5">Ошибка: ${error.message}</td></tr>`; return; }
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="5">Нет счетов к оплате</td></tr>'; return; }
    tbody.innerHTML = '';
    data.forEach(req => {
        const cls = req.status === 'оплачен' ? 'status-paid' : 'status-approved';
        const btn = req.status === 'согласован' ? `<button class="btn-action btn-green pay-btn" data-id="${req.id}">Оплачен</button>` : '✅';
        tbody.innerHTML += `<tr><td><strong>${req.request_number}</strong></td><td>${req.supplier_id?.name || '—'}</td><td><a href="${req.invoice_url}" target="_blank" style="color:var(--accent2)">🔗</a></td><td><span class="${cls}">${req.status}</span></td><td>${btn}</td></tr>`;
    });
    document.querySelectorAll('.pay-btn').forEach(btn => btn.onclick = async () => { await supabaseClient.from('requests').update({ status: 'оплачен', paid_at: new Date().toISOString() }).eq('id', btn.dataset.id); await supabaseClient.from('journal').insert({ action: `Заявка ${btn.dataset.id} оплачена`, user_id: currentUser.id }); loadAccountant(); });
}

// ================= АДМИН =================
async function loadAdmin() {
    const tbody = document.getElementById('admin-users-body');
    tbody.innerHTML = '<tr><td colspan="4">Загрузка...</td></tr>';
    const { data, error } = await supabaseClient.from('profiles').select('id, full_name, role, user_id:auth.users!inner(email)').order('created_at', { ascending: false });
    if (error) { tbody.innerHTML = `<tr><td colspan="4">Ошибка: ${error.message}</td></tr>`; return; }
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="4">Нет пользователей</td></tr>'; return; }
    tbody.innerHTML = '';
    data.forEach(u => {
        tbody.innerHTML += `<tr><td>${u.full_name}</td><td>${u.user_id?.email || '—'}</td><td><span class="role-badge">${u.role}</span></td><td><select class="role-change" data-id="${u.id}" style="width:auto; padding:0.3rem;"><option value="engineer" ${u.role==='engineer'?'selected':''}>Инженер</option><option value="security" ${u.role==='security'?'selected':''}>Безопасность</option><option value="director" ${u.role==='director'?'selected':''}>Директор</option><option value="accountant" ${u.role==='accountant'?'selected':''}>Бухгалтер</option><option value="admin" ${u.role==='admin'?'selected':''}>Админ</option></select></td></tr>`;
    });
    document.querySelectorAll('.role-change').forEach(sel => sel.onchange = async () => { await supabaseClient.from('profiles').update({ role: sel.value }).eq('id', sel.dataset.id); await supabaseClient.from('journal').insert({ action: `Роль пользователя ${sel.dataset.id} изменена на ${sel.value}`, user_id: currentUser.id }); loadAdmin(); });

    const journalBody = document.getElementById('admin-journal-body');
    journalBody.innerHTML = '<tr><td colspan="3">Загрузка...</td></tr>';
    const { data: jData } = await supabaseClient.from('journal').select('created_at, action, user_id:profiles(full_name)').order('created_at', { ascending: false }).limit(50);
    if (!jData?.length) { journalBody.innerHTML = '<tr><td colspan="3">Журнал пуст</td></tr>'; return; }
    journalBody.innerHTML = '';
    jData.forEach(j => { journalBody.innerHTML += `<tr><td>${new Date(j.created_at).toLocaleString('ru')}</td><td>${j.user_id?.full_name || 'Система'}</td><td>${j.action}</td></tr>`; });
}

// ================= ОБЩЕЕ =================
document.getElementById('close-pp-modal')?.addEventListener('click', () => document.getElementById('pp-modal').classList.add('hidden'));
document.getElementById('copy-pp')?.addEventListener('click', () => { navigator.clipboard.writeText(document.getElementById('pp-text').textContent); alert('Скопировано!'); });
function showMsg(el, text, type) { el.textContent = text; el.className = `message ${type}`; el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 3000); }
document.getElementById('logout')?.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = 'index.html'; });
