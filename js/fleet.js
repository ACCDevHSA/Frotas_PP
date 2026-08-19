'use strict';
let db, vehicles = [], reservations = [], selected, channel;
const today = () => new Date().toISOString().slice(0, 10);
const periodsOverlap = (aStart, aEnd, bStart, bEnd) => aStart <= bEnd && aEnd >= bStart;

function showLoading(title, text) {
  $('loadingTitle').textContent = title;
  $('loadingText').textContent = text;
  $('loading').classList.remove('hidden');
}
function hideLoading() { $('loading').classList.add('hidden'); }

function approvedReservations(vehicle) {
  return reservations
    .filter(item => item.vehicle_id === vehicle.id && item.status === 'approved')
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

/*
 * Regra central de disponibilidade:
 * 1. manual_status=unavailable usa manual_end_date.
 * 2. manual_status=available força disponibilidade.
 * 3. modo auto usa start_date/end_date da reserva aprovada.
 * 4. end_date é inclusiva: o veículo fica disponível no dia seguinte.
 */
function vehicleState(vehicle) {
  const currentDate = today();

  if (vehicle.manual_status === 'unavailable') {
    const manualExpired = vehicle.manual_end_date && vehicle.manual_end_date < currentDate;
    if (!manualExpired) {
      return {
        busy: true,
        current: vehicle.current_driver || 'Indisponível',
        last: vehicle.last_driver || '-',
        end: vehicle.manual_end_date || null,
        next: null
      };
    }
  }

  if (vehicle.manual_status === 'available') {
    return {
      busy: false,
      current: '-',
      last: vehicle.last_driver || vehicle.current_driver || '-',
      end: null,
      next: null
    };
  }

  const approved = approvedReservations(vehicle);
  const current = approved.find(item =>
    item.start_date <= currentDate && item.end_date >= currentDate
  );
  const previous = [...approved]
    .filter(item => item.end_date < currentDate)
    .sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
  const next = approved.find(item => item.start_date > currentDate);

  return {
    busy: Boolean(current),
    current: current?.requester_name || '-',
    last: previous?.requester_name || vehicle.last_driver || '-',
    end: current?.end_date || null,
    next: next || null
  };
}

async function load(silent = false) {
  try {
    db = db || getClient();
    if (!silent) showLoading('Sincronizando frota', 'Buscando veículos e reservas atualizados...');

    const [vehicleResult, reservationResult] = await Promise.all([
      db.from('vehicles').select('*').eq('active', true).order('model'),
      db.from('reservations_public').select('*').in('status', ['pending', 'approved']).order('start_date')
    ]);

    if (vehicleResult.error) throw vehicleResult.error;
    if (reservationResult.error) throw reservationResult.error;

    vehicles = vehicleResult.data || [];
    reservations = reservationResult.data || [];
    $('source').classList.add('online');
    $('sourceText').textContent = 'Supabase conectado';
    fillProjects();
    render();
  } catch (error) {
    $('sourceText').textContent = 'Erro de conexão';
    toast(error.message);
  } finally {
    if (!silent) hideLoading();
  }
}

function fillProjects() {
  const projects = [...new Set(vehicles.map(vehicle => vehicle.project).filter(Boolean))].sort();
  const currentValue = $('project').value;
  $('project').innerHTML = '<option value="">Todos os projetos</option>' +
    projects.map(project => `<option value="${esc(project)}">${esc(project)}</option>`).join('');
  if (projects.includes(currentValue)) $('project').value = currentValue;
}

function card(vehicle) {
  const state = vehicleState(vehicle);
  const nextUser = state.next?.requester_name || '-';
  const nextDate = state.next?.start_date ? fmtDate(state.next.start_date) : '-';

  return `<article class="vehicle-card ${state.busy ? 'unavailable' : ''}" onclick="openDetails('${vehicle.id}')">
    <div class="vehicle-top">
      <span class="project-tag">${esc(vehicle.project || '-')}</span>
      <span class="status ${state.busy ? 'off' : ''}"><i></i>${state.busy ? 'INDISPONÍVEL' : 'DISPONÍVEL'}</span>
    </div>
    <h3>${esc(vehicle.model)}</h3>
    <p class="variant">${esc(vehicle.version || '-')} · ${esc(vehicle.color || '-')}</p>
    <div class="facts">
      <div><span>Placa</span><b>${esc(vehicle.plate)}</b></div>
      <div><span>Usuário atual</span><b>${esc(state.current)}</b></div>
      <div><span>Último usuário</span><b>${esc(state.last)}</b></div>
      <div><span>Fim da reserva atual</span><b>${state.busy && state.end ? fmtDate(state.end) : '-'}</b></div>
      <div><span>Próximo usuário</span><b>${esc(nextUser)}</b></div>
      <div><span>Próxima reserva</span><b>${nextDate}</b></div>
    </div>
    <button class="btn primary wide" onclick="event.stopPropagation();openRequest('${vehicle.id}',this)">${state.busy ? 'Request Reservation' : 'Request'}</button>
  </article>`;
}

function render() {
  const query = $('search').value.toLowerCase();
  const project = $('project').value;
  const availability = $('availability').value;

  const rows = vehicles.filter(vehicle => {
    const state = vehicleState(vehicle);
    const searchable = Object.values(vehicle).join(' ').toLowerCase();
    return (!query || searchable.includes(query)) &&
      (!project || vehicle.project === project) &&
      (!availability || (availability === 'busy') === state.busy);
  });

  const busyCount = vehicles.filter(vehicle => vehicleState(vehicle).busy).length;
  $('kTotal').textContent = vehicles.length;
  $('kAvailable').textContent = vehicles.length - busyCount;
  $('kBusy').textContent = busyCount;
  $('kPending').textContent = reservations.filter(item => item.status === 'pending').length;
  $('count').textContent = rows.length;
  $('vehicleGrid').innerHTML = rows.map(card).join('') || '<div class="empty">Nenhum veículo encontrado.</div>';

  const reservationRows = reservations
    .filter(item => item.status === 'pending' || (item.status === 'approved' && item.end_date >= today()))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  $('reservationGrid').innerHTML = reservationRows.map(item => `<article class="reservation-card ${item.status}">
    <span class="badge ${item.status}">${statusLabel[item.status]}</span>
    <h3>${esc(item.model)} · ${esc(item.plate)}</h3>
    <p><b>${esc(item.requester_name)}</b></p>
    <p>${fmtDate(item.start_date)} a ${fmtDate(item.end_date)}</p>
  </article>`).join('') || '<div class="empty">Não há reservas futuras.</div>';
}

function openDetails(id) {
  selected = vehicles.find(vehicle => vehicle.id === id);
  if (!selected) return toast('Veículo não encontrado.');
  const state = vehicleState(selected);

  $('detailsTitle').textContent = selected.model;
  $('detailsSubtitle').textContent = `${selected.version || '-'} · ${selected.color || '-'}`;
  $('detailsGrid').innerHTML = [
    ['Projeto', selected.project],
    ['Status', state.busy ? 'Indisponível' : 'Disponível'],
    ['Placa', selected.plate],
    ['Ano / Modelo', selected.year_model],
    ['Renavam', selected.renavam],
    ['Chassi', selected.chassis],
    ['Rodízio', selected.rotation_day],
    ['Usuário atual', state.current],
    ['Último usuário', state.last],
    ['Fim da reserva atual', state.busy && state.end ? fmtDate(state.end) : '-'],
    ['Próximo usuário', state.next?.requester_name || '-'],
    ['Próxima reserva', state.next?.start_date ? fmtDate(state.next.start_date) : '-']
  ].map(([label, value]) => `<div><small>${esc(label)}</small><b>${esc(value || '-')}</b></div>`).join('');

  $('detailsRequest').textContent = state.busy ? 'Request Reservation' : 'Request';
  $('detailsRequest').onclick = () => {
    $('detailsModal').classList.add('hidden');
    openRequest(id, $('detailsRequest'));
  };
  $('detailsModal').classList.remove('hidden');
}

async function openRequest(id, button) {
  const original = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="mini-spinner"></span> Preparando...';
  }
  showLoading('Preparando formulário', 'Verificando a disponibilidade...');
  await new Promise(resolve => setTimeout(resolve, 220));

  selected = vehicles.find(vehicle => vehicle.id === id);
  if (!selected) {
    hideLoading();
    if (button) { button.disabled = false; button.innerHTML = original; }
    return toast('Veículo não encontrado.');
  }

  const form = $('requestForm');
  form.reset();
  form.elements.vehicle_id.value = id;
  form.elements.project.value = selected.project || '';
  form.elements.start_date.min = form.elements.end_date.min = today();
  $('selectedVehicle').textContent = `${selected.model} · ${selected.plate}`;
  $('conflictWarning').classList.add('hidden');
  hideLoading();
  $('requestModal').classList.remove('hidden');

  if (button) { button.disabled = false; button.innerHTML = original; }
}

