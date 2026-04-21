let currentUser = null;
let currentRole = null;

document.addEventListener('DOMContentLoaded', () => {
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session) { window.location.href = 'index.html'; return; }
    currentUser = session.user;
    await loadProfile();
  });
});

async function loadProfile() {
  const { data: profile, error } = await supabaseClient.from('profiles').select('full_name, role').eq('id', currentUser.id).single();
  if (error || !profile) {
    document.getElementById('user-name').textContent = 'Пользователь';
    document.getElementById('user-role').textContent = 'engineer';
    currentRole = 'engineer';
  } else {
    document.getElementById('user-name').textContent = profile.full_name;
    document.getElementById('user-role').textContent = profile.role;
    currentRole = profile.role;
  }
  showPanel(currentRole);
}

function showPanel(role) {
  document.querySelectorAll('.role-section').forEach(el => el.classList.remove('active'));
  const panel = document.getElementById(`${role}-panel`);
  if (panel) panel.classList.add('active');
  if (role === 'engineer') loadEngineer();
  if (role === 'security') loadSecurity();
  if (role === 'director') loadDirector();
  if (role === 'accountant') loadAccountant();
  if (role === 'admin') loadAdmin();
}

// === ENGINEER ===
async function loadEngineer() {
  const tbody = document.getElementById('eng-table');
  tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
  const { data, error } = await supabaseClient.from('requests').select('*, supplier:counterparties(name, inn, status)').eq('created_by', currentUser.id).order('created_at', { ascending: false });
  if (error) { tbody.innerHTML = `<tr><td colspan="6">Ошибка: ${error.message}</td></tr>`; return; }
  tbody.innerHTML = '';
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="6">Заявок нет</td></tr>'; return; }
  data.forEach(r => {
    const stCls = { 'новая':'st-new', 'ожидает директора':'st-wait', 'согласован':'st-app', 'оплачен':'st-paid' }[r.status] || 'st-new';
    const btn = r.status === 'согласован' ? `<button class="btn btn-sm btn-primary btn-pp" data-id="${r.request_number}">Запросить ПП</button>` : '—';
    tbody.innerHTML += `<tr>
      <td><strong>${r.request_number}</strong></td><td>${r.project_name}</td><td>${r.supplier?.name || '—'}</td>
      <td><a href="${r.invoice_url}" target="_blank">🔗 Открыть</a></td><td><span class="status ${stCls}">${r.status}</span></td><td>${btn}</td>
    </tr>`;
  });
  document.querySelectorAll('.btn-pp').forEach(b => b.onclick = () => openPPModal(b.dataset.id));
}

document.getElementById('btn-new-request').onclick = () => { document.getElementById('modal-request').classList.remove('hidden'); loadSuppliers(); };
document.querySelectorAll('.modal-close').forEach(btn => btn.onclick = () => btn.closest('.modal').classList.add('hidden'));

async function loadSuppliers() {
  const sel = document.getElementById('req-supplier');
  sel.innerHTML = '<option value="">Выберите...</option><option value="new">+ Новый контрагент</option>';
  const { data } = await supabaseClient.from('counterparties').select('id, name, inn').eq('status', 'одобрен').order('name');
  data?.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = `${s.name} (ИНН:${s.inn})`; sel.appendChild(o); });
}

document.getElementById('req-supplier').onchange = e => {
  document.getElementById('new-sup-fields').classList.toggle('hidden', e.target.value !== 'new');
};

document.getElementById('form-request').onsubmit = async e => {
  e.preventDefault();
  const msg = document.getElementById('req-msg');
  const proj = document.getElementById('req-project').value.trim();
  const deal = document.getElementById('req-deal').value.trim();
  const invNum = document.getElementById('req-invoice').value.trim();
  const url = document.getElementById('req-url').value.trim();
  const supId = document.getElementById('req-supplier').value;
  if (!proj || !deal || !invNum || !url || !supId) { showMsg(msg, 'Заполните все поля', 'error'); return; }

  try {
    let finalSup = supId;
    if (supId === 'new') {
      const inn = document.getElementById('new-inn').value.trim();
      const name = document.getElementById('new-name').value.trim();
      if (!inn || !name) throw new Error('Укажите ИНН и наименование');
      const { data: ns, error: se } = await supabaseClient.from('counterparties').insert({ inn, name, status: 'на проверке', created_by: currentUser.id }).select().single();
      if (se) throw se;
      finalSup = ns.id;
    }
    const { data: existing } = await supabaseClient.from('requests').select('id').eq('project_name', proj).eq('deal_number', deal);
    const seq = String((existing?.length || 0) + 1).padStart(3, '0');
    const num = `${proj}_${deal}_${seq}`;
    const { data: req, error: re } = await supabaseClient.from('requests').insert({
      project_name: proj, deal_number: deal, request_number: num, invoice_number: invNum, invoice_url: url, supplier_id: finalSup, status: supId === 'new' ? 'на проверке' : 'новая', created_by: currentUser.id
    }).select().single();
    if (re) throw re;
    await supabaseClient.from('journal').insert({ action: `Создана заявка ${num}`, entity_type: 'request', entity_id: req.id, user_id: currentUser.id });
    showMsg(msg, '✅ Заявка создана!', 'success');
    setTimeout(() => { document.getElementById('modal-request').classList.add('hidden'); document.getElementById('form-request').reset(); loadEngineer(); }, 1000);
  } catch (err) { showMsg(msg, err.message, 'error'); }
};

