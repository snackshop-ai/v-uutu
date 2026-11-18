import * as THREE from 'three';

const stage = document.getElementById('worldStage');
const game = window.VoUuGame;
if (!stage || !game) throw new Error('Không tìm thấy khung cảnh Vô Ưu Tự');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#c5d7d8');
scene.fog = new THREE.Fog('#c5d7d8', 34, 125);
const camera = new THREE.PerspectiveCamera(49, 1, .1, 240);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
renderer.domElement.className = 'webgl-view';
renderer.domElement.setAttribute('aria-label', 'Khung cảnh 3D tương tác của Vô Ưu Tự');
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
stage.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight('#e8f5f4', '#7e7058', 2.0));
const sun = new THREE.DirectionalLight('#ffe3ad', 3.1);
sun.position.set(-18, 33, -14);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -28; sun.shadow.camera.right = 28;
sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -18;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
sun.shadow.bias = -.0003;
scene.add(sun);

const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { top: { value: new THREE.Color('#83a9c0') }, horizon: { value: new THREE.Color('#efd9b4') } },
  vertexShader: 'varying float h; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); h=normalize(position).y; gl_Position=projectionMatrix*p; }',
  fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying float h; void main(){ float t=smoothstep(-0.35,0.62,h); gl_FragColor=vec4(mix(horizon,top,t),1.0); }'
}));
scene.add(sky);

const world = new THREE.Group(); scene.add(world);
const climb = new THREE.Group(), courtyard = new THREE.Group();
world.add(climb, courtyard);
const mat = (color, roughness = .82, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const materials = {
  stone: mat('#77766e'), stepA: mat('#88877e'), stepB: mat('#a09b8d'), riser: mat('#625f58'),
  wood: mat('#694438'), darkWood: mat('#432f2a'), red: mat('#8b352d'), redLight: mat('#a84937'),
  wall: mat('#dfcba4'), wallDark: mat('#c2aa7f'), gold: mat('#d3aa56', .38, .48), bronze: mat('#80623b', .38, .55),
  leaf: mat('#557552'), leafLight: mat('#728f62'), pine: mat('#355b50'), water: new THREE.MeshStandardMaterial({ color: '#4c9b9a', roughness: .23, metalness: .1, transparent: true, opacity: .87 }),
  roof: null, roofDark: mat('#552c29'), tileLine: mat('#b66c48'),
};

function mesh(parent, geometry, material, x = 0, y = 0, z = 0, options = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = options.cast !== false;
  m.receiveShadow = options.receive !== false;
  parent.add(m);
  return m;
}
function box(parent, width, height, depth, material, x, y, z, options) {
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), material, x, y, z, options);
}
function cylinder(parent, top, bottom, height, material, x, y, z, sides = 10) {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, sides), material, x, y, z);
}
function sphere(parent, radius, material, x, y, z, segments = 10) {
  return mesh(parent, new THREE.SphereGeometry(radius, segments, Math.max(6, segments - 2)), material, x, y, z);
}
function beam(parent, start, end, radius, material, segments = 7) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), direction = new THREE.Vector3().subVectors(b, a);
  const object = mesh(parent, new THREE.CylinderGeometry(radius, radius, direction.length(), segments), material, ...a.clone().add(b).multiplyScalar(.5).toArray());
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return object;
}
function texturedCanvas(draw, repeats = [1, 1]) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  const c = canvas.getContext('2d'); draw(c, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(...repeats); texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
const roofTexture = texturedCanvas((c, w, h) => {
  c.fillStyle = '#71362e'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 30) {
    c.fillStyle = y % 60 === 0 ? '#914738' : '#804037'; c.fillRect(0, y, w, 24);
    c.strokeStyle = '#552d2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, y + 25); c.lineTo(w, y + 25); c.stroke();
    for (let x = (y / 30 % 2) * 32; x < w; x += 64) {
      c.strokeStyle = '#a35a43'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y + 2); c.lineTo(x, y + 22); c.stroke();
    }
  }
}, [2, 2]);
materials.roof = new THREE.MeshStandardMaterial({ map: roofTexture, color: '#efd2ae', roughness: .9, side: THREE.DoubleSide });
const pavingTexture = texturedCanvas((c, w, h) => {
  c.fillStyle = '#b8aa8c'; c.fillRect(0, 0, w, h);
  for (let row = 0; row < 12; row++) for (let col = 0; col < 8; col++) {
    const x = col * 68 + (row % 2) * 34, y = row * 43;
    c.fillStyle = ['#c4b696', '#bcae8f', '#cabb9b', '#b6a787'][(row * 3 + col) % 4];
    c.fillRect(x + 2, y + 2, 64, 39);
    c.strokeStyle = '#8e826c'; c.lineWidth = 2; c.strokeRect(x + 2, y + 2, 64, 39);
  }
}, [8, 8]);
const courtyardStone = new THREE.MeshStandardMaterial({ map: pavingTexture, roughness: .97 });

function curvedRoof(parent, x, y, z, width, depth) {
  const roof = new THREE.Group(); roof.position.set(x, y, z); parent.add(roof);
  const positions = [], uvs = [], indices = [];
  for (const side of [-1, 1]) {
    const base = positions.length / 3;
    for (let ix = 0; ix <= 6; ix++) for (let iz = 0; iz <= 4; iz++) {
      const t = ix / 6, v = iz / 4, xx = side * t * width * .5, zz = (v - .5) * depth;
      const liftedEave = Math.pow(Math.abs(zz) / (depth * .5), 5) * Math.pow(t, 2) * .38;
      const yy = .62 * (1 - t) - .22 * t + liftedEave;
      positions.push(xx, yy, zz); uvs.push(t * 2, v * 2);
    }
    const row = 5;
    for (let ix = 0; ix < 6; ix++) for (let iz = 0; iz < 4; iz++) {
      const a = base + ix * row + iz, b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  mesh(roof, geometry, materials.roof, 0, 0, 0);
  beam(roof, [0, .66, -depth * .53], [0, .66, depth * .53], .095, materials.roofDark, 8);
  for (const side of [-1, 1]) for (let j = 1; j <= 5; j++) {
    const t = j / 6, xx = side * t * width * .5, yy = .62 * (1 - t) - .22 * t + .03;
    box(roof, .035, .035, depth * .97, materials.tileLine, xx, yy, 0, { cast: false });
  }
  const eaveMat = mat('#532d29');
  for (const zz of [-depth * .5, depth * .5]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-width * .5, -.03, zz), new THREE.Vector3(-width * .28, -.12, zz),
      new THREE.Vector3(0, .02, zz), new THREE.Vector3(width * .28, -.12, zz), new THREE.Vector3(width * .5, -.03, zz)
    ]);
    mesh(roof, new THREE.TubeGeometry(curve, 18, .045, 5, false), eaveMat);
  }
  return roof;
}

