const $=id=>document.getElementById(id),clean=v=>String(v??'').trim(),esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c])),fmtDate=v=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'-';
const statusLabel={pending:'Pendente',approved:'Aprovada',rejected:'Rejeitada',cancelled:'Cancelada',completed:'Concluída'};
function toast(m){const e=$('toast');if(!e)return;e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3000)}
function applyTheme(t){document.documentElement.dataset.theme=t;localStorage.setItem('fleetTheme',t);if($('themeText'))$('themeText').textContent=t==='dark'?'Tema claro':'Tema escuro';if($('themeMeta'))$('themeMeta').content=t==='dark'?'#07111f':'#f4f8fc'}
function toggleTheme(){applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')}
function getClient(){const c=window.APP_CONFIG||{};if(!c.SUPABASE_URL||c.SUPABASE_URL.includes('SEU-PROJETO'))throw Error('Configure js/config.js.');return supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY)}
applyTheme(localStorage.getItem('fleetTheme')||'dark');
document.addEventListener('click',event=>{const button=event.target.closest('[data-close]');if(!button)return;const target=$(button.dataset.close);if(target){event.preventDefault();event.stopPropagation();target.classList.add('hidden');document.body.style.overflow=''}});

function loadCss(href){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link)}
function loadScript(src){const script=document.createElement('script');script.src=src;script.defer=true;document.head.appendChild(script)}

// Recursos já existentes nas versões anteriores.
loadCss('css/modal-card-fix.css?v=8.0');
loadScript('js/modal-card-fix.js?v=8.0');
loadScript('js/upcoming-reservations-fix.js?v=8.0');

// Projeto somente visual no formulário público.
loadCss('css/project-readonly.css?v=8.0');
loadScript('js/project-readonly.js?v=8.0');
