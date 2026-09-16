"use strict";

/* Fleet Management - botoes Word e PDF para o solicitante.
 * Substitui integralmente contract-format-selector.js.
 * Carregar depois de reservation-contract-upgrade.js e contract-document-engine.js.
 */
(() => {
  if (!window.APP_CONFIG || !window.supabase) return;

  const db = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );
  let approvedCache = [];
  let refreshing = false;

  function tokens() {
    try {
      const values = JSON.parse(localStorage.getItem("fleetRequestTokens") || "[]");
      return Array.isArray(values) ? [...new Set(values)] : [];
    } catch {
      return [];
    }
  }

  function formatDate(value) {
    return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "-";
  }

  function notify(message) {
    const toast = document.getElementById("toast");
    if (!toast) return window.alert(message);
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3500);
  }

  async function loadApproved() {
    if (refreshing) return approvedCache;
    refreshing = true;
    const rows = [];
    try {
      for (const token of tokens()) {
        const { data, error } = await db.rpc("track_fleet_request", { p_token: token });
        if (error) continue;
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.status === "approved") rows.push({ ...row, tracking_token: token });
      }
      approvedCache = rows;
      return rows;
    } finally {
      refreshing = false;
    }
  }

  function matches(card, request) {
    const text = card?.innerText || "";
    return text.includes(request.plate || "") &&
      text.includes(request.requester_name || "") &&
      text.includes(formatDate(request.start_date));
  }

  function addStyles() {
    if (document.getElementById("contractFormatButtonsStyles")) return;
    const style = document.createElement("style");
    style.id = "contractFormatButtonsStyles";
    style.textContent = `
      .contract-format-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
      .contract-format-actions .btn{width:100%}
      .contract-format-actions .pdf-btn{border-color:var(--danger);color:var(--danger)}
      .contract-format-actions .word-btn{border-color:var(--blue);color:var(--blue)}
      @media(max-width:480px){.contract-format-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function execute(format, request, button) {
    if (!window.FleetContract) return notify("Motor do contrato não carregado.");
    const old = button.textContent;
    button.disabled = true;
    button.textContent = format === "word" ? "Gerando Word..." : "Abrindo PDF...";
    try {
      if (format === "word") window.FleetContract.word(request);
      else window.FleetContract.pdf(request);
    } catch (error) {
      console.error(error);
      notify(error.message || "Não foi possível gerar o contrato.");
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  async function decorateCards() {
    const requests = await loadApproved();
    document.querySelectorAll("#reservationGrid .reservation-card").forEach((card) => {
      const request = requests.find((item) => matches(card, item));
      const oldButton = card.querySelector(".contract-download-button");
      let actions = card.querySelector(".contract-format-actions");

      if (!request) {
        if (oldButton) {
          oldButton.disabled = true;
          oldButton.textContent = "Contrato disponível ao solicitante";
        }
        actions?.remove();
        return;
      }

      if (oldButton) oldButton.remove();
      if (actions) return;

      actions = document.createElement("div");
      actions.className = "contract-format-actions";
      actions.innerHTML = `
        <button type="button" class="btn word-btn" data-contract-format="word">Baixar Word</button>
        <button type="button" class="btn pdf-btn" data-contract-format="pdf">Baixar PDF</button>`;
      actions.querySelector('[data-contract-format="word"]').addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation(); execute("word", request, event.currentTarget);
      });
      actions.querySelector('[data-contract-format="pdf"]').addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation(); execute("pdf", request, event.currentTarget);
      });
      card.appendChild(actions);
    });
  }

  function init() {
    addStyles();
    const grid = document.getElementById("reservationGrid");
    if (grid) new MutationObserver(() => setTimeout(decorateCards, 60)).observe(grid, { childList:true, subtree:true });
    setTimeout(decorateCards, 100);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();