function labelTexture(text) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const c = canvas.getContext('2d'); c.fillStyle = '#26372de8'; c.roundRect(9, 9, 494, 110, 18); c.fill();
  c.strokeStyle = '#d7b66c'; c.lineWidth = 5; c.roundRect(9, 9, 494, 110, 18); c.stroke();
  c.fillStyle = '#fff2d5'; c.font = 'bold 48px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 65);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
function addLabel(parent, text, x, y, z, scale = 3.4) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text), transparent: true, depthTest: false }));
  sprite.position.set(x, y, z); sprite.scale.set(scale, scale * .34, 1); sprite.renderOrder = 4; parent.add(sprite); return sprite;
}
function plaque(parent, text, x, y, z, width = 2.1) {
  const texture = labelTexture(text);
  const signMaterial = new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: .8, side: THREE.DoubleSide });
  return mesh(parent, new THREE.PlaneGeometry(width, width * .25), signMaterial, x, y, z, { cast: false });
}

function building(parent, { x, z, width, depth, wallHeight, name, tiers = 1, main = false }) {
  const group = new THREE.Group(); group.position.set(x, 0, z); parent.add(group);
  box(group, width + .6, .34, depth + .55, materials.stone, 0, .16, 0);
  if (main) {
    const wallY = .34 + wallHeight * .5, sideThickness = .58, opening = width * .68, wingWidth = (width - opening) * .5;
    box(group, width, wallHeight, sideThickness, materials.wall, 0, wallY, -depth * .5 + sideThickness * .5);
    for (const side of [-1, 1]) {
      box(group, sideThickness, wallHeight, depth, materials.wall, side * (width * .5 - sideThickness * .5), wallY, 0);
      box(group, wingWidth, wallHeight, sideThickness, materials.wall, side * (opening * .5 + wingWidth * .5), wallY, depth * .5 - sideThickness * .5);
    }
    box(group, opening, .42, sideThickness, materials.wallDark, 0, .34 + wallHeight - .21, depth * .5 - sideThickness * .5);
  } else box(group, width, wallHeight, depth, materials.wall, 0, .34 + wallHeight * .5, 0);
  for (const side of [-1, 1]) for (const frontBack of [-1, 1]) {
    cylinder(group, .18, .23, wallHeight + .23, materials.red, side * (width * .43), .34 + wallHeight * .5, frontBack * depth * .42, 12);
  }
  // The main hall has an open front so its altar and Buddha statues can be seen from the courtyard.
  if (!main) {
    box(group, width * .35, wallHeight * .76, .13, materials.darkWood, 0, .34 + wallHeight * .4, depth * .5 + .085);
    for (const side of [-1, 1]) {
      box(group, width * .14, wallHeight * .74, .1, materials.redLight, side * width * .26, .34 + wallHeight * .4, depth * .5 + .1);
      for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++)
        sphere(group, .035, materials.gold, side * width * .26 + (col ? .12 : -.12), .45 + row * .22, depth * .5 + .17, 7);
    }
  }
  for (let i = 0; i < (main ? 6 : 3); i++) {
    const gx = (i - (main ? 2.5 : 1)) * (main ? .36 : .35);
    box(group, .13, .13, .48, materials.gold, gx, wallHeight + .27, depth * .5 + .16);
  }
  if (name) plaque(group, name, 0, wallHeight + .72, depth * .5 + .1, main ? 2.65 : 1.8);
  curvedRoof(group, 0, .34 + wallHeight, 0, width + 1.6, depth + 1.25);
  if (tiers > 1) {
    box(group, width * .56, wallHeight * .64, depth * .56, materials.wallDark, 0, wallHeight + wallHeight * .35, 0);
    curvedRoof(group, 0, wallHeight + wallHeight * .68, 0, width * .72, depth * .72);
  }
  if (main) {
    box(group, 6.2, .38, 1.2, materials.darkWood, 0, .42, -depth * .28);
    for (let i = 0; i < 3; i++) {
      const statue = new THREE.Group(); statue.position.set((i - 1) * 2.15, .62, -depth * .28); group.add(statue);
      cylinder(statue, .55, .62, .32, materials.gold, 0, .16, 0, 10);
      const legs = sphere(statue, .5, materials.gold, 0, .46, 0, 12); legs.scale.set(1.15, .48, .82);
      const robe = sphere(statue, .43, materials.gold, 0, 1.02, 0, 12); robe.scale.set(.9, 1.2, .72);
      sphere(statue, .29, materials.gold, 0, 1.62, 0, 12);
      for (const side of [-1, 1]) sphere(statue, .085, materials.gold, side * .3, 1.61, 0, 8);
      sphere(statue, .12, materials.gold, 0, 1.94, 0, 9);
      mesh(statue, new THREE.TorusGeometry(.57, .055, 8, 28), materials.gold, 0, 1.62, -.12);
    }
    // Small offering burner inside the hall, in front of the altar.
    cylinder(group, .2, .28, .2, materials.bronze, 0, .62, depth * .18, 10);
    cylinder(group, .29, .29, .08, materials.gold, 0, .76, depth * .18, 10);
    for (let i = -1; i <= 1; i++) {
      const stick = cylinder(group, .018, .025, .38, mat('#913c2f'), i * .09, .96, depth * .18, 6); stick.rotation.z = i * .09;
      sphere(group, .035, new THREE.MeshBasicMaterial({ color: '#ff7436' }), i * .09, 1.16, depth * .18, 6);
    }
  }
  const label = addLabel(group, name || '', 0, wallHeight + 2.0 + (tiers > 1 ? wallHeight * .5 : 0), 0, Math.max(2.25, width * .43));
  return { group, label };
}

