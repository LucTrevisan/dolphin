/**
 * Prepara o GLB “2021 BYD Dolphin EV” (Ddiaz Design, Sketchfab, CC BY-NC-SA 4.0) para o app.
 *
 * O arquivo original agrupa a geometria por MATERIAL (36 malhas com nomes em hash: toda a pintura
 * numa malha, todo o plástico em outra…). O app reconhece as peças pelos nomes (components.js) e
 * abre as portas por conjunto (doors.js), então este script reorganiza o modelo em peças nomeadas:
 *
 *   BYD_Dolphin
 *   ├── carroceria               pintura, para-choques, faróis (headlight_*), lanternas (taillight_*)
 *   ├── porta_dianteira_esquerda / _direita        (com retrovisor, vidro e forro)
 *   ├── porta_traseira_esquerda  / _direita
 *   ├── porta_malas              tampa traseira (vidro, barra de luz, aerofólio)
 *   ├── roda_dianteira_esquerda … roda_traseira_direita   (pneu, aro e freio)
 *   ├── interior                 bancos, painel, volante, forros
 *   ├── vidros                   para-brisa e vidros fixos
 *   └── chassi                   assoalho inferior
 *
 * Como: cada malha é dividida em componentes conexos (vértices soldados por posição) e cada
 * componente é atribuído a uma peça pelo material e pela posição. A porta traseira e a tampa
 * traseira vêm fundidas à carroceria no original; elas são recortadas triângulo a triângulo.
 * As transformações são aplicadas aos vértices e o carro sai em metros, com o entre-eixos real
 * do Dolphin (2,70 m), frente em +Z, teto em +Y.
 *
 * Uso (depois, otimize com `npm run otimizar-modelo`):
 *   npm run preparar-dolphin -- modelos-originais/2021_byd_dolphin_ev.glb modelos-originais/2021_byd_dolphin_ev.preparado.glb
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";

const args = process.argv.slice(2);
const [input, outputArg] = args.filter((a) => !a.startsWith("--"));
const debug = args.includes("--debug");
if (!input) {
  console.error("Uso: npm run preparar-dolphin -- original.glb [preparado.glb] [--debug]");
  process.exit(1);
}
const output = outputArg ?? input.replace(/\.glb$/i, "") + ".preparado.glb";

/** Entre-eixos do BYD Dolphin (m): define a escala final. */
const WHEELBASE = 2.7;
/**
 * Coordenadas de trabalho: o carro medido com 4,28 m de comprimento, frente +Z e lado ESQUERDO +X
 * (convenção glTF). Todos os limites abaixo estão nesse referencial.
 */
const WORK_LENGTH = 4.28;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const root = doc.getRoot();

// ----------------------------------------------------------------------------- geometria de trabalho

const sources = [];
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  for (const prim of mesh.listPrimitives()) sources.push({ node, prim, matrix: node.getWorldMatrix() });
}

// Escala de trabalho a partir do comprimento bruto.
let rawMin = Infinity;
let rawMax = -Infinity;
for (const s of sources) {
  const pos = s.prim.getAttribute("POSITION");
  const t = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) {
    const z = transformPoint(s.matrix, pos.getElement(i, t))[2];
    rawMin = Math.min(rawMin, z);
    rawMax = Math.max(rawMax, z);
  }
}
const workScale = WORK_LENGTH / (rawMax - rawMin);

