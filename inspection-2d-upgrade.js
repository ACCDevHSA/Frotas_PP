"use strict";

/* Fleet Management - Checklist 2D com quatro vistas e exportacao PNG.
 * Substitui inspection-upgrade.js e inspection-save-fix.js.
 * Carregar depois de app.js.
 */
(() => {
  const VIEWS = [
    {
      id: "left", label: "Lado esquerdo", image: "assets/vehicle/vehicle-left.png",
      points: [
        ["le_parachoque_dianteiro", "Para-choque dianteiro esquerdo", 10, 63],
        ["le_roda_dianteira", "Roda dianteira esquerda", 25, 72],
        ["le_porta_dianteira", "Porta dianteira esquerda", 47, 57],
        ["le_porta_traseira", "Porta traseira esquerda", 66, 56],
        ["le_roda_traseira", "Roda traseira esquerda", 79, 72],
        ["le_parachoque_traseiro", "Para-choque traseiro esquerdo", 92, 63],
        ["le_vidros", "Vidros do lado esquerdo", 56, 38],
        ["le_teto", "Teto, lado esquerdo", 55, 24]
      ]
    },
    {
      id: "right", label: "Lado direito", image: "assets/vehicle/vehicle-right.png",
      points: [
        ["ld_parachoque_dianteiro", "Para-choque dianteiro direito", 10, 63],
        ["ld_roda_dianteira", "Roda dianteira direita", 25, 72],
        ["ld_porta_dianteira", "Porta dianteira direita", 47, 57],
        ["ld_porta_traseira", "Porta traseira direita", 66, 56],
        ["ld_roda_traseira", "Roda traseira direita", 79, 72],
        ["ld_parachoque_traseiro", "Para-choque traseiro direito", 92, 63],
        ["ld_vidros", "Vidros do lado direito", 56, 38],
        ["ld_teto", "Teto, lado direito", 55, 24]
      ]
    },
    {
      id: "front", label: "Frente", image: "assets/vehicle/vehicle-front.png",
      points: [
        ["fr_parachoque", "Para-choque dianteiro", 50, 78],
        ["fr_grade", "Grade dianteira", 50, 63],
        ["fr_farois_esquerdo", "Farol dianteiro esquerdo", 27, 52],
        ["fr_farois_direito", "Farol dianteiro direito", 73, 52],
        ["fr_capo", "Capô", 50, 39],
        ["fr_parabrisa", "Para-brisa", 50, 22],
        ["fr_retrovisor_esquerdo", "Retrovisor esquerdo", 13, 32],
        ["fr_retrovisor_direito", "Retrovisor direito", 87, 32]
      ]
    },
    {
      id: "rear", label: "Traseira", image: "assets/vehicle/vehicle-rear.png",
      points: [
        ["tr_parachoque", "Para-choque traseiro", 50, 79],
        ["tr_portamalas", "Porta-malas", 50, 52],
        ["tr_lanterna_esquerda", "Lanterna traseira esquerda", 27, 43],
        ["tr_lanterna_direita", "Lanterna traseira direita", 73, 43],
        ["tr_vidro", "Vidro traseiro", 50, 25],
        ["tr_lateral_esquerda", "Canto traseiro esquerdo", 13, 61],
        ["tr_lateral_direita", "Canto traseiro direito", 87, 61]
      ]
    }
  ];

  let records = [];
  let activePoint = null;
  let editingId = null;

  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  function notify(message) {
    const toast = $("toast");
    if (!toast) return window.alert(message);
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3500);
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.id = "inspection2dStyles";
    style.textContent = `
      .vehicle-views{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .vehicle-view{position:relative;overflow:visible;border:1px solid var(--line);border-radius:14px;background:#eef1f4;box-shadow:0 8px 22px #0003}
      .vehicle-view h4{position:absolute;z-index:3;left:10px;top:8px;margin:0;padding:5px 8px;border-radius:8px;background:#07111fcc;color:#fff;font-size:12px}
      .vehicle-view-image{display:block;width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:13px}
      .damage-dot{position:absolute;z-index:4;width:28px;height:28px;display:grid;place-items:center;transform:translate(-50%,-50%);border:2px solid #fff;border-radius:50%;background:#e83d55;color:#fff;font-weight:900;cursor:pointer;box-shadow:0 0 0 5px #e83d5530,0 3px 10px #0006}
      .damage-dot.has-damage{background:#f0ad22;color:#202a34}
      .damage-dot .count{font-size:11px}
      .damage-dot:hover::after{content:attr(data-tip);position:absolute;left:32px;top:-5px;width:max-content;max-width:220px;padding:7px 9px;border:1px solid #d2a61d;border-radius:7px;background:#fff4bd;color:#172433;font-size:11px;font-weight:600;line-height:1.3;white-space:normal;box-shadow:0 7px 20px #0005;pointer-events:none}
      .damage-popover{position:fixed;z-index:300;width:min(330px,calc(100vw - 24px));padding:13px;border:1px solid var(--blue);border-radius:13px;background:var(--surface);box-shadow:0 18px 45px #000a}
      .damage-popover h4{margin:0 0 8px;color:var(--teal)}
      .damage-popover textarea{min-height:78px}
      .damage-popover-list{display:grid;gap:6px;max-height:120px;overflow:auto;margin:9px 0}
      .damage-popover-item{display:flex;gap:6px;align-items:flex-start;padding:7px;border:1px solid var(--line);border-radius:8px;font-size:12px}
      .damage-popover-item button{margin-left:auto}
      .damage-popover-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:8px}
      .damage-2d-list{display:grid;gap:8px;margin-top:14px}
      .damage-2d-item{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--surface2)}
      .damage-2d-item small{color:var(--muted)}
      .damage-2d-item-actions{display:flex;gap:5px;align-items:center}
      #damageList{display:none!important}
      .png-button{margin-right:auto}
      @media(max-width:850px){.vehicle-views{grid-template-columns:1fr}.damage-dot:hover::after{display:none}}
    `;
    document.head.appendChild(style);
  }

  function legacyAdd(part, description) {
    const editor = $("damageEditor");
    const field = $("damageDescription");
    const button = $("addDamage");
    if (!editor || !field || !button) throw new Error("Integração de avarias não encontrada.");
    editor.dataset.part = part;
    field.value = description;
    button.click();
  }

  function legacyRemove(part, description) {
    const item = [...document.querySelectorAll("#damageList .damage-item")]
      .find((node) => node.textContent.includes(part) && node.textContent.includes(description));
    item?.querySelector("[data-remove-damage]")?.click();
  }

  function syncNotes() {
    const notes = document.querySelector('#inspectionForm [name="vehicle_notes"]');
    if (!notes) return;
    const normal = notes.value.split("\n").filter((line) => !line.startsWith("[AVARIA - "));
    const damageLines = records.map((r) => `[AVARIA - ${r.part}] ${r.description}`);
    notes.value = [...normal.filter((x) => x.trim()), ...damageLines].join("\n");
  }

  function pointRecords(pointId) { return records.filter((r) => r.pointId === pointId); }

  function renderDots() {
    document.querySelectorAll(".damage-dot").forEach((dot) => {
      const list = pointRecords(dot.dataset.pointId);
      dot.classList.toggle("has-damage", list.length > 0);
      dot.innerHTML = list.length ? `<span class="count">${list.length}</span>` : "+";
      dot.dataset.tip = list.length
        ? `${dot.dataset.label}: ${list.map((x) => x.description).join(" | ")}`
        : `${dot.dataset.label}: adicionar avaria`;
    });
  }

  function renderList() {
    const list = $("damage2dList");
    if (!list) return;
    list.innerHTML = records.length ? records.map((r) => `
      <div class="damage-2d-item">
        <div><b>${escapeHtml(r.part)}</b><br><small>${escapeHtml(r.viewLabel)}</small><br>${escapeHtml(r.description)}</div>
        <div class="damage-2d-item-actions">
          <button type="button" class="btn small" data-edit-damage="${r.id}">Editar</button>
          <button type="button" class="btn small danger" data-delete-damage="${r.id}">Remover</button>
        </div>
      </div>`).join("") : '<div class="empty">Nenhuma avaria registrada.</div>';
    renderDots();
    syncNotes();
  }

  function popupPosition(dot) {
    const rect = dot.getBoundingClientRect();
    const width = Math.min(330, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left + 18), window.innerWidth - width - 12);
    const top = Math.min(Math.max(12, rect.top + 20), window.innerHeight - 330);
    return { left, top };
  }

  function openPopover(dot, editId = null) {
    closePopover();
    activePoint = {
      id: dot.dataset.pointId,
      part: dot.dataset.label,
      viewId: dot.dataset.viewId,
      viewLabel: dot.dataset.viewLabel
    };
    editingId = editId;
    const existing = pointRecords(activePoint.id);
    const editing = records.find((r) => r.id === editId);
    const pop = document.createElement("div");
    pop.className = "damage-popover";
    pop.id = "damage2dPopover";
    const position = popupPosition(dot);
    pop.style.left = `${position.left}px`;
    pop.style.top = `${position.top}px`;
    pop.innerHTML = `
      <h4>${escapeHtml(activePoint.part)}</h4>
      <div class="damage-popover-list">${existing.map((r) => `
        <div class="damage-popover-item"><span>${escapeHtml(r.description)}</span><button type="button" class="btn small" data-pop-edit="${r.id}">Editar</button></div>`).join("") || "<small>Nenhuma avaria neste ponto.</small>"}</div>
      <textarea id="damage2dText" placeholder="${editing ? "Edite a avaria" : "Descreva uma nova avaria"}">${escapeHtml(editing?.description || "")}</textarea>
      <div class="damage-popover-actions">
        <button type="button" class="btn small" data-close-popover>Cancelar</button>
        <button type="button" class="btn small primary" id="saveDamage2d">${editing ? "Atualizar" : "Salvar avaria"}</button>
      </div>`;
    document.body.appendChild(pop);
    $("damage2dText").focus();
  }

  function closePopover() { $("damage2dPopover")?.remove(); activePoint = null; editingId = null; }

  function saveDamage() {
    const text = $("damage2dText")?.value.trim();
    if (!text || !activePoint) return notify("Digite a descrição da avaria.");
    try {
      if (editingId) {
        const record = records.find((r) => r.id === editingId);
        if (!record) return;
        legacyRemove(record.part, record.description);
        legacyAdd(activePoint.part, text);
        record.description = text;
      } else {
        legacyAdd(activePoint.part, text);
        records.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          pointId: activePoint.id,
          part: activePoint.part,
          viewId: activePoint.viewId,
          viewLabel: activePoint.viewLabel,
          description: text
        });
      }
      renderList();
      closePopover();
      notify("Avaria salva.");
    } catch (error) { console.error(error); notify(error.message); }
  }

  function deleteDamage(id) {
    const index = records.findIndex((r) => r.id === id);
    if (index < 0) return;
    const record = records[index];
    legacyRemove(record.part, record.description);
    records.splice(index, 1);
    renderList();
  }

  function buildViews() {
    const stage = $("carStage");
    if (!stage) return;
    stage.className = "vehicle-views";
    stage.innerHTML = VIEWS.map((view) => `
      <article class="vehicle-view" data-view="${view.id}">
        <h4>${view.label}</h4>
        <img class="vehicle-view-image" src="${view.image}" alt="Vista do veículo: ${view.label}">
        ${view.points.map(([id,label,x,y]) => `<button type="button" class="damage-dot" style="left:${x}%;top:${y}%" data-point-id="${id}" data-label="${label}" data-view-id="${view.id}" data-view-label="${view.label}" data-tip="${label}: adicionar avaria" aria-label="${label}">+</button>`).join("")}
      </article>`).join("");
    const area = stage.closest(".damage-area");
    const list = document.createElement("div");
    list.id = "damage2dList";
    list.className = "damage-2d-list";
    area.appendChild(list);
    renderList();
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function wrap(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text || "-").split(/\s+/); let line = ""; let cy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { ctx.fillText(line, x, cy); line = word; cy += lineHeight; }
      else line = test;
    }
    ctx.fillText(line, x, cy); return cy + lineHeight;
  }

  async function generatePng() {
    const button = $("generateChecklistPng");
    const old = button.textContent; button.disabled = true; button.textContent = "Gerando PNG...";
    try {
      const images = await Promise.all(VIEWS.map((v) => loadImage(v.image)));
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      const listHeight = Math.max(180, records.length * 38 + 70);
      canvas.height = 1650 + listHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = "#147da3"; ctx.fillRect(0,0,canvas.width,16);
      ctx.fillStyle = "#172433"; ctx.font = "bold 38px Arial"; ctx.fillText($("inspectionTitle")?.textContent || "Checklist de Vistoria", 70, 78);
      ctx.font = "22px Arial"; ctx.fillStyle = "#536577"; ctx.fillText($("inspectionVehicle")?.textContent || "-", 70, 116);
      const f = $("inspectionForm").elements;
      const fields = [
        ["KM atual", f.odometer_km.value], ["Data", f.inspection_date.value ? new Date(f.inspection_date.value+"T12:00:00").toLocaleDateString("pt-BR") : "-"],
        ["Hora", f.inspection_time.value], ["Quem realizou a vistoria", f.inspector_name.value],
        ["Quem utilizará/utilizou o veículo", f.driver_name.value]
      ];
      let fy=170; ctx.font="bold 18px Arial";
      fields.forEach(([label,value],i)=>{const col=i%2,row=Math.floor(i/2);const x=70+col*750,y=fy+row*75;ctx.fillStyle="#edf3f7";ctx.fillRect(x,y,700,58);ctx.fillStyle="#536577";ctx.font="bold 14px Arial";ctx.fillText(label.toUpperCase(),x+14,y+20);ctx.fillStyle="#172433";ctx.font="18px Arial";ctx.fillText(value||"-",x+14,y+44)});
      const imageY=420, cellW=700, cellH=430;
      VIEWS.forEach((view,i)=>{const x=70+(i%2)*750,y=imageY+Math.floor(i/2)*490;ctx.fillStyle="#172433";ctx.font="bold 22px Arial";ctx.fillText(view.label,x,y);ctx.drawImage(images[i],x,y+20,cellW,cellH);view.points.forEach(([id,label,px,py])=>{const rs=pointRecords(id);const cx=x+px/100*cellW,cy=y+20+py/100*cellH;ctx.beginPath();ctx.fillStyle=rs.length?"#f0ad22":"#e83d55";ctx.arc(cx,cy,14,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle=rs.length?"#172433":"#fff";ctx.font="bold 15px Arial";ctx.textAlign="center";ctx.fillText(rs.length?String(rs.length):"+",cx,cy+5);ctx.textAlign="left"})});
      let y=1425; ctx.fillStyle="#172433";ctx.font="bold 25px Arial";ctx.fillText("AVARIAS REGISTRADAS",70,y);y+=40;ctx.font="18px Arial";
      if(!records.length){ctx.fillText("Nenhuma avaria registrada.",70,y);y+=34}else records.forEach((r,i)=>{ctx.fillStyle="#172433";y=wrap(ctx,`${i+1}. ${r.viewLabel} - ${r.part}: ${r.description}`,80,y,1420,28)});
      y+=25;ctx.font="bold 22px Arial";ctx.fillText("OBSERVAÇÕES DO VEÍCULO",70,y);y+=34;ctx.font="18px Arial";y=wrap(ctx,f.vehicle_notes.value||"Nenhuma observação.",70,y,1420,28);
      y+=75;ctx.strokeStyle="#172433";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(80,y);ctx.lineTo(730,y);ctx.moveTo(870,y);ctx.lineTo(1520,y);ctx.stroke();ctx.font="18px Arial";ctx.fillText("Assinatura de quem utilizará/utilizou o veículo",80,y+27);ctx.fillText("Assinatura de quem realizou a vistoria",870,y+27);
      const link=document.createElement("a");link.href=canvas.toDataURL("image/png");link.download=`Checklist_${($("inspectionVehicle")?.textContent||"veiculo").replace(/[^a-z0-9_-]/gi,"_")}_${f.inspection_date.value||"data"}.png`;link.click();
    } catch(error){console.error(error);notify("Não foi possível gerar o PNG. Verifique as quatro imagens.");}
    finally{button.disabled=false;button.textContent=old;}
  }

  function addPngButton() {
    const actions = $("inspectionForm")?.querySelector(".modal-actions");
    if (!actions || $("generateChecklistPng")) return;
    const button = document.createElement("button");
    button.type="button";button.id="generateChecklistPng";button.className="btn png-button";button.textContent="Gerar PNG do checklist";button.onclick=generatePng;actions.prepend(button);
  }

  document.addEventListener("click", (event) => {
    const dot=event.target.closest(".damage-dot");if(dot){event.stopPropagation();return openPopover(dot);}
    if(event.target.closest("#saveDamage2d")){event.preventDefault();return saveDamage();}
    if(event.target.closest("[data-close-popover]"))return closePopover();
    const edit=event.target.closest("[data-edit-damage]");if(edit){const r=records.find(x=>x.id===edit.dataset.editDamage);const dot=document.querySelector(`.damage-dot[data-point-id="${r?.pointId}"]`);if(dot)return openPopover(dot,r.id);}
    const popEdit=event.target.closest("[data-pop-edit]");if(popEdit){const r=records.find(x=>x.id===popEdit.dataset.popEdit);const dot=document.querySelector(`.damage-dot[data-point-id="${r?.pointId}"]`);if(dot)return openPopover(dot,r.id);}
    const del=event.target.closest("[data-delete-damage]");if(del)return deleteDamage(del.dataset.deleteDamage);
  });

  function init(){injectStyles();buildViews();addPngButton();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