function tree(parent, x, z, size = 1, pine = true, baseY = 0) {
  const group = new THREE.Group(); group.position.set(x, baseY, z); parent.add(group);
  cylinder(group, .13 * size, .19 * size, 1.5 * size, materials.wood, 0, .75 * size, 0, 7);
  if (pine) {
    for (let i = 0; i < 3; i++) {
      const foliage = mesh(group, new THREE.ConeGeometry((.9 - i * .12) * size, 1.55 * size, 7), i % 2 ? materials.pine : materials.leaf, 0, 1.55 * size + i * .6 * size, 0);
      foliage.rotation.y = .25 * i;
    }
  } else {
    sphere(group, .88 * size, materials.leaf, 0, 2.1 * size, 0, 8);
    sphere(group, .66 * size, materials.leafLight, .42 * size, 2.32 * size, .08 * size, 8);
  }
  return group;
}

function lantern(parent, x, y, z, scale = 1) {
  const group = new THREE.Group(); group.position.set(x, y, z); parent.add(group);
  cylinder(group, .035 * scale, .06 * scale, 2.4 * scale, materials.wood, 0, 1.2 * scale, 0, 7);
  beam(group, [0, 2.35 * scale, 0], [0, 2.75 * scale, 0], .035 * scale, materials.darkWood);
  const glowMat = new THREE.MeshStandardMaterial({ color: '#ffe1a1', emissive: '#e58e32', emissiveIntensity: 1.1, roughness: .48 });
  cylinder(group, .26 * scale, .23 * scale, .43 * scale, glowMat, 0, 2.13 * scale, 0, 10);
  cylinder(group, .28 * scale, .28 * scale, .055 * scale, materials.red, 0, 2.37 * scale, 0, 10);
  cylinder(group, .28 * scale, .28 * scale, .055 * scale, materials.red, 0, 1.9 * scale, 0, 10);
  beam(group, [0, 1.85 * scale, 0], [0, 1.7 * scale, 0], .018 * scale, materials.gold);
  return group;
}

