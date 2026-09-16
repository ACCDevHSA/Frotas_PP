"use strict";

/*
 * Fleet Management - data automatica no contrato
 * Carregar DEPOIS de contract-legal-upgrade.js e
 * contract-signature-layout-fix.js.
 *
 * Substitui:
 * Sumare, ______ de ____________________ de ______.
 *
 * Por exemplo:
 * Sumare, 9 de setembro de 2026.
 */
(() => {
  if (window.__fleetContractCurrentDateInstalled) return;
  window.__fleetContractCurrentDateInstalled = true;

  const PreviousBlob = window.Blob;

  function currentDateText() {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).formatToParts(new Date());

    const day = parts.find((part) => part.type === "day")?.value || "";
    const month = parts.find((part) => part.type === "month")?.value || "";
    const year = parts.find((part) => part.type === "year")?.value || "";

    return `Sumaré, ${day} de ${month} de ${year}.`;
  }

  function isContract(parts, options) {
    const type = String(options?.type || "").toLowerCase();
    const supportedType =
      type.includes("application/msword") ||
      type.includes("text/html");

    return supportedType && parts.some((part) =>
      typeof part === "string" &&
      part.includes("CONTRATO DE COMODATO")
    );
  }

  function applyCurrentDate(html) {
    const date = currentDateText();

    let result = html.replace(
      /Sumar[eé],\s*_+\s+de\s+_+\s+de\s+_+\.?/gi,
      date
    );

    result = result.replace(
      /Sumar[eé],\s*______\s+de\s+____________________\s+de\s+______\.?/gi,
      date
    );

    return result;
  }

  window.Blob = function FleetContractDateBlob(parts = [], options = {}) {
    const updatedParts = isContract(parts, options)
      ? parts.map((part) =>
          typeof part === "string" ? applyCurrentDate(part) : part
        )
      : parts;

    return new PreviousBlob(updatedParts, options);
  };

  window.Blob.prototype = PreviousBlob.prototype;
  Object.setPrototypeOf(window.Blob, PreviousBlob);
})();