function checkConflict() {
  const form = $('requestForm');
  const start = form.elements.start_date.value;
  const end = form.elements.end_date.value;
  const warning = $('conflictWarning');
  if (!start || !end) return warning.classList.add('hidden');
  if (end < start) {
    warning.textContent = 'A data final não pode ser anterior à data inicial.';
    return warning.classList.remove('hidden');
  }
  const conflict = reservations.find(item =>
    item.vehicle_id === selected.id &&
    item.status === 'approved' &&
    periodsOverlap(start, end, item.start_date, item.end_date)
  );
  warning.classList.toggle('hidden', !conflict);
  if (conflict) {
    warning.innerHTML = `Conflito com reserva aprovada de <b>${fmtDate(conflict.start_date)}</b> a <b>${fmtDate(conflict.end_date)}</b>. O envio ainda é permitido para análise.`;
  }
}

$('requestForm').onsubmit = async event => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  const button = $('submitRequest');
  const original = button.innerHTML;

  if (payload.end_date < payload.start_date) return toast('Revise o período informado.');
  button.disabled = true;
  button.innerHTML = '<span class="mini-spinner"></span> Enviando...';
  showLoading('Registrando solicitação', 'Enviando os dados para o Supabase...');

  try {
    payload.status = 'pending';
    const result = await db.from('reservations').insert(payload);
    if (result.error) throw result.error;
    await load(true);
    $('requestModal').classList.add('hidden');
    $('successSummary').innerHTML = `<b>${esc(selected.model)} · ${esc(selected.plate)}</b><span>${fmtDate(payload.start_date)} a ${fmtDate(payload.end_date)}</span>`;
    hideLoading();
    $('successModal').classList.remove('hidden');
  } catch (error) {
    hideLoading();
    toast(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
};

['start_date', 'end_date'].forEach(name => $('requestForm').elements[name].onchange = checkConflict);
$('themeToggle').onclick = toggleTheme;
$('search').oninput = render;
$('project').onchange = $('availability').onchange = render;
$('clear').onclick = () => {
  $('search').value = '';
  $('project').value = '';
  $('availability').value = '';
  render();
};

load();
// Recalcula automaticamente mudança de dia, encerramento e início de reservas.
setInterval(() => load(true), 30000);
try {
  db = getClient();
  channel = db.channel('fleet-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => load(true))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => load(true))
    .subscribe();
} catch (error) {}
