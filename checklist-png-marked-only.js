"use strict";

/* Fleet Management
 * PNG do checklist: mostra nas imagens somente os pontos marcados.
 * Carregar por ultimo, depois de inspection-simple-notes-fix.js.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  let installedButton = null;

  function notify(message) {
    const toast = $("toast");
    if (!toast) return window.alert(message);
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 3200);
  }

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

  function drawMarkedPoint(ctx, x, y, number) {
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fillStyle = "#45c78f";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#102333";
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(number, x, y + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  async function generatePng(button) {
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
      const form = $("inspectionForm")?.elements;
      if (!form) throw new Error("Formulario do checklist nao encontrado.");

      const notes = form.vehicle_notes?.value || "Nenhuma avaria registrada.";
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
      const markedPoints = [];

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

        /* REGRA NOVA: somente .simple-marked entra no PNG. */
        view.querySelectorAll(".damage-dot.simple-marked").forEach((dot) => {
          const left = Number.parseFloat(dot.style.left) / 100;
          const top = Number.parseFloat(dot.style.top) / 100;
          const number = dot.dataset.damageOrder || dot.textContent.trim() || "1";
          drawMarkedPoint(
            ctx,
            x + left * imageWidth,
            y + 18 + top * imageHeight,
            number
          );
          markedPoints.push({
            number: Number(number) || 0,
            view: dot.dataset.viewLabel || label,
            point: dot.dataset.label || "Ponto do veiculo"
          });
        });
      });

      markedPoints.sort((a, b) => a.number - b.number);
      let y = 1395;
      ctx.fillStyle = "#172433";
      ctx.font = "bold 25px Arial";
      ctx.fillText("PONTOS COM AVARIA", 70, y);
      y += 36;
      ctx.font = "17px Arial";

      if (!markedPoints.length) {
        ctx.fillText("Nenhum ponto marcado.", 80, y);
        y += 30;
      } else {
        markedPoints.forEach((item) => {
          ctx.fillText(`${item.number}. ${item.view} - ${item.point}`, 80, y);
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
      ctx.fillText(`Gerado em ${new Date().toLocaleString("pt-BR")} - Fleet Management`, 70, canvas.height - 30);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `Checklist_${($("inspectionVehicle")?.textContent || "veiculo")
        .replace(/[^a-z0-9_-]/gi, "_")}_${form.inspection_date.value || "data"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Erro ao gerar PNG:", error);
      notify(error.message || "Nao foi possivel gerar o PNG do checklist.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function replaceGeneratorButton() {
    const current = $("generateChecklistPng");
    if (!current || current.dataset.markedOnly === "true") return;

    /* Clone remove todos os listeners antigos do botao. */
    const clean = current.cloneNode(true);
    clean.dataset.markedOnly = "true";
    clean.textContent = "Gerar PNG do checklist";
    current.replaceWith(clean);
    clean.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      generatePng(clean);
    });
    installedButton = clean;
  }

  function init() {
    replaceGeneratorButton();
    const form = $("inspectionForm");
    if (form) {
      const observer = new MutationObserver(() => replaceGeneratorButton());
      observer.observe(form, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
