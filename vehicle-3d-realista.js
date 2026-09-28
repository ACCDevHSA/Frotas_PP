/* PP Fleet System: sedan 3D interativo e projecao para as vistas 2D. */
(function(){
'use strict';
let viewer=null;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const viewNames={front:'Frente',rear:'Traseira',left:'Lado esquerdo',right:'Lado direito',top:'Teto'};

function roundedBox(THREE,w,h,d,r,material){
  const shape=new THREE.Shape(); const x=-w/2,y=-h/2;
  shape.moveTo(x+r,y); shape.lineTo(x+w-r,y); shape.quadraticCurveTo(x+w,y,x+w,y+r);
  shape.lineTo(x+w,y+h-r); shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  shape.lineTo(x+r,y+h); shape.quadraticCurveTo(x,y+h,x,y+h-r);
  shape.lineTo(x,y+r); shape.quadraticCurveTo(x,y,x+r,y);
  const g=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:r*.28,bevelThickness:r*.28});
  g.center(); const m=new THREE.Mesh(g,material); m.rotation.x=Math.PI/2; return m;
}
function part(mesh,id,kind){mesh.userData={inspection:true,id,kind};mesh.castShadow=true;mesh.receiveShadow=true;return mesh}

function createSedan(THREE){
 const group=new THREE.Group();group.name='Sedan branco';
 const paint=new THREE.MeshPhysicalMaterial({color:0xf8f8f6,metalness:.24,roughness:.19,clearcoat:1,clearcoatRoughness:.08});
 const glass=new THREE.MeshPhysicalMaterial({color:0x26343d,roughness:.06,metalness:.16,transparent:true,opacity:.78,clearcoat:1});
 const black=new THREE.MeshStandardMaterial({color:0x111315,roughness:.45,metalness:.22});
 const chrome=new THREE.MeshStandardMaterial({color:0xbcc4c9,roughness:.18,metalness:.9});
 const red=new THREE.MeshStandardMaterial({color:0xd71933,roughness:.2,metalness:.12,emissive:0x280006});
 const lamp=new THREE.MeshPhysicalMaterial({color:0xdde6eb,roughness:.08,metalness:.35,clearcoat:1});
 const tire=new THREE.MeshStandardMaterial({color:0x141516,roughness:.82});
 function add(m,p,r){m.position.set(...p);if(r)m.rotation.set(...r);group.add(m);return m}
 // carroceria principal alongada, capô baixo e porta-malas separado
 add(part(roundedBox(THREE,4.72,.68,1.80,.30,paint),'body','body'),[0,-.05,0]);
 add(part(roundedBox(THREE,1.62,.30,1.70,.22,paint),'hood','hood'),[1.53,.38,0],[0,0,-.035]);
 add(part(roundedBox(THREE,1.18,.33,1.68,.21,paint),'trunk','trunk'),[-1.82,.37,0],[0,0,.025]);
 // cabine fastback semelhante às referencias
 const cabin=part(roundedBox(THREE,2.62,.82,1.46,.30,glass),'cabin','glass');add(cabin,[-.30,.76,0]);cabin.scale.set(1,.95,1);
 add(part(roundedBox(THREE,1.98,.14,1.37,.14,paint),'roof','roof'),[-.36,1.25,0]);
 // para-brisas inclinados
 const fw=part(roundedBox(THREE,.73,.08,1.42,.07,glass),'windshield','glass');add(fw,[.82,.91,0],[0,0,-.62]);
 const rw=part(roundedBox(THREE,.66,.08,1.38,.07,glass),'rear-window','glass');add(rw,[-1.3,.88,0],[0,0,.64]);
 // laterais: colunas, vincos, maçanetas e retrovisores
 for(const side of [-1,1]){const z=side*.92;
   add(part(new THREE.Mesh(new THREE.BoxGeometry(3.45,.09,.06),black),'sill','side'),[0,-.47,z]);
   add(part(new THREE.Mesh(new THREE.BoxGeometry(.07,.65,.045),black),'pillar-b','glass'),[-.16,.77,side*.755]);
   add(part(new THREE.Mesh(new THREE.BoxGeometry(.045,.72,.035),black),'door-line-front','side'),[.72,.08,side*.91]);
   add(part(new THREE.Mesh(new THREE.BoxGeometry(.045,.72,.035),black),'door-line-rear','side'),[-.86,.08,side*.91]);
   for(const x of [.48,-.78]) add(part(roundedBox(THREE,.3,.07,.07,.025,chrome),'handle','side'),[x,.28,side*.965]);
   add(part(roundedBox(THREE,.38,.18,.22,.07,paint),'mirror','side'),[.73,.7,side*1.08]);
 }
 // rodas multirraios
 for(const x of [-1.43,1.43])for(const side of [-1,1]){const z=side*.94,w=new THREE.Group();
   const t=new THREE.Mesh(new THREE.CylinderGeometry(.47,.47,.25,40),tire);t.rotation.x=Math.PI/2;t.castShadow=true;w.add(t);
   const rim=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.27,32),chrome);rim.rotation.x=Math.PI/2;w.add(rim);
   const hub=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.285,20),black);hub.rotation.x=Math.PI/2;w.add(hub);
   for(let i=0;i<10;i++){const sp=new THREE.Mesh(new THREE.BoxGeometry(.25,.035,.025),black);sp.position.z=side*.143;sp.rotation.z=i*Math.PI/5;w.add(sp)}
   w.position.set(x,-.43,z);group.add(w)
 }
 // frente: faróis estreitos, grade e entradas inferiores
 for(const side of [-1,1]){
   add(part(roundedBox(THREE,.12,.23,.61,.06,lamp),'headlamp','front'),[2.3,.24,side*.56]);
   add(part(roundedBox(THREE,.13,.3,.52,.07,red),'taillamp','rear'),[-2.29,.28,side*.58]);
   add(part(roundedBox(THREE,.13,.27,.26,.04,black),'front-vent','front'),[2.34,-.27,side*.68]);
 }
 add(part(roundedBox(THREE,.13,.28,1.22,.05,black),'upper-grille','front'),[2.35,.04,0]);
 add(part(roundedBox(THREE,.13,.28,1.05,.05,black),'lower-grille','front'),[2.36,-.3,0]);
 add(part(roundedBox(THREE,.13,.2,1.38,.05,black),'rear-diffuser','rear'),[-2.34,-.29,0]);
 // placas
 const plate=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8});
 add(part(roundedBox(THREE,.055,.25,.57,.03,plate),'front-plate','front'),[2.425,-.03,0]);
 add(part(roundedBox(THREE,.055,.25,.57,.03,plate),'rear-plate','rear'),[-2.425,-.02,0]);
 // detalhes visuais inspirados nas referencias 2D: spoiler discreto, antena e vincos
 const spoiler=part(roundedBox(THREE,.42,.08,1.28,.04,paint),'rear-spoiler','rear');add(spoiler,[-2.05,.64,0],[0,0,.02]);
 const antenna=new THREE.Mesh(new THREE.ConeGeometry(.09,.28,20),black);antenna.rotation.z=-Math.PI/2;antenna.position.set(-.92,1.39,0);antenna.userData={inspection:true,id:'antenna',kind:'roof'};group.add(antenna);
 for(const side of [-1,1]){
   const belt=new THREE.Mesh(new THREE.BoxGeometry(2.65,.035,.025),chrome);belt.position.set(-.15,.58,side*.925);group.add(belt);
   const crease=new THREE.Mesh(new THREE.BoxGeometry(2.95,.018,.018),chrome);crease.position.set(.02,.02,side*.93);crease.rotation.z=-.035;group.add(crease);
 }
 return group;
}

