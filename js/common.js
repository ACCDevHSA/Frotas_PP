const $=id=>document.getElementById(id),clean=v=>String(v??'').trim(),esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c])),fmtDate=v=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'-';
const statusLabel={pending:'Pendente',approved:'Aprovada',rejected:'Rejeitada',cancelled:'Cancelada',completed:'Concluída'};
function toast(m){const e=$('toast');if(!e)return;e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3000)}
function applyTheme(t){document.documentElement.dataset.theme=t;localStorage.setItem('fleetTheme',t);if($('themeText'))$('themeText').textContent=t==='dark'?'Tema claro':'Tema escuro';if($('themeMeta'))$('themeMeta').content=t==='dark'?'#07111f':'#f4f8fc'}
function toggleTheme(){applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')}
function getClient(){const c=window.APP_CONFIG||{};if(!c.SUPABASE_URL||c.SUPABASE_URL.includes('SEU-PROJETO'))throw Error('Configure js/config.js.');return supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY)}
applyTheme(localStorage.getItem('fleetTheme')||'dark');
// Fechamento genérico para todos os modais.
document.addEventListener('click',event=>{const button=event.target.closest('[data-close]');if(!button)return;const target=$(button.dataset.close);if(target){event.preventDefault();event.stopPropagation();target.classList.add('hidden');document.body.style.overflow=''}});
// Carrega a correção visual isolada, sem exigir alteração do index.html.
const fixCss=document.createElement('link');fixCss.rel='stylesheet';fixCss.href='css/modal-card-fix.css?v=4.1';document.head.appendChild(fixCss);
const fixScript=document.createElement('script');fixScript.src='js/modal-card-fix.js?v=4.1';fixScript.defer=true;document.head.appendChild(fixScript);
