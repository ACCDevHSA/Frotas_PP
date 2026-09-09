"use strict";
(() => {
  if(!window.APP_CONFIG||!window.supabase)return;
  const db=window.supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY);
  async function open(id){const {data,error}=await db.rpc("admin_get_fleet_contract",{p_reservation_id:id});if(error)return alert(error.message);const row=Array.isArray(data)?data[0]:data;if(!row)return alert("Contrato não encontrado.");const choice=prompt("Contrato administrativo:\n1 - Visualizar\n2 - Word (.doc)\n3 - PDF","1");try{if(choice==="1")FleetContract.preview(row);else if(choice==="2")FleetContract.word(row);else if(choice==="3")FleetContract.pdf(row)}catch(e){alert(e.message)}}
  function add(){document.querySelectorAll("#requestsBody tr").forEach(tr=>{const action=tr.querySelector("td.actions");const any=action?.querySelector("[data-decision-id],[data-delete-id],[data-delete-reservation]");if(!action||!any||action.querySelector(".admin-contract-button"))return;const id=any.dataset.decisionId||any.dataset.deleteId||any.dataset.deleteReservation;const status=tr.querySelector(".badge")?.textContent?.trim().toLowerCase()||tr.cells[3]?.textContent.trim().toLowerCase();if(!["approved","aprovada","completed","concluída"].includes(status))return;const b=document.createElement("button");b.type="button";b.className="btn small admin-contract-button";b.textContent="Contrato";b.onclick=()=>open(id);action.prepend(b)})}
  const body=document.getElementById("requestsBody");if(body)new MutationObserver(add).observe(body,{childList:true,subtree:true});add();
})();