function mountainY(x, z) {
  const side = Math.max(0, Math.abs(x) - 2.8);
  const hill = 3.3 * Math.exp(-Math.pow((side - 7.4) / 4.8, 2)) + .58 * Math.sin(z * .24 + x * .35) + .42 * Math.sin(z * .12 - x * .47);
  return z * (.155 / .43) + hill - Math.max(0, side - 10) * .25 - .75;
}
function mountainTerrain() {
  const xs = 54, zs = 156, width = 50, length = 68, positions = [], colors = [], indices = [];
  const grassA = new THREE.Color('#6a855f'), grassB = new THREE.Color('#9b9a72'), rock = new THREE.Color('#827e70');
  for (let iz = 0; iz <= zs; iz++) {
    const z = iz / zs * length;
    for (let ix = 0; ix <= xs; ix++) {
      const x = (ix / xs - .5) * width, side = Math.max(0, Math.abs(x) - 2.8);
      const y = mountainY(x, z);
      positions.push(x, y, z);
      const tint = side > 10 ? rock.clone() : grassA.clone().lerp(grassB, .25 + .2 * Math.sin(z * .2 + x));
      const brightness = .86 + .12 * Math.sin(x * .55 + z * .22);
      colors.push(tint.r * brightness, tint.g * brightness, tint.b * brightness);
    }
  }
  for (let iz = 0; iz < zs; iz++) for (let ix = 0; ix < xs; ix++) {
    const a = iz * (xs + 1) + ix, b = a + xs + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  terrain.receiveShadow = true; climb.add(terrain);
  const farTerrain = new THREE.Mesh(new THREE.PlaneGeometry(210, 210, 1, 1), mat('#81978b'));
  farTerrain.rotation.x = -Math.PI / 2; farTerrain.position.set(0, -8, 27); farTerrain.receiveShadow = true; climb.add(farTerrain);
}

const birds = [];
function addBird(parent, x, y, z, scale = 1) {
  const bird = new THREE.Group(); bird.position.set(x, y, z); parent.add(bird);
  const feather = mat('#403d38'), wingMat = mat('#625b4c');
  sphere(bird, .12 * scale, feather, 0, 0, 0, 8);
  const beak = mesh(bird, new THREE.ConeGeometry(.045 * scale, .16 * scale, 5), materials.gold, .13 * scale, .015 * scale, -.015 * scale); beak.rotation.z = -Math.PI / 2;
  const wings = [];
  for (const side of [-1, 1]) { const wing = mesh(bird, new THREE.BoxGeometry(.22 * scale, .035 * scale, .1 * scale), wingMat, side * .13 * scale, .045 * scale, 0); wing.userData.side = side; wings.push(wing); }
    bird.userData.wings = wings; bird.userData.baseY = y; birds.push(bird); return bird;
}
function buildStairway() {
  const count = 108, depth = .43, rise = .155, tread = new THREE.BoxGeometry(1, .22, depth + .12), riser = new THREE.BoxGeometry(1, .19, .1);
  box(climb, 7.4, .24, 3.2, materials.stone, 0, -.1, -1.15);
  const treads = new THREE.InstancedMesh(tread, materials.stepA, count), risers = new THREE.InstancedMesh(riser, materials.riser, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const width = 6.35 - i * .009, wobble = Math.sin(i * 1.7) * .035;
    dummy.position.set(wobble, i * rise + .015, i * depth); dummy.rotation.y = Math.sin(i * 2.1) * .008; dummy.scale.set(width, 1, 1); dummy.updateMatrix(); treads.setMatrixAt(i, dummy.matrix);
    treads.setColorAt(i, new THREE.Color(['#929087','#77776f','#a19b8e','#85847a'][i % 4]));
    dummy.position.set(wobble, i * rise - .075, i * depth + depth * .42); dummy.scale.set(width, 1, 1); dummy.updateMatrix(); risers.setMatrixAt(i, dummy.matrix);
  }
  treads.instanceMatrix.needsUpdate = true; risers.instanceMatrix.needsUpdate = true; treads.castShadow = true; treads.receiveShadow = true; risers.castShadow = true; climb.add(treads, risers);
  // Uneven stone shoulders instead of handrails keep the path feeling cut into the mountain.
  for (let i = 5; i < count; i += 4) for (const side of [-1, 1]) {
    const z = i * depth + (i % 2) * .15, x = side * (3.65 + Math.sin(i * 3) * .42), y = i * rise;
    const boulder = mesh(climb, new THREE.DodecahedronGeometry(.57 + (i % 3) * .08, 0), mat(i % 2 ? '#78776e' : '#928e82'), x, y + .05, z);
    boulder.scale.set(1.25, .75, .8); boulder.rotation.set(i * .13, i * .77, i * .21);
  }
  for (let i = 8; i < count; i += 18) { const side = i % 36 ? 1 : -1; lantern(climb, side * 4.35, i * rise - .18, i * depth, .58); }
  const treeSteps = [12, 29, 48, 67, 86, 101];
  treeSteps.forEach((i, n) => {
    const side = n % 2 ? 1 : -1, x = side * (7.2 + (n % 3) * .7), z = i * depth + (n % 2) * 1.5;
    const size = 2.0 + (n % 3) * .4, t = tree(climb, x, z, size, n % 3 === 0, mountainY(x, z));
    addBird(t, .35 * size, 3.2 * size, .14 * size, .72 + (n % 2) * .12);
    if (n % 2 === 0) addBird(t, -.25 * size, 2.8 * size, .18 * size, .58);
  });
  // Sparse grass tufts grow between stones and on the trail shoulders.
  const grassMat = mat('#667b52'), grassGeo = new THREE.ConeGeometry(.075, .42, 4), grass = new THREE.InstancedMesh(grassGeo, grassMat, 132);
  let gi = 0;
  for (let i = 3; i < count; i += 5) for (const side of [-1, 1]) {
    const x = side * (3.15 + ((i * 7) % 9) * .28), z = i * depth + ((i * 13) % 11) * .035, y = mountainY(x, z) + .17;
    dummy.position.set(x, y, z); dummy.rotation.z = side * (.18 + (i % 4) * .07); dummy.scale.set(1, .75 + (i % 3) * .2, 1); dummy.updateMatrix(); grass.setMatrixAt(gi++, dummy.matrix);
  }
  grass.count = gi; grass.instanceMatrix.needsUpdate = true; grass.castShadow = true; climb.add(grass);
  for (let i = 10; i < count; i += 19) { const rockMesh = mesh(climb, new THREE.DodecahedronGeometry(.75, 0), mat(i % 2 ? '#72766d' : '#979286'), i % 2 ? -5 : 5, i * rise + .15, i * depth + 1.1); rockMesh.scale.set(1.5, .9, 1.2); }
  return { depth, rise, length: count * depth, height: count * rise };
}

function gate(parent, x, y, z) {
  const group = new THREE.Group(); group.position.set(x, y, z); parent.add(group);
  box(group, 10.6, .48, 3.2, materials.stone, 0, .24, 0);
  for (const px of [-4.2, -1.45, 1.45, 4.2]) {
    cylinder(group, .33, .4, 5.2, materials.red, px, 3.15, 0, 12);
    cylinder(group, .47, .47, .23, materials.gold, px, .48, 0, 10);
    cylinder(group, .43, .43, .2, materials.gold, px, 5.72, 0, 10);
  }
  box(group, 10, .38, .62, materials.darkWood, 0, 5.35, 0);
  box(group, 2.5, 1.04, .2, materials.darkWood, 0, 4.18, .38);
  plaque(group, 'VÔ ƯU TỰ', 0, 4.18, .5, 2.8);
  const approachPlaque = plaque(group, 'VÔ ƯU TỰ', 0, 4.18, .26, 2.8);
  approachPlaque.rotation.y = Math.PI;
  curvedRoof(group, 0, 5.52, 0, 11.2, 3.6);
  for (const px of [-3.3, 0, 3.3]) {
    cylinder(group, .12, .12, .38, materials.gold, px, 6.46, 0, 8);
    sphere(group, .13, materials.gold, px, 6.68, 0, 8);
  }
  box(group, 8.4, .2, 2.5, materials.darkWood, 0, 7.12, 0);
  curvedRoof(group, 0, 7.2, 0, 8.8, 3.0);
  return group;
}

function lanternsAndClouds() {
  // Haze drifting across the valley at a height above the path.
  for (let i = 0; i < 14; i++) {
    const group = new THREE.Group(); group.position.set((i % 2 ? 1 : -1) * (11 + i % 4 * 4), 3 + i % 3 * 2, i * 4 - 4); climb.add(group);
    const cloudMat = new THREE.MeshStandardMaterial({ color: '#f2eee1', roughness: 1, transparent: true, opacity: .34, depthWrite: false });
    for (let j = 0; j < 5; j++) sphere(group, 1.1 + (j % 2) * .35, cloudMat, (j - 2) * .72, Math.sin(j) * .25, 0, 9);
    group.userData.drift = .08 + (i % 4) * .025; group.userData.initialX = group.position.x;
    group.name = 'cloud';
  }
}

function makeCourtyard() {
  const ground = mesh(courtyard, new THREE.PlaneGeometry(44, 44), courtyardStone, 0, -.13, -3, { cast: false }); ground.rotation.x = -Math.PI / 2;
  const boundaryMaterial = mat('#887f6a');
  for (const x of [-20, 20]) {
    box(courtyard, .35, 1.1, 42, boundaryMaterial, x, .4, -2);
    for (let z = -22; z <= 18; z += 3) cylinder(courtyard, .13, .16, .6, materials.gold, x, 1.2, z, 8);
  }
  for (const z of [-22, 18]) {
    box(courtyard, 40, 1.1, .35, boundaryMaterial, 0, .4, z);
    for (let x = -20; x <= 20; x += 3) cylinder(courtyard, .13, .16, .6, materials.gold, x, 1.2, z, 8);
  }
  // Main stone axis and the gate at its head.
  box(courtyard, 4.2, .13, 24, materials.wallDark, 0, -.03, 2);
  for (let z = -12; z < 12; z += 1.4) for (const x of [-1.2, 0, 1.2]) box(courtyard, 1.08, .018, 1.18, materials.stone, x, .045, z, { cast: false });
  gate(courtyard, 0, 0, 10.5);
  const zones = game.getZones();
  const positions = Object.fromEntries(zones.map(z => [z.id, { x: z.x * 2, z: z.z * 2 }]));
  building(courtyard, { ...positions.shop, width: 4.4, depth: 3.6, wallHeight: 2.8, name: 'SẮM LỄ' });
  building(courtyard, { ...positions.hall, z: positions.hall.z - .7, width: 8.8, depth: 6.4, wallHeight: 4.2, name: 'CHÍNH ĐIỆN', tiers: 2, main: true });
  building(courtyard, { ...positions.dining, width: 5.4, depth: 4.0, wallHeight: 3.1, name: 'TRAI ĐƯỜNG' });
  building(courtyard, { ...positions.tea, width: 4.2, depth: 3.0, wallHeight: 2.8, name: 'TRÀ THẤT' });
  makePond(positions.pond);
  makeMeritStele(positions.pond);
  makeCenser(positions.censer);
  makeBellTower(positions.bell);
  for (const pos of [[-14, 8], [-14, -14], [18, -14], [-13, -15], [13, -15], [-10, 15], [10, 15]]) tree(courtyard, pos[0], pos[1], 1.1, true);
  const boundaryShrine = building(courtyard, { x: 0, z: -14, width: 4.2, depth: 3.4, wallHeight: 2.6, name: 'TAM QUAN' });
  boundaryShrine.group.scale.set(.78, .78, .78);
}

let fish = [], smoke = [], bell = null, bellWobble = 0;
function makePond(pos) {
  const group = new THREE.Group(); group.position.set(pos.x * 2, 0, pos.z * 2); courtyard.add(group);
  group.scale.set(.68, .78, 1.12);
  const border = mesh(group, new THREE.CylinderGeometry(4.15, 4.25, .42, 40), materials.stone, 0, .06, 0);
  const water = mesh(group, new THREE.CircleGeometry(3.92, 40), materials.water, 0, .29, 0, { cast: false }); water.rotation.x = -Math.PI / 2;
  const edge = mesh(group, new THREE.TorusGeometry(4, .16, 8, 48), materials.wallDark, 0, .32, 0); edge.rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const pad = mesh(group, new THREE.CircleGeometry(.38, 9), materials.leaf, -2 + i * .85, .32, Math.sin(i * 3.2) * 1.15, { cast: false }); pad.rotation.x = -Math.PI / 2;
  }
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group(); f.position.set(Math.sin(i * 2) * 2, .42 + i * .015, Math.cos(i * 2) * 2); group.add(f);
    const fishBody = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 8), mat(i % 2 ? '#e4a95e' : '#efc17a', .34)); fishBody.scale.set(1.55, .65, .62); f.add(fishBody);
    const tail = mesh(f, new THREE.ConeGeometry(.19, .42, 5), mat('#d06b48'), -.42, 0, 0); tail.rotation.z = Math.PI / 2;
    sphere(f, .045, mat('#232923'), .31, .055, .08, 7);
    fish.push({ group: f, origin: f.position.clone(), phase: i * 1.7 });
  }
  border.receiveShadow = true;
}

