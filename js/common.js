const $=id=>document.getElementById(id);const clean=v=>String(v??'').trim();const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate=v=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'-';
const statusLabel={pending:'Pendente',approved:'Aprovada',rejected:'Rejeitada',cancelled:'Cancelada',completed:'Concluída'};
function toast(msg){const e=$('toast');e.textContent=msg;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3000)}
function initTheme(){document.documentElement.dataset.theme=localStorage.getItem('fleetTheme')||'dark'}
function toggleTheme(){const n=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=n;localStorage.setItem('fleetTheme',n)}
function getClient(){const c=window.APP_CONFIG||{};if(!c.SUPABASE_URL||c.SUPABASE_URL.includes('SEU-PROJETO'))throw Error('Configure js/config.js com a URL e a chave publicável do Supabase.');return supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY)}
initTheme();
