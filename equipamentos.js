const equipmentForm = document.querySelector('#equipment-form');
const equipmentStatus = document.querySelector('#equipment-status');
const equipmentOs = document.querySelector('#equipment-os');
const token = localStorage.getItem('assistechToken');
const storedUser = localStorage.getItem('assistechUser');
let currentUser = null;
try {
  currentUser = storedUser ? JSON.parse(storedUser) : null;
} catch {
  currentUser = null;
}
const isTechnician = currentUser?.perfil === 'tecnico';
const userName = document.querySelector('#user-name');
const logoutButton = document.querySelector('#logout-button');
const equipmentList = document.querySelector('#equipment-list');
const refreshButton = document.querySelector('#refresh-equipment');
const reportFilter = document.querySelector('#report-filter');
const osQueryForm = document.querySelector('#os-query-form');
const osResult = document.querySelector('#os-result');
const areaLabel = document.querySelector('#area-label');
const pageTitle = document.querySelector('#page-title');
const pageDescription = document.querySelector('#page-description');
const printReportButton = document.querySelector('#print-report');
const summaryTotal = document.querySelector('#summary-total');
const summaryProgress = document.querySelector('#summary-progress');
const summaryDone = document.querySelector('#summary-done');
let currentEquipment = [];

if (!token || currentUser?.perfil !== 'tecnico') {
  window.location.replace('login.html');
} else if (storedUser && userName) {
  try {
    userName.textContent = currentUser.nome || 'Área do usuário';
  } catch {
    userName.textContent = 'Área do usuário';
  }
}

document.querySelectorAll('.technician-only').forEach((element) => {
  element.hidden = !isTechnician;
  if (!isTechnician) {
    element.querySelectorAll('input, textarea, select').forEach((field) => { field.disabled = true; });
  }
});
document.querySelectorAll('.client-only').forEach((element) => {
  element.hidden = isTechnician;
});

if (!isTechnician) {
  areaLabel.textContent = 'Área do cliente';
  pageTitle.textContent = 'Acompanhe seu equipamento.';
  pageDescription.textContent = 'Consulte sua OS no topo e acompanhe o andamento do atendimento.';
}

logoutButton?.addEventListener('click', () => {
  localStorage.removeItem('assistechToken');
  localStorage.removeItem('assistechUser');
  window.location.href = 'login.html';
});

equipmentForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = equipmentForm.querySelector('button[type="submit"]');
  equipmentStatus.hidden = false;
  equipmentStatus.textContent = 'Salvando equipamento...';
  equipmentStatus.style.color = '';
  submitButton.disabled = true;

  try {
    const response = await fetch('/api/equipamentos', {
      body: new FormData(equipmentForm),
      headers: { Authorization: `Bearer ${token}` },
      method: 'POST',
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Não foi possível salvar o equipamento.');
    }

    equipmentStatus.textContent = result.message;
    equipmentStatus.style.color = '#15803d';
    if (equipmentOs && result.equipamento?.numero_os) {
      equipmentOs.hidden = false;
      equipmentOs.innerHTML = `<span>OS gerada</span><strong>${escapeHtml(result.equipamento.numero_os)}</strong><button type="button" id="copy-os">Copiar número</button>`;
      document.querySelector('#copy-os')?.addEventListener('click', async () => {
        await navigator.clipboard.writeText(result.equipamento.numero_os);
        document.querySelector('#copy-os').textContent = 'Número copiado';
      });
    }
    equipmentForm.reset();
  } catch (error) {
    equipmentStatus.textContent = error.message || 'Não foi possível salvar o equipamento.';
    equipmentStatus.style.color = '#c2410c';
    if (error.message.includes('sessão')) {
      window.setTimeout(() => { window.location.href = 'login.html'; }, 900);
    }
  } finally {
    submitButton.disabled = false;
  }
});

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatCurrency = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const companyAddress = 'Rua Dr. Henrique, nº 8 - Bairro Castanheira - CEP 66645-110';