function openPPModal(reqNum) {
  document.getElementById('modal-pp').classList.remove('hidden');
  document.getElementById('pp-text').value = `Тема: Запрос ПП по заявке ${reqNum}\n\nКоллеги, добрый день!\nПрошу оплатить счёт по заявке ${reqNum}.\nСчёт согласован директором.\nСсылка: ${reqNum}_invoice_url\nСпасибо!`;
  document.getElementById('btn-copy-pp').onclick = () => {
    navigator.clipboard.writeText(document.getElementById('pp-text').value).then(() => alert('Текст скопирован в буфер'));
  };
}

// === SECURITY ===
async function loadSecurity() {
  const tbody = document.getElementById('sec-table');
  tbody.innerHTML = '<tr><td colspan="4">Загрузка...</td></tr>';
  const { data, error } = await supabaseClient.from('counterparties').select('id, inn, name, status').order('created_at', { ascending: false });
  if (error) { tbody.innerHTML = `<tr><td colspan="4">Ошибка: ${error.message}</td></tr>`; return; }
  tbody.innerHTML = '';
  data.forEach(c => {
    const st = c.status === 'на проверке' ? 'st-wait' : c.status === 'одобрен' ? 'st-app' : 'st-new';
    const btns = c.status === 'на проверке' ? `<button class="btn btn-sm btn-green btn-sec-ok" data-id="${c.id}">✓</button><button class="btn btn-sm btn-red btn-sec-no" data-id="${c.id}">✕</button>` : '—';
    tbody.innerHTML += `<tr><td>${c.inn}</td><td>${c.name}</td><td><span class="status ${st}">${c.status}</span></td><td>${btns}</td></tr>`;
  });
  document.querySelectorAll('.btn-sec-ok').forEach(b => b.onclick = () => updateCP(b.dataset.id, 'одобрен'));
  document.querySelectorAll('.btn-sec-no').forEach(b => b.onclick = () => updateCP(b.dataset.id, 'отклонён'));
}
async function updateCP(id, status) {
  await supabaseClient.from('counterparties').update({ status }).eq('id', id);
  await supabaseClient.from('journal').insert({ action: `Контрагент ${status}`, entity_type: 'counterparty', entity_id: id, user_id: currentUser.id });
  loadSecurity();
}

// === DIRECTOR ===
async function loadDirector() {
  const tbody = document.getElementById('dir-table');
  tbody.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
  const { data, error } = await supabaseClient.from('requests').select('*, supplier:counterparties(inn, status), creator:profiles(full_name)').eq('status', 'ожидает директора').order('created_at');
  if (error) { tbody.innerHTML = `<tr><td colspan="6">Ошибка: ${error.message}</td></tr>`; return; }
  tbody.innerHTML = '';
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="6">Нет заявок на согласование</td></tr>'; return; }
  data.forEach(r => {
    const cpOk = r.supplier?.status === 'одобрен';
    const btns = cpOk ? `<button class="btn btn-sm btn-green btn-dir-ok" data-id="${r.id}">Согласовать</button><button class="btn btn-sm btn-red btn-dir-no" data-id="${r.id}">Отклонить</button>` : `<small style="color:var(--orange)">Ожидает проверки СБ</small>`;
    tbody.innerHTML += `<tr><td>${r.request_number}</td><td>${r.project_name}</td><td>${r.creator?.full_name || '—'}</td><td>${r.supplier?.inn || '—'}</td><td>${r.status}</td><td>${btns}</td></tr>`;
  });
  document.querySelectorAll('.btn-dir-ok').forEach(b => b.onclick = () => updateReqStatus(b.dataset.id, 'согласован'));
  document.querySelectorAll('.btn-dir-no').forEach(b => b.onclick = () => updateReqStatus(b.dataset.id, 'отклонён'));
}