function projectHit(hit,car){
 const p=car.worldToLocal(hit.point.clone());
 // Modelo usa X longitudinal: +X frente; Z transversal: +Z lado esquerdo da imagem de referência.
 const ax=Math.abs(p.x),az=Math.abs(p.z);let view,x,y;
 if(p.y>.82 && p.y>ax*.24 && p.y>az*.65){view='top';x=clamp(50+(p.z/1.05)*43,4,96);y=clamp(50-(p.x/2.45)*43,4,96)}
 else if(ax>az*1.45){view=p.x>0?'front':'rear';x=clamp(50-(p.z/1.02)*43,5,95);y=clamp(76-(p.y/1.35)*55,7,94)}
 else {view=p.z>0?'left':'right';x=clamp(50+(p.x/2.45)*45,4,96);if(view==='left')x=100-x;y=clamp(77-(p.y/1.35)*58,6,95)}
 return{view_id:view,view:viewNames[view],x:+x.toFixed(2),y:+y.toFixed(2)};
}
function makeId(view){return `${view}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0,8)}`}
function addMark(mapped){const id=makeId(mapped.view_id);inspectionMarks.push({point_id:id,view_id:mapped.view_id,view:mapped.view,part:`${mapped.view} · marcação 3D`,x:mapped.x,y:mapped.y,damage_type:'B',description:'',order:inspectionMarks.length+1,source:'3d'});normalizeMarks();requestAnimationFrame(()=>buildInspectionViews())}

