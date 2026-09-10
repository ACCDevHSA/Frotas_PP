"use strict";

/* Fleet Management - botoes Word e PDF no painel administrativo.
 * Substitui integralmente admin-contract-access.js.
 * Carregar depois de admin.js e contract-document-engine.js.
 */
(() => {
  if (!window.APP_CONFIG || !window.supabase) return;

  const db = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

  function notify(message) {
    const toast = document.getElementById("toast");
    if (!toast) return window.alert(message);
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3500);
  }

  function addStyles() {
    if (document.getElementById("adminContractButtonsStyles")) return;
    const style = document.createElement("style");
    style.id = "adminContractButtonsStyles";
    style.textContent = `
      .admin-contract-actions{display:inline-flex;gap:5px;margin-right:3px}
      .admin-contract-actions .word-btn{color:var(--blue);border-color:var(--blue)}
      .admin-contract-actions .pdf-btn{color:var(--danger);border-color:var(--danger)}
    `;
    document.head.appendChild(style);
  }

  function reservationId(actionCell) {
    const element = actionCell.querySelector(
      "[data-decision-id],[data-decision],[data-delete-id],[data-delete-reservation],[data-delete]"
    );
    return element?.dataset.decisionId || element?.dataset.decision ||
      element?.dataset.deleteId || element?.dataset.deleteReservation ||
      element?.dataset.delete || "";
  }

  function rowStatus(row) {
    return (row.querySelector(".badge")?.textContent || row.cells[3]?.textContent || "")
      .trim().toLowerCase();
  }

  async function getContract(id) {
    const { data, error } = await db.rpc("admin_get_fleet_contract", {
      p_reservation_id: id
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Contrato não encontrado ou solicitação ainda não aprovada.");
    return row;
  }

  async function execute(format, id, button) {
    if (!window.FleetContract) return notify("Motor do contrato não carregado.");
    const old = button.textContent;
    button.disabled = true;
    button.textContent = format === "word" ? "Word..." : "PDF...";
    try {
      const contract = await getContract(id);
      if (format === "word") window.FleetContract.word(contract);
      else window.FleetContract.pdf(contract);
    } catch (error) {
      console.error(error);
      notify(error.message || "Não foi possível abrir o contrato.");
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }

  function decorateRows() {
    document.querySelectorAll("#requestsBody tr").forEach((row) => {
      const status = rowStatus(row);
      const allowed = ["approved", "aprovada", "completed", "concluída", "concluida"].includes(status);
      const actionCell = row.querySelector("td.actions") || row.lastElementChild;
      if (!allowed || !actionCell || actionCell.querySelector(".admin-contract-actions")) return;
      const id = reservationId(actionCell);
      if (!id) return;

      const actions = document.createElement("span");
      actions.className = "admin-contract-actions";
      actions.innerHTML = `
        <button type="button" class="btn small word-btn">Word</button>
        <button type="button" class="btn small pdf-btn">PDF</button>`;
      actions.querySelector(".word-btn").addEventListener("click", () => execute("word", id, actions.querySelector(".word-btn")));
      actions.querySelector(".pdf-btn").addEventListener("click", () => execute("pdf", id, actions.querySelector(".pdf-btn")));
      actionCell.prepend(actions);
    });
  }

  function init() {
    addStyles();
    const body = document.getElementById("requestsBody");
    if (body) new MutationObserver(decorateRows).observe(body, { childList:true, subtree:true });
    decorateRows();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();
