"use strict";

/*
 * Fleet Management - correção do campo de link do SharePoint
 * Carregue DEPOIS de sharepoint-contract-workflow.js.
 *
 * Corrige a perda de foco causada pela reconstrução contínua do card.
 */
(() => {
  const fieldState = new Map();

  function cardKey(card) {
    return [
      card.querySelector("h3")?.textContent || "",
      card.textContent.match(/\d{2}\/\d{2}\/\d{4}\s+a\s+\d{2}\/\d{2}\/\d{4}/)?.[0] || "",
      card.textContent.match(/[A-Z]{3}\d[A-Z0-9]\d{2}/)?.[0] || ""
    ].join("|");
  }

  function installStyles() {
    if (document.getElementById("sharePointInputFixStyles")) return;
    const style = document.createElement("style");
    style.id = "sharePointInputFixStyles";
    style.textContent = `
      .sp-contract-box,
      .sp-contract-box input[type="url"] {
        pointer-events: auto !important;
      }

      .sp-contract-box input[type="url"] {
        position: relative !important;
        z-index: 30 !important;
        display: block !important;
        width: 100% !important;
        min-height: 42px !important;
        user-select: text !important;
        -webkit-user-select: text !important;
        cursor: text !important;
        touch-action: manipulation !important;
      }
    `;
    document.head.appendChild(style);
  }

  function protectBox(box) {
    if (box.dataset.inputProtected === "true") return;
    const input = box.querySelector('input[type="url"]');
    if (!input) return;

    box.dataset.inputProtected = "true";
    const card = box.closest(".reservation-card");
    const key = card ? cardKey(card) : String(Date.now());

    if (fieldState.has(key)) {
      input.value = fieldState.get(key);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    input.addEventListener("input", () => {
      fieldState.set(key, input.value);
    });

    input.addEventListener("focus", () => {
      box.dataset.editingLink = "true";
    });

    input.addEventListener("blur", () => {
      delete box.dataset.editingLink;
    });

    for (const eventName of [
      "click", "dblclick", "pointerdown", "mousedown",
      "mouseup", "touchstart", "touchend", "keydown", "keyup"
    ]) {
      input.addEventListener(eventName, event => {
        event.stopPropagation();
      }, true);
    }
  }

  function scan() {
    document.querySelectorAll(".sp-contract-box").forEach(protectBox);
  }

  function init() {
    installStyles();
    scan();

    const grid = document.getElementById("reservationGrid");
    if (!grid) return;

    new MutationObserver(mutations => {
      const active = document.activeElement;
      const activeIsLink = active?.matches?.(
        '.sp-contract-box input[type="url"]'
      );

      /* Enquanto o usuário digita, não reprotege nem força foco. */
      if (activeIsLink) return;

      const hasNewNodes = mutations.some(mutation =>
        [...mutation.addedNodes].some(node =>
          node.nodeType === 1 && (
            node.matches?.(".sp-contract-box") ||
            node.querySelector?.(".sp-contract-box")
          )
        )
      );

      if (hasNewNodes) window.setTimeout(scan, 30);
    }).observe(grid, { childList: true, subtree: true });
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init, { once: true })
    : init();
})();
