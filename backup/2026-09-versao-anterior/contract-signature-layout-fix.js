"use strict";

/*
 * Fleet Management - layout final das assinaturas do contrato
 * Carregar por ultimo, depois de contract-legal-upgrade.js.
 * Aplica o mesmo formato ao contrato baixado pelo card e pelo popup.
 */
(() => {
  if (window.__fleetSignatureLayoutFixInstalled) return;
  window.__fleetSignatureLayoutFixInstalled = true;

  const NativeBlob = window.Blob;

  const signatureStyle = `
    <style id="fleet-contract-signature-layout">
      .signatures {
        display: block !important;
        margin-top: 64px !important;
        page-break-inside: avoid !important;
      }

      .signatures > div {
        display: block !important;
        margin: 0 0 18px 0 !important;
      }

      .signature-party {
        display: block !important;
        margin: 0 !important;
        padding: 5px 0 0 0 !important;
        border-top: 1px solid #111 !important;
        text-align: left !important;
        font-weight: 700 !important;
        line-height: 1.2 !important;
      }

      .signature-line {
        display: block !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        text-align: left !important;
        font-weight: 400 !important;
        line-height: 1.2 !important;
      }
    </style>
  `;

  function isContractHtml(parts, options) {
    const type = String(options?.type || "").toLowerCase();
    if (!type.includes("application/msword") && !type.includes("text/html")) return false;
    return parts.some((part) =>
      typeof part === "string" &&
      part.includes("CONTRATO DE COMODATO") &&
      part.includes('class="signatures"')
    );
  }

  function applySignatureLayout(html) {
    if (html.includes('id="fleet-contract-signature-layout"')) return html;

    const normalized = html
      .replace(/<div class="signature-party">\s*COMODATÁRIO\s*<\/div>/i,
        '<div class="signature-party">COMODATÁRIO</div>')
      .replace(/<div class="signature-party">\s*COMODANTE\s*<\/div>/i,
        '<div class="signature-party">COMODANTE</div>')
      .replace(/<div class="signature-line">\s*Assinatura:?\s*<\/div>/gi,
        '<div class="signature-line">Assinatura:</div>');

    return normalized.includes("</head>")
      ? normalized.replace("</head>", `${signatureStyle}</head>`)
      : `${signatureStyle}${normalized}`;
  }

  window.Blob = function FleetContractBlob(parts = [], options = {}) {
    const nextParts = isContractHtml(parts, options)
      ? parts.map((part) => typeof part === "string" ? applySignatureLayout(part) : part)
      : parts;

    return new NativeBlob(nextParts, options);
  };

  window.Blob.prototype = NativeBlob.prototype;
  Object.setPrototypeOf(window.Blob, NativeBlob);
})();
