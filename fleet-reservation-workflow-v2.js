"use strict";

/* Fleet Management - fluxo unificado de reservas, assinatura, cancelamento e timeline.
 * Carregar POR ULTIMO no index.html e no painel.html.
 */
(() => {
  if (!window.APP_CONFIG || !window.supabase) return;
  const client = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
  const isPublic = Boolean(document.getElementById("requestForm"));
  const isAdmin = Boolean(document.getElementById("requestsBody"));
  const MAX_PDF = 5 * 1024 * 1024;
  let own = [];
  let busy = false;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "-";
  const tokens = () => { try { return [...new Set(JSON.parse(localStorage.getItem("fleetRequestTokens") || "[]"))]; } catch { return []; } };
  const toast = message => { const el=$("toast"); if(!el) return alert(message); el.textContent=message; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),3800); };
  const base64 = file => new Promise((ok,no) => { const r=new FileReader(); r.onload=()=>ok(String(r.result).split(",")[1]); r.onerror=no; r.readAsDataURL(file); });

  function styles(){
    if($("workflowV2Styles")) return;
    const s=document.createElement("style"); s.id="workflowV2Styles"; s.textContent=`
      .workflow-state{display:grid;gap:9px;margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface-raised,var(--surface2))}
      .workflow-state.pending{border-color:var(--warning,var(--amber))}.workflow-state.confirmed{border-color:var(--success,var(--green))}.workflow-state.cancelled{opacity:.72}
      .workflow-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.workflow-actions .btn{width:100%}.workflow-file{padding:8px!important}
      .timeline-button{margin-top:8px}.timeline-list{display:grid;gap:10px;padding:20px}.timeline-item{display:grid;grid-template-columns:120px 1fr auto;gap:12px;align-items:center;padding:12px;border-left:4px solid var(--blue);border-radius:8px;background:var(--surface)}
      .timeline-item.pending{border-color:var(--warning,var(--amber))}.timeline-item.approved{border-color:var(--success,var(--green))}.timeline-gap{padding:8px 12px;color:var(--success,var(--green));font-size:.8rem}
      .admin-signed-cell .btn{white-space:nowrap}@media(max-width:620px){.workflow-actions{grid-template-columns:1fr}.timeline-item{grid-template-columns:1fr}}
    `; document.head.appendChild(s);
  }

  async function loadOwn(){
    own=[];
    for(const token of tokens()){
      const {data,error}=await client.rpc("track_fleet_request",{p_token:token});
      if(error) continue;
      const row=Array.isArray(data)?data[0]:data;
      if(row){const st=await client.rpc("get_reservation_workflow_status",{p_token:token}); own.push({...row,token,...(Array.isArray(st.data)?st.data[0]:st.data)});}
    }
    return own;
  }

  function cardMatch(card,row){const t=card.innerText||""; return t.includes(row.plate||"")&&t.includes(row.requester_name||"")&&t.includes(fmt(row.start_date));}
  function vehicleCard(row){return [...document.querySelectorAll("#vehicleGrid .vehicle-card")].find(c=>(c.innerText||"").includes(row.plate||""));}
  function downloadOriginal(row,kind){
    if(!window.FleetContract) return toast("Motor do contrato não carregado.");
    try{kind==="word"?FleetContract.word(row):FleetContract.pdf(row);}catch(e){toast(e.message);}
  }
  async function cancel(row,button){
    if(!confirm("Cancelar esta reserva?")) return;
    button.disabled=true;
    const {error}=await client.rpc("cancel_own_fleet_reservation",{p_token:row.token});
    button.disabled=false;
    if(error) return toast(error.message);
    toast("Reserva cancelada."); await refreshPublic();
  }
  async function complete(row,box){
    const input=box.querySelector('input[type="file"]'), file=input.files[0], button=box.querySelector('[data-complete]');
    if(!file) return toast("Selecione o contrato assinado em PDF.");
    if(!file.name.toLowerCase().endsWith(".pdf")) return toast("Envie somente PDF.");
    if(file.size>MAX_PDF) return toast("O PDF deve ter no máximo 5 MB.");
    button.disabled=true; button.textContent="Concluindo...";
    try{
      const {error}=await client.rpc("complete_reservation_with_signed_contract",{p_token:row.token,p_file_name:file.name,p_pdf_base64:await base64(file)});
      if(error) throw error;
      toast("Solicitação concluída e reserva confirmada."); await refreshPublic();
    }catch(e){console.error(e);toast(e.message||"Falha ao concluir solicitação.");}
    finally{if(button.isConnected){button.disabled=false;button.textContent="Concluir Solicitação";}}
  }

  function decorateReservationCards(){
    document.querySelectorAll("#reservationGrid .reservation-card").forEach(card=>{
      const row=own.find(r=>cardMatch(card,r)); if(!row) return;
      card.querySelectorAll(".contract-download-button,.contract-format-actions,.contract-actions-final,.signed-contract-box").forEach(x=>x.remove());
      let box=card.querySelector(".workflow-state"); if(box) box.remove();
      box=document.createElement("div");
      const pending=row.status==="pending"&&!row.has_signed_contract;
      const confirmed=row.status==="approved"&&row.has_signed_contract;
      box.className=`workflow-state ${pending?"pending":confirmed?"confirmed":"cancelled"}`;
      if(pending){
        box.innerHTML=`<strong>Reserva pendente de aprovação</strong><small>Baixe, assine e envie o contrato para confirmar a reserva.</small><div class="workflow-actions"><button class="btn" data-word>Baixar Word</button><button class="btn" data-pdf>Baixar PDF</button></div><input class="workflow-file" type="file" accept="application/pdf,.pdf"><div class="workflow-actions"><button class="btn primary" data-complete>Concluir Solicitação</button><button class="btn danger" data-cancel>Cancelar Reserva</button></div>`;
        box.querySelector("[data-word]").onclick=()=>downloadOriginal(row,"word"); box.querySelector("[data-pdf]").onclick=()=>downloadOriginal(row,"pdf"); box.querySelector("[data-complete]").onclick=()=>complete(row,box); box.querySelector("[data-cancel]").onclick=e=>cancel(row,e.currentTarget);
      } else if(confirmed){
        box.innerHTML=`<strong>Reserva confirmada</strong><small>Contrato assinado recebido. Veículo indisponível no período reservado.</small><div class="workflow-actions"><button class="btn" data-word>Baixar Word</button><button class="btn" data-pdf>Baixar PDF</button><button class="btn danger" data-cancel>Cancelar Reserva</button></div>`;
        box.querySelector("[data-word]").onclick=()=>downloadOriginal(row,"word"); box.querySelector("[data-pdf]").onclick=()=>downloadOriginal(row,"pdf"); box.querySelector("[data-cancel]").onclick=e=>cancel(row,e.currentTarget);
      } else box.innerHTML=`<strong>${row.status==="cancelled"?"Reserva cancelada":"Reserva encerrada"}</strong>`;
      card.appendChild(box);
    });
  }

  function decorateVehicleCards(){
    document.querySelectorAll("#vehicleGrid .vehicle-card").forEach(card=>{
      if(!card.querySelector(".timeline-button")){const b=document.createElement("button");b.type="button";b.className="btn wide timeline-button";b.textContent="Ver timeline de reservas";b.onclick=e=>{e.preventDefault();e.stopPropagation();openTimeline(card.dataset.id,card.querySelector("h3")?.textContent||"Veículo")};card.appendChild(b);}
    });
    own.filter(r=>r.status==="pending"&&!r.has_signed_contract).forEach(r=>{const c=vehicleCard(r);if(!c)return;const status=c.querySelector(".status");if(status){status.classList.add("off");status.innerHTML="<i></i>RESERVA PENDENTE DE APROVAÇÃO";}const req=c.querySelector('[data-request]');if(req)req.textContent="Solicitar outra data";});
    own.filter(r=>r.status==="approved"&&r.has_signed_contract).forEach(r=>{const c=vehicleCard(r);if(!c)return;const status=c.querySelector(".status");if(status){status.classList.add("off");status.innerHTML="<i></i>INDISPONÍVEL";}const req=c.querySelector('[data-request]');if(req)req.textContent="Solicitar outra data";});
  }

  async function openTimeline(vehicleId,title){
    const {data,error}=await client.rpc("get_vehicle_reservation_timeline",{p_vehicle_id:vehicleId}); if(error)return toast(error.message);
    let modal=$("timelineModal"); if(!modal){modal=document.createElement("div");modal.id="timelineModal";modal.className="modal hidden";modal.innerHTML='<div class="modal-card"><div class="modal-head"><div><p class="eyebrow">AGENDA DO VEÍCULO</p><h2 id="timelineTitle"></h2></div><button class="close" data-close-timeline>×</button></div><div class="timeline-list" id="timelineList"></div></div>';document.body.appendChild(modal);modal.querySelector("[data-close-timeline]").onclick=()=>modal.classList.add("hidden");}
    $("timelineTitle").textContent=title; const rows=data||[]; let html="",previous=null;
    for(const r of rows){if(previous){const gap=Math.round((new Date(r.start_date)-new Date(previous))/86400000)-1;if(gap>0)html+=`<div class="timeline-gap">Gap disponível: ${gap} dia(s)</div>`;}html+=`<div class="timeline-item ${r.status}"><b>${fmt(r.start_date)}<br>${fmt(r.end_date)}</b><span>${esc(r.requester_name||"Reserva")}</span><span>${r.status==="pending"?"Pendente de assinatura":"Confirmada"}</span></div>`;previous=r.end_date;}
    $("timelineList").innerHTML=html||'<div class="empty">Nenhuma reserva futura. Período livre.</div>';modal.classList.remove("hidden");
  }

  async function interceptRequest(event){
    if(event.target?.id!=="requestForm"||busy)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();busy=true;
    const form=event.target,p=Object.fromEntries(new FormData(form)),button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent="Solicitando...";
    try{
      const {data,error}=await client.rpc("create_fleet_request",{p_vehicle_id:p.vehicle_id,p_fleet_user_id:p.fleet_user_id,p_start_date:p.start_date,p_end_date:p.end_date,p_purpose:p.purpose,p_notes:p.notes||null});
      if(error)throw error;const list=tokens();list.push(data);localStorage.setItem("fleetRequestTokens",JSON.stringify([...new Set(list)]));document.getElementById("requestModal")?.classList.add("hidden");toast("Reserva criada. Envie o contrato assinado para confirmar.");setTimeout(()=>location.reload(),700);
    }catch(e){console.error(e);toast(e.message||"Falha ao criar reserva.");}
    finally{busy=false;button.disabled=false;button.textContent="Enviar solicitação";}
  }

  async function refreshPublic(){await loadOwn();decorateReservationCards();decorateVehicleCards();}

  async function adminLoad(){
    const {data,error}=await client.rpc("admin_list_signed_contracts_v2");if(error){console.error(error);return;}const map=new Map((data||[]).map(x=>[x.reservation_id,x]));
    const table=document.querySelector("#requestsTab table"),head=table?.querySelector("thead tr");if(head&&!head.querySelector(".signed-head")){const th=document.createElement("th");th.className="signed-head";th.textContent="Contrato Assinado";head.insertBefore(th,head.lastElementChild);}
    document.querySelectorAll("#requestsBody tr").forEach(row=>{row.querySelector(".admin-signed-cell")?.remove();const el=row.querySelector("[data-decision],[data-delete],[data-decision-id],[data-delete-id],[data-delete-reservation]");const id=el?.dataset.decision||el?.dataset.delete||el?.dataset.decisionId||el?.dataset.deleteId||el?.dataset.deleteReservation;if(!id)return;const td=document.createElement("td");td.className="admin-signed-cell";const item=map.get(id);if(item){const b=document.createElement("button");b.className="btn small";b.textContent="Baixar Assinado";b.onclick=()=>{const bin=atob(item.pdf_base64),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:"application/pdf"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=item.file_name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000)};td.appendChild(b)}else td.innerHTML='<span class="muted">Aguardando</span>';row.insertBefore(td,row.lastElementChild);});
  }

  function init(){styles();if(isPublic){document.addEventListener("submit",interceptRequest,true);const vg=$("vehicleGrid"),rg=$("reservationGrid");if(vg)new MutationObserver(()=>setTimeout(decorateVehicleCards,50)).observe(vg,{childList:true,subtree:true});if(rg)new MutationObserver(()=>setTimeout(refreshPublic,80)).observe(rg,{childList:true,subtree:true});refreshPublic();}if(isAdmin){const body=$("requestsBody");if(body)new MutationObserver(()=>setTimeout(adminLoad,100)).observe(body,{childList:true,subtree:true});setTimeout(adminLoad,500);}}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();
