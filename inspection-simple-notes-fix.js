"use strict";

/*
 * Fleet Management - avarias por clique simples (v2)
 *
 * 1o clique na bolinha:
 *   - marca em verde
 *   - cria "N. Avaria: " em Observacoes do veiculo
 *   - direciona o cursor para a nova anotacao
 *
 * 2o clique na mesma bolinha:
 *   - desmarca
 *   - remove a anotacao vinculada
 *   - renumera as demais anotacoes
 *
 * Carregar DEPOIS de inspection-2d-upgrade.js.
 */
(() => {
  const POINT_PREFIX = "fleet-damage-point-";
  let clickLock = false;

  const $ = (id) => document.getElementById(id);

  function notify(message) {
    const toast = $("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function notesField() {
    return document.querySelector('#inspectionForm [name="vehicle_notes"]');
  }

  function installStyles() {
    if ($("simpleDamageToggleStyles")) return;

    const style = document.createElement("style");
    style.id = "simpleDamageToggleStyles";
    style.textContent = `
      /* As imagens e os cards nunca aumentam. */
      .vehicle-view,
      .vehicle-view:hover,
      .vehicle-view:focus-within,
      .vehicle-view-image,
      .vehicle-view:hover .vehicle-view-image,
      .vehicle-view:focus-within .vehicle-view-image {
        transform: none !important;
        scale: 1 !important;
        transition: none !important;
      }

      /* Somente a bolinha sobe levemente. */
      button.damage-dot {
        transition: transform .14s ease,
          background-color .14s ease,
          box-shadow .14s ease !important;
      }

      button.damage-dot:hover,
      button.damage-dot:focus-visible {
        transform: translate(-50%, calc(-50% - 4px)) !important;
        scale: 1 !important;
        outline: none !important;
        box-shadow: 0 0 0 5px rgb(232 61 85 / 20%),
          0 8px 14px rgb(0 0 0 / 26%) !important;
      }

      button.damage-dot.simple-marked,
      button.damage-dot.simple-marked:hover,
      button.damage-dot.simple-marked:focus-visible {
        background: #45c78f !important;
        color: #08151f !important;
        box-shadow: 0 0 0 5px rgb(69 199 143 / 22%),
          0 8px 14px rgb(0 0 0 / 24%) !important;
      }

      /* O editor antigo nao e utilizado neste fluxo. */
      #damage2dPopover,
      .damage2d-popover {
        display: none !important;
      }

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

  function readLines() {
    return (notesField()?.value || "").split("\n");
  }

  function isDamageLine(line) {
    return /^\s*\d+\.\s*Avaria\s*:/i.test(line);
  }

  function damageLines() {
    return readLines().filter(isDamageLine);
  }

  function manualLines() {
    return readLines().filter((line) => !isDamageLine(line));
  }

  function renumberDamageLines(lines) {
    return lines.map((line, index) => {
      const content = line.replace(/^\s*\d+\.\s*Avaria\s*:\s*/i, "");
      return `${index + 1}. Avaria: ${content}`;
    });
  }

  function writeNotes(manual, damages) {
    const notes = notesField();
    if (!notes) return;

    const cleanManual = manual.filter((line, index, all) => {
      if (line.trim()) return true;
      return index > 0 && index < all.length - 1;
    });

    notes.value = [...cleanManual, ...renumberDamageLines(damages)]
      .join("\n")
      .replace(/^\n+|\n+$/g, "");

    notes.dispatchEvent(new Event("input", { bubbles: true }));
    notes.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function markedDotsInOrder() {
    return [...document.querySelectorAll(".damage-dot.simple-marked")]
      .sort((a, b) => Number(a.dataset.damageOrder) - Number(b.dataset.damageOrder));
  }

  function synchronizeDotNumbers() {
    markedDotsInOrder().forEach((dot, index) => {
      dot.dataset.damageOrder = String(index + 1);
      dot.textContent = String(index + 1);
      dot.dataset.tip = `${dot.dataset.label || "Ponto do veiculo"}: Avaria ${index + 1}`;
    });
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

    const total = document.querySelectorAll(".damage-dot.simple-marked").length;
    summary.innerHTML = `<span>Pontos marcados: <b>${total}</b></span><span>Proximo clique: <b>${total + 1}. Avaria:</b></span>`;
  }

  function focusNewLine() {
    const notes = notesField();
    if (!notes) return;

    notes.classList.add("damage-notes-focus");
    notes.focus({ preventScroll: true });
    notes.setSelectionRange(notes.value.length, notes.value.length);
    notes.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => notes.classList.remove("damage-notes-focus"), 1200);
  }

  function mark(dot) {
    const existingDamages = damageLines();
    const nextNumber = existingDamages.length + 1;

    dot.classList.add("simple-marked");
    dot.dataset.damageOrder = String(nextNumber);
    dot.dataset.damagePointKey = `${POINT_PREFIX}${dot.dataset.pointId || nextNumber}`;

    existingDamages.push(`${nextNumber}. Avaria: `);
    writeNotes(manualLines(), existingDamages);
    synchronizeDotNumbers();
    updateSummary();
    focusNewLine();

    notify(`${dot.dataset.label || "Ponto"} marcado. Digite a avaria nas observacoes.`);
  }

  function unmark(dot) {
    const order = Number(dot.dataset.damageOrder);
    const existingDamages = damageLines();

    if (Number.isInteger(order) && order > 0 && order <= existingDamages.length) {
      existingDamages.splice(order - 1, 1);
    }

    dot.classList.remove("simple-marked");
    delete dot.dataset.damageOrder;
    delete dot.dataset.damagePointKey;
    dot.textContent = "+";
    dot.dataset.tip = `${dot.dataset.label || "Ponto do veiculo"}: adicionar avaria`;

    writeNotes(manualLines(), existingDamages);
    synchronizeDotNumbers();
    updateSummary();

    notify(`${dot.dataset.label || "Ponto"} desmarcado e anotacao removida.`);
  }

  function toggle(dot) {
    if (dot.classList.contains("simple-marked")) unmark(dot);
    else mark(dot);
  }

  /*
   * pointerdown executa antes do click do inspection-2d-upgrade.js.
   * O click seguinte e bloqueado para que o popup antigo nao abra.
   */
  window.addEventListener("pointerdown", (event) => {
    const dot = event.target.closest?.(".damage-dot");
    if (!dot) return;

    event.preventDefault();
    event.stopPropagation();
    clickLock = true;
    toggle(dot);
  }, true);

  window.addEventListener("click", (event) => {
    const dot = event.target.closest?.(".damage-dot");
    if (!dot || !clickLock) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    clickLock = false;
  }, true);



  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Imagem nao encontrada: ${src}`));
      image.src = src;
    });
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const paragraphs = String(text || "Nenhuma observacao.").split("\n");
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

  function drawMarker(ctx, x, y, dot) {
    const marked = dot.classList.contains("simple-marked");
    const number = dot.dataset.damageOrder || "+";

    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = marked ? "#45c78f" : "#e83d55";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = marked ? "#102333" : "#ffffff";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(marked ? number : "+", x, y + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  async function generateUpdatedPng(button) {
    const views = [...document.querySelectorAll(".vehicle-view")];
    if (views.length !== 4) {
      notify("As quatro vistas do veiculo nao foram encontradas.");
      return;
    }

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Gerando PNG...";

    try {
      const images = await Promise.all(
        views.map((view) => loadImage(view.querySelector("img")?.src))
      );

      const notes = notesField()?.value || "Nenhuma avaria registrada.";
      const lineCount = Math.max(1, notes.split("\n").length);
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = Math.max(2050, 1890 + lineCount * 30);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#147da3";
      ctx.fillRect(0, 0, canvas.width, 16);

      ctx.fillStyle = "#172433";
      ctx.font = "bold 38px Arial";
      ctx.fillText($("inspectionTitle")?.textContent || "Checklist de Vistoria", 70, 76);
      ctx.font = "22px Arial";
      ctx.fillStyle = "#5b6d7e";
      ctx.fillText($("inspectionVehicle")?.textContent || "-", 70, 114);

      const form = $("inspectionForm")?.elements;
      if (!form) throw new Error("Formulario do checklist nao encontrado.");

      const dateValue = form.inspection_date.value
        ? new Date(`${form.inspection_date.value}T12:00:00`).toLocaleDateString("pt-BR")
        : "-";

      const fields = [
        ["KM atual", form.odometer_km.value || "-"],
        ["Data da vistoria", dateValue],
        ["Hora", form.inspection_time.value || "-"],
        ["Quem realizou a vistoria", form.inspector_name.value || "-"],
        ["Quem utilizara/utilizou o veiculo", form.driver_name.value || "-"]
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
        ctx.fillText(String(value), x + 12, y + 43);
      });

      const imageTop = 400;
      const imageWidth = 700;
      const imageHeight = 420;

      views.forEach((view, index) => {
        const x = 70 + (index % 2) * 750;
        const y = imageTop + Math.floor(index / 2) * 480;
        const label = view.querySelector("h4")?.textContent || `Vista ${index + 1}`;

        ctx.fillStyle = "#172433";
        ctx.font = "bold 22px Arial";
        ctx.fillText(label, x, y);
        ctx.drawImage(images[index], x, y + 18, imageWidth, imageHeight);
        ctx.strokeStyle = "#d7e0e8";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y + 18, imageWidth, imageHeight);

        view.querySelectorAll(".damage-dot").forEach((dot) => {
          const left = Number.parseFloat(dot.style.left) / 100;
          const top = Number.parseFloat(dot.style.top) / 100;
          drawMarker(
            ctx,
            x + left * imageWidth,
            y + 18 + top * imageHeight,
            dot
          );
        });
      });

      let y = 1395;
      const marked = markedDotsInOrder();
      ctx.fillStyle = "#172433";
      ctx.font = "bold 25px Arial";
      ctx.fillText("PONTOS MARCADOS", 70, y);
      y += 36;
      ctx.font = "17px Arial";

      if (!marked.length) {
        ctx.fillText("Nenhum ponto marcado.", 80, y);
        y += 30;
      } else {
        marked.forEach((dot) => {
          ctx.fillText(
            `${dot.dataset.damageOrder}. ${dot.dataset.viewLabel || "Vista"} - ${dot.dataset.label || "Ponto do veiculo"}`,
            80,
            y
          );
          y += 27;
        });
      }

      y += 18;
      ctx.font = "bold 25px Arial";
      ctx.fillText("ANOTACOES DE AVARIAS E OBSERVACOES", 70, y);
      y += 40;
      ctx.font = "18px Arial";
      y = wrapText(ctx, notes, 70, y, 1440, 29);

      y = Math.max(y + 90, 1810);
      ctx.strokeStyle = "#172433";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(730, y);
      ctx.moveTo(870, y);
      ctx.lineTo(1520, y);
      ctx.stroke();
      ctx.font = "17px Arial";
      ctx.fillText("Assinatura de quem utilizara/utilizou o veiculo", 80, y + 27);
      ctx.fillText("Assinatura de quem realizou a vistoria", 870, y + 27);

      ctx.fillStyle = "#718094";
      ctx.font = "13px Arial";
      ctx.fillText(
        `Gerado em ${new Date().toLocaleString("pt-BR")} - Fleet Management`,
        70,
        canvas.height - 30
      );

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `Checklist_${($("inspectionVehicle")?.textContent || "veiculo")
        .replace(/[^a-z0-9_-]/gi, "_")}_${form.inspection_date.value || "data"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Erro ao gerar PNG atualizado:", error);
      notify(error.message || "Nao foi possivel gerar o PNG do checklist.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  /* Intercepta o gerador anterior para usar sempre o estado do toggle. */
  window.addEventListener("pointerdown", (event) => {
    const button = event.target.closest?.("#generateChecklistPng");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    clickLock = true;
    generateUpdatedPng(button);
  }, true);

  function resetVisualState() {
    document.querySelectorAll(".damage-dot.simple-marked").forEach((dot) => {
      dot.classList.remove("simple-marked");
      delete dot.dataset.damageOrder;
      delete dot.dataset.damagePointKey;
      dot.textContent = "+";
      dot.dataset.tip = `${dot.dataset.label || "Ponto do veiculo"}: adicionar avaria`;
    });
    updateSummary();
  }

  function init() {
    installStyles();
    resetVisualState();
    updateSummary();

    /* Novo checklist sempre inicia sem marcacoes visuais. */
    const modal = $("inspectionModal");
    if (modal) {
      const observer = new MutationObserver(() => {
        if (!modal.classList.contains("hidden")) {
          window.setTimeout(() => {
            resetVisualState();
            const notes = notesField();
            if (notes && !notes.value.trim()) notes.value = "";
          }, 30);
        }
      });
      observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
