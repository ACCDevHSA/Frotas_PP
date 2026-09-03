"use strict";

/* Fleet Management - upgrade visual da vistoria
   Dependencias: index.html atual, app.js atual e Three.js carregado por este arquivo.
*/
(() => {
  const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.min.js";
  const PARTS = [
    { id: "front_bumper", label: "Para-choque dianteiro", position: [0, 0.62, 2.35] },
    { id: "hood", label: "Capo", position: [0, 1.02, 1.58] },
    { id: "windshield", label: "Para-brisa", position: [0, 1.35, 0.62] },
    { id: "roof", label: "Teto", position: [0, 1.65, -0.08] },
    { id: "rear_glass", label: "Vidro traseiro", position: [0, 1.30, -0.82] },
    { id: "rear_bumper", label: "Para-choque traseiro", position: [0, 0.62, -2.30] },
    { id: "left_front_door", label: "Porta dianteira esquerda", position: [-1.05, 0.92, 0.45] },
    { id: "left_rear_door", label: "Porta traseira esquerda", position: [-1.05, 0.92, -0.65] },
    { id: "right_front_door", label: "Porta dianteira direita", position: [1.05, 0.92, 0.45] },
    { id: "right_rear_door", label: "Porta traseira direita", position: [1.05, 0.92, -0.65] },
    { id: "left_front_wheel", label: "Roda dianteira esquerda", position: [-1.12, 0.43, 1.35] },
    { id: "left_rear_wheel", label: "Roda traseira esquerda", position: [-1.12, 0.43, -1.35] },
    { id: "right_front_wheel", label: "Roda dianteira direita", position: [1.12, 0.43, 1.35] },
    { id: "right_rear_wheel", label: "Roda traseira direita", position: [1.12, 0.43, -1.35] }
  ];

  let scene;
  let camera;
  let renderer;
  let car;
  let raycaster;
  let pointer;
  let hotspots = [];
  let stage;
  let tooltip;
  let editor;
  let activeHotspot = null;
  let dragging = false;
  let previousX = 0;
  let yaw = -0.55;
  let resizeObserver;

  function injectStyles() {
    const style = document.createElement("style");
    style.id = "inspection3dStyles";
    style.textContent = `
      #carStage.inspection-3d-stage{position:relative;height:390px;min-height:320px;padding:0;overflow:hidden;border:1px solid var(--line);border-radius:16px;background:radial-gradient(circle at 50% 32%,#36506d 0,#13243a 48%,#07111f 100%);cursor:grab;touch-action:none}
      #carStage.inspection-3d-stage:active{cursor:grabbing}
      #carStage canvas{display:block;width:100%;height:100%;outline:none}
      .car-orientation{position:absolute;inset:12px 12px auto 12px;z-index:3;display:flex;justify-content:space-between;pointer-events:none;color:#d9e7f5;font-size:11px;font-weight:800;letter-spacing:.1em;text-shadow:0 2px 5px #000}
      .car-orientation span{padding:6px 8px;border:1px solid #ffffff30;border-radius:999px;background:#07111faa;backdrop-filter:blur(6px)}
      .damage-hover-tip{position:absolute;z-index:7;max-width:220px;padding:7px 9px;border:1px solid #9bd8ff;border-radius:8px;background:#fff8c9;color:#1b2735;font:12px/1.25 Segoe UI,Arial,sans-serif;box-shadow:0 7px 22px #0007;pointer-events:none;transform:translate(12px,-110%)}
      .damage-comment{position:absolute;z-index:8;width:min(290px,calc(100% - 24px));padding:12px;border:1px solid #6fbef9;border-radius:12px;background:var(--surface);box-shadow:0 14px 35px #0009;transform:translate(12px,-105%)}
      .damage-comment::after{content:"";position:absolute;left:-7px;bottom:10px;width:12px;height:12px;transform:rotate(45deg);border-left:1px solid #6fbef9;border-bottom:1px solid #6fbef9;background:var(--surface)}
      .damage-comment strong{display:block;margin-bottom:7px;color:var(--teal)}
      .damage-comment textarea{min-height:72px;margin-bottom:8px}
      .damage-comment-actions{display:flex;justify-content:flex-end;gap:7px}
      .inspection-signatures{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:3px}
      .signature-preview{min-height:74px;padding:32px 10px 8px;border:1px dashed var(--line);border-radius:10px;color:var(--muted);text-align:center;font-size:12px;background:var(--bg)}
      .signature-preview::before{content:"";display:block;border-top:1px solid var(--muted);margin-bottom:6px}
      .inspection-print-button{margin-right:auto}
      @media(max-width:760px){#carStage.inspection-3d-stage{height:310px}.inspection-signatures{grid-template-columns:1fr}.damage-comment{transform:none;left:12px!important;top:12px!important}}
      @media print{body>*{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function loadThree() {
    if (window.THREE) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = THREE_URL;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Nao foi possivel carregar o motor 3D."));
      document.head.appendChild(script);
    });
  }

  function material(color, metalness = 0.35, roughness = 0.42) {
    return new THREE.MeshStandardMaterial({ color, metalness, roughness });
  }

  function box(name, size, position, color, rotation = [0, 0, 0], bevel = false) {
    const geometry = new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(geometry, material(color));
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function wheel(x, z) {
    const group = new THREE.Group();
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.30, 32),
      material(0x101318, 0.1, 0.82)
    );
    tire.rotation.z = Math.PI / 2;
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.315, 12),
      material(0xb9c4cf, 0.8, 0.22)
    );
    rim.rotation.z = Math.PI / 2;
    group.add(tire, rim);
    group.position.set(x, 0.43, z);
    return group;
  }

  function buildCar() {
    const group = new THREE.Group();
    group.name = "sedan-generico";

    const paint = 0x2476b9;
    const darkPaint = 0x175687;
    const glass = new THREE.MeshStandardMaterial({ color: 0x7fc7e8, transparent: true, opacity: 0.62, metalness: 0.15, roughness: 0.12 });

    group.add(box("carroceria", [2.0, 0.58, 4.25], [0, 0.78, 0], paint));
    group.add(box("saia", [2.08, 0.18, 3.72], [0, 0.45, 0], darkPaint));
    group.add(box("capo", [1.86, 0.17, 1.30], [0, 1.10, 1.39], paint, [-0.045, 0, 0]));
    group.add(box("porta-malas", [1.85, 0.18, 0.90], [0, 1.06, -1.67], paint, [0.035, 0, 0]));

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.83, 1.92), glass);
    cabin.position.set(0, 1.42, -0.20);
    cabin.scale.set(0.94, 1, 1);
    cabin.rotation.x = 0.01;
    cabin.castShadow = true;
    group.add(cabin);

    group.add(box("pilar-frontal", [1.86, 0.06, 0.09], [0, 1.42, 0.76], 0x142839, [-0.55, 0, 0]));
    group.add(box("pilar-traseiro", [1.86, 0.06, 0.09], [0, 1.39, -1.08], 0x142839, [0.60, 0, 0]));
    group.add(box("grade-dianteira", [1.15, 0.20, 0.06], [0, 0.70, 2.16], 0x101820));
    group.add(box("entrada-ar", [1.46, 0.10, 0.06], [0, 0.51, 2.18], 0x091017));

    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xdff5ff, emissive: 0x93dfff, emissiveIntensity: 1.3 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff263d, emissive: 0xff1028, emissiveIntensity: 1.15 });
    [-0.67, 0.67].forEach((x) => {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.15, 0.07), headlightMat);
      head.position.set(x, 0.89, 2.16);
      group.add(head);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.07), tailMat);
      tail.position.set(x, 0.88, -2.16);
      group.add(tail);
    });

    [-1.05, 1.05].forEach((x) => {
      [1.35, -1.35].forEach((z) => group.add(wheel(x, z)));
    });

    const mirrorLeft = box("retrovisor-esquerdo", [0.28, 0.16, 0.32], [-1.12, 1.30, 0.55], paint);
    const mirrorRight = box("retrovisor-direito", [0.28, 0.16, 0.32], [1.12, 1.30, 0.55], paint);
    group.add(mirrorLeft, mirrorRight);

    const plateFront = box("placa-frontal", [0.72, 0.18, 0.035], [0, 0.63, 2.205], 0xe9edf0);
    const plateRear = box("placa-traseira", [0.72, 0.18, 0.035], [0, 0.70, -2.205], 0xe9edf0);
    group.add(plateFront, plateRear);

    PARTS.forEach((part) => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.105, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0xff5168, emissive: 0x7e081b, emissiveIntensity: 0.65 })
      );
      dot.position.set(...part.position);
      dot.userData = part;
      dot.name = `hotspot-${part.id}`;
      group.add(dot);
      hotspots.push(dot);
    });

    return group;
  }

  function setup3D() {
    stage = document.getElementById("carStage");
    if (!stage || stage.dataset.upgraded === "true") return;
    stage.dataset.upgraded = "true";
    stage.className = "inspection-3d-stage";
    stage.innerHTML = '<div class="car-orientation"><span>TRASEIRA - lanternas vermelhas</span><span>FRENTE - farois e grade</span></div>';

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(6.2, 3.7, 6.7);
    camera.lookAt(0, 0.85, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    stage.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xd8edff, 0x182638, 2.15));
    const key = new THREE.DirectionalLight(0xffffff, 3.4);
    key.position.set(5, 8, 6);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x6db7ff, 1.7);
    fill.position.set(-5, 3, -5);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(5.2, 64),
      new THREE.MeshStandardMaterial({ color: 0x17283b, roughness: 0.93, metalness: 0.08 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    car = buildCar();
    car.rotation.y = yaw;
    scene.add(car);
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    tooltip = document.createElement("div");
    tooltip.className = "damage-hover-tip hidden";
    stage.appendChild(tooltip);

    editor = document.createElement("div");
    editor.className = "damage-comment hidden";
    editor.innerHTML = `
      <strong id="floatingDamagePart"></strong>
      <textarea id="floatingDamageText" placeholder="Descreva a avaria observada"></textarea>
      <div class="damage-comment-actions">
        <button type="button" class="btn small" id="cancelFloatingDamage">Cancelar</button>
        <button type="button" class="btn small primary" id="saveFloatingDamage">Salvar avaria</button>
      </div>`;
    stage.appendChild(editor);

    editor.querySelector("#cancelFloatingDamage").addEventListener("click", closeEditor);
    editor.querySelector("#saveFloatingDamage").addEventListener("click", saveDamage);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", () => {
      dragging = false;
      tooltip.classList.add("hidden");
    });
    renderer.domElement.addEventListener("click", onClick);

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resize();
    animate();
  }

  function resize() {
    if (!stage || !renderer || !camera) return;
    const width = Math.max(stage.clientWidth, 300);
    const height = Math.max(stage.clientHeight, 260);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    if (!renderer) return;
    requestAnimationFrame(animate);
    car.rotation.y += (yaw - car.rotation.y) * 0.16;
    hotspots.forEach((spot) => {
      const scale = activeHotspot === spot ? 1.35 : 1 + Math.sin(performance.now() / 320) * 0.08;
      spot.scale.setScalar(scale);
    });
    renderer.render(scene, camera);
  }

  function eventPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return { rect, hits: raycaster.intersectObjects(hotspots, false) };
  }

  function onPointerDown(event) {
    event.stopPropagation();
    dragging = true;
    previousX = event.clientX;
    renderer.domElement.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    event.stopPropagation();
    const { rect, hits } = eventPointer(event);
    if (dragging && Math.abs(event.clientX - previousX) > 1) {
      yaw += (event.clientX - previousX) * 0.012;
      previousX = event.clientX;
      tooltip.classList.add("hidden");
      return;
    }
    if (hits.length) {
      const spot = hits[0].object;
      tooltip.textContent = spot.userData.label;
      tooltip.style.left = `${event.clientX - rect.left}px`;
      tooltip.style.top = `${event.clientY - rect.top}px`;
      tooltip.classList.remove("hidden");
      renderer.domElement.style.cursor = "pointer";
    } else {
      tooltip.classList.add("hidden");
      renderer.domElement.style.cursor = dragging ? "grabbing" : "grab";
    }
  }

  function onPointerUp(event) {
    event?.stopPropagation();
    dragging = false;
  }

  function onClick(event) {
    event.stopPropagation();
    const { rect, hits } = eventPointer(event);
    if (!hits.length) return;
    activeHotspot = hits[0].object;
    const x = Math.min(event.clientX - rect.left, rect.width - 310);
    const y = Math.max(event.clientY - rect.top, 120);
    editor.style.left = `${Math.max(8, x)}px`;
    editor.style.top = `${Math.max(110, y)}px`;
    editor.querySelector("#floatingDamagePart").textContent = activeHotspot.userData.label;
    editor.querySelector("#floatingDamageText").value = "";
    editor.classList.remove("hidden");
    editor.querySelector("#floatingDamageText").focus();
  }

  function closeEditor() {
    editor?.classList.add("hidden");
    activeHotspot = null;
  }

  function saveDamage() {
    if (!activeHotspot) return;
    const text = editor.querySelector("#floatingDamageText").value.trim();
    if (!text) {
      window.alert("Descreva a avaria antes de salvar.");
      return;
    }

    const part = activeHotspot.userData.label;
    const legacyEditor = document.getElementById("damageEditor");
    const legacyDescription = document.getElementById("damageDescription");
    const legacyAdd = document.getElementById("addDamage");
    if (legacyEditor && legacyDescription && legacyAdd) {
      legacyEditor.dataset.part = part;
      legacyDescription.value = text;
      legacyAdd.click();
    }

    const notes = document.querySelector('#inspectionForm [name="vehicle_notes"]');
    if (notes) {
      const line = `[AVARIA - ${part}] ${text}`;
      notes.value = notes.value.trim() ? `${notes.value.trim()}\n${line}` : line;
      notes.dispatchEvent(new Event("input", { bubbles: true }));
    }

    activeHotspot.material.color.set(0xffc247);
    activeHotspot.material.emissive.set(0x7b4200);
    closeEditor();
  }

  function addSignatures() {
    const form = document.getElementById("inspectionForm");
    if (!form || form.querySelector(".inspection-signatures")) return;
    const grid = form.querySelector(".form-grid");
    if (!grid) return;
    const signatures = document.createElement("div");
    signatures.className = "inspection-signatures";
    signatures.innerHTML = `
      <div class="signature-preview">Assinatura de quem utilizara/utilizou o veiculo</div>
      <div class="signature-preview">Assinatura de quem realizou a vistoria</div>`;
    grid.appendChild(signatures);
  }

  function textFrom(selector) {
    return document.querySelector(selector)?.value?.trim() || "-";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function printChecklist() {
    const title = document.getElementById("inspectionTitle")?.textContent || "Checklist de Vistoria";
    const vehicle = document.getElementById("inspectionVehicle")?.textContent || "-";
    const notes = textFrom('#inspectionForm [name="vehicle_notes"]');
    const damageItems = [...document.querySelectorAll("#damageList .damage-item")]
      .map((item) => `<li>${escapeHtml(item.innerText.replace(/Remover/g, "").trim())}</li>`)
      .join("");
    const snapshot = renderer ? renderer.domElement.toDataURL("image/png") : "";
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
      window.alert("Permita pop-ups para gerar o PDF ou imprimir o checklist.");
      return;
    }

    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>
        @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#182433;margin:0}h1{font-size:21px;margin:0 0 4px}h2{font-size:14px;margin:20px 0 8px;border-bottom:2px solid #1a7ca8;padding-bottom:5px}.header{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #1a7ca8;padding-bottom:10px}.brand{font-weight:800;color:#1a7ca8}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.field{padding:9px;border:1px solid #cbd5df;border-radius:6px}.field b{display:block;font-size:10px;color:#607386;margin-bottom:4px;text-transform:uppercase}.car{display:block;width:100%;max-height:245px;object-fit:contain;background:#eef5fa;border:1px solid #cbd5df;border-radius:8px}.notes{white-space:pre-wrap;min-height:80px;padding:10px;border:1px solid #cbd5df}.damages{padding-left:20px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:46px}.signature{padding-top:7px;border-top:1px solid #1c2732;text-align:center}.footer{margin-top:22px;font-size:9px;color:#667789;text-align:center}.actions{margin:0 0 18px;text-align:right}.actions button{padding:9px 15px;border:0;border-radius:6px;background:#147ba8;color:#fff;font-weight:bold}@media print{.actions{display:none}}
      </style></head><body>
      <div class="actions"><button onclick="window.print()">Imprimir / Salvar como PDF</button></div>
      <div class="header"><div><div class="brand">FLEET MANAGEMENT</div><h1>${escapeHtml(title)}</h1><div>${escapeHtml(vehicle)}</div></div><div>Gerado em ${new Date().toLocaleString("pt-BR")}</div></div>
      <div class="meta">
        <div class="field"><b>KM atual</b>${escapeHtml(textFrom('#inspectionForm [name="odometer_km"]'))}</div>
        <div class="field"><b>Data e hora</b>${escapeHtml(textFrom('#inspectionForm [name="inspection_date"]'))} - ${escapeHtml(textFrom('#inspectionForm [name="inspection_time"]'))}</div>
        <div class="field"><b>Quem utilizara/utilizou o veiculo</b>${escapeHtml(textFrom('#inspectionForm [name="driver_name"]'))}</div>
        <div class="field"><b>Quem realizou a vistoria</b>${escapeHtml(textFrom('#inspectionForm [name="inspector_name"]'))}</div>
      </div>
      <h2>Mapa tridimensional de avarias</h2>
      ${snapshot ? `<img class="car" src="${snapshot}" alt="Vista 3D do veiculo">` : ""}
      <h2>Observacoes do veiculo</h2><div class="notes">${escapeHtml(notes)}</div>
      <h2>Avarias registradas</h2><ul class="damages">${damageItems || "<li>Nenhuma avaria registrada.</li>"}</ul>
      <div class="signatures"><div class="signature">Assinatura de quem utilizara/utilizou o veiculo</div><div class="signature">Assinatura de quem realizou a vistoria</div></div>
      <div class="footer">Checklist gerado pelo Fleet Management. Use a opcao Salvar como PDF na caixa de impressao.</div>
      <script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));<\/script>
      </body></html>`);
    popup.document.close();
  }

  function addPrintButton() {
    const form = document.getElementById("inspectionForm");
    const actions = form?.querySelector(".modal-actions");
    if (!actions || actions.querySelector(".inspection-print-button")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn inspection-print-button";
    button.textContent = "Gerar PDF / Imprimir";
    button.addEventListener("click", printChecklist);
    actions.prepend(button);
  }

  async function init() {
    injectStyles();
    addSignatures();
    addPrintButton();
    try {
      await loadThree();
      setup3D();
    } catch (error) {
      console.error(error);
      const currentStage = document.getElementById("carStage");
      if (currentStage) currentStage.innerHTML = '<div class="empty">Visualizador 3D indisponivel. Verifique se o CDN do Three.js esta liberado.</div>';
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
