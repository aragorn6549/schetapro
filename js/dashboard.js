let currentUser = null;
let currentRole = 'engineer';

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
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('full_name, role')
        .eq('id', currentUser.id)
        .single();

    currentRole = profile?.role || 'engineer';
    document.getElementById('user-name').textContent = profile?.full_name || 'Пользователь';
    document.getElementById('user-role').textContent = currentRole;
    showPanel(currentRole);
}

function showPanel(role) {
    document.querySelectorAll('.role-section').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById(`${role}-panel`);
    if (panel) panel.classList.add('active');

    if (role === 'engineer') loadEngineerRequests();
    else if (role === 'security') loadSecurityCounterparties();
    else if (role === 'director') loadDirectorRequests();
    else if (role === 'accountant') loadAccountantRequests();
    else if (role === 'admin') loadJournal();
}

// === ИНЖЕНЕР ===
async function loadEngineerRequests() {
    const tbody = document.getElementById('requests-table-body');
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';

    const { data, error } = await supabaseClient
        .from('requests')
        .select('id, project_name, request_number, invoice_url, status, supplier_id:counterparties(name)')
        .eq('created_by', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) { tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red)">${error.message}</td></tr>`; return; }
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="6">Нет заявок</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(r => {
        const btn = r.status === 'согласован' 
            ? `<button class="btn-action btn-blue" onclick="copyPP('${r.request_number}')">📋 Запросить ПП</button>` 
            : '—';
        tbody.innerHTML += `<tr>
            <td><strong>${r.request_number}</strong></td><td>${r.project_name}</td>
            <td>${r.supplier_id?.name || '—'}</td>
            <td><a href="${r.invoice_url}" target="_blank" style="color:var(--accent2)">🔗</a></td>
            <td><span class="status-${statusClass(r.status)}">${r.status}</span></td>
            <td>${btn}</td>
        </tr>`;
    });
}

window.copyPP = (num) => {
    const txt = `Тема: Запрос ПП по счёту № ${num}\nПрошу оплатить. Счёт согласован директором.`;
    navigator.clipboard.writeText(txt).then(() => showToast('✅ Текст скопирован', 'success'));
};

document.getElementById('btn-new-request')?.addEventListener('click', () => {
    document.getElementById('request-modal').classList.remove('hidden');
    loadSuppliersDropdown();
});
document.getElementById('close-modal')?.addEventListener('click', () => {
    document.getElementById('request-modal').classList.add('hidden');
    document.getElementById('req-message').classList.add('hidden');
});
document.getElementById('req-supplier')?.addEventListener('change', e => {
    document.getElementById('new-supplier-fields').classList.toggle('hidden', e.target.value !== 'new');
});

async function loadSuppliersDropdown() {
    const sel = document.getElementById('req-supplier');
    sel.innerHTML = '<option value="">Выберите</option><option value="new">+ Новый контрагент</option>';
    const { data } = await supabaseClient.from('counterparties').select('id, name, inn').eq('status', 'одобрен').order('name');
    data?.forEach(s => {
        const o = document.createElement('option'); o.value = s.id; o.textContent = `${s.name} (${s.inn})`; sel.appendChild(o);
    });
}

document.getElementById('request-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('req-message');
    const proj = document.getElementById('req-project').value.trim();
    const deal = document.getElementById('req-deal').value.trim();
    const inv = document.getElementById('req-invoice').value.trim();
    const url = document.getElementById('req-url').value.trim();
    const supId = document.getElementById('req-supplier').value;

    if (!proj || !deal || !inv || !url || !supId) { showToast(msg, 'Заполните все поля', 'error'); return; }

    try {
        let finalSup = supId;
        if (supId === 'new') {
            const inn = document.getElementById('new-sup-inn').value.trim();
            const name = document.getElementById('new-sup-name').value.trim();
            if (!inn || !name) throw new Error('Укажите ИНН и название');
            const { data: ns, error: se } = await supabaseClient.from('counterparties').insert({ inn, name, status: 'на проверке', created_by: currentUser.id }).select().single();
            if (se) throw se;
            finalSup = ns.id;
        }

        const { data: existing } = await supabaseClient.from('requests').select('id').ilike('project_name', proj).eq('deal_number', deal);
        const seq = String((existing?.length || 0) + 1).padStart(3, '0');
        const num = `${proj}_${deal}_${seq}`;

        const { data: rd, error: re } = await supabaseClient.from('requests').insert({
            project_name: proj, deal_number: deal, request_number: num,
            invoice_number: inv, invoice_url: url, supplier_id: finalSup, status: 'новая', created_by: currentUser.id
        }).select().single();
        if (re) throw re;

        await logJournal(`Создана заявка ${num}`, 'request', rd.id);
        showToast(msg, '✅ Заявка создана!', 'success');
        setTimeout(() => { document.getElementById('request-modal').classList.add('hidden'); document.getElementById('request-form').reset(); document.getElementById('new-supplier-fields').classList.add('hidden'); loadEngineerRequests(); }, 1200);
    } catch (err) { showToast(msg, err.message, 'error'); }
});