let meritStele = null;
function makeMeritStele(pos) {
  const group = new THREE.Group();
  group.position.set(pos.x * 2, 0, pos.z * 2 + 6);
  courtyard.add(group);
  box(group, 2.05, .28, .9, materials.stone, 0, .14, 0);
  box(group, 1.7, 2.0, .34, materials.riser, 0, 1.25, 0);
  box(group, 1.95, .22, .58, materials.wallDark, 0, .27, 0);
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const board = mesh(group, new THREE.PlaneGeometry(1.48, 1.44), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }), 0, 1.3, .181, { cast: false });
  const backBoard = board.clone(); backBoard.position.z = -.181; backBoard.rotation.y = Math.PI; group.add(backBoard);
  meritStele = { canvas, ctx, texture, count: -1 };
  paintMeritStele(game.getState().releasedFish || 0);
}
function paintMeritStele(count) {
  if (!meritStele || meritStele.count === count) return;
  const { canvas, ctx, texture } = meritStele;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3f433a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#d6b56b'; ctx.lineWidth = 10; ctx.strokeRect(13, 13, canvas.width - 26, canvas.height - 26);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f3dda5';
  ctx.font = 'bold 42px serif'; ctx.fillText('CÔNG ĐỨC BIA', 256, 86);
  ctx.fillStyle = '#f8f3df'; ctx.font = '30px sans-serif'; ctx.fillText('Cá phóng sinh', 256, 166);
  ctx.fillStyle = '#f3dda5'; ctx.font = 'bold 48px serif'; ctx.fillText(`${count} con`, 256, 240);
  meritStele.count = count; texture.needsUpdate = true;
}