function init(stage){
 const THREE=window.THREE;if(!THREE||!stage)return;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xf0f4f7);
 const camera=new THREE.PerspectiveCamera(32,stage.clientWidth/stage.clientHeight,.1,100);camera.position.set(6.4,3.1,5.2);
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(stage.clientWidth,stage.clientHeight);renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;stage.prepend(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xffffff,0x607080,2.6));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(5,8,6);key.castShadow=true;scene.add(key);const fill=new THREE.DirectionalLight(0xcfe6ff,1.4);fill.position.set(-5,4,-4);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(18,18),new THREE.MeshStandardMaterial({color:0xdce4e8,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.91;floor.receiveShadow=true;scene.add(floor);
 const car=createSedan(THREE);scene.add(car);
 const target=new THREE.Vector3(0,.18,0),ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let down=null,drag=false,theta=.72,phi=1.08,radius=7.2,hover=null;const cameraKey='pp_fleet_3d_camera';try{const saved=JSON.parse(localStorage.getItem(cameraKey)||'null');if(saved){theta=saved.theta??theta;phi=saved.phi??phi;radius=saved.radius??radius}}catch{}
 const preview=stage.querySelector('.model-mark-preview');
 function cam(){camera.position.set(radius*Math.sin(phi)*Math.cos(theta),radius*Math.cos(phi)+.35,radius*Math.sin(phi)*Math.sin(theta));camera.lookAt(target)}function preset(name){const p={default:[.72,1.08,7.2],front:[0,1.16,7],rear:[Math.PI,1.16,7],left:[Math.PI/2,1.15,7],right:[-Math.PI/2,1.15,7],top:[Math.PI/2,.18,8]}[name]||[.72,1.08,7.2];theta=p[0];phi=p[1];radius=p[2];cam();localStorage.setItem(cameraKey,JSON.stringify({theta,phi,radius}))}cam();stage.closest('.model3d-shell')?.querySelectorAll('[data-camera-preset]').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.cameraPreset)));stage.closest('.model3d-shell')?.querySelector('#save3dPreset')?.addEventListener('click',()=>{localStorage.setItem(cameraKey,JSON.stringify({theta,phi,radius}));toast('Posição 3D salva como predefinição.')});
 function hitAt(e){const r=renderer.domElement.getBoundingClientRect();mouse.x=((e.clientX-r.left)/r.width)*2-1;mouse.y=-((e.clientY-r.top)/r.height)*2+1;ray.setFromCamera(mouse,camera);return ray.intersectObjects(car.children,true).find(h=>h.object.userData.inspection)}
 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};drag=false;renderer.domElement.setPointerCapture(e.pointerId)});
 renderer.domElement.addEventListener('pointermove',e=>{if(down){const dx=e.clientX-down.x,dy=e.clientY-down.y;if(Math.hypot(dx,dy)>4)drag=true;theta-=dx*.009;phi=clamp(phi+dy*.007,.42,1.46);down={x:e.clientX,y:e.clientY};cam();localStorage.setItem(cameraKey,JSON.stringify({theta,phi,radius}));preview.style.opacity='0'}else{hover=hitAt(e);if(hover){preview.style.left=e.offsetX+'px';preview.style.top=e.offsetY+'px';preview.style.opacity='1'}else preview.style.opacity='0'}});
 renderer.domElement.addEventListener('pointerup',e=>{if(!drag){const h=hitAt(e);if(h)addMark(projectHit(h,car))}down=null;drag=false});
 renderer.domElement.addEventListener('pointerleave',()=>{down=null;preview.style.opacity='0'});
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();radius=clamp(radius*(e.deltaY>0?1.08:.92),5.2,10);cam();localStorage.setItem(cameraKey,JSON.stringify({theta,phi,radius}))},{passive:false});
 function animate(){renderer.render(scene,camera);requestAnimationFrame(animate)}animate();
 const ro=new ResizeObserver(()=>{const w=stage.clientWidth,h=stage.clientHeight;camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();renderer.setSize(w,h)});ro.observe(stage);
 viewer={scene,camera,renderer,car,ro};
}
window.buildInspectionViews=function(){
 carStage.innerHTML=`<section class="model3d-shell"><div class="model3d-head"><div><b>Veículo 3D · marcação livre</b><small>Arraste para girar 360°. Use a roda do mouse para zoom. Clique na carroceria para registrar B · Riscado.</small></div><div class="model3d-actions"><button type="button" class="btn tiny" data-camera-preset="default">Perspectiva</button><button type="button" class="btn tiny" data-camera-preset="front">Frente</button><button type="button" class="btn tiny" data-camera-preset="left">Esquerda</button><button type="button" class="btn tiny" data-camera-preset="right">Direita</button><button type="button" class="btn tiny" data-camera-preset="rear">Traseira</button><button type="button" class="btn tiny" data-camera-preset="top">Teto</button><button type="button" class="btn tiny" id="save3dPreset">Salvar posição</button><button type="button" class="btn" id="show2dMapping">Ver projeção 2D</button></div></div><div class="model3d-stage" id="model3dStage"><span class="model-mark-preview">B</span></div><div class="model3d-map hidden" id="model3dMap">${INSPECTION_VIEWS.map(v=>`<article class="vehicle-view"><h4>${v.label}</h4><img src="${v.image}" alt="${v.label}">${inspectionMarks.filter(m=>m.view_id===v.id).map(m=>`<button type="button" class="damage-dot marked type-${String(m.damage_type||'B').toLowerCase()}" style="left:${m.x}%;top:${m.y}%" data-inspection-point="${m.point_id}">${m.damage_type||'B'}</button>`).join('')}</article>`).join('')}</div></section>`;
 document.getElementById('show2dMapping').onclick=e=>{const map=document.getElementById('model3dMap');map.classList.toggle('hidden');e.currentTarget.textContent=map.classList.contains('hidden')?'Ver projeção 2D':'Ocultar projeção 2D'};
 init(document.getElementById('model3dStage'));renderDamageList();
};
})();
