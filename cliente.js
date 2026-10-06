const token = localStorage.getItem('assistechToken');
const storedUser = localStorage.getItem('assistechUser');
const osForm = document.querySelector('#os-query-form');
const osResult = document.querySelector('#os-result');
const userName = document.querySelector('#user-name');
const logoutButton = document.querySelector('#logout-button');

let user = null;
try {
  user = storedUser ? JSON.parse(storedUser) : null;
} catch {
  user = null;
}

if (!token || user?.perfil !== 'cliente') {
  window.location.replace('login.html');
}

if (userName && user) userName.textContent = user.nome || 'Área do cliente';

logoutButton?.addEventListener('click', () => {
  localStorage.removeItem('assistechToken');
  localStorage.removeItem('assistechUser');
  window.location.href = 'login.html';
});

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const formatDateTime = (value) => value
  ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  : 'Ainda em atendimento';

osForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const orderNumber = new FormData(osForm).get('numero_os');
  osResult.hidden = false;
  osResult.textContent = 'Consultando sua OS...';

  try {
    const response = await fetch(`/api/equipamentos/os/${encodeURIComponent(orderNumber)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível consultar a OS.');

    const equipment = result.equipamento;
    const photo = equipment.foto_url
      ? `<img class="os-equipment-photo" src="${escapeHtml(equipment.foto_url)}" alt="Foto do equipamento ${escapeHtml(equipment.nome)}">`
      : '<p class="os-no-photo">Nenhuma foto foi cadastrada para este equipamento.</p>';
    const contact = equipment.status === 'Concluído'
      ? `<div class="os-completed"><strong>Serviço concluído</strong><span>Entre em contato com a empresa pelo WhatsApp para combinar a retirada.</span><a href="https://web.whatsapp.com/send?phone=5591985995059&text=${encodeURIComponent(`Olá, gostaria de falar sobre ${equipment.numero_os}.`)}" target="_blank" rel="noopener">Falar no WhatsApp: (91) 98599-5059 ↗</a></div>`
      : equipment.status === 'Em manutenção'
        ? '<div class="os-completed os-in-progress"><strong>Serviço em manutenção</strong><span>Seu equipamento está em avaliação ou reparo pela equipe técnica.</span></div>'
        : '<div class="os-completed os-received"><strong>Equipamento recebido</strong><span>Sua OS foi registrada e aguarda o início da avaliação técnica.</span></div>';
    const statusClass = equipment.status === 'Concluído'
      ? 'status-done'
      : equipment.status === 'Em manutenção' ? 'status-progress' : 'status-received';
    const activeStatus = `<strong class="client-status ${statusClass}">${escapeHtml(equipment.status)}</strong>`;
    osResult.innerHTML = `<div class="os-result-header"><span>${escapeHtml(equipment.numero_os)}</span>${activeStatus}</div><h3>${escapeHtml(equipment.nome)}</h3><p><strong>Cliente:</strong> ${escapeHtml(equipment.cliente_nome)}</p><p><strong>Conclusão:</strong> ${formatDateTime(equipment.concluido_em)}</p>${photo}<p><strong>Modelo:</strong> ${escapeHtml(equipment.modelo)}</p><p><strong>Defeito informado:</strong> ${escapeHtml(equipment.defeito)}</p><p><strong>Peças utilizadas:</strong> ${escapeHtml(equipment.pecas_utilizadas || 'Nenhuma informada')}</p><p class="os-value">Valor do serviço: ${formatCurrency(equipment.valor_servico)}</p>${contact}`;
  } catch (error) {
    osResult.textContent = error.message;
  }
});