function makeCenser(pos) {
  const group = new THREE.Group(); group.position.set(pos.x * 2, 0, pos.z * 2); courtyard.add(group);
  cylinder(group, .42, .68, .35, materials.gold, 0, .24, 0, 12);
  cylinder(group, .76, .65, .15, materials.bronze, 0, .48, 0, 14);
  cylinder(group, .73, .73, .09, materials.gold, 0, .58, 0, 14);
  cylinder(group, .57, .5, .48, materials.bronze, 0, .86, 0, 14);
  cylinder(group, .7, .72, .13, materials.gold, 0, 1.13, 0, 14);
  cylinder(group, .56, .56, .07, materials.darkWood, 0, 1.17, 0, 14);
  cylinder(group, .48, .48, .055, mat('#332d27'), 0, 1.28, 0, 14);
  const ember = new THREE.MeshBasicMaterial({ color: '#ff9c36' });
  sphere(group, .2, ember, 0, 1.32, 0, 8);
  for (const side of [-1, 1]) {
    beam(group, [side * .56, .88, 0], [side * .98, 1.09, 0], .095, materials.gold);
    sphere(group, .12, materials.gold, side * .99, 1.12, 0, 8);
  }
  for (let i = 0; i < 3; i++) {
    const stick = cylinder(group, .025, .035, .62, mat('#913c2f'), (i - 1) * .14, 1.43, 0, 6); stick.rotation.z = (i - 1) * .11;
    sphere(group, .052, new THREE.MeshBasicMaterial({ color: '#ff6a32' }), (i - 1) * .14, 1.75, 0, 7);
  }
  for (let i = 0; i < 12; i++) {
    const s = sphere(group, .16 + (i % 3) * .025, new THREE.MeshBasicMaterial({ color: '#fff1d4', transparent: true, opacity: .2, depthWrite: false }), Math.sin(i * 3) * .28, 1.72 + i * .34, Math.cos(i * 2.7) * .2, 8);
    smoke.push({ mesh: s, baseY: 1.72 + i * .34, phase: i * .6 });
  }
  addLabel(group, 'LƯ HƯƠNG', 0, 2.85, 0, 2.65);
}

function makeBellTower(pos) {
  const x = pos.x * 2, z = pos.z * 2, group = new THREE.Group(); group.position.set(x, 0, z); courtyard.add(group);
  box(group, 3.3, .28, 3.1, materials.stone, 0, .14, 0);
  for (const px of [-1.1, 1.1]) for (const pz of [-.92, .92]) cylinder(group, .16, .2, 4.2, materials.red, px, 2.35, pz, 10);
  box(group, 2.9, .27, 2.55, materials.darkWood, 0, 4.48, 0);
  curvedRoof(group, 0, 4.55, 0, 4.25, 3.6);
  const bellGroup = new THREE.Group(); bellGroup.position.set(0, 3.08, 0); group.add(bellGroup); bell = bellGroup;
  cylinder(group, .58, .43, .08, materials.gold, 0, 3.02, 0, 18);
  const bellBody = mesh(bellGroup, new THREE.CylinderGeometry(.38, .57, 1.35, 18, 1, true), materials.bronze, 0, -.8, 0);
  cylinder(bellGroup, .57, .59, .15, materials.gold, 0, -1.49, 0, 18);
  cylinder(bellGroup, .08, .08, .64, materials.darkWood, 0, -.56, .25, 8);
  addLabel(group, 'THÁP CHUÔNG', 0, 5.9, 0, 3.35);
  group.userData.bellBody = bellBody;
}

