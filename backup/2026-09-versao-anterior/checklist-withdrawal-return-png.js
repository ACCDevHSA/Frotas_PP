"use strict";

/* Fleet Management - PNG comparativo Retirada x Devolucao
 * Carregar DEPOIS de:
 *   inspection-2d-upgrade.js
 *   inspection-simple-notes-fix.js
 *   checklist-png-marked-only.js
 */
(() => {
  if (!window.APP_CONFIG || !window.supabase) return;

  const db = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

  let allowOriginalSubmit = false;
  let exporting = false;

  const $ = (id) => document.getElementById(id);
  const form = () => $("inspectionForm");
  const field = (name) => form()?.elements?.[name];
  const markedDots = () => [...document.querySelectorAll(".damage-dot.simple-marked")]
    .sort((a, b) => Number(a.dataset.damageOrder) - Number(b.dataset.damageOrder));

  function notify(message) {
    const toast = $("toast");
    if (!toast) return window.alert(message);
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 4000);
  }

  function type() {
    return field("inspection_type")?.value || "";
  }

  function loanId() {
    return field("loan_record_id")?.value || "";
  }

  function formatDate(value) {
    return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "-";
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Imagem nao encontrada: ${src}`));
      image.src = src;
    });
  }

  function wrap(ctx, text, x, y, width, lineHeight) {
    for (const paragraph of String(text || "Nenhuma observacao.").split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > width && line) {
          ctx.fillText(line, x, y);
          line = word;
          y += lineHeight;
        } else line = test;
      }
      ctx.fillText(line || " ", x, y);
      y += lineHeight;
    }
    return y;
  }

  function currentInspection() {
    return {
      inspection_type: type(),
      odometer_km: field("odometer_km")?.value || "-",
      inspection_date: field("inspection_date")?.value || "",
      inspection_time: field("inspection_time")?.value || "-",
      inspector_name: field("inspector_name")?.value || "-",
      driver_name: field("driver_name")?.value || "-",
      vehicle_notes: field("vehicle_notes")?.value || "Nenhuma observacao.",
      points: markedDots().map((dot) => ({
        number: Number(dot.dataset.damageOrder),
        pointId: dot.dataset.pointId,
        view: dot.dataset.viewLabel || "Vista",
        part: dot.dataset.label || "Ponto do veiculo"
      }))
    };
  }

  function storedPoints(inspection) {
    const values = Array.isArray(inspection?.damages) ? inspection.damages : [];
    return values.map((item, index) => ({
      number: index + 1,
      pointId: item.point_id || item.pointId || "",
      view: item.view || item.viewLabel || "Vista",
      part: item.part || "Ponto do veiculo"
    }));
  }

  async function previousWithdrawal() {
    if (!loanId()) return null;
    const { data, error } = await db.rpc("get_loan_inspection_comparison", {
      p_loan_record_id: loanId()
    });
    if (error) throw error;
    return (data || []).find((item) => item.inspection_type === "withdrawal") || null;
  }

  function pointMatches(dot, point) {
    return (point.pointId && dot.dataset.pointId === point.pointId) ||
      dot.dataset.label === point.part;
  }

  function drawPoint(ctx, x, y, number, color) {
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#102333";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(number), x, y + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawInspectionHeader(ctx, inspection, title, x, y, width, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, 44);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 23px Arial";
    ctx.fillText(title, x + 15, y + 29);

    ctx.fillStyle = "#eef3f7";
    ctx.fillRect(x, y + 54, width, 92);
    ctx.fillStyle = "#536577";
    ctx.font = "bold 12px Arial";
    ctx.fillText("KM", x + 14, y + 76);
    ctx.fillText("DATA / HORA", x + 170, y + 76);
    ctx.fillText("VISTORIADOR", x + 390, y + 76);
    ctx.fillText("USUARIO DO VEICULO", x + 14, y + 117);
    ctx.fillStyle = "#172433";
    ctx.font = "16px Arial";
    ctx.fillText(String(inspection?.odometer_km || "-"), x + 14, y + 98);
    ctx.fillText(`${formatDate(inspection?.inspection_date)} ${inspection?.inspection_time || ""}`, x + 170, y + 98);
    ctx.fillText(inspection?.inspector_name || "-", x + 390, y + 98);
    ctx.fillText(inspection?.driver_name || "-", x + 14, y + 139);
  }

  async function generateComparisonPng(button) {
    if (exporting) return;
    exporting = true;
    const original = button?.textContent || "Gerar PNG";
    if (button) {
      button.disabled = true;
      button.textContent = "Gerando PNG...";
    }

    try {
      const views = [...document.querySelectorAll(".vehicle-view")];
      if (views.length !== 4) throw new Error("As quatro vistas do veiculo nao foram encontradas.");
      const images = await Promise.all(views.map((view) => loadImage(view.querySelector("img")?.src)));
      const current = currentInspection();
      const withdrawal = type() === "return" ? await previousWithdrawal() : null;

      if (type() === "return" && !withdrawal) {
        throw new Error("A vistoria de retirada nao foi encontrada para este emprestimo.");
      }

      const left = withdrawal || current;
      const right = type() === "return" ? current : null;
      const leftPoints = withdrawal ? storedPoints(withdrawal) : current.points;
      const rightPoints = right ? current.points : [];

      const canvas = document.createElement("canvas");
      canvas.width = 1900;
      canvas.height = right ? 2450 : 1750;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#147da3";
      ctx.fillRect(0, 0, canvas.width, 16);
      ctx.fillStyle = "#172433";
      ctx.font = "bold 38px Arial";
      ctx.fillText("CHECKLIST DE VISTORIA - COMPARATIVO", 60, 68);
      ctx.font = "21px Arial";
      ctx.fillStyle = "#596b7c";
      ctx.fillText($("inspectionVehicle")?.textContent || "-", 60, 105);

      const columnWidth = right ? 870 : 1780;
      const columns = right
        ? [
            { data:left, points:leftPoints, title:"RETIRADA", x:60, color:"#2878b9" },
            { data:right, points:rightPoints, title:"DEVOLUCAO", x:970, color:"#27a573" }
          ]
        : [{ data:left, points:leftPoints, title:"RETIRADA", x:60, color:"#2878b9" }];

      columns.forEach((column) => drawInspectionHeader(ctx, column.data, column.title, column.x, 140, columnWidth, column.color));

      const viewWidth = right ? 405 : 850;
      const viewHeight = right ? 245 : 510;
      columns.forEach((column) => {
        views.forEach((view, index) => {
          const localCol = index % 2;
          const localRow = Math.floor(index / 2);
          const x = column.x + localCol * (viewWidth + 30);
          const y = 330 + localRow * (viewHeight + 75);
          const label = view.querySelector("h4")?.textContent || `Vista ${index + 1}`;
          ctx.fillStyle = "#172433";
          ctx.font = "bold 17px Arial";
          ctx.fillText(label, x, y);
          ctx.drawImage(images[index], x, y + 14, viewWidth, viewHeight);
          ctx.strokeStyle = "#d6e0e8";
          ctx.strokeRect(x, y + 14, viewWidth, viewHeight);

          view.querySelectorAll(".damage-dot").forEach((dot) => {
            const point = column.points.find((item) => pointMatches(dot, item));
            if (!point) return;
            const px = Number.parseFloat(dot.style.left) / 100;
            const py = Number.parseFloat(dot.style.top) / 100;
            drawPoint(
              ctx,
              x + px * viewWidth,
              y + 14 + py * viewHeight,
              point.number,
              column.title === "RETIRADA" ? "#65adff" : "#45c78f"
            );
          });
        });
      });

      let y = right ? 1040 : 1490;
      columns.forEach((column, index) => {
        const x = column.x;
        ctx.fillStyle = "#172433";
        ctx.font = "bold 20px Arial";
        ctx.fillText(`${column.title} - PONTOS E OBSERVACOES`, x, y);
        let sy = y + 31;
        ctx.font = "15px Arial";
        if (column.points.length) {
          column.points.forEach((point) => {
            sy = wrap(ctx, `${point.number}. ${point.view} - ${point.part}`, x + 8, sy, columnWidth - 15, 22);
          });
        } else {
          ctx.fillText("Nenhum ponto marcado.", x + 8, sy);
          sy += 22;
        }
        sy += 10;
        ctx.font = "15px Arial";
        wrap(ctx, column.data?.vehicle_notes || "Nenhuma observacao.", x + 8, sy, columnWidth - 15, 22);
      });

      const signatureY = canvas.height - 130;
      ctx.strokeStyle = "#172433";
      ctx.beginPath();
      ctx.moveTo(100, signatureY);
      ctx.lineTo(850, signatureY);
      ctx.moveTo(1050, signatureY);
      ctx.lineTo(1800, signatureY);
      ctx.stroke();
      ctx.font = "16px Arial";
      ctx.fillText("Assinatura de quem utilizou o veiculo", 100, signatureY + 26);
      ctx.fillText("Assinatura de quem realizou a vistoria", 1050, signatureY + 26);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `Checklist_Comparativo_${($("inspectionVehicle")?.textContent || "veiculo")
        .replace(/[^a-z0-9_-]/gi, "_")}_${field("inspection_date")?.value || "data"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return true;
    } catch (error) {
      console.error("PNG comparativo:", error);
      notify(error.message || "Nao foi possivel gerar o PNG comparativo.");
      return false;
    } finally {
      exporting = false;
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  }

  function syncCurrentDamagesToLegacy() {
    const notes = (field("vehicle_notes")?.value || "").split("\n");
    const dots = markedDots();
    const legacyEditor = $("damageEditor");
    const legacyDescription = $("damageDescription");
    const legacyButton = $("addDamage");
    if (!legacyEditor || !legacyDescription || !legacyButton) return;

    dots.forEach((dot, index) => {
      const line = notes.find((value) => new RegExp(`^\\s*${index + 1}\\.\\s*Avaria\\s*:`, "i").test(value)) || "";
      const description = line.replace(/^\s*\d+\.\s*Avaria\s*:\s*/i, "").trim() || "Avaria indicada no checklist";
      legacyEditor.dataset.part = dot.dataset.label || "Ponto do veiculo";
      legacyEditor.dataset.pointId = dot.dataset.pointId || "";
      legacyEditor.dataset.view = dot.dataset.viewLabel || "Vista";
      legacyDescription.value = description;
      legacyButton.click();
    });
  }

  function configureButtons() {
    const inspectionForm = form();
    if (!inspectionForm) return;
    const submit = inspectionForm.querySelector('button[type="submit"]');
    const png = $("generateChecklistPng");
    const currentType = type();

    if (submit) {
      submit.hidden = false;
      submit.disabled = false;
      submit.textContent = currentType === "return"
        ? "Concluir vistoria e encerrar emprestimo"
        : "Salvar vistoria de retirada";
    }

    if (png) {
      png.textContent = currentType === "return"
        ? "Gerar PNG Retirada + Devolucao"
        : "Gerar PNG da retirada";
    }
  }

  function replacePngButton() {
    const current = $("generateChecklistPng");
    if (!current || current.dataset.comparison === "true") return;
    const clean = current.cloneNode(true);
    clean.dataset.comparison = "true";
    current.replaceWith(clean);
    clean.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await generateComparisonPng(clean);
    });
    configureButtons();
  }

  /* Na devolucao, baixa antes e so depois libera o submit original. */
  document.addEventListener("submit", async (event) => {
    if (event.target?.id !== "inspectionForm" || allowOriginalSubmit) return;
    if (type() !== "return") {
      syncCurrentDamagesToLegacy();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const submit = event.target.querySelector('button[type="submit"]');
    const ok = await generateComparisonPng(submit);
    if (!ok) {
      notify("A devolucao nao foi concluida porque o PNG nao foi gerado.");
      return;
    }

    syncCurrentDamagesToLegacy();
    allowOriginalSubmit = true;
    event.target.requestSubmit(submit);
    setTimeout(() => { allowOriginalSubmit = false; }, 0);
  }, true);

  function init() {
    replacePngButton();
    configureButtons();
    const modal = $("inspectionModal");
    if (modal) {
      new MutationObserver(() => {
        if (!modal.classList.contains("hidden")) {
          setTimeout(() => {
            replacePngButton();
            configureButtons();
          }, 50);
        }
      }).observe(modal, { attributes:true, attributeFilter:["class"] });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else init();
})();