// === ACCOUNTANT ===
async function loadAccountant() {
  const tbody = document.getElementById('acc-table');
  tbody.innerHTML = '<tr><td colspan="5">Загрузка...</td></tr>';
  const { data, error } = await supabaseClient.from('requests').select('*, supplier:counterparties(name)').in('status', ['согласован', 'оплачен']).order('created_at');
  if (error) { tbody.innerHTML = `<tr><td colspan="5">Ошибка: ${error.message}</td></tr>`; return; }
  tbody.innerHTML = '';
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="5">Нет счетов к оплате</td></tr>'; return; }
  data.forEach(r => {
    const st = r.status === 'оплачен' ? 'st-paid' : 'st-app';
    const btn = r.status === 'согласован' ? `<button class="btn btn-sm btn-green btn-acc-pay" data-id="${r.id}">Оплачен</button>` : '✅';
    tbody.innerHTML += `<tr><td>${r.request_number}</td><td>${r.supplier?.name || '—'}</td><td><a href="${r.invoice_url}" target="_blank">🔗</a></td><td><span class="status ${st}">${r.status}</span></td><td>${btn}</td></tr>`;
  });
  document.querySelectorAll('.btn-acc-pay').forEach(b => b.onclick = () => markPaid(b.dataset.id));
}

async function markPaid(id) {
  await supabaseClient.from('requests').update({ status: 'оплачен', paid_at: new Date().toISOString() }).eq('id', id);
  await supabaseClient.from('journal').insert({ action: 'Счёт оплачен', entity_type: 'request', entity_id: id, user_id: currentUser.id });
  loadAccountant();
}

async function updateReqStatus(id, status) {
  await supabaseClient.from('requests').update({ status, approved_at: status === 'согласован' ? new Date().toISOString() : null }).eq('id', id);
  await supabaseClient.from('journal').insert({ action: `Заявка ${status}`, entity_type: 'request', entity_id: id, user_id: currentUser.id });
  loadDirector();
  loadSecurity();
}

// === ADMIN ===
async function loadAdmin() {
  const tbody = document.getElementById('adm-journal');
  tbody.innerHTML = '<tr><td colspan="3">Загрузка...</td></tr>';
  const { data, error } = await supabaseClient.from('journal').select('*, user:profiles(full_name)').order('created_at', { ascending: false }).limit(100);
  if (error) { tbody.innerHTML = `<tr><td colspan="3">Ошибка: ${error.message}</td></tr>`; return; }
  tbody.innerHTML = '';
  data.forEach(j => {
    tbody.innerHTML += `<tr><td>${new Date(j.created_at).toLocaleString()}</td><td>${j.user?.full_name || 'Система'}</td><td>${j.action}</td></tr>`;
  });
}

document.getElementById('btn-open-admin-users').onclick = async () => {
  document.getElementById('modal-users').classList.remove('hidden');
  const tbody = document.getElementById('adm-users-body');
  tbody.innerHTML = 'Загрузка...';
  const { data } = await supabaseClient.from('profiles').select('id, full_name, role').order('created_at');
  tbody.innerHTML = '';
  data?.forEach(u => {
    tbody.innerHTML += `<tr><td>${u.full_name}</td><td>${u.id}</td><td>
      <select class="role-select" data-id="${u.id}">
        <option value="engineer" ${u.role==='engineer'?'selected':''}>Инженер</option>
        <option value="security" ${u.role==='security'?'selected':''}>Безопасность</option>
        <option value="director" ${u.role==='director'?'selected':''}>Директор</option>
        <option value="accountant" ${u.role==='accountant'?'selected':''}>Бухгалтер</option>
        <option value="admin" ${u.role==='admin'?'selected':''}>Админ</option>
      </select>
    </td><td><button class="btn btn-sm btn-primary btn-save-role" data-id="${u.id}">Сохранить</button></td></tr>`;
  });
  document.querySelectorAll('.btn-save-role').forEach(b => b.onclick = () => saveRole(b.dataset.id));
};

async function saveRole(id) {
  const val = document.querySelector(`.role-select[data-id="${id}"]`).value;
  await supabaseClient.from('profiles').update({ role: val }).eq('id', id);
  await supabaseClient.from('journal').insert({ action: `Изменена роль на ${val}`, entity_type: 'user', entity_id: id, user_id: currentUser.id });
  alert('Роль обновлена');
}

// UTILS
function showMsg(el, txt, type) {
  el.textContent = txt; el.className = `message ${type}`; el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}
document.getElementById('logout').onclick = async () => { await supabaseClient.auth.signOut(); window.location.href = 'index.html'; };
