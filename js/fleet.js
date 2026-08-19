'use strict';
let db, vehicles = [], reservations = [], selected, channel;
const today = () => new Date().toISOString().slice(0, 10);
const overlap = (a, b, c, d) => a <= d && b >= c;

function showLoading(title, text) {
  $('loadingTitle').textContent = title;
  $('loadingText').textContent = text;
  $('loading').classList.remove('hidden');
}
function hideLoading() { $('loading').classList.add('hidden'); }

function approvedFor(vehicle) {
  return reservations
    .filter(r => r.vehicle_id === vehicle.id && r.status === 'approved')
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

function live(vehicle) {
  if (vehicle.manual_status === 'unavailable') {
    return {
      busy: true,
      current: vehicle.current_driver || 'Indisponível',
      last: vehicle.last_driver || '-',
      end: vehicle.manual_end_date
    };
  }
  if (vehicle.manual_status === 'available') {
    return {
      busy: false,
      current: '-',
      last: vehicle.last_driver || vehicle.current_driver || '-',
      end: null
    };
  }
  const approved = approvedFor(vehicle);
  const current = approved.find(r => r.start_date <= today() && r.end_date >= today());
  const previous = [...approved]
    .filter(r => r.end_date < today())
    .sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
  return {
    busy: Boolean(current),
    current: current?.requester_name || '-',
    last: previous?.requester_name || vehicle.last_driver || '-',
    end: current?.end_date || null
  };
}

async function load(silent = false) {
  try {
    db = db || getClient();
    if (!silent) showLoading('Sincronizando frota', 'Buscando dados atualizados...');
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
    toast(error.message);
  } finally {
    if (!silent) hideLoading();
  }
}

function fillProjects() {
  const projects = [...new Set(vehicles.map(v => v.project).filter(Boolean))];
  $('project').innerHTML = '<option value="">Todos os projetos</option>' +
    projects.map(project => `<option>${esc(project)}</option>`).join('');
}

function card(vehicle) {
  const state = live(vehicle);
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
    </div>
    <button class="btn primary wide" onclick="event.stopPropagation();openRequest('${vehicle.id}',this)">${state.busy ? 'Request Reservation' : 'Request'}</button>
  </article>`;
}

function render() {
  const query = $('search').value.toLowerCase();
  const project = $('project').value;
  const availability = $('availability').value;
  const rows = vehicles.filter(vehicle => {
    const state = live(vehicle);
    return (!query || Object.values(vehicle).join(' ').toLowerCase().includes(query)) &&
      (!project || vehicle.project === project) &&
      (!availability || (availability === 'busy') === state.busy);
  });
  const busy = vehicles.filter(vehicle => live(vehicle).busy).length;
  $('kTotal').textContent = vehicles.length;
  $('kAvailable').textContent = vehicles.length - busy;
  $('kBusy').textContent = busy;
  $('kPending').textContent = reservations.filter(r => r.status === 'pending').length;
  $('count').textContent = rows.length;
  $('vehicleGrid').innerHTML = rows.map(card).join('') || '<div class="empty">Nenhum veículo encontrado.</div>';

  const reservationRows = reservations
    .filter(r => r.status === 'pending' || (r.status === 'approved' && r.end_date >= today()))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  $('reservationGrid').innerHTML = reservationRows.map(r => `<article class="reservation-card ${r.status}">
    <span class="badge ${r.status}">${statusLabel[r.status]}</span>
    <h3>${esc(r.model)} · ${esc(r.plate)}</h3>
    <p><b>${esc(r.requester_name)}</b></p>
    <p>${fmtDate(r.start_date)} a ${fmtDate(r.end_date)}</p>
  </article>`).join('') || '<div class="empty">Não há reservas futuras.</div>';
}

function openDetails(id) {
  selected = vehicles.find(vehicle => vehicle.id === id);
  const state = live(selected);
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
    ['Fim da reserva atual', state.busy && state.end ? fmtDate(state.end) : '-']
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
  showLoading('Preparando formulário', 'Verificando disponibilidade...');
  await new Promise(resolve => setTimeout(resolve, 220));
  selected = vehicles.find(vehicle => vehicle.id === id);
  const form = $('requestForm');
  form.reset();
  form.elements.vehicle_id.value = id;
  form.elements.project.value = selected.project || '';
  form.elements.start_date.min = form.elements.end_date.min = today();
  $('selectedVehicle').textContent = `${selected.model} · ${selected.plate}`;
  $('conflictWarning').classList.add('hidden');
  hideLoading();
  $('requestModal').classList.remove('hidden');
  if (button) {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function checkConflict() {
  const form = $('requestForm');
  const start = form.elements.start_date.value;
  const end = form.elements.end_date.value;
  const warning = $('conflictWarning');
  if (!start || !end) return warning.classList.add('hidden');
  const conflict = reservations.find(r => r.vehicle_id === selected.id && r.status === 'approved' && overlap(start, end, r.start_date, r.end_date));
  warning.classList.toggle('hidden', !conflict);
  if (conflict) warning.innerHTML = `Conflito com reserva aprovada de <b>${fmtDate(conflict.start_date)}</b> a <b>${fmtDate(conflict.end_date)}</b>. O envio ainda é permitido para análise.`;
}

$('requestForm').onsubmit = async event => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  const button = $('submitRequest');
  const original = button.innerHTML;
  if (payload.end_date < payload.start_date) return toast('Revise o período.');
  button.disabled = true;
  button.innerHTML = '<span class="mini-spinner"></span> Enviando...';
  showLoading('Registrando solicitação', 'Enviando dados para o Supabase...');
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
setInterval(() => load(true), 30000);
try {
  db = getClient();
  channel = db.channel('fleet-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => load(true))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => load(true))
    .subscribe();
} catch (error) {}
