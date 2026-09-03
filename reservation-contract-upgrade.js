"use strict";

/* Fleet Management
 * Melhoria da fila de reservas:
 * - Reserva aprovada: "Aprovada - pendente de assinatura do contrato"
 * - Botao "Baixar Contrato" no proprio card
 *
 * Este complemento deve ser carregado depois de app.js.
 */
(() => {
  const TODAY = () => {
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  };

  function injectStyles() {
    if (document.getElementById("reservationContractUpgradeStyles")) return;

    const style = document.createElement("style");
    style.id = "reservationContractUpgradeStyles";
    style.textContent = `
      .reservation-card.contract-pending {
        position: relative;
        border-color: color-mix(in srgb, var(--green) 48%, var(--line));
        background:
          linear-gradient(150deg, color-mix(in srgb, var(--green) 7%, var(--surface)), var(--surface));
      }

      .reservation-card .contract-status-line {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        margin: 13px 0;
        padding: 10px 11px;
        border: 1px solid color-mix(in srgb, var(--amber) 45%, var(--line));
        border-radius: 10px;
        background: color-mix(in srgb, var(--amber) 9%, var(--surface2));
        color: var(--text);
        font-size: .78rem;
        line-height: 1.35;
      }

      .reservation-card .contract-status-icon {
        flex: 0 0 auto;
        width: 22px;
        height: 22px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--amber);
        color: #14202c;
        font-size: .72rem;
        font-weight: 900;
      }

      .reservation-card .contract-status-line strong,
      .reservation-card .contract-status-line small {
        display: block;
      }

      .reservation-card .contract-status-line small {
        margin-top: 2px;
        color: var(--muted);
      }

      .reservation-card .contract-download-button {
        width: 100%;
        margin-top: 3px;
      }

      .reservation-card .contract-download-button span {
        margin-right: 6px;
      }
    `;
    document.head.appendChild(style);
  }

  function futureReservations() {
    if (typeof reservations === "undefined" || !Array.isArray(reservations)) return [];

    return reservations
      .filter((reservation) =>
        reservation.status === "pending" ||
        (reservation.status === "approved" && reservation.start_date > TODAY())
      )
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }

  function contractFileName(reservation) {
    const plate = String(reservation.plate || "VEICULO").replace(/[^a-z0-9_-]/gi, "_");
    return `Contrato_${plate}_${reservation.start_date || "reserva"}.doc`;
  }

  function safe(value) {
    return String(value ?? "-").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
  }

  function generateContract(reservation) {
    /* Se app.js possuir a funcao oficial, utiliza a mesma rotina. */
    if (typeof downloadContract === "function") {
      downloadContract(reservation);
      return;
    }

    const documentHtml = `<!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Contrato de Comodato de Veiculo</title>
        <style>
          body{font:16px Arial,sans-serif;max-width:800px;margin:42px auto;line-height:1.55;color:#172433}
          h1{text-align:center;font-size:24px;margin-bottom:32px}
          .data{padding:12px 14px;border:1px solid #cad5df;border-radius:7px;margin:9px 0}
          .signatures{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:80px}
          .signature{padding-top:8px;border-top:1px solid #1c2834;text-align:center}
        </style>
      </head>
      <body>
        <h1>Contrato de Comodato de Veiculo</h1>
        <div class="data"><b>Usuario:</b> ${safe(reservation.requester_name)}</div>
        <div class="data"><b>Veiculo:</b> ${safe(reservation.model)} ${safe(reservation.version || "")} - Placa ${safe(reservation.plate)}</div>
        <div class="data"><b>Periodo:</b> ${formatDate(reservation.start_date)} a ${formatDate(reservation.end_date)}</div>
        <div class="data"><b>Finalidade:</b> ${safe(reservation.purpose)}</div>
        <p>O usuario declara receber o veiculo para a finalidade indicada e se compromete a devolve-lo nas condicoes registradas no checklist de vistoria.</p>
        <div class="signatures">
          <div class="signature">Assinatura do usuario</div>
          <div class="signature">Assinatura da gestao da frota</div>
        </div>
      </body>
      </html>`;

    const blob = new Blob([documentHtml], { type: "application/msword;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = contractFileName(reservation);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  function decorateCards() {
    const grid = document.getElementById("reservationGrid");
    if (!grid) return;

    const data = futureReservations();
    const cards = [...grid.querySelectorAll(".reservation-card")];

    cards.forEach((card, index) => {
      const reservation = data[index];
      if (!reservation || reservation.status !== "approved") return;
      if (card.dataset.contractUpgraded === "true") return;

      card.dataset.contractUpgraded = "true";
      card.classList.add("contract-pending");

      const badge = card.querySelector(".badge");
      if (badge) {
        badge.textContent = "APROVADA";
        badge.title = "Solicitacao aprovada";
      }

      const status = document.createElement("div");
      status.className = "contract-status-line";
      status.innerHTML = `
        <span class="contract-status-icon" aria-hidden="true">!</span>
        <span>
          <strong>Aprovada, pendente de assinatura do contrato</strong>
          <small>Baixe o documento, colete a assinatura e mantenha junto ao registro do emprestimo.</small>
        </span>`;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn primary contract-download-button";
      button.innerHTML = "<span aria-hidden=\"true\">↓</span> Baixar Contrato";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        generateContract(reservation);
      });

      card.appendChild(status);
      card.appendChild(button);
    });
  }

  function init() {
    injectStyles();

    const grid = document.getElementById("reservationGrid");
    if (!grid) return;

    const observer = new MutationObserver(() => decorateCards());
    observer.observe(grid, { childList: true, subtree: true });
    decorateCards();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
