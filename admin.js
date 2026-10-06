const token = localStorage.getItem('assistechToken');
const storedUser = localStorage.getItem('assistechUser');
const usersList = document.querySelector('#users-list');
const ordersList = document.querySelector('#orders-list');
const adminName = document.querySelector('#admin-name');
const logoutButton = document.querySelector('#logout-button');

let user = null;
try { user = storedUser ? JSON.parse(storedUser) : null; } catch { user = null; }
if (!token || user?.perfil !== 'admin') window.location.replace('login.html');
if (adminName && user) adminName.textContent = user.nome || 'Painel administrativo';
logoutButton?.addEventListener('click', () => {
  localStorage.removeItem('assistechToken');
  localStorage.removeItem('assistechUser');
  window.location.href = 'login.html';
});

const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const formatDate = (value) => new Date(value).toLocaleDateString('pt-BR');
const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
  return result;
};

const loadUsers = async () => {
  try {
    const { usuarios } = await request('/api/admin/usuarios');
    usersList.innerHTML = `<table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Cadastro</th></tr></thead><tbody>${usuarios.map((item) => `<tr><td>${escapeHtml(item.nome)}</td><td>${escapeHtml(item.email)}</td><td><select data-user-id="${item.id}" class="admin-role"><option value="cliente" ${item.perfil === 'cliente' ? 'selected' : ''}>Cliente</option><option value="tecnico" ${item.perfil === 'tecnico' ? 'selected' : ''}>Técnico</option><option value="admin" ${item.perfil === 'admin' ? 'selected' : ''}>Administrador</option></select></td><td>${formatDate(item.criado_em)}</td></tr>`).join('')}</tbody></table>`;
    usersList.querySelectorAll('.admin-role').forEach((select) => select.addEventListener('change', () => updateRole(select)));
  } catch (error) { usersList.innerHTML = `<p class="empty-state error-state">${escapeHtml(error.message)}</p>`; }
};

const updateRole = async (select) => {
  try {
    await request(`/api/admin/usuarios/${select.dataset.userId}/perfil`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil: select.value }) });
  } catch (error) { window.alert(error.message); loadUsers(); }
};

const loadOrders = async () => {
  try {
    const { equipamentos } = await request('/api/admin/equipamentos');
    ordersList.innerHTML = `<table class="admin-table"><thead><tr><th>OS</th><th>Cliente</th><th>Equipamento</th><th>Status</th><th>Valor</th></tr></thead><tbody>${equipamentos.map((item) => `<tr><td><strong>${escapeHtml(item.numero_os)}</strong></td><td>${escapeHtml(item.cliente_nome)}</td><td>${escapeHtml(item.nome)}<small>${escapeHtml(item.modelo)}</small></td><td>${escapeHtml(item.status)}</td><td>${formatCurrency(item.valor_servico)}</td></tr>`).join('')}</tbody></table>`;
  } catch (error) { ordersList.innerHTML = `<p class="empty-state error-state">${escapeHtml(error.message)}</p>`; }
};

Promise.all([loadUsers(), loadOrders()]);