// === БЕЗОПАСНОСТЬ ===
async function loadSecurityCounterparties() {
    const tbody = document.getElementById('security-table-body');
    tbody.innerHTML = '<tr><td colspan="4">Загрузка...</td></tr>';
    const { data, error } = await supabaseClient.from('counterparties').select('id, inn, name, status').order('created_at', { ascending: false });
    if (error) return;
    tbody.innerHTML = '';
    data.forEach(c => {
        const btns = c.status === 'на проверке' 
            ? `<button class="btn-action btn-green" onclick="approveCounterparty('${c.id}')">✓</button> <button class="btn-action btn-red" onclick="rejectCounterparty('${c.id}')">✕</button>` 
            : c.status;
        tbody.innerHTML += `<tr>
            <td>${c.inn}</td><td>${c.name}</td><td><span class="status-${statusClass(c.status)}">${c.status}</span></td><td>${btns}</td>
        </tr>`;
    });
}

window.approveCounterparty = async (id) => {
    await supabaseClient.from('counterparties').update({ status: 'одобрен' }).eq('id', id);
    await supabaseClient.from('requests').update({ status: 'ожидает директора' }).eq('supplier_id', id).eq('status', 'новая');
    await logJournal('Контрагент одобрен. Заявки переданы директору.', 'counterparty', id);
    loadSecurityCounterparties();
};

window.rejectCounterparty = async (id) => {
    await supabaseClient.from('counterparties').update({ status: 'отклонен' }).eq('id', id);
    await logJournal('Контрагент отклонен.', 'counterparty', id);
    loadSecurityCounterparties();
};

// === ДИРЕКТОР ===
async function loadDirectorRequests() {
    const tbody = document.getElementById('director-table-body');
    tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
    const { data, error } = await supabaseClient.from('requests')
        .select('id, request_number, project_name, status, supplier_id:counterparties(name, inn, status)')
        .eq('status', 'ожидает директора')
        .order('created_at', { ascending: false });
    if (error) return;
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="6">Нет заявок на согласование</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(r => {
        const sup = r.supplier_id || {};
        const isApproved = sup.status === 'одобрен';
        const btns = isApproved
            ? `<button class="btn-action btn-green" onclick="directorApprove('${r.id}')">Согласовать</button> <button class="btn-action btn-red" onclick="directorReject('${r.id}')">Отклонить</button>`
            : '<span style="color:var(--text3)">Ожидает проверки СБ</span>';
        tbody.innerHTML += `<tr>
            <td><strong>${r.request_number}</strong></td><td>${r.project_name}</td><td>${sup.name || '—'}</td><td>${sup.inn || '—'}</td>
            <td><span class="status-${statusClass(r.status)}">${r.status}</span></td><td>${btns}</td>
        </tr>`;
    });
}

window.directorApprove = async (id) => {
    await supabaseClient.from('requests').update({ status: 'согласован', approved_at: new Date().toISOString() }).eq('id', id);
    await logJournal('Согласована заявка', 'request', id);
    loadDirectorRequests();
};
window.directorReject = async (id) => {
    await supabaseClient.from('requests').update({ status: 'отклонен' }).eq('id', id);
    await logJournal('Отклонена заявка', 'request', id);
    loadDirectorRequests();
};

// === БУХГАЛТЕР ===
async function loadAccountantRequests() {
    const tbody = document.getElementById('accountant-table-body');
    tbody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
    const { data, error } = await supabaseClient.from('requests')
        .select('id, request_number, invoice_number, status, supplier_id:counterparties(name)')
        .in('status', ['согласован', 'оплачен'])
        .order('created_at', { ascending: false });
    if (error) return;
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="5">Нет счетов к оплате</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(r => {
        const btn = r.status === 'согласован' ? `<button class="btn-action btn-green" onclick="markPaid('${r.id}')">Оплачен</button>` : '✅';
        tbody.innerHTML += `<tr>
            <td><strong>${r.request_number}</strong></td><td>${r.supplier_id?.name || '—'}</td><td>${r.invoice_number || '—'}</td>
            <td><span class="status-${statusClass(r.status)}">${r.status}</span></td><td>${btn}</td>
        </tr>`;
    });
}

window.markPaid = async (id) => {
    await supabaseClient.from('requests').update({ status: 'оплачен', paid_at: new Date().toISOString() }).eq('id', id);
    await logJournal('Отмечен как оплаченный', 'request', id);
    loadAccountantRequests();
};

// === АДМИН (Журнал) ===
async function loadJournal() {
    const tbody = document.getElementById('admin-journal-body');
    tbody.innerHTML = '<tr><td colspan="4">Загрузка...</td></tr>';
    const { data, error } = await supabaseClient.from('journal').select('created_at, action, entity_type, user_id:profiles(full_name)').order('created_at', { ascending: false }).limit(50);
    if (error) return;
    if (!data?.length) { tbody.innerHTML = '<tr><td colspan="4">Журнал пуст</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(j => {
        const time = new Date(j.created_at).toLocaleString('ru-RU');
        tbody.innerHTML += `<tr>
            <td style="font-family:monospace; font-size:0.8rem">${time}</td>
            <td>${j.user_id?.full_name || 'Система'}</td>
            <td>${j.action}</td>
            <td style="color:var(--text3)">${j.entity_type}</td>
        </tr>`;
    });
}

// === УТИЛИТЫ ===
async function logJournal(action, type, id) {
    await supabaseClient.from('journal').insert({ action, entity_type: type, entity_id: id, user_id: currentUser.id });
}

function showToast(el, msg, type) {
    el.textContent = msg; el.className = `message ${type}`; el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

function statusClass(s) {
    return { 'новая':'new', 'ожидает директора':'check', 'согласован':'approved', 'оплачен':'paid', 'на проверке':'check', 'одобрен':'approved', 'отклонен':'rejected' }[s] || 'new';
}

document.getElementById('logout')?.addEventListener('click', async () => { await supabaseClient.auth.signOut(); window.location.href = 'index.html'; });
