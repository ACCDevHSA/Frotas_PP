"use strict";

/* Fluxo publico: reserva aprovada automaticamente + contrato assinado. */
(() => {
  if (!window.APP_CONFIG || !window.supabase) return;
  const db = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
  let approved = [];
  const MAX_BYTES = 5 * 1024 * 1024;

  const tokens = () => {
    try { return [...new Set(JSON.parse(localStorage.getItem("fleetRequestTokens") || "[]"))]; }
    catch { return []; }
  };
  const fmt = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "-";
  const toast = message => {
    const el = document.getElementById("toast");
    if (!el) return alert(message);
    el.textContent = message; el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3500);
  };
  const readBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  async function load() {
    approved = [];
    for (const token of tokens()) {
      const { data, error } = await db.rpc("track_fleet_request", { p_token: token });
      if (error) continue;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.status === "approved") {
        const status = await db.rpc("get_signed_contract_status", { p_token: token });
        approved.push({ ...row, token, signed: Boolean(status.data) });
      }
    }
    return approved;
  }

  function matches(card, request) {
    const text = card.innerText || "";
    return text.includes(request.plate || "") &&
      text.includes(request.requester_name || "") &&
      text.includes(fmt(request.start_date));
  }

  function styles() {
    if (document.getElementById("signedContractFlowStyles")) return;
    const style = document.createElement("style");
    style.id = "signedContractFlowStyles";
    style.textContent = `
      .signed-contract-box{display:grid;gap:9px;margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface-raised,var(--surface2))}
      .signed-contract-box strong{color:var(--warning,var(--amber))}.signed-contract-box small{color:var(--muted)}
      .signed-contract-box input[type=file]{padding:8px;background:var(--surface)}
      .signed-contract-box.done{border-color:var(--success,var(--green))}.signed-contract-box.done strong{color:var(--success,var(--green))}
    `;
    document.head.appendChild(style);
  }

  async function submitSigned(request, box) {
    const file = box.querySelector('input[type="file"]').files[0];
    const button = box.querySelector("button");
    if (!file) return toast("Selecione o PDF assinado.");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast("Envie somente um arquivo PDF.");
    if (file.size > MAX_BYTES) return toast("O PDF deve ter no máximo 5 MB.");
    const old = button.textContent; button.disabled = true; button.textContent = "Enviando...";
    try {
      const base64 = await readBase64(file);
      const { error } = await db.rpc("submit_signed_fleet_contract", {
        p_token: request.token,
        p_file_name: file.name,
        p_pdf_base64: base64
      });
      if (error) throw error;
      box.classList.add("done");
      box.innerHTML = "<strong>Solicitação concluída</strong><small>Contrato assinado recebido e disponível para a Administração.</small>";
      toast("Contrato assinado enviado. Solicitação concluída.");
    } catch (error) { console.error(error); toast(error.message || "Falha ao enviar contrato assinado."); }
    finally { if (button.isConnected) { button.disabled = false; button.textContent = old; } }
  }

  async function decorate() {
    await load();
    document.querySelectorAll("#reservationGrid .reservation-card").forEach(card => {
      const request = approved.find(item => matches(card, item));
      if (!request) return;
      const statusLine = card.querySelector(".contract-status-line strong");
      if (statusLine) statusLine.textContent = request.signed ? "Solicitação concluída" : "Aguardando assinatura do contrato";
      let box = card.querySelector(".signed-contract-box");
      if (box) return;
      box = document.createElement("div");
      box.className = `signed-contract-box${request.signed ? " done" : ""}`;
      box.innerHTML = request.signed
        ? "<strong>Solicitação concluída</strong><small>Contrato assinado recebido.</small>"
        : `<strong>Aguardando assinatura do contrato</strong>
           <small>Baixe o contrato, assine, selecione o PDF e conclua a solicitação.</small>
           <input type="file" accept="application/pdf,.pdf" aria-label="Selecionar contrato assinado">
           <button type="button" class="btn primary">Concluir Solicitação</button>`;
      if (!request.signed) box.querySelector("button").addEventListener("click", () => submitSigned(request, box));
      card.appendChild(box);
    });
  }

  function init() {
    styles();
    const grid = document.getElementById("reservationGrid");
    if (grid) new MutationObserver(() => setTimeout(decorate, 80)).observe(grid, { childList: true, subtree: true });
    setTimeout(decorate, 150);
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