const openPrintDocument = (title, content, extraStyles = '') => {
  const printWindow = window.open('', '_blank', 'width=900,height=760');
  if (!printWindow) return;
  printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${title}</title><style>
    @page{size:A4;margin:12mm}*{box-sizing:border-box}body{color:#172b4d;font-family:Arial,sans-serif;font-size:10px;line-height:1.35;margin:0}h1,h2,h3,p{margin:0}.document-header{align-items:flex-start;border-bottom:3px solid #1d65f0;display:flex;justify-content:space-between;padding-bottom:12px}.brand{color:#0b3d9c;font-size:22px;font-weight:800;letter-spacing:-.5px}.brand span{color:#ff715b}.address{color:#52627a;font-size:9px;text-align:right}.document-title{color:#10233f;font-size:18px;margin:18px 0 10px}.document-meta{background:#f1f6fd;border-left:3px solid #ff715b;display:grid;gap:4px;grid-template-columns:1fr 1fr;padding:10px}.document-meta strong{color:#10233f}.section-label{border-bottom:1px solid #dbe4f0;color:#0b3d9c;font-size:10px;font-weight:800;letter-spacing:.08em;margin:16px 0 7px;padding-bottom:4px;text-transform:uppercase}.info-grid{display:grid;gap:7px;grid-template-columns:1fr 1fr}.info-box{border:1px solid #dbe4f0;border-radius:3px;padding:7px}.info-box strong{display:block;color:#52627a;font-size:8px;text-transform:uppercase}.info-box span{display:block;font-size:11px;margin-top:2px}.signature{border-top:1px solid #9aaac0;margin-top:28px;padding-top:5px;text-align:center;width:210px}.footer{border-top:1px solid #dbe4f0;color:#52627a;font-size:8px;margin-top:22px;padding-top:8px;text-align:center}.report-table{border-collapse:collapse;width:100%}.report-table th{background:#0b3d9c;color:#fff;font-size:8px;padding:6px;text-align:left}.report-table td{border-bottom:1px solid #dbe4f0;padding:6px;vertical-align:top}.report-table .value{font-weight:700;white-space:nowrap}.status{font-weight:700}.status-done{color:#15803d}.status-progress{color:#a16207}.status-received{color:#52627a}.total-line{display:flex;font-size:13px;font-weight:800;justify-content:flex-end;margin-top:12px}.no-print{display:none!important}${extraStyles}</style></head><body>${content}<script>window.onload=()=>{window.print();}</script></body></html>`);
  printWindow.document.close();
};

const updateSummary = (equipment) => {
  if (summaryTotal) summaryTotal.textContent = equipment.length;
  if (summaryProgress) summaryProgress.textContent = equipment.filter((item) => item.status === 'Em manutenção').length;
  if (summaryDone) summaryDone.textContent = equipment.filter((item) => item.status === 'Concluído').length;
};

const printReceipt = (equipment) => {
  const orderNumber = equipment.numero_os || `OS-${String(equipment.id).padStart(6, '0')}`;
  const content = `<header class="document-header"><div class="brand">ASSIS<span>TECH</span></div><div class="address">${companyAddress}<br>Recibo de serviço técnico</div></header><h1 class="document-title">Recibo de serviço</h1><div class="document-meta"><div><strong>OS:</strong> ${escapeHtml(orderNumber)}</div><div><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</div><div><strong>Cliente:</strong> ${escapeHtml(equipment.cliente_nome)}</div><div><strong>Garantia:</strong> 90 dias</div></div><div class="section-label">Equipamento do cliente</div><div class="info-grid"><div class="info-box"><strong>Aparelho</strong><span>${escapeHtml(equipment.nome)}</span></div><div class="info-box"><strong>Modelo</strong><span>${escapeHtml(equipment.modelo)}</span></div><div class="info-box"><strong>Status</strong><span>${escapeHtml(equipment.status)}</span></div><div class="info-box"><strong>Garantia</strong><span>90 dias sobre o serviço realizado</span></div></div><div class="section-label">Serviço realizado</div><div class="info-box"><strong>Defeito apresentado</strong><span>${escapeHtml(equipment.defeito)}</span></div><div class="info-box" style="margin-top:7px"><strong>Peças utilizadas</strong><span>${escapeHtml(equipment.pecas_utilizadas || 'Nenhuma peça informada')}</span></div><div class="total-line">Valor total: ${formatCurrency(equipment.valor_servico)}</div><div class="signature">Assinatura do responsável</div><footer class="footer">Assistech | ${companyAddress}<br>Garantia de 90 dias válida para o serviço descrito neste recibo.</footer>`;
  openPrintDocument('Recibo Assistech', content);
};

const printReport = () => {
  if (!currentEquipment.length) return;
  const rows = currentEquipment.map((equipment) => { const orderNumber = equipment.numero_os || `OS-${String(equipment.id).padStart(6, '0')}`; return `<tr><td><strong>${escapeHtml(orderNumber)}</strong><br>${escapeHtml(equipment.cliente_nome)}</td><td><strong>${escapeHtml(equipment.nome)}</strong><br><small>${escapeHtml(equipment.modelo)}</small></td><td>${escapeHtml(equipment.defeito)}<br><small>Peças: ${escapeHtml(equipment.pecas_utilizadas || 'Nenhuma')}</small></td><td class="status status-${equipment.status === 'Concluído' ? 'done' : equipment.status === 'Em manutenção' ? 'progress' : 'received'}">${escapeHtml(equipment.status)}</td><td class="value">${formatCurrency(equipment.valor_servico)}</td></tr>`; }).join('');
  const total = currentEquipment.reduce((sum, equipment) => sum + Number(equipment.valor_servico || 0), 0);
  const content = `<header class="document-header"><div class="brand">ASSIS<span>TECH</span></div><div class="address">${companyAddress}<br>Relatório técnico de equipamentos</div></header><h1 class="document-title">Relatório de atendimento</h1><div class="document-meta"><div><strong>Emissão:</strong> ${new Date().toLocaleString('pt-BR')}</div><div><strong>Registros:</strong> ${currentEquipment.length}</div></div><div class="section-label">Equipamentos cadastrados</div><table class="report-table"><thead><tr><th>OS / cliente</th><th>Aparelho / modelo</th><th>Defeito / peças</th><th>Status</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table><div class="total-line">Total dos serviços: ${formatCurrency(total)}</div><footer class="footer">Assistech | ${companyAddress}<br>Documento emitido para controle técnico e atendimento ao cliente.</footer>`;
  openPrintDocument('Relatório técnico Assistech', content, '@media print{body{font-size:9px}.document-title{margin:10px 0 7px}.section-label{margin-top:10px}.report-table td{padding:4px}.footer{margin-top:12px}}');
};

const loadEquipment = async (filters = new URLSearchParams()) => {
  if (!equipmentList) return;

  try {
    const query = filters.toString() ? `?${filters.toString()}` : '';
    const response = await fetch(`/api/equipamentos${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os equipamentos.');

    if (!result.equipamentos.length) {
      currentEquipment = [];
      updateSummary([]);
      equipmentList.innerHTML = '<p class="empty-state">Nenhum equipamento cadastrado ainda.</p>';
      return;
    }

    currentEquipment = result.equipamentos;
    updateSummary(currentEquipment);
    equipmentList.innerHTML = result.equipamentos.map((equipment) => `
      <article class="equipment-item">
        <div class="equipment-item-photo">
          ${equipment.foto_url ? `<img src="${escapeHtml(equipment.foto_url)}" alt="Foto de ${escapeHtml(equipment.nome)}">` : '<div class="equipment-placeholder" aria-hidden="true">✦</div>'}
        </div>
        <div class="equipment-item-info">
          <div class="equipment-item-topline"><span class="equipment-model">${escapeHtml(equipment.modelo)}</span>${isTechnician ? `<span class="status-badge status-${equipment.status === 'Concluído' ? 'done' : equipment.status === 'Em manutenção' ? 'progress' : 'received'}">${escapeHtml(equipment.status)}</span>` : `<span class="os-label">${escapeHtml(equipment.numero_os)}</span>`}</div>
          <h3>${escapeHtml(equipment.nome)}</h3>
          <span class="equipment-client">Cliente: ${escapeHtml(equipment.cliente_nome)}</span>
          ${isTechnician ? `<p>${escapeHtml(equipment.defeito)}</p><div class="equipment-meta"><strong>${formatCurrency(equipment.valor_servico)}</strong><span>${escapeHtml(equipment.pecas_utilizadas || 'Sem peças registradas')}</span></div>` : ''}
        </div>
        ${isTechnician ? `<label class="status-field" for="status-${equipment.id}">
          Status
          <select id="status-${equipment.id}" data-equipment-id="${equipment.id}">
            ${['Recebido', 'Em manutenção', 'Concluído'].map((status) => `<option ${status === equipment.status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
        </label><button class="receipt-button" type="button" data-receipt-id="${equipment.id}">Imprimir recibo</button>` : ''}
      </article>
    `).join('');

    equipmentList.querySelectorAll('select[data-equipment-id]').forEach((select) => {
      select.addEventListener('change', () => updateStatus(select));
    });
    equipmentList.querySelectorAll('[data-receipt-id]').forEach((button) => {
      button.addEventListener('click', () => printReceipt(currentEquipment.find((item) => String(item.id) === button.dataset.receiptId)));
    });
  } catch (error) {
    equipmentList.innerHTML = `<p class="empty-state error-state">${escapeHtml(error.message)}</p>`;
  }
};

const updateStatus = async (select) => {
  const equipmentId = select.dataset.equipmentId;
  select.disabled = true;

  try {
    const response = await fetch(`/api/equipamentos/${equipmentId}/status`, {
      body: JSON.stringify({ status: select.value }),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      method: 'PATCH',
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar o status.');
  } catch (error) {
    window.alert(error.message);
    loadEquipment();
  } finally {
    select.disabled = false;
  }
};

refreshButton?.addEventListener('click', loadEquipment);
reportFilter?.addEventListener('submit', (event) => {
  event.preventDefault();
  loadEquipment(new URLSearchParams(new FormData(reportFilter)));
});
printReportButton?.addEventListener('click', printReport);

osQueryForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const orderNumber = new FormData(osQueryForm).get('numero_os');
  osResult.hidden = false;
  osResult.textContent = 'Consultando OS...';

  try {
    const response = await fetch(`/api/equipamentos/os/${encodeURIComponent(orderNumber)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível consultar a OS.');
    const equipment = result.equipamento;
    osResult.innerHTML = `<div class="os-result-header"><span>${escapeHtml(equipment.numero_os)}</span><strong>${escapeHtml(equipment.status)}</strong></div><h3>${escapeHtml(equipment.nome)}</h3><p>Modelo: ${escapeHtml(equipment.modelo)}</p><p>Defeito: ${escapeHtml(equipment.defeito)}</p><p>Peças utilizadas: ${escapeHtml(equipment.pecas_utilizadas || 'Nenhuma informada')}</p><p class="os-value">Valor do serviço: ${formatCurrency(equipment.valor_servico)}</p>`;
  } catch (error) {
    osResult.textContent = error.message;
  }
});
if (isTechnician) {
  loadEquipment();
}