function makeCharacter() {
  const actor = new THREE.Group(); scene.add(actor);
  const robeMat = mat('#557760', .86), sashMat = mat('#a64837', .72), skinMat = mat('#d8b38f', .92), dark = mat('#332c2b');
  const trousers = mat('#3c3935'), shoeMat = mat('#302b28'), eyeWhite = mat('#f2eee4'), iris = mat('#382d27');
  const torso = new THREE.Group(); actor.add(torso);
  mesh(torso, new THREE.CylinderGeometry(.29, .43, .86, 18), robeMat, 0, .87, 0);
  mesh(torso, new THREE.CylinderGeometry(.3, .49, .42, 18), robeMat, 0, .43, 0);
  cylinder(torso, .34, .35, .105, sashMat, 0, .75, 0, 18);
  cylinder(torso, .435, .48, .09, mat('#b79a68'), 0, .235, 0, 18);
  // Overlapping collar panels and a visible sash give the robe a tailored silhouette.
  box(torso, .12, .48, .035, sashMat, -.065, 1.12, -.315).rotation.z = -.22;
  box(torso, .12, .48, .035, mat('#d8c49a'), .065, 1.12, -.315).rotation.z = .22;
  box(torso, .1, .55, .045, sashMat, .09, 1.04, -.335).rotation.z = -.12;
  const neck = cylinder(torso, .09, .105, .2, skinMat, 0, 1.4, 0, 12);
  neck.castShadow = true;
  const head = sphere(torso, .235, skinMat, 0, 1.68, 0, 18); head.scale.set(.9, 1.08, .82);
  for (const side of [-1, 1]) sphere(torso, .065, skinMat, side * .205, 1.68, -.005, 9);
  // Eyes, brows, nose and mouth face toward the character's forward (-Z) direction.
  for (const side of [-1, 1]) {
    sphere(torso, .038, eyeWhite, side * .082, 1.725, -.177, 9);
    sphere(torso, .02, iris, side * .082, 1.724, -.209, 8);
    box(torso, .085, .022, .025, dark, side * .082, 1.78, -.178);
  }
  sphere(torso, .036, skinMat, 0, 1.69, -.215, 8);
  box(torso, .075, .014, .018, mat('#815950'), 0, 1.615, -.184);
  const maleHair = new THREE.Group(); torso.add(maleHair);
  const maleCap = sphere(maleHair, .24, dark, 0, 1.82, .025, 14); maleCap.scale.set(1.02, .47, .98);
  for (const side of [-1, 1]) box(maleHair, .07, .2, .14, dark, side * .19, 1.68, .025);
  const femaleHair = new THREE.Group(); torso.add(femaleHair);
  const femaleCap = sphere(femaleHair, .24, dark, 0, 1.82, .045, 14); femaleCap.scale.set(1.04, .5, 1.02);
  const backHair = sphere(femaleHair, .22, dark, 0, 1.52, .13, 12); backHair.scale.set(1.1, 1.25, .72);
  for (const side of [-1, 1]) {
    const lock = sphere(femaleHair, .14, dark, side * .2, 1.51, -.015, 10); lock.scale.set(.65, 1.45, .8);
    sphere(femaleHair, .035, materials.gold, side * .224, 1.65, -.04, 7);
  }
  sphere(femaleHair, .115, dark, 0, 2.015, .12, 10);
  const femaleSash = new THREE.Group(); torso.add(femaleSash);
  beam(femaleSash, [-.3, 1.3, -.18], [.28, .78, -.2], .055, mat('#ead4aa'), 8);
  sphere(femaleSash, .065, materials.gold, .28, .78, -.2, 8);
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * .34, 1.23, 0); torso.add(arm);
    sphere(arm, .16, robeMat, 0, -.015, 0, 10);
    cylinder(arm, .125, .105, .42, robeMat, 0, -.22, 0, 10);
    cylinder(arm, .095, .085, .36, skinMat, 0, -.59, -.015, 10);
    sphere(arm, .085, skinMat, 0, -.79, -.025, 9); arms.push(arm);
    const leg = new THREE.Group(); leg.position.set(side * .16, .39, 0); actor.add(leg);
    cylinder(leg, .14, .15, .34, trousers, 0, -.14, 0, 10);
    cylinder(leg, .12, .13, .34, trousers, 0, -.46, 0, 10);
    const shoe = box(leg, .22, .12, .34, shoeMat, 0, -.66, -.055);
    legs.push(leg);
  }
  const beadMat = mat('#e2bc75', .35, .15);
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9;
    sphere(torso, .032, beadMat, Math.sin(a) * .18, 1.0 + Math.cos(a) * .12, -.32, 7);
  }
  const name = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(''), transparent: true, depthTest: false }));
  name.scale.set(2.35, .58, 1); name.position.set(0, 2.3, 0); name.renderOrder = 5; actor.add(name);
  actor.userData = { torso, arms, legs, robeMat, sashMat, maleHair, femaleHair, femaleSash, name, currentName: '', lastProfile: '' };
  return actor;
}

mountainTerrain();
const trail = buildStairway();
gate(climb, 0, trail.height - .48, trail.length + 1.6);
lanternsAndClouds();
makeCourtyard();
const actor = makeCharacter();
const clock = new THREE.Clock();
const cameraTarget = new THREE.Vector3(), cameraDesired = new THREE.Vector3(), lookTarget = new THREE.Vector3();
let activeInside = null, yaw = 0, tilt = .24, walking = false, frame = 0, actorHeading = Math.PI, targetActorHeading = Math.PI;

function refreshProfile() {
  const profile = game.getProfile(), d = actor.userData;
  const name = profile?.name || '';
  const gender = profile?.gender || (profile?.avatar === 'tam-sen' ? 'female' : 'male');
  const signature = `${name}|${profile?.avatar || ''}|${gender}`;
  if (signature === d.lastProfile) return;
  d.lastProfile = signature;
  d.name.material.map?.dispose(); d.name.material.map = labelTexture(name || 'HÀNH GIẢ'); d.name.material.needsUpdate = true;
  const palette = { 'hanh-gia': ['#557760', '#a64837'], 'lu-khach': ['#536a7d', '#ad7642'], 'tam-sen': ['#9a6678', '#c79b51'], 'giu-niem': ['#685b83', '#b2533a'] };
  const colors = palette[profile?.avatar] || palette['hanh-gia'];
  d.robeMat.color.set(colors[0]); d.sashMat.color.set(colors[1]);
  d.maleHair.visible = gender !== 'female'; d.femaleHair.visible = gender === 'female'; d.femaleSash.visible = gender === 'female';
}

function positionTargets() {
  const state = game.getState();
  const inside = !!state.inside;
  const step = Math.max(0, Math.min(108, Number(state.routeStep) || 0));
  const climbY = step === 0 ? 0 : (step - 1) * trail.rise + .16;
  if (inside !== activeInside) {
    activeInside = inside; climb.visible = !inside; courtyard.visible = inside;
    actor.position.set(inside ? (state.worldX || 0) * 2 : 0, inside ? 0.12 : climbY, inside ? (state.worldZ ?? 3) * 2 : step * trail.depth);
    yaw = 0; tilt = .24; actorHeading = targetActorHeading = inside ? 0 : Math.PI;
    scene.fog.near = inside ? 25 : 34; scene.fog.far = inside ? 78 : 125;
  }
  const targetX = inside ? (state.worldX || 0) * 2 : 0;
  const targetZ = inside ? (state.worldZ ?? 3) * 2 : step * trail.depth;
  const targetY = inside ? .12 : climbY;
  cameraTarget.set(targetX, targetY, targetZ);
  actor.userData.targetX = targetX; actor.userData.targetY = targetY; actor.userData.targetZ = targetZ;
  const profile = game.getProfile();
  const forwardX = Math.sin(yaw), forwardZ = Math.cos(yaw) * (inside ? -1 : 1);
  actor.rotation.y = actorHeading;
  const behind = inside ? 1 : -1;
  cameraDesired.set(targetX - forwardX * 6.4, targetY + 3.35 + tilt * 4, targetZ + behind * Math.cos(yaw) * 7.1);
  lookTarget.set(targetX + forwardX * 2.7, targetY + 1.05, targetZ + forwardZ * 3.7);
  refreshProfile();
}

