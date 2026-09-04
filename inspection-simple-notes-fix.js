"use strict";

/* Fleet Management - fluxo simples de avarias
 * Carregar DEPOIS de inspection-2d-upgrade.js.
 * O clique na bolinha marca o ponto e direciona para Observacoes do veiculo.
 */
(() => {
  let nextNumber = 1;
  let blockNextClick = false;

  const $ = (id) => document.getElementById(id);

  function notify(message) {
    const toast = $("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function installStyles() {
    if ($("simpleDamageNotesStyles")) return;
    const style = document.createElement("style");
    style.id = "simpleDamageNotesStyles";
    style.textContent = `
      /* Remove qualquer zoom da vista ou da imagem. */
      .vehicle-view,
      .vehicle-view:hover,
      .vehicle-view-image,
      .vehicle-view:hover .vehicle-view-image {
        transform: none !important;
        scale: 1 !important;
        transition: none !important;
      }

      /* Apenas a bolinha salta levemente. */
      button.damage-dot {
        transition: transform .14s ease, background-color .14s ease,
          box-shadow .14s ease !important;
      }

      button.damage-dot:hover,
      button.damage-dot:focus-visible {
        transform: translate(-50%, calc(-50% - 4px)) !important;
        scale: 1 !important;
        outline: none !important;
        box-shadow: 0 0 0 5px rgb(232 61 85 / 22%),
          0 8px 14px rgb(0 0 0 / 28%) !important;
      }

      button.damage-dot.simple-marked,
      button.damage-dot.simple-marked:hover,
      button.damage-dot.simple-marked:focus-visible {
        background: #45c78f !important;
        color: #08151f !important;
        box-shadow: 0 0 0 5px rgb(69 199 143 / 22%),
          0 7px 13px rgb(0 0 0 / 24%) !important;
      }

      /* O popup antigo deixa de ser usado. */
      #damage2dPopover,
      .damage2d-popover {
        display: none !important;
      }

      #vehicleNotes.damage-notes-focus,
      #inspectionForm [name="vehicle_notes"].damage-notes-focus {
        border-color: var(--success, #43ce98) !important;
        box-shadow: 0 0 0 3px rgb(67 206 152 / 16%) !important;
      }

      .simple-damage-summary {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-top: 8px;
        color: var(--muted);
        font-size: .74rem;
      }
    `;
    document.head.appendChild(style);
  }

  function notesField() {
    return document.querySelector('#inspectionForm [name="vehicle_notes"]');
  }

  function calculateNextNumber() {
    const notes = notesField()?.value || "";
    const numbers = [...notes.matchAll(/(?:^|\n)\s*(\d+)\.\s*Avaria\s*:/gi)]
      .map((match) => Number(match[1]))
      .filter(Number.isFinite);
    nextNumber = numbers.length ? Math.max(...numbers) + 1 : 1;
  }

  function updateSummary() {
    const container = document.querySelector(".damage-area");
    if (!container) return;
    let summary = $("simpleDamageSummary");
    if (!summary) {
      summary = document.createElement("div");
      summary.id = "simpleDamageSummary";
      summary.className = "simple-damage-summary";
      container.appendChild(summary);
    }
    const marked = document.querySelectorAll(".damage-dot.simple-marked").length;
    summary.innerHTML = `<span>Pontos marcados: <b>${marked}</b></span><span>Próxima anotação: <b>${nextNumber}. Avaria:</b></span>`;
  }

  function appendDamageLine(dot) {
    const notes = notesField();
    if (!notes) {
      notify("Campo Observações do veículo não encontrado.");
      return;
    }

    calculateNextNumber();
    const prefix = `${nextNumber}. Avaria: `;
    const current = notes.value.replace(/\s+$/, "");
    notes.value = current ? `${current}\n${prefix}` : prefix;

    dot.classList.add("simple-marked");
    const clicks = Number(dot.dataset.damageClicks || 0) + 1;
    dot.dataset.damageClicks = String(clicks);
    dot.textContent = clicks > 1 ? String(clicks) : "✓";
    dot.dataset.tip = `${dot.dataset.label || "Ponto do veículo"}: ${clicks} anotação(ões)`;

    nextNumber += 1;
    updateSummary();

    notes.classList.add("damage-notes-focus");
    notes.focus({ preventScroll: true });
    notes.setSelectionRange(notes.value.length, notes.value.length);
    notes.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => notes.classList.remove("damage-notes-focus"), 1400);

    notes.dispatchEvent(new Event("input", { bubbles: true }));
    notes.dispatchEvent(new Event("change", { bubbles: true }));
    notify(`${dot.dataset.label || "Ponto"} marcado. Descreva a avaria no campo de observações.`);
  }

  /*
   * pointerdown ocorre antes do click capturado pelo módulo antigo.
   * Depois, um bloqueio no window impede que o popup antigo seja aberto.
   */
  window.addEventListener("pointerdown", (event) => {
    const dot = event.target.closest?.(".damage-dot");
    if (!dot) return;

    event.preventDefault();
    event.stopPropagation();
    blockNextClick = true;
    appendDamageLine(dot);
  }, true);

  window.addEventListener("click", (event) => {
    if (!blockNextClick) return;
    const dot = event.target.closest?.(".damage-dot");
    if (!dot) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    blockNextClick = false;
  }, true);

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function wrap(ctx, text, x, y, maxWidth, lineHeight) {
    const paragraphs = String(text || "Nenhuma observação.").split("\n");
    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/);
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, x, y);
          line = word;
          y += lineHeight;
        } else {
          line = test;
        }
      }
      ctx.fillText(line || " ", x, y);
      y += lineHeight;
    }
    return y;
  }

  async function generateSimplePng(button) {
    const views = [...document.querySelectorAll(".vehicle-view")];
    if (views.length !== 4) return notify("As quatro vistas do veículo não foram encontradas.");

    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Gerando PNG...";

    try {
      const images = await Promise.all(views.map((view) => loadImage(view.querySelector("img").src)));
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 2050;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#147da3";
      ctx.fillRect(0, 0, canvas.width, 16);

      ctx.fillStyle = "#172433";
      ctx.font = "bold 38px Arial";
      ctx.fillText($("inspectionTitle")?.textContent || "Checklist de Vistoria", 70, 76);
      ctx.font = "22px Arial";
      ctx.fillStyle = "#5b6d7e";
      ctx.fillText($("inspectionVehicle")?.textContent || "-", 70, 114);

      const form = $("inspectionForm").elements;
      const fields = [
        ["KM atual", form.odometer_km.value],
        ["Data", form.inspection_date.value],
        ["Hora", form.inspection_time.value],
        ["Quem realizou a vistoria", form.inspector_name.value],
        ["Quem utilizará/utilizou o veículo", form.driver_name.value]
      ];
      fields.forEach(([label, value], index) => {
        const x = 70 + (index % 2) * 750;
        const y = 160 + Math.floor(index / 2) * 72;
        ctx.fillStyle = "#eef3f7";
        ctx.fillRect(x, y, 700, 55);
        ctx.fillStyle = "#667789";
        ctx.font = "bold 13px Arial";
        ctx.fillText(label.toUpperCase(), x + 12, y + 19);
        ctx.fillStyle = "#172433";
        ctx.font = "18px Arial";
        ctx.fillText(value || "-", x + 12, y + 43);
      });

      const imageTop = 400;
      const width = 700;
      const height = 420;
      views.forEach((view, index) => {
        const x = 70 + (index % 2) * 750;
        const y = imageTop + Math.floor(index / 2) * 480;
        const label = view.querySelector("h4")?.textContent || `Vista ${index + 1}`;
        ctx.fillStyle = "#172433";
        ctx.font = "bold 22px Arial";
        ctx.fillText(label, x, y);
        ctx.drawImage(images[index], x, y + 18, width, height);

        view.querySelectorAll(".damage-dot").forEach((dot) => {
          const left = parseFloat(dot.style.left) / 100;
          const top = parseFloat(dot.style.top) / 100;
          const marked = dot.classList.contains("simple-marked");
          const cx = x + left * width;
          const cy = y + 18 + top * height;
          ctx.beginPath();
          ctx.fillStyle = marked ? "#45c78f" : "#e83d55";
          ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = marked ? "#142433" : "#fff";
          ctx.font = "bold 14px Arial";
          ctx.textAlign = "center";
          ctx.fillText(marked ? (dot.dataset.damageClicks || "✓") : "+", cx, cy + 5);
          ctx.textAlign = "left";
        });
      });

      let y = 1395;
      ctx.fillStyle = "#172433";
      ctx.font = "bold 25px Arial";
      ctx.fillText("ANOTAÇÕES DE AVARIAS E OBSERVAÇÕES", 70, y);
      y += 42;
      ctx.font = "18px Arial";
      y = wrap(ctx, notesField()?.value || "Nenhuma avaria registrada.", 70, y, 1440, 29);

      y = Math.max(y + 80, 1810);
      ctx.strokeStyle = "#172433";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(730, y);
      ctx.moveTo(870, y);
      ctx.lineTo(1520, y);
      ctx.stroke();
      ctx.font = "17px Arial";
      ctx.fillText("Assinatura de quem utilizará/utilizou o veículo", 80, y + 27);
      ctx.fillText("Assinatura de quem realizou a vistoria", 870, y + 27);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `Checklist_${($("inspectionVehicle")?.textContent || "veiculo").replace(/[^a-z0-9_-]/gi, "_")}_${form.inspection_date.value || "data"}.png`;
      link.click();
    } catch (error) {
      console.error(error);
      notify("Não foi possível gerar o PNG. Verifique as quatro imagens.");
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  /* Substitui o click do botão PNG anterior sem alterar o HTML. */
  window.addEventListener("pointerdown", (event) => {
    const button = event.target.closest?.("#generateChecklistPng");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    blockNextClick = true;
    generateSimplePng(button);
  }, true);

  function init() {
    installStyles();
    calculateNextNumber();
    updateSummary();
    notesField()?.addEventListener("input", () => {
      calculateNextNumber();
      updateSummary();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
