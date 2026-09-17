"use strict";
(() => {
  if (window.__fleetSharePointWorkflowV3) return;
  window.__fleetSharePointWorkflowV3 = true;

  const $ = id => document.getElementById(id);
  const db = window.getFleetDb
    ? window.getFleetDb()
    : window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
  const isPublic = Boolean($("requestForm"));
  const isAdmin = Boolean($("requestsBody"));
  const fmt = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "-";
  let own = [];
  let scanning = false;
  let adminScanning = false;

  function notify(message, error = false) {
    const toast = $("toast");
    if (!toast) return alert(message);
    toast.textContent = message;
    toast.style.borderColor = error ? "var(--danger)" : "var(--success)";
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
      toast.style.removeProperty("border-color");
    }, 4000);
  }

  function tokens() {
    try {
      const value = JSON.parse(localStorage.getItem("fleetRequestTokens") || "[]");
      return Array.isArray(value) ? [...new Set(value)] : [];
    } catch { return []; }
  }

  function validSharePoint(value) {
    try {
      const url = new URL(String(value || "").trim());
      return url.protocol === "https:" && /(^|\.)sharepoint\.(com|us|de|cn)$/i.test(url.hostname);
    } catch { return false; }
  }

  async function loadOwn() {
    const rows = [];
    for (const token of tokens()) {
      const tracked = await db.rpc("track_fleet_request", { p_token: token });
      if (tracked.error) continue;
      const request = Array.isArray(tracked.data) ? tracked.data[0] : tracked.data;
      if (!request) continue;
      const stateResult = await db.rpc("get_sharepoint_contract_status", { p_token: token });
      const state = stateResult.error ? {} : (Array.isArray(stateResult.data) ? stateResult.data[0] : stateResult.data) || {};
      rows.push({
        ...request,
        token,
        has_signed_contract: Boolean(state.has_signed_contract),
        signed_contract_url: state.signed_contract_url || null
      });
    }
    own = rows;
  }

  function match(card, row) {
    const text = card.innerText || "";
    return text.includes(row.plate || "") &&
      text.includes(row.requester_name || "") &&
      text.includes(fmt(row.start_date));
  }

  function openContract(row, format, button) {
    if (!window.FleetContract) return notify("Motor do contrato nao carregado.", true);
    const old = button.textContent;
    button.disabled = true;
    button.textContent = format === "word" ? "Gerando Word..." : "Abrindo PDF...";
    try {
      if (format === "word") window.FleetContract.word(row);
      else window.FleetContract.pdf(row);
    } catch (error) {
      console.error(error);
      notify(error.message || "Nao foi possivel gerar o contrato.", true);
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  function pendingBox(row) {
    const box = document.createElement("div");
    box.className = "sp-contract-box";
    box.dataset.workflowToken = row.token;
    box.innerHTML = `
      <strong>Aguardando assinatura do contrato</strong>
      <small class="sp-contract-help">Baixe o contrato, assine, salve no SharePoint e cole o link abaixo.</small>
      <div class="sp-contract-actions">
        <button type="button" class="btn" data-word>Baixar Word</button>
        <button type="button" class="btn" data-pdf>Baixar PDF</button>
      </div>
      <input type="url" data-contract-link inputmode="url" autocomplete="off"
        placeholder="https://empresa.sharepoint.com/..." aria-label="Link do contrato assinado no SharePoint">
      <div class="sp-contract-validation">Informe um link HTTPS valido do SharePoint.</div>
      <div class="sp-contract-actions">
        <button type="button" class="btn primary" data-submit disabled>Concluir Solicitacao</button>
        <button type="button" class="btn danger" data-cancel>Cancelar reserva</button>
      </div>`;

    const input = box.querySelector("[data-contract-link]");
    const submit = box.querySelector("[data-submit]");
    const validation = box.querySelector(".sp-contract-validation");
    box.querySelector("[data-word]").onclick = event => openContract(row, "word", event.currentTarget);
    box.querySelector("[data-pdf]").onclick = event => openContract(row, "pdf", event.currentTarget);
    input.addEventListener("click", event => event.stopPropagation());
    input.addEventListener("pointerdown", event => event.stopPropagation());
    input.addEventListener("keydown", event => event.stopPropagation());
    input.addEventListener("input", () => {
      const ok = validSharePoint(input.value);
      submit.disabled = !ok;
      validation.textContent = ok ? "Link do SharePoint reconhecido." : "Informe um link HTTPS valido do SharePoint.";
      validation.className = `sp-contract-validation ${input.value.trim() ? (ok ? "valid" : "invalid") : ""}`;
    });
    submit.onclick = async () => {
      const url = input.value.trim();
      if (!validSharePoint(url)) return;
      submit.disabled = true;
      submit.textContent = "Concluindo...";
      const result = await db.rpc("submit_sharepoint_signed_contract", { p_token: row.token, p_contract_url: url });
      if (result.error || !result.data) {
        submit.disabled = false;
        submit.textContent = "Concluir Solicitacao";
        return notify(result.error?.message || "O banco nao confirmou o link.", true);
      }
      notify("Contrato registrado. Solicitacao enviada para aprovacao.");
      setTimeout(() => location.reload(), 700);
    };
    box.querySelector("[data-cancel]").onclick = event => cancel(row, event.currentTarget);
    return box;
  }

  function readyBox(row, approved) {
    const box = document.createElement("div");
    box.className = "sp-contract-box ready";
    box.dataset.workflowToken = row.token;
    box.innerHTML = `
      <strong>${approved ? "Reserva aprovada" : "Contrato enviado"}</strong>
      <small>${approved ? "A reserva esta confirmada." : "A solicitacao aguarda aprovacao administrativa."}</small>
      <div class="sp-contract-actions">
        <button type="button" class="btn" data-open>Abrir contrato assinado</button>
        <button type="button" class="btn danger" data-cancel>Cancelar reserva</button>
      </div>`;
    box.querySelector("[data-open]").onclick = () => window.open(row.signed_contract_url, "_blank", "noopener,noreferrer");
    box.querySelector("[data-cancel]").onclick = event => cancel(row, event.currentTarget);
    return box;
  }

  async function cancel(row, button) {
    if (!confirm("Cancelar esta solicitacao de reserva?")) return;
    button.disabled = true;
    const result = await db.rpc("cancel_own_fleet_reservation", { p_token: row.token });
    if (result.error) {
      button.disabled = false;
      return notify(result.error.message, true);
    }
    notify("Solicitacao cancelada.");
    setTimeout(() => location.reload(), 600);
  }

  function decoratePublic() {
    for (const card of document.querySelectorAll("#reservationGrid .reservation-card")) {
      const row = own.find(item => match(card, item));
      if (!row || !["pending", "approved"].includes(row.status)) continue;
      const existing = card.querySelector(".sp-contract-box");
      if (existing?.dataset.workflowToken === row.token) continue;
      card.querySelectorAll(".workflow-state,.signed-upload-final,.signed-contract-box,.native-pdf-upload,.sp-contract-box,.contract-format-actions,.contract-actions-final,.contract-download-button").forEach(el => el.remove());
      card.appendChild(row.has_signed_contract ? readyBox(row, row.status === "approved") : pendingBox(row));
    }
  }

  async function refreshPublic() {
    if (scanning || document.activeElement?.matches("[data-contract-link]")) return;
    scanning = true;
    try { await loadOwn(); decoratePublic(); }
    finally { scanning = false; }
  }

  function reservationId(row) {
    const el = row.querySelector("[data-decision],[data-delete]");
    return el?.dataset.decision || el?.dataset.delete || "";
  }

  async function decorateAdmin() {
    if (adminScanning) return;
    adminScanning = true;
    try {
      const result = await db.rpc("admin_list_sharepoint_contracts");
      if (result.error) throw result.error;
      const map = new Map((result.data || []).map(item => [item.reservation_id, item]));
      const header = document.querySelector("#requestsTab thead tr");
      if (header && !header.querySelector(".sp-contract-header")) {
        const th = document.createElement("th"); th.className = "sp-contract-header"; th.textContent = "Contrato Assinado";
        header.insertBefore(th, header.lastElementChild);
      }
      for (const row of document.querySelectorAll("#requestsBody tr")) {
        const id = reservationId(row); if (!id) continue;
        const item = map.get(id);
        const approve = row.querySelector('[data-decision][data-status="approved"]');
        if (approve) { approve.disabled = !item?.contract_url; approve.title = item?.contract_url ? "Aprovar solicitacao" : "Aguardando contrato assinado"; }
        let cell = row.querySelector(".sp-contract-cell");
        if (!cell) { cell = document.createElement("td"); cell.className = "sp-contract-cell"; row.insertBefore(cell, row.lastElementChild); }
        if (cell.dataset.contractUrl === (item?.contract_url || "")) continue;
        cell.dataset.contractUrl = item?.contract_url || "";
        cell.innerHTML = item?.contract_url ? '<button type="button" class="btn small">Abrir contrato</button>' : '<span class="muted">Aguardando link</span>';
        cell.querySelector("button")?.addEventListener("click", () => window.open(item.contract_url, "_blank", "noopener,noreferrer"));
      }
    } catch (error) { console.error("SharePoint admin:", error); }
    finally { adminScanning = false; }
  }

  function styles() {
    if ($("sharePointContractStylesV3")) return;
    const style = document.createElement("style"); style.id = "sharePointContractStylesV3";
    style.textContent = `.sp-contract-box{display:grid;gap:9px;margin-top:12px;padding:12px;border:1px solid var(--warning);border-radius:var(--radius-sm);background:var(--surface-raised)}.sp-contract-box.ready{border-color:var(--success)}.sp-contract-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.sp-contract-actions .btn{width:100%}.sp-contract-box input[type=url]{position:relative;z-index:2;width:100%;min-height:42px;pointer-events:auto;user-select:text}.sp-contract-validation{color:var(--muted);font-size:.76rem}.sp-contract-validation.valid{color:var(--success)}.sp-contract-validation.invalid{color:var(--danger)}@media(max-width:520px){.sp-contract-actions{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function init() {
    styles();
    if (isPublic) {
      const grid = $("reservationGrid");
      if (grid) new MutationObserver(() => { if (!document.activeElement?.matches("[data-contract-link]")) setTimeout(refreshPublic, 120); }).observe(grid, { childList: true });
      refreshPublic();
    }
    if (isAdmin) {
      const body = $("requestsBody");
      if (body) new MutationObserver(() => setTimeout(decorateAdmin, 120)).observe(body, { childList: true });
      setTimeout(decorateAdmin, 400);
    }
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