const comps = [];
for (const s of sources) {
  const { prim } = s;
  const material = prim.getMaterial()?.getName() ?? "";
  const pos = prim.getAttribute("POSITION");
  const n = pos.getCount();
  const P = new Float64Array(n * 3);
  const t = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const w = transformPoint(s.matrix, pos.getElement(i, t));
    P[i * 3] = w[0] * workScale;
    P[i * 3 + 1] = w[1] * workScale;
    P[i * 3 + 2] = w[2] * workScale;
  }
  const indices = prim.getIndices();
  const tris = indices ? Array.from({ length: indices.getCount() }, (_, i) => indices.getScalar(i)) : Array.from({ length: n }, (_, i) => i);
  s.P = P;
  s.tris = tris;
  s.material = material;

  // Componentes conexos: vértices na mesma posição (0,5 mm) contam como um só.
  const keyOf = new Map();
  const weld = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(P[i * 3] * 2000)},${Math.round(P[i * 3 + 1] * 2000)},${Math.round(P[i * 3 + 2] * 2000)}`;
    if (!keyOf.has(k)) keyOf.set(k, keyOf.size);
    weld[i] = keyOf.get(k);
  }
  const parent = Int32Array.from({ length: keyOf.size }, (_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  for (let i = 0; i < tris.length; i += 3) {
    const a = find(weld[tris[i]]);
    const b = find(weld[tris[i + 1]]);
    const c = find(weld[tris[i + 2]]);
    parent[a] = b;
    parent[find(c)] = find(b);
  }
  const byRoot = new Map();
  for (let i = 0; i < tris.length; i += 3) {
    const r = find(weld[tris[i]]);
    if (!byRoot.has(r)) byRoot.set(r, { source: s, material, tris: [], verts: new Set() });
    const c = byRoot.get(r);
    c.tris.push(i);
    for (let k = 0; k < 3; k++) c.verts.add(tris[i + k]);
  }
  for (const c of byRoot.values()) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const v of c.verts) {
      for (let k = 0; k < 3; k++) {
        b[k] = Math.min(b[k], P[v * 3 + k]);
        b[k + 3] = Math.max(b[k + 3], P[v * 3 + k]);
      }
    }
    c.n = c.verts.size;
    c.min = b.slice(0, 3);
    c.max = b.slice(3);
    c.center = [0, 1, 2].map((k) => (b[k] + b[k + 3]) / 2);
    c.size = [0, 1, 2].map((k) => b[k + 3] - b[k]);
    comps.push(c);
  }
}

// ----------------------------------------------------------------------------- referências do carro

const isMat = (c, ...names) => names.includes(c.material);
const EXTERIOR = new Set(["D_Paint_Color", "D_col_plas", "D_M_Color", "D_Color_2", "D_Light_Emiss", "D_glass_Plastic", "D_tire"]);
const INTERIOR = new Set([
  "D_Cuero_1", "D_Cuero_2", "D_Cuero_3", "D_Cuero_4", "D_Til", "D_Til_2", "D_Orange_ST", "Speaker", "D_Dashboard",
  "D_orange", "D_carpet", "D_Roof", "D_Buttons", "phong6", "D_PlasIN", "D_Plastic_N_2",
]);

// Rodas: os pneus, agrupados por lado e eixo.
const wheels = {};
for (const c of comps.filter((c) => isMat(c, "D_tire"))) {
  const key = `${c.center[2] > 0 ? "dianteira" : "traseira"}_${c.center[0] > 0 ? "esquerda" : "direita"}`;
  const w = (wheels[key] ??= { key, min: [...c.min], max: [...c.max] });
  for (let k = 0; k < 3; k++) {
    w.min[k] = Math.min(w.min[k], c.min[k]);
    w.max[k] = Math.max(w.max[k], c.max[k]);
  }
}
if (Object.keys(wheels).length !== 4) throw new Error(`Esperava 4 rodas, encontrei ${Object.keys(wheels).length}.`);
const axleZ = (end) => {
  const list = Object.values(wheels).filter((w) => w.key.startsWith(end));
  return list.reduce((s, w) => s + (w.min[2] + w.max[2]) / 2, 0) / list.length;
};
const finalScale = WHEELBASE / (axleZ("dianteira") - axleZ("traseira"));

/** Recortes de portas (referencial de trabalho). */
const B_PILLAR_Z = -0.268; // fresta entre a porta dianteira e a traseira
const FRONT_DOOR = [-0.3, 0.98];
const REAR_DOOR = [-1.34, -0.25];
const REAR_DOOR_TOP = 1.21; // linha de cintura: acima dela, o contorno da janela fica na carroceria
/** Tampa traseira: tudo atrás de z = −1,36, entre as colunas e acima da linha do para-choque. */
const TAILGATE = { halfWidth: 0.715, bottom: 0.79, front: -1.42 };

/** Cabine (para separar plástico interno do externo): abaixo do para-brisa e do vidro traseiro. */
function inCabin([x, y, z]) {
  if (Math.abs(x) > 0.8 || y < 0.22 || y > 1.53 || z > 1.42 || z < -1.97) return false;
  if (y > 1.01 + 0.45 * (1.42 - z)) return false; // à frente/acima do para-brisa
  if (z < -1.48 && y > 1.21 + (z + 1.85) * 0.838) return false; // atrás do vidro traseiro
  return true;
}

const inside = (c, min, max, tol = 0) => [0, 1, 2].every((k) => c.min[k] >= min[k] - tol && c.max[k] <= max[k] + tol);
const sideName = (x) => (x > 0 ? "esquerda" : "direita");

// O contorno lateral (porta traseira + moldura das janelas) e a traseira (tampa + laterais) vêm
// fundidos: são recortados triângulo a triângulo.
const isSideRing = (c) =>
  isMat(c, "D_Paint_Color") && c.n > 2000 && c.min[2] < -1.2 && c.max[2] > 0.9 && Math.abs(c.center[0]) > 0.6;
const isRearBody = (c) => isMat(c, "D_Paint_Color") && c.n > 5000 && c.min[2] < -2.1 && c.max[2] > -1.3 && c.size[0] > 1.8;

// ----------------------------------------------------------------------------- classificação

/** Peça de um componente: "conjunto/nome". */
function classify(c) {
  const [x, y, z] = c.center;
  const side = sideName(x);

  // Rodas: o componente cabe inteiro na caixa de um pneu (aro, calota, parafusos, freio).
  for (const w of Object.values(wheels)) {
    if (!inside(c, w.min, w.max, 0.02)) continue;
    const asm = `roda_${w.key}`;
    if (isMat(c, "D_tire")) return `${asm}/pneu`;
    // Disco e pinça ficam atrás do aro (mais para dentro), na malha de plástico principal.
    const wheelX = (w.min[0] + w.max[0]) / 2;
    const inboard = Math.abs(x) < Math.abs(wheelX) + 0.06 && /4092bf/.test(c.source.node.getName());
    if (inboard) return `${asm}/${c.size[1] > 0.28 ? "freio_disco" : "freio_pinca"}`;
    return `${asm}/aro`;
  }

  // Assoalho inferior e fechamentos das caixas de roda.
  if (isMat(c, "D_Plastic") && c.size[2] > 4 && c.max[1] < 0.8) return "chassi/assoalho";

  // Tampa traseira.
  if (
    !INTERIOR.has(c.material) &&
    Math.max(Math.abs(c.min[0]), Math.abs(c.max[0])) <= 0.77 &&
    c.min[1] >= 0.78 &&
    c.max[2] <= -1.36 &&
    c.min[2] < -1.45
  ) {
    return "porta_malas/tampa";
  }

  // Portas laterais: peças externas a partir de 0,6 m do centro; forros a partir de 0,715 m.
  const minAbsX = Math.min(Math.abs(c.min[0]), Math.abs(c.max[0]));
  const sameSide = Math.sign(c.min[0]) === Math.sign(c.max[0]);
  const doorMat = !isMat(c, "D_Roof", "D_carpet", "D_tire", "D_Light_Emiss", "D_glass_Plastic", "D_Color_2");
  const outboard = minAbsX >= (INTERIOR.has(c.material) || isMat(c, "D_Plastic", "D_Details", "D_badges") ? 0.715 : 0.6);
  if (doorMat && sameSide && outboard && c.min[1] >= 0.2 && c.max[1] <= 1.58) {
    if (c.min[2] >= FRONT_DOOR[0] - 0.035 && c.max[2] <= FRONT_DOOR[1] + 0.035) return `porta_dianteira_${side}/porta`;
    if (c.min[2] >= REAR_DOOR[0] - 0.035 && c.max[2] <= REAR_DOOR[1] + 0.035) return `porta_traseira_${side}/porta`;
  }

  // Tomada de recarga (CCS2: Tipo 2 + CC) no para-lama dianteiro direito.
  if (isMat(c, "D_Plastic") && inside(c, [-0.93, 0.79, 1.12], [-0.81, 0.95, 1.33])) return "carroceria/tomada_recarga";

  // Volante (lado do motorista, +X): aro, raios, botões e cubo — sem a coluna e o quadro de
  // instrumentos, que ficam à frente (o app posiciona o banco do motorista pelo volante).
  const wheelCenter = [0.4, 0.975, 0.43];
  if (!EXTERIOR.has(c.material) && Math.hypot(x - wheelCenter[0], y - wheelCenter[1], z - wheelCenter[2]) < 0.2 && z < 0.535) {
    return "interior/volante";
  }

  // Vidros e lentes das luzes.
  if (isMat(c, "D_glass")) {
    if (inCabin(c.center) && Math.max(...c.size) < 0.15) return "interior/tela";
    if (z > 1.5 && y < 1.0) return `carroceria/headlight_lente_${Math.abs(x) < 0.3 ? "centro" : side}`;
    if (z < -1.6 && y < 1.15) return `carroceria/taillight_lente_${side}`;
    return "vidros/vidro";
  }
  if (isMat(c, "D_Light_Emiss", "D_glass_Plastic")) {
    if (z > 0) return `carroceria/headlight_${Math.abs(x) < 0.3 ? "centro" : side}`;
    return `carroceria/taillight_${Math.abs(x) < 0.3 ? "centro" : side}`;
  }

  // Emblemas: o logotipo do quadro de instrumentos fica no interior; os de fora (inclusive o
  // acabamento da coluna C, que fica junto do vidro) na carroceria.
  if (isMat(c, "D_badges")) return inCabin(c.center) && Math.max(...c.size) < 0.15 ? "interior/interior" : "carroceria/carroceria";
  if (EXTERIOR.has(c.material)) return "carroceria/carroceria";
  if (INTERIOR.has(c.material)) return inCabin(c.center) ? "interior/interior" : "carroceria/carroceria";
  // Plásticos e cromados usados por dentro e por fora. Nas laterais, acima da linha de cintura, são
  // acabamentos externos das janelas (ex.: o triângulo preto atrás da porta traseira).
  if (minAbsX >= 0.66 && sameSide && c.min[1] >= 1.0) return "carroceria/carroceria";
  return inCabin(c.center) ? "interior/interior" : "carroceria/carroceria";
}

/**
 * Recorte dos componentes fundidos: contorno lateral → porta traseira (abaixo da linha de cintura,
 * atrás da fresta da coluna B) e traseira → tampa (entre as colunas, acima da linha do para-choque).
 * Os triângulos da borda são CORTADOS nos planos do recorte, com posição, normal e UV interpolados:
 * a borda sai reta, sem o serrilhado de mandar triângulos inteiros para um lado ou outro.
 * Devolve [[peça, triângulo], …]; cada vértice é um índice original ou { mix: [[índice, peso], …] }.
 */
function cutTriangle(c, i) {
  const { P, tris } = c.source;
  const ring = isSideRing(c);
  const opening = ring ? `porta_traseira_${sideName(c.center[0])}/porta` : "porta_malas/tampa";
  // Planos do recorte: f(p) ≥ 0 do lado da peça que abre.
  const planes = ring
    ? [(p) => B_PILLAR_Z - p[2], (p) => REAR_DOOR_TOP - p[1], (p) => p[1] - 0.24]
    : [(p) => TAILGATE.halfWidth - p[0], (p) => p[0] + TAILGATE.halfWidth, (p) => p[1] - TAILGATE.bottom, (p) => TAILGATE.front - p[2]];
  const ids = [tris[i], tris[i + 1], tris[i + 2]];
  const pos = ids.map((v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
  if (planes.every((f) => pos.every((p) => f(p) >= 0))) return [[opening, ids]];
  if (planes.some((f) => pos.every((p) => f(p) <= 0))) return [["carroceria/carroceria", ids]];

  let poly = ids.map((v, k) => ({ pos: pos[k], mix: [[v, 1]] }));
  const pieces = [];
  for (const f of planes) {
    const [inPart, outPart] = splitPolygon(poly, f);
    if (outPart) pieces.push(["carroceria/carroceria", outPart]);
    poly = inPart;
    if (!poly) break;
  }
  if (poly) pieces.push([opening, poly]);
  const ref = (p) => (p.mix.length === 1 && p.mix[0][1] === 1 ? p.mix[0][0] : { mix: p.mix });
  // Polígono convexo → leque de triângulos (a ordem dos vértices preserva a face).
  return pieces.flatMap(([part, pg]) => pg.slice(1, -1).map((_, k) => [part, [ref(pg[0]), ref(pg[k + 1]), ref(pg[k + 2])]]));
}

/** Sutherland–Hodgman: divide um polígono pelo plano f(p) = 0 em [parte com f ≥ 0, parte com f ≤ 0]. */
function splitPolygon(poly, f) {
  const inside = [];
  const outside = [];
  const vals = poly.map((p) => f(p.pos));
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k];
    const b = poly[(k + 1) % poly.length];
    const fa = vals[k];
    const fb = vals[(k + 1) % poly.length];
    if (fa >= 0) inside.push(a);
    if (fa <= 0) outside.push(a);
    if ((fa > 0 && fb < 0) || (fa < 0 && fb > 0)) {
      const t = fa / (fa - fb);
      const mix = new Map();
      for (const [v, w] of a.mix) mix.set(v, (mix.get(v) ?? 0) + w * (1 - t));
      for (const [v, w] of b.mix) mix.set(v, (mix.get(v) ?? 0) + w * t);
      const p = { pos: a.pos.map((x, j) => x + (b.pos[j] - x) * t), mix: [...mix] };
      inside.push(p);
      outside.push(p);
    }
  }
  return [inside.length >= 3 ? inside : null, outside.length >= 3 ? outside : null];
}

// ----------------------------------------------------------------------------- montagem do novo GLB

/**
 * Os insertos das rodas usam a tinta da carroceria no original. Um material próprio (D_Paint_Roda,
 * grafite como nas rodas do Dolphin) deixa trocar a cor do carro sem pintar as rodas; a cor final
 * pode ser ajustada no config (materials.D_Paint_Roda).
 */
const wheelPaint = new Map();
const materialFor = (part, mat) => {
  if (!part.startsWith("roda_") || mat?.getName() !== "D_Paint_Color") return mat;
  if (!wheelPaint.has(mat)) {
    wheelPaint.set(mat, mat.clone().setName("D_Paint_Roda").setBaseColorFactor([0.04, 0.045, 0.052, 1]).setRoughnessFactor(0.35));
  }
  return wheelPaint.get(mat);
};

/** part → material → { source → triângulos ([ref, ref, ref], ref = índice ou { mix }) } */
const buckets = new Map();
const add = (part, c, tri) => {
  if (!buckets.has(part)) buckets.set(part, new Map());
  const byMat = buckets.get(part);
  const mat = materialFor(part, c.source.prim.getMaterial());
  if (!byMat.has(mat)) byMat.set(mat, new Map());
  const bySource = byMat.get(mat);
  if (!bySource.has(c.source)) bySource.set(c.source, []);
  bySource.get(c.source).push(tri);
};
const report = new Map();
for (const c of comps) {
  const { tris } = c.source;
  if (isSideRing(c) || isRearBody(c)) {
    for (const i of c.tris) for (const [part, tri] of cutTriangle(c, i)) add(part, c, tri);
    continue;
  }
  const part = classify(c);
  for (const i of c.tris) add(part, c, [tris[i], tris[i + 1], tris[i + 2]]);
  if (debug) {
    if (!report.has(part)) report.set(part, []);
    report.get(part).push(c);
  }
}
if (debug) {
  const f = (v) => v.toFixed(2).padStart(6);
  for (const [part, list] of [...report].sort()) {
    console.log(`\n${part}`);
    for (const c of list.sort((a, b) => b.n - a.n).slice(0, 40)) {
      console.log(`  ${c.material.padEnd(16)} v=${String(c.n).padStart(6)} x[${f(c.min[0])},${f(c.max[0])}] y[${f(c.min[1])},${f(c.max[1])}] z[${f(c.min[2])},${f(c.max[2])}]`);
    }
  }
}

const sceneRoot = doc.createNode("BYD_Dolphin");
const assemblies = new Map();
let triangles = 0;
for (const [part, byMat] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) {
  const [asmName, partName] = part.split("/");
  if (!assemblies.has(asmName)) {
    const node = doc.createNode(asmName);
    sceneRoot.addChild(node);
    assemblies.set(asmName, node);
  }
  let index = 0;
  for (const [material, bySource] of byMat) {
    const prim = buildPrimitive(material, bySource);
    triangles += prim.getIndices().getCount() / 3;
    // Nome sem o material: os padrões do app testam o nome da malha (ex.: "D_Roof" casaria com "roof").
    const name = `${asmName === partName ? asmName : `${asmName}_${partName}`}_${++index}`;
    const mesh = doc.createMesh(name).addPrimitive(prim);
    assemblies.get(asmName).addChild(doc.createNode(name).setMesh(mesh));
  }
}

// Substitui a cena original pela reorganizada.
for (const scene of root.listScenes()) for (const child of scene.listChildren()) scene.removeChild(child);
(root.getDefaultScene() ?? root.listScenes()[0] ?? doc.createScene("Scene")).addChild(sceneRoot);
for (const node of root.listNodes()) if (node !== sceneRoot && !sceneRoot.listChildren().includes(node) && !isDescendant(node, sceneRoot)) node.dispose();
for (const mesh of root.listMeshes()) if (!mesh.listParents().some((p) => p.propertyType === "Node")) mesh.dispose();
await doc.transform(prune());

await io.write(output, doc);
const summary = [...assemblies.keys()].join(", ");
console.log(`${input} → ${output}`);
console.log(`  escala ×${(workScale * finalScale).toFixed(5)} (entre-eixos ${WHEELBASE} m) · ${Math.round(triangles).toLocaleString("pt-BR")} triângulos`);
console.log(`  conjuntos: ${summary}`);

// ----------------------------------------------------------------------------- utilidades

function buildPrimitive(material, bySource) {
  const out = doc.createPrimitive().setMaterial(material);
  // Semânticas comuns a todas as origens (normalmente POSITION, NORMAL, TEXCOORD_0).
  const sourcesList = [...bySource.keys()];
  const semantics = sourcesList[0].prim.listSemantics().filter((sem) => sourcesList.every((s) => s.prim.getAttribute(sem)));
  const data = Object.fromEntries(semantics.map((sem) => [sem, []]));
  const indices = [];
  let base = 0;
  for (const [s, triangles] of bySource) {
    // Vértices originais são compartilhados; os criados no recorte ({ mix }) entram um a um.
    const remap = new Map();
    const order = [];
    for (const tri of triangles) {
      for (const ref of tri) {
        if (typeof ref !== "number") {
          indices.push(base + order.length);
          order.push(ref.mix);
          continue;
        }
        if (!remap.has(ref)) {
          remap.set(ref, base + order.length);
          order.push([[ref, 1]]);
        }
        indices.push(remap.get(ref));
      }
    }
    const m = s.matrix;
    const flip = det3(m) < 0;
    for (const sem of semantics) {
      const acc = s.prim.getAttribute(sem);
      const size = acc.getElementSize();
      const arr = acc.getArray();
      const integer = !(arr instanceof Float32Array);
      // Média ponderada do atributo nos vértices de origem (um só vértice com peso 1 = cópia).
      const blend = (mix) => {
        const out = new Array(size).fill(0);
        for (const [v, w] of mix) for (let k = 0; k < size; k++) out[k] += arr[v * size + k] * w;
        return out;
      };
      for (const mix of order) {
        if (sem === "POSITION") {
          const p = [0, 0, 0];
          for (const [v, w] of mix) for (let k = 0; k < 3; k++) p[k] += s.P[v * 3 + k] * w;
          data[sem].push(...p.map((x) => x * finalScale));
        } else if (sem === "NORMAL" || sem === "TANGENT") {
          const e = mix.length === 1 ? acc.getElement(mix[0][0], new Array(size).fill(0)) : blend(mix);
          const d = normalize(transformDir(m, e));
          const w = size === 4 ? Math.sign(acc.getElement(mix[0][0], [0, 0, 0, 0])[3]) || 1 : null;
          data[sem].push(...d, ...(size === 4 ? [flip ? -w : w] : []));
        } else {
          const e = blend(mix);
          data[sem].push(...(integer ? e.map(Math.round) : e));
        }
      }
    }
    base += order.length;
    if (flip) for (let i = indices.length - triangles.length * 3; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  }
  const buffer = root.listBuffers()[0];
  for (const sem of semantics) {
    const src = sourcesList[0].prim.getAttribute(sem);
    const Typed = ["POSITION", "NORMAL", "TANGENT"].includes(sem) ? Float32Array : src.getArray().constructor;
    const acc = doc
      .createAccessor()
      .setType(src.getType())
      .setArray(new Typed(data[sem]))
      .setNormalized(["POSITION", "NORMAL", "TANGENT"].includes(sem) ? false : src.getNormalized())
      .setBuffer(buffer);
    out.setAttribute(sem, acc);
  }
  const Index = base > 65535 ? Uint32Array : Uint16Array;
  out.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Index(indices)).setBuffer(buffer));
  return out;
}

function transformPoint(m, [x, y, z]) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

function transformDir(m, [x, y, z]) {
  return [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
}

function normalize(v) {
  const l = Math.hypot(...v) || 1;
  return v.map((c) => c / l);
}

function det3(m) {
  return m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
}

function isDescendant(node, ancestor) {
  for (let p = node.getParentNode(); p; p = p.getParentNode()) if (p === ancestor) return true;
  return false;
}
