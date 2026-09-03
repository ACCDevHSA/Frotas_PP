"use strict";

/* Carregar depois de reservation-contract-upgrade.js.
   Substitui o download simples pelo contrato corporativo completo.
   CPF e CNH sao obtidos somente via tracking_token armazenado no navegador solicitante.
*/
(() => {
  if (!window.APP_CONFIG || !window.supabase) return;

  const client = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

  const escapeHtml = (value) => String(value ?? "-").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  const formatDate = (value) => value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
    : "-";

  function toast(message) {
    const element = document.getElementById("toast");
    if (!element) return window.alert(message);
    element.textContent = message;
    element.classList.add("show");
    window.setTimeout(() => element.classList.remove("show"), 4000);
  }

  function tokens() {
    try {
      return JSON.parse(localStorage.getItem("fleetRequestTokens") || "[]");
    } catch {
      return [];
    }
  }

  async function trackedApprovedRequests() {
    const values = [];
    for (const token of tokens()) {
      const { data, error } = await client.rpc("track_fleet_request", { p_token: token });
      if (error) continue;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.status === "approved") values.push({ ...row, token });
    }
    return values;
  }

  function cardMatches(card, request) {
    const text = card.innerText || "";
    return text.includes(request.plate || "") &&
      text.includes(request.requester_name || "") &&
      text.includes(formatDate(request.start_date));
  }

  async function bindSecureButtons() {
    const approved = await trackedApprovedRequests();
    const cards = [...document.querySelectorAll("#reservationGrid .reservation-card")];

    cards.forEach((card) => {
      const button = card.querySelector(".contract-download-button");
      if (!button) return;
      const request = approved.find((item) => cardMatches(card, item));

      if (request) {
        button.dataset.trackingToken = request.token;
        button.disabled = false;
        button.title = "Baixar contrato desta solicitação";
      } else {
        button.removeAttribute("data-tracking-token");
        button.disabled = true;
        button.title = "O contrato só pode ser baixado no navegador que realizou a solicitação.";
        button.textContent = "Contrato disponível ao solicitante";
      }
    });
  }

  function contractHtml(data) {
    const vehicle = [data.model, data.version].filter(Boolean).join(" ");
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato de Comodato</title>
<style>
@page{size:A4;margin:18mm}body{font:12pt Arial,sans-serif;color:#111;line-height:1.45;margin:0}h1{text-align:center;font-size:16pt;margin:0 0 20px}h2{font-size:12pt;margin:22px 0 8px;text-transform:uppercase;border-bottom:1px solid #333;padding-bottom:4px}.box{border:1px solid #999;padding:10px 12px;margin:10px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:7px 18px}.field b{display:inline-block;min-width:92px}p{text-align:justify;margin:9px 0}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:45px;margin-top:70px;page-break-inside:avoid}.signature{border-top:1px solid #111;padding-top:7px;text-align:center}.signature small{display:block;margin-top:4px}.meta{text-align:right;font-size:9pt;color:#555;margin-bottom:14px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>
<div class="meta">Fleet Management - Contrato gerado em ${new Date().toLocaleString("pt-BR")}</div>
<h1>CONTRATO DE COMODATO DE VEÍCULO</h1>

<div class="box"><div class="grid">
<div class="field"><b>Comodatário:</b> ${escapeHtml(data.requester_name)}</div>
<div class="field"><b>CPF:</b> ${escapeHtml(data.requester_cpf)}</div>
<div class="field"><b>CNH:</b> ${escapeHtml(data.requester_cnh)}</div>
<div class="field"><b>Matrícula:</b> ${escapeHtml(data.employee_number)}</div>
<div class="field"><b>Departamento:</b> ${escapeHtml(data.department)}</div>
<div class="field"><b>Cargo:</b> ${escapeHtml(data.job_title)}</div>
<div class="field"><b>E-mail:</b> ${escapeHtml(data.requester_email)}</div>
<div class="field"><b>Projeto:</b> ${escapeHtml(data.project)}</div>
</div></div>

<p>Pelo presente instrumento particular, de um lado, figurando como <b>COMODANTE:</b></p>
<p><b>HONDA AUTOMÓVEIS DO BRASIL LTDA.</b>, com sede na Estrada Municipal Valêncio Calegari, 777, Distrito de Nova Veneza, Sumaré/SP, doravante denominada simplesmente HONDA; e, de outro lado, o usuário acima identificado, doravante simplesmente denominado <b>“COMODATÁRIO”</b>.</p>
<p>Pelo presente instrumento e na melhor forma de direito, firmam o presente <b>CONTRATO DE COMODATO</b> (“Contrato”), referente ao veículo:</p>

<div class="box"><div class="grid">
<div class="field"><b>Veículo:</b> ${escapeHtml(vehicle)}</div>
<div class="field"><b>Placa:</b> ${escapeHtml(data.plate)}</div>
<div class="field"><b>Chassi:</b> ${escapeHtml(data.chassis)}</div>
<div class="field"><b>Renavam:</b> ${escapeHtml(data.renavam)}</div>
<div class="field"><b>Período:</b> ${formatDate(data.start_date)} a ${formatDate(data.end_date)}</div>
<div class="field"><b>Finalidade:</b> ${escapeHtml(data.purpose)}</div>
</div></div>

<h2>Conservação e condições de uso e restituição do veículo</h2>
<p><b>2.</b> Para os efeitos deste instrumento, o COMODATÁRIO declara e reconhece receber o veículo acima identificado em perfeitas condições de uso, assumindo a condição de “fiel depositário”, sendo responsável direta e pessoalmente pela guarda, conservação e limpeza, ressalvada sua depreciação normal decorrente do uso, devendo restituí-lo imediatamente à HONDA quando findo ou rescindido este Contrato.</p>
<p><b>Parágrafo Primeiro.</b> Caso o veículo não seja restituído no prazo assinalado no caput desta cláusula, o COMODATÁRIO ficará sujeito às sanções disciplinares previstas na legislação vigente.</p>
<p><b>Parágrafo Segundo.</b> Em caso de sinistro assim considerado (extravio, roubo, furto, acidente etc.), a ocorrência deverá ser prontamente comunicada à HONDA, sendo que o COMODATÁRIO deverá ressarcir todo e qualquer dano caso tenha concorrido com dolo em sua ocorrência. O COMODATÁRIO assume, ainda, que responderá por todas as despesas não cobertas pelo seguro da HONDA, inclusive quanto ao pagamento da franquia do seguro.</p>
<p><b>Parágrafo Terceiro.</b> Para todos os fins contratuais, o veículo será avaliado conforme valor divulgado na tabela FIPE do mês vigente à eventual ocorrência.</p>
<p><b>Parágrafo Quarto.</b> O COMODATÁRIO obriga-se a não efetuar qualquer reparo ou substituição de peças, salvo mediante prévia autorização da HONDA.</p>
<p><b>Parágrafo Quinto.</b> O COMODATÁRIO obriga-se a comunicar à HONDA a existência de possíveis falhas de funcionamento do Bem.</p>
<p><b>Parágrafo Sexto.</b> O COMODATÁRIO fica expressamente proibido de emprestar o veículo a terceiros.</p>

<h2>Obrigações do Comodatário</h2>
<p><b>3.</b> Enquanto vigente o presente Contrato, obriga-se o COMODATÁRIO a zelar pela guarda do veículo e a mantê-lo em perfeitas condições de operação, como se seu fosse, comprometendo-se a devolvê-lo nas mesmas condições em que o recebeu, ressalvados, tão somente, o desgaste e a desvalia gerados pela sua regular e normal utilização.</p>
<p><b>4.2.</b> O COMODATÁRIO compromete-se a avisar a HONDA imediatamente sobre eventuais necessidades de substituição e/ou reparos do Bem.</p>
<p><b>4.3.</b> O COMODATÁRIO compromete-se a obedecer e respeitar todas as normas e preceitos das leis e autoridades de trânsito, ficando exclusivamente responsável pelo uso dos equipamentos de segurança obrigatórios, por qualquer infração cometida no período do presente instrumento contratual, bem como por eventuais acidentes e danos causados a terceiros, isentando a HONDA de toda e qualquer ocorrência para a qual tenha concorrido com dolo.</p>
<p><b>4.4.</b> Ao COMODATÁRIO é proibido realizar quaisquer alterações ou modificações que alterem a configuração original do veículo.</p>
<p><b>4.5.</b> O COMODATÁRIO, ao firmar o presente termo, declara ter lido e manifesta expressa concordância com a Norma Interna referente às regras e condições para utilização do veículo da frota de Planejamento de Produto.</p>

<h2>Confidencialidade</h2>
<p><b>5.</b> O COMODATÁRIO obriga-se a manter o mais completo e absoluto sigilo sobre os termos e condições do presente Contrato de Comodato, não divulgando, revelando ou reproduzindo seus termos a terceiros por qualquer meio, pessoal, virtual ou de qualquer outra natureza.</p>

<h2>Disposições finais</h2>
<p><b>6.</b> As Partes têm plena ciência de que o presente instrumento é firmado única e exclusivamente para resguardo de direitos de natureza civil, restando a HONDA completamente isenta de qualquer responsabilidade decorrente de seu uso, civil, trabalhista, criminal ou de outra natureza, sendo, ainda, o COMODATÁRIO o único responsável por eventual infração de trânsito que venha a sofrer durante sua vigência.</p>
<p><b>7.</b> Ao assinar o presente Contrato de Comodato, o COMODATÁRIO declara estar ciente das condições vigentes na norma de uso de frota do DAS, cabendo ao COMODATÁRIO verificar a norma vigente na Intranet Honda, bem como das boas práticas dispostas na Norma Interna de utilização da frota de Planejamento de Produto, cabendo ao COMODATÁRIO verificar a norma vigente junto aos gestores de frota da área de Planejamento de Produto.</p>

<h2>Foro</h2>
<p><b>8.</b> As Partes elegem o Foro da Comarca de Sumaré (SP) para dirimir eventuais controvérsias oriundas desta relação, com expressa renúncia a qualquer outro, por mais privilegiado que seja.</p>

<p style="margin-top:28px">Sumaré, ______ de ____________________ de ______.</p>
<div class="signatures">
<div class="signature"><b>COMODATÁRIO</b><small>${escapeHtml(data.requester_name)}<br>CPF: ${escapeHtml(data.requester_cpf)}</small></div>
<div class="signature"><b>COMODANTE</b><small>HONDA AUTOMÓVEIS DO BRASIL LTDA.</small></div>
</div>
</body></html>`;
  }

  async function downloadByToken(token, button) {
    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = "Gerando contrato...";

    try {
      const { data, error } = await client.rpc("track_fleet_request", { p_token: token });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || row.status !== "approved") throw new Error("A solicitação ainda não está aprovada.");
      if (!row.requester_cpf || !row.requester_cnh) throw new Error("O usuário não possui CPF ou CNH no cadastro.");

      const blob = new Blob([contractHtml(row)], { type: "application/msword;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Contrato_Comodato_${String(row.plate || "veiculo").replace(/[^a-z0-9_-]/gi, "_")}_${row.start_date}.doc`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    } catch (error) {
      console.error(error);
      toast(error.message || "Não foi possível gerar o contrato.");
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".contract-download-button[data-tracking-token]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    downloadByToken(button.dataset.trackingToken, button);
  }, true);

  function init() {
    const grid = document.getElementById("reservationGrid");
    if (!grid) return;
    const observer = new MutationObserver(() => window.setTimeout(bindSecureButtons, 50));
    observer.observe(grid, { childList: true, subtree: true });
    window.setTimeout(bindSecureButtons, 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