function resize() {
  const rect = stage.getBoundingClientRect(); if (!rect.width || !rect.height) return;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.65);
  renderer.setPixelRatio(pixelRatio); renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height; camera.fov = rect.width < 390 ? 52 : 49; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}

const canvas = renderer.domElement;
let drag = null;
canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  yaw = THREE.MathUtils.clamp(yaw - dx * .006, -1.05, 1.05); tilt = THREE.MathUtils.clamp(tilt + dy * .0013, -.15, .55);
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

function animate() {
  const dt = Math.min(clock.getDelta(), .04), elapsed = clock.elapsedTime, state = game.getState();
  positionTargets();
  for (let i = 0; i < birds.length; i++) {
    const bird = birds[i], flap = Math.sin(elapsed * 7 + i * 2.4) * .35;
    bird.userData.wings.forEach(wing => { wing.rotation.z = wing.userData.side * flap; });
    bird.position.y = bird.userData.baseY + Math.sin(elapsed * 1.3 + i) * .035;
  }
  const d = actor.userData, dx = d.targetX - actor.position.x, dy = d.targetY - actor.position.y, dz = d.targetZ - actor.position.z;
  const turnDelta = Math.atan2(Math.sin(targetActorHeading - actorHeading), Math.cos(targetActorHeading - actorHeading));
  actorHeading += turnDelta * (1 - Math.exp(-dt * 16)); actor.rotation.y = actorHeading;
  const distance = Math.hypot(dx, dz);
  walking = distance > .035;
  const ease = 1 - Math.exp(-dt * (walking ? 4.3 : 7.2));
  actor.position.x += dx * ease; actor.position.y += dy * ease; actor.position.z += dz * ease;
  d.torso.position.y = walking ? Math.abs(Math.sin(elapsed * 8.5)) * .045 : Math.sin(elapsed * 1.1) * .012;
  d.legs[0].rotation.x = walking ? Math.sin(elapsed * 8.5) * .46 : 0;
  d.legs[1].rotation.x = walking ? Math.sin(elapsed * 8.5 + Math.PI) * .46 : 0;
  d.arms[0].rotation.x = walking ? Math.sin(elapsed * 8.5 + Math.PI) * .3 : .08;
  d.arms[1].rotation.x = walking ? Math.sin(elapsed * 8.5) * .3 : -.08;
  const inside = !!state.inside, fwdX = Math.sin(yaw), fwdZ = Math.cos(yaw) * (inside ? -1 : 1), behind = inside ? 1 : -1;
  cameraDesired.set(actor.position.x - fwdX * 6.4, actor.position.y + 3.35 + tilt * 4, actor.position.z + behind * Math.cos(yaw) * 7.1);
  camera.position.lerp(cameraDesired, 1 - Math.exp(-dt * 3.6));
  lookTarget.set(actor.position.x + fwdX * 2.7, actor.position.y + 1.05, actor.position.z + fwdZ * 3.7); camera.lookAt(lookTarget);
  sky.position.copy(camera.position);
  for (const item of fish) {
    item.group.position.x = item.origin.x + Math.sin(elapsed * .7 + item.phase) * 1.15;
    item.group.position.z = item.origin.z + Math.cos(elapsed * .48 + item.phase) * .75;
    item.group.rotation.y = Math.atan2(Math.cos(elapsed * .48 + item.phase), Math.sin(elapsed * .7 + item.phase));
  }
  for (const item of smoke) { item.mesh.position.y = item.baseY + ((elapsed * .18 + item.phase) % 1.5); item.mesh.material.opacity = .18 * (1 - ((elapsed * .18 + item.phase) % 1.5) / 1.5); item.mesh.position.x = Math.sin(elapsed + item.phase) * .22; }
  paintMeritStele(game.getState().releasedFish || 0);
  if (bell) { bellWobble *= Math.exp(-dt * 3.6); bell.rotation.z = Math.sin(elapsed * 24) * bellWobble * .08; }
  climb.children.filter(o => o.name === 'cloud').forEach(o => { o.position.x = o.userData.initialX + Math.sin(elapsed * o.userData.drift + o.position.z) * 1.2; });
  renderer.render(scene, camera);
  frame++;
}

window.voUu3d = {
  resize,
  render() { positionTargets(); renderer.render(scene, camera); },
  ringBell() { bellWobble = Math.min(1, bellWobble + .85); },
  setSoundEnabled(enabled) {
    if (window.voUuBirdTimer) clearTimeout(window.voUuBirdTimer);
    if (!enabled) return;
    const sing = () => {
      if (!game.soundEnabled?.()) return;
      try {
        const ctx = window.voUuAudioContext || (window.voUuAudioContext = new (window.AudioContext || window.webkitAudioContext)());
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime, base = 1700 + Math.random() * 700;
        [0, .17, .39].forEach((offset, index) => {
          const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'sine';
          osc.frequency.setValueAtTime(base + index * 260, now + offset);
          osc.frequency.exponentialRampToValueAtTime(base * .78, now + offset + .11);
          gain.gain.setValueAtTime(.0001, now + offset); gain.gain.exponentialRampToValueAtTime(.025, now + offset + .025); gain.gain.exponentialRampToValueAtTime(.0001, now + offset + .14);
          osc.connect(gain); gain.connect(ctx.destination); osc.start(now + offset); osc.stop(now + offset + .15);
        });
      } catch {}
      window.voUuBirdTimer = setTimeout(sing, 9000 + Math.random() * 9000);
    };
    window.voUuBirdTimer = setTimeout(sing, 1800 + Math.random() * 1800);
  },
  faceDirection(direction) {
    const headings = game.getState().inside
      ? { up: 0, down: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }
      : { up: Math.PI, down: 0 };
    if (!(direction in headings)) return false;
    targetActorHeading = headings[direction];
    return Math.abs(Math.atan2(Math.sin(targetActorHeading - actorHeading), Math.cos(targetActorHeading - actorHeading))) > .08;
  },
};
resize();
renderer.setAnimationLoop(animate);

