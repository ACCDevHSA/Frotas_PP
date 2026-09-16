(() => {
  "use strict";
  const LINK = "input[data-contract-link],input[name='signed_contract_url'],input[name='sharepoint_url'],input[name='sharepoint_link'],input[placeholder*='sharepoint' i],input[placeholder^='http' i]";
  const CARD = "[data-reservation-card],.reservation-card,.request-card,.smart-card,.reservation-item";
  const CANCEL = "[data-action='cancel-reservation'],.cancel-reservation,.cancel-booking,.btn-cancel-reservation";
  const FINISH = "[data-action='complete-request'],[data-action='finish-request'],.complete-request,.finish-request";
  let cancelling=false;
  const cardOf=el=>el?.closest(CARD)||el?.parentElement?.parentElement;
  const notify=(message,type="info")=>{
    if(typeof window.showToast==="function") return window.showToast(message,type);
    const t=document.getElementById("toast");
    if(t){t.textContent=message;t.classList.add("show",type);setTimeout(()=>t.classList.remove("show",type),3500);}
    else alert(message);
  };
  const validUrl=value=>{try{const u=new URL(String(value||"").trim());return u.protocol==="https:"||u.protocol==="http:";}catch{return false;}};
  function enableLink(input){input.disabled=false;input.readOnly=false;input.removeAttribute("disabled");input.removeAttribute("readonly");input.style.pointerEvents="auto";input.style.cursor="text";input.tabIndex=0;}
  function syncFinish(input){
    const card=cardOf(input); if(!card)return;
    const button=card.querySelector(FINISH)||[...card.querySelectorAll("button")].find(b=>/concluir\s+solicita[cç][aã]o/i.test(b.textContent));
    if(button){button.disabled=!validUrl(input.value);button.setAttribute("aria-disabled",String(button.disabled));}
  }
  function contractUrl(card){
    const fields=["contractUrl","contractFileUrl","contractPdfUrl","documentUrl","contractPath","generatedContractUrl","originalContractUrl"];
    for(const key of fields) if(validUrl(card.dataset?.[key])) return card.dataset[key];
    const a=card.querySelector("a[href*='.pdf'],a[href*='contract'],a[href*='storage']"); return validUrl(a?.href)?a.href:"";
  }
  function addDownload(card){
    if(card.querySelector("[data-action='download-contract'],.download-contract"))return;
    const url=contractUrl(card); if(!url)return;
    const a=document.createElement("a");a.className="btn primary download-contract";a.dataset.action="download-contract";a.href=url;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Baixar contrato";
    (card.querySelector(".contract-actions,.reservation-actions,.modal-actions,.actions")||card).prepend(a);
  }
  function repair(root=document){
    root.querySelectorAll?.(LINK).forEach(i=>{enableLink(i);syncFinish(i);});
    if(root.matches?.(CARD))addDownload(root);
    root.querySelectorAll?.(CARD).forEach(addDownload);
  }
  function idOf(button){const c=cardOf(button);return button.dataset.reservationId||button.dataset.requestId||button.dataset.id||c?.dataset.reservationId||c?.dataset.requestId||c?.dataset.id||"";}
  function client(){return [window.supabaseClient,window.supabaseClientInstance,window.sb,window.client].find(x=>x&&typeof x.from==="function");}
  async function existingCancel(id,button){for(const n of ["cancelReservation","cancelFleetReservation","cancelRequest","cancelBooking","cancelLoanRequest"]){if(typeof window[n]==="function"){await window[n](id,button);return true;}}return false;}
  async function fallbackCancel(id,button){
    const db=client(), c=cardOf(button), table=button.dataset.table||c?.dataset.table||window.FLEET_RESERVATIONS_TABLE, status=button.dataset.cancelStatus||window.FLEET_CANCELLED_STATUS||"cancelled";
    if(!db||!table)return false;
    const {error}=await db.from(table).update({status}).eq("id",id);if(error)throw error;return true;
  }
  async function cancel(button){
    const id=idOf(button);if(!id)throw new Error("ID da reserva não encontrado no botão/cartão.");
    if(!confirm("Deseja realmente cancelar esta reserva?")||cancelling)return;
    cancelling=true;const old=button.textContent;button.disabled=true;button.textContent="Cancelando...";
    try{const ok=await existingCancel(id,button)||await fallbackCancel(id,button);if(!ok)throw new Error("Configure FLEET_RESERVATIONS_TABLE no config.js.");cardOf(button)?.remove();notify("Reserva cancelada com sucesso.","success");window.dispatchEvent(new CustomEvent("fleet:reservation-cancelled",{detail:{id}}));}
    catch(e){console.error(e);button.disabled=false;button.textContent=old;notify(e.message||"Não foi possível cancelar.","error");}
    finally{cancelling=false;}
  }
  document.addEventListener("input",e=>{if(e.target.matches?.(LINK))syncFinish(e.target);});
  document.addEventListener("click",e=>{const b=e.target.closest?.(CANCEL)||((e.target.closest?.("button")&&/cancelar\s+reserva/i.test(e.target.closest("button").textContent))?e.target.closest("button"):null);if(!b)return;e.preventDefault();e.stopImmediatePropagation();cancel(b);},true);
  const observer=new MutationObserver(rs=>rs.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)repair(n);}))); 
  const init=()=>{repair();observer.observe(document.body,{childList:true,subtree:true});};
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();
