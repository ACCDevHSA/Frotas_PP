"use strict";
(() => {
  if(!window.APP_CONFIG||!window.supabase)return;
  const db=window.supabase.createClient(APP_CONFIG.SUPABASE_URL,APP_CONFIG.SUPABASE_ANON_KEY);
  const tokens=()=>{try{return JSON.parse(localStorage.getItem("fleetRequestTokens")||"[]")}catch{return[]}};
  async function approved(){for(const token of tokens()){const {data}=await db.rpc("track_fleet_request",{p_token:token});const row=Array.isArray(data)?data[0]:data;if(row?.status==="approved")return row}return null}
  async function choose(e){const b=e.target.closest(".contract-download-button,#downloadContract");if(!b)return;e.preventDefault();e.stopImmediatePropagation();const row=await approved();if(!row)return alert("Contrato disponível apenas no navegador solicitante.");const choice=prompt("Escolha o formato:\n1 - Word (.doc)\n2 - PDF\n3 - Visualizar","1");try{if(choice==="1")FleetContract.word(row);else if(choice==="2")FleetContract.pdf(row);else if(choice==="3")FleetContract.preview(row)}catch(err){alert(err.message)}}
  document.addEventListener("click",choose,true);
})();
