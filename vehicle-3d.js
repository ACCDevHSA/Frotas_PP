/* PP Fleet System - visualizador 3D do checklist */
var activeInspectionView = 'left';
var inspection3D = null;

function inspectionCameraPreset(id) {
  return {
    left: [6.6, 2.55, 0],
    right: [-6.6, 2.55, 0],
    front: [0, 2.35, 6.6],
    rear: [0, 2.35, -6.6],
    top: [0, 8.8, 0.01]
  }[id] || [6.6, 2.55, 0];
}

function createSedanModel(THREE) {
  const car = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({color:0xf5f6f7, metalness:0.25, roughness:0.22, clearcoat:1, clearcoatRoughness:0.13});
  const paintDark = new THREE.MeshPhysicalMaterial({color:0xdfe3e6, metalness:0.2, roughness:0.28, clearcoat:0.8});
  const glass = new THREE.MeshPhysicalMaterial({color:0x314451, metalness:0.15, roughness:0.08, transmission:0.16, transparent:true, opacity:0.78});
  const rubber = new THREE.MeshStandardMaterial({color:0x111315, roughness:0.72, metalness:0.05});
  const black = new THREE.MeshStandardMaterial({color:0x15191d, roughness:0.3, metalness:0.35});
  const chrome = new THREE.MeshStandardMaterial({color:0xc8d0d5, roughness:0.16, metalness:0.9});
  const lamp = new THREE.MeshPhysicalMaterial({color:0xe7eef2, roughness:0.08, metalness:0.35, clearcoat:1});
  const tail = new THREE.MeshStandardMaterial({color:0xc8182d, emissive:0x350006, roughness:0.22});

  function roundedPart(name, scale, position, material, sphereScale, rotation) {
    const geo = new THREE.SphereGeometry(1, 48, 24);
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;
    mesh.scale.set(scale[0] * sphereScale, scale[1] * sphereScale, scale[2] * sphereScale);
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    car.add(mesh);
    return mesh;
  }
  function box(name, size, position, material, rotation, bevelScale) {
    const geo = new THREE.BoxGeometry(...size, 6, 3, 3);
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    if (bevelScale) mesh.scale.set(...bevelScale);
    mesh.castShadow = true;
    car.add(mesh);
    return mesh;
  }

  roundedPart('carroceria', [2.35,0.47,0.96], [0,-0.05,0], paint, 1);
  roundedPart('capo', [1.26,0.24,0.91], [1.35,0.38,0], paint, 1, [0,0,-0.03]);
  roundedPart('porta-malas', [0.92,0.25,0.9], [-1.69,0.34,0], paint, 1, [0,0,0.04]);
  roundedPart('teto', [1.38,0.55,0.79], [-0.26,0.88,0], glass, 1);
  box('painel-teto', [1.85,0.13,1.36], [-0.35,1.26,0], paint, [0,0,0.01]);

  // Para-brisa e vidro traseiro inclinados
  box('para-brisa', [0.72,0.08,1.42], [0.78,0.87,0], glass, [0,0,-0.63]);
  box('vidro-traseiro', [0.66,0.08,1.38], [-1.27,0.84,0], glass, [0,0,0.62]);

  // Colunas, linha de cintura e divisões de portas
  for (const z of [-0.93,0.93]) {
    box('saia-lateral', [3.55,0.13,0.08], [0,-0.52,z], black);
    box('friso-cromado', [2.55,0.035,0.035], [-0.2,0.71,z*0.995], chrome);
    box('coluna-b', [0.08,0.66,0.055], [-0.16,0.78,z*1.005], black, [0,0,0.02]);
    box('linha-porta', [0.035,0.78,0.035], [0.72,0.12,z*1.01], black);
    box('linha-porta', [0.035,0.76,0.035], [-0.9,0.1,z*1.01], black);
    // Maçanetas
    box('macaneta', [0.3,0.055,0.06], [0.5,0.25,z*1.035], chrome);
    box('macaneta', [0.3,0.055,0.06], [-0.82,0.25,z*1.035], chrome);
  }

  // Rodas com pneus e aros multirraios
  for (const x of [-1.38,1.38]) {
    for (const z of [-0.94,0.94]) {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.47,0.47,0.25,40), rubber);
      tire.rotation.x = Math.PI/2;
      tire.castShadow = true;
      wheel.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.31,0.31,0.265,32), chrome);
      rim.rotation.x = Math.PI/2;
      wheel.add(rim);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.28,20), black);
      hub.rotation.x = Math.PI/2;
      wheel.add(hub);
      for (let i=0;i<10;i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.235,0.035,0.025), black);
        spoke.position.z = z > 0 ? 0.142 : -0.142;
        spoke.rotation.z = i*Math.PI/5;
        wheel.add(spoke);
      }
      wheel.position.set(x,-0.43,z);
      car.add(wheel);
    }
  }

  // Frente próxima da referência: faróis estreitos e grade horizontal
  for (const z of [-0.58,0.58]) {
    box('farol', [0.12,0.24,0.62], [2.31,0.23,z], lamp, [0,0,-0.04]);
    box('lanterna', [0.12,0.28,0.5], [-2.3,0.26,z], tail, [0,0,0.05]);
    box('retrovisor', [0.36,0.18,0.2], [0.73,0.67,z>0?1.14:-1.14], paintDark);
  }
  box('grade-superior', [0.13,0.27,1.25], [2.35,0.06,0], black);
  box('grade-inferior', [0.12,0.27,1.05], [2.37,-0.31,0], black);
  for (let i=-4;i<=4;i++) box('grade-filete',[0.02,0.22,0.025],[2.425,0.05,i*0.13],chrome);
  box('para-choque-traseiro', [0.13,0.24,1.42], [-2.36,-0.25,0], black);
  box('placa-frontal', [0.055,0.24,0.55], [2.43,-0.02,0], new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.7}));
  box('placa-traseira', [0.055,0.24,0.55], [-2.43,-0.02,0], new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.7}));

  car.rotation.y = -Math.PI/2;
  return car;
}

