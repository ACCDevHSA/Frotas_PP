'use strict';
let db, vehicles = [], reservations = [], records = [];
const todayAdmin = () => new Date().toISOString().slice(0, 10);

async function load() {
  try {
    db = db || getClient();
    const results = await Promise.all([
      db.from('vehicles').select('*').order('model'),
      db.from('reservations_admin').select('*').order('created_at', { ascending: false }),
      db.from('loan_records_view').select('*').order('withdrawal_date', { ascending: false })
    ]);
    results.forEach(result => { if (result.error) throw result.error; });
    [vehicles, reservations, records] = results.map(result => result.data || []);
    $('sourceText').textContent = 'Supabase conectado';
    render();
  } catch (error) {
    toast(error.message);
  }
}

function isFutureOrCurrent(reservation) {
  return reservation.end_date >= todayAdmin();
}

function render() {
  $('kVehicles').textContent = vehicles.filter(vehicle => vehicle.active).length;
  $('kPending').textContent = reservations.filter(item => item.status === 'pending').length;
  $('kApproved').textContent = reservations.filter(item => item.status === 'approved').length;
  $('kOpen').textContent = records.filter(item => item.status === 'open').length;

  $('fleetBody').innerHTML = vehicles.map(vehicle => `<tr>
    <td>${esc(vehicle.project || '-')}</td>
    <td><b>${esc(vehicle.model)}</b></td>
    <td>${esc(vehicle.plate)}</td>
    <td>${esc(vehicle.manual_status || 'auto')}</td>
    <td>${esc(vehicle.current_driver || '-')}</td>
    <td>${esc(vehicle.last_driver || '-')}</td>
    <td><button class="icon-btn" onclick="editVehicle('${vehicle.id}')" title="Editar veículo">✎</button><button class="icon-btn danger" onclick="disableVehicle('${vehicle.id}')" title="Inativar veículo">⌫</button></td>
  </tr>`).join('');

  $('requestsBody').innerHTML = reservations.map(item => {
    const canManage = ['pending', 'approved'].includes(item.status) && isFutureOrCurrent(item);
    return `<tr>
      <td><b>${esc(item.requester_name)}</b><small class="block">${esc(item.requester_email)}</small></td>
      <td>${esc(item.model)} · ${esc(item.plate)}</td>
      <td>${fmtDate(item.start_date)} a ${fmtDate(item.end_date)}</td>
      <td><span class="badge ${item.status}">${statusLabel[item.status]}</span></td>
      <td><div class="actions">
        ${item.status === 'pending' ? `<button class="btn small success" onclick="decide('${item.id}','approved')">Aprovar</button><button class="btn small danger" onclick="decide('${item.id}','rejected')">Rejeitar</button>` : ''}
        ${canManage ? `<button class="btn small" onclick="editReservation('${item.id}')">✎ Editar</button><button class="btn small danger" onclick="deleteReservation('${item.id}')">⌫ Excluir</button>` : ''}
      </div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5">Nenhuma solicitação.</td></tr>';

  $('recordsBody').innerHTML = records.map(item => `<tr>
    <td>${esc(item.requester_name)}</td>
    <td>${esc(item.model)} · ${esc(item.plate)}</td>
    <td>${fmtDate(item.withdrawal_date)}</td>
    <td>${fmtDate(item.expected_return_date)}</td>
    <td>${esc(item.status)}</td>
    <td>${item.contract_url ? `<a class="btn small" href="${esc(item.contract_url)}" target="_blank" rel="noopener">Abrir</a>` : 'Pendente'}</td>
    <td>${item.checklist_url ? `<a class="btn small" href="${esc(item.checklist_url)}" target="_blank" rel="noopener">Abrir</a>` : 'Pendente'}</td>
  </tr>`).join('') || '<tr><td colspan="7">Nenhum registro.</td></tr>';
}

function openVehicle(vehicle = {}) {
  const form = $('vehicleForm');
  form.reset();
  Object.entries(vehicle).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? '';
  });
  form.elements.active.value = String(vehicle.active ?? true);
  form.elements.manual_status.value = vehicle.manual_status || 'auto';
  $('vehicleModalTitle').textContent = vehicle.id ? 'Editar veículo' : 'Novo veículo';
  $('vehicleModal').classList.remove('hidden');
}
function editVehicle(id) { openVehicle(vehicles.find(vehicle => vehicle.id === id)); }
async function disableVehicle(id) {
  if (!confirm('Inativar este veículo? O histórico será preservado.')) return;
  const result = await db.from('vehicles').update({ active: false }).eq('id', id);
  if (result.error) toast(result.error.message); else load();
}

$('vehicleForm').onsubmit = async event => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  const id = payload.id;
  delete payload.id;
  delete payload.last_driver;
  payload.active = payload.active === 'true';
  Object.keys(payload).forEach(key => { if (payload[key] === '') payload[key] = null; });
  const result = id
    ? await db.from('vehicles').update(payload).eq('id', id)
    : await db.from('vehicles').insert(payload);
  if (result.error) return toast(result.error.message);
  $('vehicleModal').classList.add('hidden');
  toast('Veículo salvo.');
  load();
};

async function decide(id, status) {
  const result = await db.rpc('set_reservation_status', { p_reservation_id: id, p_status: status });
  if (result.error) return toast(result.error.message);
  toast('Solicitação atualizada.');
  await load();
}

function editReservation(id) {
  const item = reservations.find(reservation => reservation.id === id);
  if (!item) return toast('Reserva não encontrada.');
  const form = $('reservationEditForm');
  form.reset();
  ['id','requester_name','requester_email','employee_number','department','job_title','project','start_date','end_date','purpose','notes'].forEach(key => {
    if (form.elements[key]) form.elements[key].value = item[key] ?? '';
  });
  form.elements.vehicle_id.value = item.vehicle_id;
  form.elements.status.value = item.status;
  $('reservationEditVehicle').textContent = `${item.model} · ${item.plate}`;
  $('reservationEditModal').classList.remove('hidden');
}

function ensureReservationEditorUI() {
  if ($('reservationEditModal')) return;
  document.body.insertAdjacentHTML('beforeend', `<div class="modal hidden" id="reservationEditModal"><div class="modal-card"><div class="modal-head"><div><p class="eyebrow">EDITAR RESERVA</p><h2>Dados da reserva</h2><p id="reservationEditVehicle"></p></div><button class="close" data-close="reservationEditModal">×</button></div><form id="reservationEditForm"><div class="form-grid"><input type="hidden" name="id"><input type="hidden" name="vehicle_id"><input type="hidden" name="status"><label>Nome completo *<input name="requester_name" required></label><label>E-mail corporativo *<input name="requester_email" type="email" required></label><label>Matrícula *<input name="employee_number" required></label><label>Departamento *<input name="department" required></label><label>Cargo<input name="job_title"></label><label>Projeto *<input name="project" required></label><label>Data inicial *<input name="start_date" type="date" required></label><label>Data final *<input name="end_date" type="date" required></label><label class="full">Finalidade *<textarea name="purpose" required></textarea></label><label class="full">Observações<textarea name="notes"></textarea></label></div><div class="modal-actions"><button type="button" class="btn" data-close="reservationEditModal">Cancelar</button><button class="btn primary" id="saveReservation">Salvar alterações</button></div></form></div></div>`);
}
ensureReservationEditorUI();

$('reservationEditForm').onsubmit = async event => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  if (payload.end_date < payload.start_date) return toast('A data final deve ser posterior ou igual à inicial.');
  const button = $('saveReservation');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Salvando...';
  try {
    const result = await db.rpc('admin_update_reservation', {
      p_reservation_id: payload.id,
      p_requester_name: payload.requester_name,
      p_requester_email: payload.requester_email,
      p_employee_number: payload.employee_number,
      p_department: payload.department,
      p_job_title: payload.job_title || null,
      p_project: payload.project,
      p_start_date: payload.start_date,
      p_end_date: payload.end_date,
      p_purpose: payload.purpose,
      p_notes: payload.notes || null
    });
    if (result.error) throw result.error;
    $('reservationEditModal').classList.add('hidden');
    toast('Reserva atualizada.');
    await load();
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
};

async function deleteReservation(id) {
  const item = reservations.find(reservation => reservation.id === id);
  if (!item) return toast('Reserva não encontrada.');
  const message = item.status === 'approved'
    ? `Excluir a reserva aprovada de ${item.requester_name} para ${item.model} (${fmtDate(item.start_date)} a ${fmtDate(item.end_date)})? O registro de empréstimo vinculado também será removido.`
    : `Excluir a solicitação de ${item.requester_name} para ${item.model}?`;
  if (!confirm(message)) return;

  try {
    const result = await db.rpc('admin_delete_reservation', { p_reservation_id: id });
    if (result.error) throw result.error;
    toast('Reserva excluída.');
    await load();
  } catch (error) {
    toast(error.message);
  }
}

document.querySelectorAll('.tab').forEach(button => button.onclick = () => {
  document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === button));
  ['fleet','requests','records'].forEach(tab => $(tab + 'Tab').classList.toggle('hidden', tab !== button.dataset.tab));
});
$('newVehicle').onclick = () => openVehicle();
$('themeToggle').onclick = toggleTheme;
load();
