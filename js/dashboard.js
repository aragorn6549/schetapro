let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof supabaseClient === 'undefined') {
        console.error('Supabase не подключён. Проверь js/supabase.js');
        document.getElementById('user-role').textContent = 'Ошибка';
        return;
    }

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        currentUser = session.user;
        await loadUserProfile();
    });
});

async function loadUserProfile() {
    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('full_name, role')
            .eq('id', currentUser.id)
            .single();

        if (error || !profile) {
            console.warn('Профиль не найден, используется роль engineer');
            document.getElementById('user-name').textContent = 'Пользователь';
            document.getElementById('user-role').textContent = 'engineer';
            showPanel('engineer');
            return;
        }

        document.getElementById('user-name').textContent = profile.full_name;
        document.getElementById('user-role').textContent = profile.role;
        showPanel(profile.role);
    } catch (err) {
        console.error('Ошибка профиля:', err);
    }
}

function showPanel(role) {
    document.querySelectorAll('.role-section').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById(`${role}-panel`);
    if (panel) panel.classList.add('active');

    if (role === 'engineer') loadRequests();
    else if (role === 'security') loadCounterparties();
    else if (role === 'director') loadDirectorRequests();
    else if (role === 'accountant') loadAccountantRequests();
    else if (role === 'admin') loadJournal();
}

async function loadRequests() {
    const tbody = document.getElementById('requests-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Загрузка...</td></tr>';

    const { data, error } = await supabaseClient
        .from('requests')
        .select('id, project_name, request_number, invoice_url, status, supplier_id:counterparties(name)')
        .eq('created_by', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red)">Ошибка: ${error.message}</td></tr>`;
        return;
    }
    if (!data?.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Нет заявок. Создайте первую!</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    data.forEach(req => {
        const cls = { 'новая':'status-new', 'ожидает директора':'status-check', 'согласован':'status-approved', 'оплачен':'status-paid' }[req.status] || 'status-new';
        const btn = req.status === 'согласован' 
            ? `<button class="btn-action btn-blue pp-btn" data-num="${req.request_number}">Запросить ПП</button>` 
            : '—';
        tbody.innerHTML += `<tr>
            <td><strong>${req.request_number}</strong></td>
            <td>${req.project_name}</td>
            <td>${req.supplier_id?.name || '—'}</td>
            <td><a href="${req.invoice_url}" target="_blank" style="color:var(--accent2)">🔗 Открыть</a></td>
            <td><span class="${cls}">${req.status}</span></td>
            <td>${btn}</td>
        </tr>`;
    });

    document.querySelectorAll('.pp-btn').forEach(btn => {
        btn.onclick = () => {
            const text = `Запрос ПП\nСчёт: ${btn.dataset.num}\nПрошу оплатить. Спасибо!`;
            navigator.clipboard?.writeText(text).then(() => alert('Текст скопирован!'));
        };
    });
}

document.getElementById('btn-new-request')?.addEventListener('click', () => {
    document.getElementById('request-modal').classList.remove('hidden');
    loadSuppliers();
});

document.getElementById('close-modal')?.addEventListener('click', () => {
    document.getElementById('request-modal').classList.add('hidden');
    document.getElementById('req-message').classList.add('hidden');
});

document.getElementById('req-supplier')?.addEventListener('change', (e) => {
    document.getElementById('new-supplier-fields').classList.toggle('hidden', e.target.value !== 'new');
});

async function loadSuppliers() {
    const sel = document.getElementById('req-supplier');
    sel.innerHTML = '<option value="">Выберите контрагента</option><option value="new">+ Добавить нового</option>';
    const { data } = await supabaseClient.from('counterparties').select('id, name, inn').eq('status', 'одобрен').order('name');
    data?.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (ИНН: ${s.inn})`;
        sel.appendChild(opt);
    });
}

document.getElementById('request-form')?.addEventListener('submit', async (e) => {
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
            if (se) throw se;
            finalSupId = ns.id;
        }

        const { data: existing } = await supabaseClient.from('requests').select('id').ilike('project_name', project).eq('deal_number', deal);
        const seq = String((existing?.length || 0) + 1).padStart(3, '0');
        const reqNum = `${project}_${deal}_${seq}`;

        const { data: reqData, error: re } = await supabaseClient.from('requests').insert({
            project_name: project, deal_number: deal, request_number: reqNum,
            invoice_number: invoice, invoice_url: url, supplier_id: finalSupId,
            status: 'новая', created_by: currentUser.id
        }).select().single();
        if (re) throw re;

        await supabaseClient.from('journal').insert({ action: `Создана заявка ${reqNum}`, entity_type: 'request', entity_id: reqData.id, user_id: currentUser.id });

        showMsg(msg, '✅ Заявка создана!', 'success');
        setTimeout(() => {
            document.getElementById('request-modal').classList.add('hidden');
            document.getElementById('request-form').reset();
            document.getElementById('new-supplier-fields').classList.add('hidden');
            loadRequests();
        }, 1200);
    } catch (err) {
        showMsg(msg, err.message, 'error');
    }
});

function showMsg(el, text, type) {
    el.textContent = text;
    el.className = `message ${type}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

function loadCounterparties() { document.getElementById('security-table-body').innerHTML = '<tr><td colspan="4" style="text-align:center">Панель безопасности</td></tr>'; }
function loadDirectorRequests() { document.getElementById('director-table-body').innerHTML = '<tr><td colspan="5" style="text-align:center">Панель директора</td></tr>'; }
function loadAccountantRequests() { document.getElementById('accountant-table-body').innerHTML = '<tr><td colspan="4" style="text-align:center">Панель бухгалтера</td></tr>'; }
function loadJournal() { document.getElementById('admin-journal-body').innerHTML = '<tr><td colspan="3" style="text-align:center">Журнал</td></tr>'; }

document.getElementById('logout')?.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = 'index.html'; });