function initInspection3D() {
  const stage = document.getElementById('inspection3DCanvas');
  if (!stage || !window.THREE) return;
  const THREE = window.THREE;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3f7f9);
  const camera = new THREE.PerspectiveCamera(31, stage.clientWidth/Math.max(1,stage.clientHeight), 0.1, 100);
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.className = 'inspection-3d-canvas';
  stage.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff,0x6c7b86,2.6));
  const key = new THREE.DirectionalLight(0xffffff,3.4); key.position.set(5,8,6); key.castShadow=true; scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfe8ff,1.6); fill.position.set(-5,4,-4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff,1.2); rim.position.set(0,3,-7); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:0xe4eaee,roughness:0.95}));
  floor.rotation.x=-Math.PI/2; floor.position.y=-0.91; floor.receiveShadow=true; scene.add(floor);
  const car=createSedanModel(THREE); scene.add(car);
  const target=new THREE.Vector3(0,0.18,0);

  function setView(id) {
    const p=inspectionCameraPreset(id);
    camera.position.set(...p); camera.lookAt(target);
    activeInspectionView=id;
    car.rotation.y = id==='left' ? -Math.PI/2 : id==='right' ? Math.PI/2 : id==='front' ? 0 : id==='rear' ? Math.PI : 0;
    document.querySelectorAll('.inspection-view-btn').forEach(b=>b.classList.toggle('active',b.dataset.inspectionView===id));
    const title=document.getElementById('inspectionViewTitle');
    if(title) title.textContent=(INSPECTION_VIEWS.find(v=>v.id===id)||{}).label||id;
    renderInspectionHotspots();
  }

  let dragging=false,lastX=0;
  renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;renderer.domElement.setPointerCapture(e.pointerId)});
  renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return;car.rotation.y+=(e.clientX-lastX)*0.012;lastX=e.clientX});
  renderer.domElement.addEventListener('pointerup',()=>dragging=false);
  renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
  renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();camera.position.multiplyScalar(e.deltaY>0?1.06:0.94);camera.position.clampLength(4.8,10);camera.lookAt(target)},{passive:false});

  function animate(){renderer.render(scene,camera);requestAnimationFrame(animate)}
  animate(); setView(activeInspectionView);
  const resizeObserver=new ResizeObserver(()=>{const w=stage.clientWidth,h=stage.clientHeight;camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();renderer.setSize(w,h)});
  resizeObserver.observe(stage);
  inspection3D={scene,camera,renderer,car,setView,stage,resizeObserver};
}

function renderInspectionHotspots() {
  const layer=document.getElementById('inspectionHotspots');
  const view=INSPECTION_VIEWS.find(v=>v.id===activeInspectionView);
  if(!layer||!view)return;
  layer.innerHTML=view.points.map(p=>`<button type="button" class="damage-dot ${inspectionMarks.some(m=>m.point_id===p[0])?'marked type-'+String((inspectionMarks.find(m=>m.point_id===p[0])||{}).damage_type||'A').toLowerCase():''}" style="left:${p[2]}%;top:${p[3]}%" data-inspection-point="${p[0]}" title="${esc(p[1])}">${(inspectionMarks.find(m=>m.point_id===p[0])||{}).damage_type||'+'}</button>`).join('');
}

function buildInspectionViews() {
  if(!INSPECTION_VIEWS.some(v=>v.id===activeInspectionView))activeInspectionView='left';
  carStage.innerHTML=`<section class="inspection-3d-shell"><div class="inspection-3d-toolbar">${INSPECTION_VIEWS.map(v=>`<button type="button" class="btn inspection-view-btn ${v.id===activeInspectionView?'active':''}" data-inspection-view="${v.id}">${v.label}</button>`).join('')}</div><div class="inspection-3d-stage" id="inspection3DCanvas"><div class="inspection-view-title" id="inspectionViewTitle">${(INSPECTION_VIEWS.find(v=>v.id===activeInspectionView)||{}).label||''}</div><div class="inspection-hotspots" id="inspectionHotspots"></div><div class="inspection-3d-note">Arraste para girar e use a roda do mouse para aproximar. As imagens 2D dos assets serão usadas no PDF.</div></div></section>`;
  initInspection3D();
  renderDamageList();
}
