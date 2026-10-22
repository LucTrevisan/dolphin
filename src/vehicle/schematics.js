import { Color3, Matrix, Mesh, MeshBuilder, PBRMaterial, TransformNode, Vector3 } from "../babylon.js";
import { getContent } from "./componentContent.js";

/**
 * Representações ILUSTRATIVAS para componentes internos ausentes no modelo 3D.
 *
 * Modelos comerciais costumam trazer só a carroceria. Cada componente ausente é desenhado em
 * posição típica (calculada pelas medidas do carro e pelos eixos detectados pelas rodas), com
 * detalhes inspirados em fotos reais de trens de força elétricos — bateria em bandeja de alumínio
 * com módulos, barramentos e parafusos; motor de carcaça aletada; inversor e carregador em caixas
 * de alumínio com conectores e cabos laranja de alta tensão. Continuam sempre identificados como
 * "ILUSTRATIVO" nas legendas e nos painéis, e aparecem só no raio X e na vista explodida (com um
 * leve brilho na cor do componente: bateria azul, motor ciano, inversor laranja).
 *
 * Desempenho: geometria procedural (sem arquivos); peças repetidas como thin instances; partes
 * pequenas de cores diferentes unidas numa malha com cor por vértice — 1 a 3 draw calls por peça,
 * só enquanto estão visíveis.
 *
 * drivetrain "front" | "rear" | "awd": um e-Axle (motor + redutor + inversor) por eixo motriz.
 * No AWD, motor/inversor/redutor têm duas peças; `item.parts` lista uma por eixo.
 * powertrain "8em1": o e-Axle vira um só bloco de alumínio, como o conjunto “8 em 1” da BYD
 * (foto do trem de força do Dolphin) — motor e redutor embaixo, caixa da eletrônica (inversor) em
 * cima com tampa parafusada e etiqueta de alta tensão, carregador de bordo atrás e cabo laranja
 * até a bateria. Continuam peças separadas: cada uma é selecionável e se afasta na vista explodida.
 * battery "blade": bateria Blade da BYD (sem módulos, cell-to-pack) — lâminas longas que atravessam
 * o pacote, lado a lado, numa bandeja escura com barramentos nas pontas.
 *
 * Coordenadas no referencial do prato giratório: frente em +Z, lado esquerdo em −X, piso em y = 0.
 * Cada peça é um nó (TransformNode) no centro dela, com as malhas como filhas — é o nó que a vista
 * explodida desloca (`meshes` devolve esses nós).
 */
export function createSchematics(scene, { parent, dims, axles, missing, drivetrain = "front", powertrain = null, battery = null, states }) {
  const items = {};
  const roots = [];
  const all = [];
  if (!missing.length) return { items, meshes: roots, setVisibility() {} };

  const L = dims.length;
  const W = dims.width * 0.86; // largura sem retrovisores (aprox.)
  const front = axles?.front ?? L * 0.31;
  const rear = axles?.rear ?? -L * 0.29;
  const wheelR = axles?.wheelRadius ?? Math.max(0.3, dims.height * 0.21);
  const wheelX = W / 2 - 0.1; // cubo da roda (aprox.)
  const floorY = Math.max(0.16, dims.height * 0.11);
  const axleList = drivetrain === "awd" ? ["front", "rear"] : [drivetrain === "rear" ? "rear" : "front"];
  const axleZ = (a) => (a === "front" ? front : rear);
  const towardCabin = (a) => (a === "front" ? -1 : 1);

  // Mesmas posições e medidas de antes: o fluxo de energia e as legendas usam esses centros.
  // No "8 em 1", motor e redutor encostam um no outro, a caixa da eletrônica assenta sobre eles e o
  // carregador de bordo forma o nível elevado da tampa; o cabo sai da frente da bateria e sobe até a
  // traseira da caixa (lado da cabine).
  const integrated = powertrain === "8em1";
  const batteryLen = Math.max(1, front - rear - 0.9);
  const batteryZ = (front + rear) / 2;
  const box = (size, at) => ({ size, at });
  const specs = {
    bateria: [box([W * 0.78, 0.13, batteryLen], [0, floorY + 0.065, batteryZ])],
    motor: axleList.map((a) => ({
      ...(integrated ? box([0.36, 0.32, 0.36], [-0.11, wheelR + 0.02, axleZ(a)]) : box([0.42, 0.34, 0.34], [-0.12, wheelR, axleZ(a)])),
      axle: a,
    })),
    redutor: axleList.map((a) => ({
      ...(integrated ? box([0.22, 0.3, 0.3], [0.18, wheelR, axleZ(a)]) : box([0.24, 0.3, 0.26], [0.2, wheelR, axleZ(a)])),
      axle: a,
    })),
    inversor: axleList.map((a) => ({
      ...(integrated
        ? box([0.6, 0.2, 0.42], [0.02, wheelR + 0.28, axleZ(a)])
        : box([0.46, 0.14, 0.34], [-0.05, wheelR + 0.33, axleZ(a) + towardCabin(a) * 0.06])),
      axle: a,
    })),
    ecu: [box([0.26, 0.1, 0.18], [-W * 0.3, floorY + 0.2, (front + rear) / 2 - (front - rear) * 0.3])],
    // Carregador de bordo sob o capô, ao lado do e-Axle dianteiro (ou atrás, em tração traseira).
    recarga: [
      integrated
        ? box([0.3, 0.1, 0.18], [-0.08, wheelR + 0.41, axleZ(axleList[0]) + towardCabin(axleList[0]) * 0.1])
        : box([0.4, 0.16, 0.3], [W * 0.28, wheelR + 0.34, drivetrain === "rear" ? rear + 0.2 : front + 0.1]),
    ],
    refrigeracao: [box([W * 0.6, 0.36, 0.06], [0, wheelR + 0.1, L / 2 - 0.25])],
    cabos_hv: axleList.map((a) => {
      const z = axleZ(a);
      const c = towardCabin(a);
      const path = (
        integrated
          ? [
              [W * 0.78 * 0.12, floorY + 0.07, batteryZ - c * (batteryLen / 2 + 0.1)], // conector da bateria
              [0.2, wheelR + 0.02, z + c * 0.33],
              [0.2, wheelR + 0.25, z + c * 0.24], // conector na traseira da caixa da eletrônica
            ]
          : [
              [0.18, floorY + 0.14, z + c * 0.55],
              [0.18, floorY + 0.3, z + c * 0.3],
              [0.1, wheelR + 0.26, z + c * 0.08],
            ]
      ).map((p) => new Vector3(...p));
      const min = path.reduce((m, p) => Vector3.Minimize(m, p), path[0].clone());
      const max = path.reduce((m, p) => Vector3.Maximize(m, p), path[0].clone());
      const at = Vector3.Center(min, max);
      return { size: max.subtract(min).asArray(), at: at.asArray(), path: path.map((p) => p.subtract(at)), axle: a };
    }),
  };

  const mats = createMaterials(scene);
  const g = geometry(scene);
  g.paint = paint;
  const builders = {
    bateria: battery === "blade" ? buildBatteryBlade : buildBattery,
    motor: integrated ? buildMotor8in1 : buildMotor,
    redutor: (P, size) => (integrated ? buildReducer8in1 : buildReducer)(P, size, wheelX),
    inversor: integrated ? buildController8in1 : buildInverter,
    ecu: buildBMS,
    recarga: integrated ? buildCharger8in1 : buildCharger,
    refrigeracao: buildRadiator,
    cabos_hv: buildCables,
  };

  for (const id of missing) {
    const list = specs[id];
    if (!list || !builders[id]) continue;
    const parts = [];
    for (const spec of list) {
      const name = `ilustrativo:${id}${list.length > 1 ? `:${spec.axle}` : ""}`;
      const center = new Vector3(...spec.at);
      const root = new TransformNode(name, scene);
      root.parent = parent;
      root.position.copyFrom(center);
      root.metadata = { evxr: { vehicle: true, component: id, assembly: name, parts: [], illustrative: true } };
      root.setEnabled(false);
      const P = { root, meshes: [], g, mats, scene };
      builders[id](P, spec.size, spec);
      roots.push(root);
      all.push(...P.meshes);
      parts.push({ mesh: P.meshes[0], meshes: P.meshes, center, size: new Vector3(...spec.size), axle: spec.axle ?? null });
    }
    const first = parts[0];
    const half = first.size.scale(0.5);
    items[id] = {
      id,
      meshes: parts.flatMap((p) => p.meshes),
      parts,
      center: first.center, // âncora principal (e-Axle dianteiro no AWD)
      size: first.size,
      min: first.center.subtract(half),
      max: first.center.add(half),
      illustrative: true,
    };
  }

  // Material próprio por malha: seleção (pulso) e raio X (brilho na cor do componente).
  states?.add(all);
  const tintOf = (id) => ({ color: Color3.FromHexString(getContent(id).color).toLinearSpace(), k: TINT[id] ?? 0.1 });
  const tints = new Map(all.map((m) => [m, tintOf(m.metadata.evxr.component)]));

  // Raio X e vista explodida exibem as peças de forma independente: vale o maior dos dois.
  const levels = { xray: 0, explode: 0 };
  let shown = -1;
  return {
    items,
    meshes: roots,
    setVisibility(k, source = "xray") {
      levels[source] = k;
      const v = Math.max(levels.xray, levels.explode);
      if (v === shown) return;
      shown = v;
      for (const r of roots) r.setEnabled(v > 0.001);
      for (const m of all) {
        m.material.alpha = v; // opaco quando visível; translúcido só durante a transição
        const t = tints.get(m);
        states?.setTint(m, "xray", t.color, t.k * v);
      }
    },
  };
}

/** Brilho no raio X (fração da cor do componente) — mantém o código de cores sem esconder os detalhes. */
const TINT = { bateria: 0.16, motor: 0.2, inversor: 0.2, redutor: 0.1, cabos_hv: 0.14 };

// ----------------------------------------------------------------------------- materiais e geometria

function createMaterials(scene) {
  const pbr = (name, hex, metallic, roughness) => {
    const m = new PBRMaterial(`mat-ilustrativo-${name}`, scene);
    m.albedoColor = Color3.FromHexString(hex).toLinearSpace();
    m.metallic = metallic;
    m.roughness = roughness;
    return m;
  };
  return {
    alu: pbr("aluminio-fundido", "#aeb3ba", 0.85, 0.42), // carcaças de motor/redutor, bandeja da bateria
    aluBright: pbr("aluminio-claro", "#d4d8dd", 0.7, 0.3), // caixas do inversor e do carregador (foto do cofre)
    packDark: pbr("pacote-escuro", "#2c3137", 0.55, 0.42), // bandeja da bateria Blade (preta, como na foto da BYD)
    orange: pbr("alta-tensao", "#ff6a14", 0, 0.5), // cabos e conectores de alta tensão
    pink: pbr("reservatorio", "#ff96bf", 0, 0.28), // reservatório do líquido de arrefecimento
    // Cor por vértice (albedo branco): várias cores na mesma malha, um draw call só.
    paintedModule: pbr("modulo-pintado", "#ffffff", 0.35, 0.45), // módulo + placa + barramentos
    paintedMetal: pbr("metal-pintado", "#ffffff", 0.7, 0.32), // caixa do inversor + etiqueta
    paintedDark: pbr("escuro-pintado", "#ffffff", 0.8, 0.4), // semieixos + coifas
    paintedPlastic: pbr("plastico-pintado", "#ffffff", 0.1, 0.6), // BMS + base
    paintedRadiator: pbr("radiador-pintado", "#ffffff", 0.6, 0.45), // colmeia + aletas
  };
}

/** Cores por vértice (espaço linear), para unir peças de cores diferentes numa só malha. */
const COLORS = {
  shell: "#c9cdd3",
  cover: "#9a4636",
  yellow: "#e6b325",
  alu: "#aeb3ba",
  aluBright: "#d4d8dd",
  sticker: "#f2c318",
  steel: "#565b63",
  rubber: "#1d2126",
  black: "#22262b",
  blade: "#aebccb", // invólucro de alumínio das lâminas Blade
  bladeTop: "#5a86b8", // filme isolante azul no topo
  copper: "#c7793c",
};
function paint(mesh, hex) {
  const c = Color3.FromHexString(hex).toLinearSpace();
  const n = mesh.getTotalVertices();
  const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) data.set([c.r, c.g, c.b, 1], i * 4);
  mesh.setVerticesData("color", data, false, 4);
  return mesh;
}

/** Primitivas soltas em coordenadas locais da peça (unidas depois com `merged`). */
function geometry(scene) {
  return {
    box(w, h, d, x = 0, y = 0, z = 0) {
      const m = MeshBuilder.CreateBox("ilustrativo-tmp", { width: w, height: h, depth: d }, scene);
      m.position.set(x, y, z);
      return m;
    },
    /** Cilindro com eixo em X (motores, eixos). */
    cylX(diameter, length, x = 0, y = 0, z = 0, tessellation = 24) {
      const m = MeshBuilder.CreateCylinder("ilustrativo-tmp", { diameter, height: length, tessellation }, scene);
      m.rotation.z = Math.PI / 2;
      m.position.set(x, y, z);
      return m;
    },
    /** Cilindro vertical (conectores, tampas). */
    cylY(diameter, height, x = 0, y = 0, z = 0, tessellation = 12) {
      const m = MeshBuilder.CreateCylinder("ilustrativo-tmp", { diameter, height, tessellation }, scene);
      m.position.set(x, y, z);
      return m;
    },
  };
}

function finish(P, mesh, suffix, material) {
  mesh.name = `${P.root.name}:${suffix}`;
  mesh.material = material;
  mesh.parent = P.root;
  mesh.isPickable = true;
  mesh.metadata = { evxr: { ...P.root.metadata.evxr } };
  P.meshes.push(mesh);
  return mesh;
}

/** Une primitivas do mesmo material numa só malha (um draw call). */
function merged(P, list, suffix, material) {
  const mesh = list.length === 1 ? list[0] : Mesh.MergeMeshes(list, true, true);
  return finish(P, mesh, suffix, material);
}

/** Uma primitiva repetida em várias posições (thin instances: um draw call, clicável). */
function instanced(P, base, positions, suffix, material) {
  const buffer = new Float32Array(positions.length * 16);
  positions.forEach((p, i) => Matrix.Translation(p.x, p.y, p.z).copyToArray(buffer, i * 16));
  base.position.setAll(0);
  base.thinInstanceSetBuffer("matrix", buffer, 16, true);
  base.thinInstanceEnablePicking = true;
  base.thinInstanceRefreshBoundingInfo(false);
  return finish(P, base, suffix, material);
}

// ----------------------------------------------------------------------------- peças

/** Bateria: bandeja com moldura parafusada, módulos em fileiras e um segundo nível na traseira. */
function buildBattery(P, [Wb, Hb, Lb]) {
  const { g, mats } = P;
  const bottom = -Hb / 2;
  const t = 0.03; // fundo da bandeja
  const rail = 0.05; // moldura
  const railH = Hb * 0.78;
  const Wi = Wb - 2 * rail - 0.02;
  const Li = Lb - 2 * rail - 0.02;
  const nx = 3;
  const nz = Math.max(5, Math.min(9, Math.round(Li / 0.27)));
  const cw = Wi / nx;
  const cd = Li / nz;
  const mw = cw - 0.022;
  const md = cd - 0.028;
  const mh = Hb - t - 0.012;

  const tray = [
    g.box(Wb, t, Lb, 0, bottom + t / 2, 0),
    g.box(Wb, railH, rail, 0, bottom + railH / 2, Lb / 2 - rail / 2),
    g.box(Wb, railH, rail, 0, bottom + railH / 2, -Lb / 2 + rail / 2),
    g.box(rail, railH, Lb, Wb / 2 - rail / 2, bottom + railH / 2, 0),
    g.box(rail, railH, Lb, -Wb / 2 + rail / 2, bottom + railH / 2, 0),
  ];
  for (let r = 1; r < nz; r++) tray.push(g.box(Wi, mh * 0.55, 0.014, 0, bottom + t + mh * 0.27, -Li / 2 + r * cd)); // travessas
  // Parafusos da moldura (unidos à bandeja: mesmo draw call).
  const yb = bottom + railH + 0.004;
  for (let x = -Wb / 2 + 0.06; x <= Wb / 2 - 0.06; x += 0.11) for (const s of [-1, 1]) tray.push(g.cylY(0.02, 0.008, x, yb, s * (Lb / 2 - rail / 2), 6));
  for (let z = -Lb / 2 + 0.12; z <= Lb / 2 - 0.12; z += 0.11) for (const s of [-1, 1]) tray.push(g.cylY(0.02, 0.008, s * (Wb / 2 - rail / 2), yb, z, 6));
  merged(P, tray, "bandeja", mats.alu);

  // Unidade de módulo (carcaça + placa + 2 barramentos, pintados por vértice) repetida por thin
  // instances. As duas fileiras mais traseiras têm um segundo nível (sob o banco de trás).
  const unit = Mesh.MergeMeshes(
    [
      g.paint(g.box(mw, mh, md), COLORS.shell),
      g.paint(g.box(mw - 0.02, 0.008, md - 0.02, 0, mh / 2 + 0.004, 0), COLORS.cover),
      g.paint(g.box(0.04, 0.01, md * 0.6, -(mw / 2 - 0.035), mh / 2 + 0.012, 0), COLORS.yellow),
      g.paint(g.box(0.04, 0.01, md * 0.6, mw / 2 - 0.035, mh / 2 + 0.012, 0), COLORS.yellow),
    ],
    true,
    true,
  );
  const modules = [];
  for (let r = 0; r < nz; r++) {
    for (let c = 0; c < nx; c++) {
      const x = -Wi / 2 + cw * (c + 0.5);
      const z = -Li / 2 + cd * (r + 0.5);
      const y = bottom + t + mh / 2;
      modules.push(new Vector3(x, y, z));
      if (r < 2) modules.push(new Vector3(x, y + mh + 0.01, z));
    }
  }
  instanced(P, unit, modules, "modulos", mats.paintedModule);

  // Conector de alta tensão na frente da bateria (de onde saem os cabos laranja).
  merged(
    P,
    [g.box(0.2, 0.05, 0.05, Wb * 0.12, bottom + railH * 0.7, Lb / 2 + 0.024), g.box(0.035, 0.035, 0.08, Wb * 0.12 - 0.05, bottom + railH * 0.7, Lb / 2 + 0.07), g.box(0.035, 0.035, 0.08, Wb * 0.12 + 0.05, bottom + railH * 0.7, Lb / 2 + 0.07)],
    "conector-hv",
    mats.orange,
  );
}

/**
 * Bateria Blade (BYD): sem módulos — as células são lâminas longas que atravessam a largura do
 * pacote, lado a lado ao longo do carro (cell-to-pack), com terminais nas duas pontas ligados por
 * barramentos. Bandeja escura parafusada, como o pacote preto da foto do trem de força do Dolphin.
 */
function buildBatteryBlade(P, [Wb, Hb, Lb]) {
  const { g, mats } = P;
  const bottom = -Hb / 2;
  const t = 0.025; // fundo da bandeja
  const rail = 0.05; // moldura
  const railH = Hb * 0.8;
  const Wi = Wb - 2 * rail - 0.02;
  const Li = Lb - 2 * rail - 0.02;
  const pitch = 0.04; // espessura da lâmina + folga
  const n = Math.max(12, Math.floor(Li / pitch));
  const bladeH = Hb - t - 0.02;
  const bladeL = Wi - 0.08; // sobra espaço nas pontas para os barramentos

  const tray = [
    g.box(Wb, t, Lb, 0, bottom + t / 2, 0),
    g.box(Wb, railH, rail, 0, bottom + railH / 2, Lb / 2 - rail / 2),
    g.box(Wb, railH, rail, 0, bottom + railH / 2, -Lb / 2 + rail / 2),
    g.box(rail, railH, Lb, Wb / 2 - rail / 2, bottom + railH / 2, 0),
    g.box(rail, railH, Lb, -Wb / 2 + rail / 2, bottom + railH / 2, 0),
  ];
  const yb = bottom + railH + 0.004;
  for (let x = -Wb / 2 + 0.06; x <= Wb / 2 - 0.06; x += 0.11) for (const s of [-1, 1]) tray.push(g.cylY(0.02, 0.008, x, yb, s * (Lb / 2 - rail / 2), 6));
  for (let z = -Lb / 2 + 0.12; z <= Lb / 2 - 0.12; z += 0.11) for (const s of [-1, 1]) tray.push(g.cylY(0.02, 0.008, s * (Wb / 2 - rail / 2), yb, z, 6));
  merged(P, tray, "bandeja", mats.packDark);

  // Lâmina (invólucro + faixa superior + terminais de cobre nas pontas), repetida por thin instances.
  const blade = Mesh.MergeMeshes(
    [
      g.paint(g.box(bladeL, bladeH, pitch - 0.008), COLORS.blade),
      g.paint(g.box(bladeL - 0.04, 0.006, pitch - 0.012, 0, bladeH / 2 + 0.003, 0), COLORS.bladeTop),
      g.paint(g.box(0.035, 0.02, pitch * 0.5, -bladeL / 2 - 0.012, bladeH / 2 - 0.012, 0), COLORS.copper),
      g.paint(g.box(0.035, 0.02, pitch * 0.5, bladeL / 2 + 0.012, bladeH / 2 - 0.012, 0), COLORS.copper),
    ],
    true,
    true,
  );
  const y = bottom + t + bladeH / 2;
  const blades = Array.from({ length: n }, (_, i) => new Vector3(0, y, -Li / 2 + pitch * (i + 0.5)));
  instanced(P, blade, blades, "laminas", mats.paintedModule);

  // Barramentos ao longo das duas pontas e conector de alta tensão na frente (cabos laranja).
  merged(
    P,
    [-1, 1].map((s) => g.box(0.03, 0.008, n * pitch, s * (bladeL / 2 + 0.012), bottom + t + bladeH + 0.002, -Li / 2 + (n * pitch) / 2)),
    "barramentos",
    mats.orange,
  );
  merged(
    P,
    [g.box(0.2, 0.05, 0.05, Wb * 0.12, bottom + railH * 0.7, Lb / 2 + 0.024), g.box(0.035, 0.035, 0.08, Wb * 0.12 - 0.05, bottom + railH * 0.7, Lb / 2 + 0.07), g.box(0.035, 0.035, 0.08, Wb * 0.12 + 0.05, bottom + railH * 0.7, Lb / 2 + 0.07)],
    "conector-hv",
    mats.orange,
  );
}

/** Motor: carcaça cilíndrica fundida com aletas, tampa e caixa de terminais com conectores laranja. */
function buildMotor(P, [len, diam]) {
  const { g, mats } = P;
  const R = diam * 0.44;
  const Lm = len * 0.86;
  const body = [g.cylX(2 * R, Lm, 0, 0, 0, 28), g.cylX(2 * R * 0.86, 0.05, -Lm / 2 - 0.02, 0, 0, 24), g.box(0.12, 0.06, 0.1, 0.03, R + 0.02, 0)];
  for (let i = 0; i < 7; i++) body.push(g.cylX(2 * R + 0.03, 0.012, -Lm / 2 + 0.04 + (i * (Lm - 0.08)) / 6, 0, 0, 28)); // aletas
  body.push(g.box(0.06, 0.04, 0.2, -0.1, -R - 0.005, 0), g.box(0.06, 0.04, 0.2, 0.1, -R - 0.005, 0)); // pés de fixação
  merged(P, body, "carcaca", mats.alu);
  merged(P, [g.cylY(0.03, 0.05, 0.0, R + 0.075, -0.025), g.cylY(0.03, 0.05, 0.06, R + 0.075, -0.025), g.cylY(0.03, 0.05, 0.03, R + 0.075, 0.03)], "terminais", mats.orange);
}

/** Redutor: carcaça com flange no motor e semieixos (com coifas) até os cubos das rodas. */
function buildReducer(P, [w, h, d], wheelX) {
  const { g, mats } = P;
  const cx = P.root.position.x; // centro da peça no carro (x)
  merged(P, [g.box(w * 0.68, h * 0.86, d * 0.85, 0, 0, 0), g.cylX(0.3, 0.025, -w * 0.38, 0, 0, 28), g.cylX(h * 0.55, w * 0.85, 0.01, -h * 0.12, 0, 20)], "carcaca", mats.alu);
  halfShafts(P, cx + w * 0.34, cx - 0.53, wheelX);
}

/** Semieixos no centro das rodas: do redutor para a direita e, passando pelo motor (coaxial), para a esquerda. */
function halfShafts(P, rightIn, leftIn, wheelX) {
  const { g, mats } = P;
  const cx = P.root.position.x;
  const shaft = (x0, x1) => g.cylX(0.045, Math.abs(x1 - x0), (x0 + x1) / 2 - cx, 0, 0, 12);
  const rightOut = wheelX - 0.06;
  const leftOut = -(wheelX - 0.06);
  const boot = (x) => g.paint(g.cylX(0.085, 0.09, x - cx, 0, 0, 12), COLORS.rubber);
  merged(
    P,
    [g.paint(shaft(rightIn, rightOut), COLORS.steel), g.paint(shaft(leftOut, leftIn), COLORS.steel), boot(rightIn + 0.05), boot(rightOut - 0.05), boot(leftIn - 0.05), boot(leftOut + 0.05)],
    "semieixos",
    mats.paintedDark,
  );
}

// ----------------------------------------------------------------------------- conjunto "8 em 1" (BYD)

/** Motor do "8 em 1": estator cilíndrico dentro de uma carcaça fundida em bloco, com nervuras e coxim. */
function buildMotor8in1(P, [w, h, d]) {
  const { g, mats } = P;
  const R = h * 0.42;
  const body = [
    g.cylX(2 * R, w * 0.92, 0, 0, 0, 28), // estator
    g.box(w * 0.9, h * 0.55, d * 0.82, 0, -h * 0.18, 0), // base da carcaça, que se une ao redutor
    g.cylX(2 * R * 0.9, 0.03, -w / 2 + 0.015, 0, 0, 24), // tampa lateral
  ];
  // Nervuras de fundição nas faces da frente e de trás.
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) body.push(g.box(0.012, h * 0.5, 0.02, -w * 0.4 + i * w * 0.16, -h * 0.12, s * (d * 0.41 + 0.008)));
  // Parafusos da tampa lateral.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    body.push(g.cylX(0.022, 0.02, -w / 2 - 0.005, Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75, 6));
  }
  merged(P, body, "carcaca", mats.alu);
  // Coxim (suporte do conjunto na carroceria).
  merged(P, [g.paint(g.box(0.08, 0.06, 0.12, -w / 2 - 0.035, h * 0.12, 0), COLORS.black), g.paint(g.box(0.05, 0.12, 0.05, -w / 2 - 0.035, h * 0.12 - 0.08, 0), COLORS.black)], "coxim", mats.paintedDark);
}

/** Redutor do "8 em 1": caixa de engrenagens com flange parafusado no motor e tampa do diferencial. */
function buildReducer8in1(P, [w, h, d], wheelX) {
  const { g, mats } = P;
  const cx = P.root.position.x;
  const body = [
    g.box(w * 0.8, h * 0.78, d * 0.78, w * 0.05, h * 0.04, 0), // caixa de engrenagens
    g.cylX(h * 0.62, w * 0.9, w * 0.02, -h * 0.06, 0, 24), // tampa do diferencial (saída dos semieixos)
    g.cylX(d * 0.95, 0.025, -w * 0.45, 0, 0, 28), // flange no motor
  ];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    body.push(g.cylX(0.02, 0.02, -w * 0.45, Math.cos(a) * d * 0.42, Math.sin(a) * d * 0.42, 6)); // parafusos do flange
  }
  for (let i = 0; i < 4; i++) body.push(g.box(0.012, h * 0.62, d * 0.8 + 0.02, -w * 0.22 + i * w * 0.17, h * 0.04, 0)); // nervuras
  merged(P, body, "carcaca", mats.alu);
  halfShafts(P, cx + w * 0.45, cx - 0.5, wheelX);
}

/**
 * Caixa da eletrônica do "8 em 1" (inversor, conversor CC-CC, distribuição de alta tensão e
 * controladores), como na foto: alumínio claro, tampa com borda parafusada, etiqueta amarela de
 * alta tensão no canto e conectores laranja atrás, de onde sai o cabo para a bateria.
 */
function buildController8in1(P, [w, h, d]) {
  const { g, mats } = P;
  const body = [
    g.box(w * 0.97, h * 0.72, d * 0.95, 0, -h * 0.13, 0), // caixa
    g.box(w, 0.022, d * 0.98, 0, h * 0.24, 0), // borda da tampa
    g.box(w * 0.9, h * 0.16, d * 0.86, 0, h * 0.32, 0), // tampa
  ];
  // Reforços na face da frente.
  for (let i = 0; i < 5; i++) body.push(g.box(0.014, h * 0.5, 0.016, -w * 0.4 + i * w * 0.2, -h * 0.13, d * 0.475 + 0.008));
  // Parafusos da borda da tampa.
  const yb = h * 0.24 + 0.014;
  for (let x = -w / 2 + 0.04; x <= w / 2 - 0.04; x += 0.07) for (const s of [-1, 1]) body.push(g.cylY(0.016, 0.01, x, yb, s * d * 0.47, 6));
  for (let z = -d / 2 + 0.08; z <= d / 2 - 0.08; z += 0.07) for (const s of [-1, 1]) body.push(g.cylY(0.016, 0.01, s * w * 0.485, yb, z, 6));
  for (const m of body) g.paint(m, COLORS.aluBright);
  // Etiqueta de alerta de alta tensão (amarela, com o raio em preto) no canto dianteiro direito da tampa.
  body.push(g.paint(g.box(0.11, 0.004, 0.08, w * 0.28, h * 0.4 + 0.002, d * 0.22), COLORS.sticker));
  body.push(g.paint(g.box(0.025, 0.005, 0.05, w * 0.28, h * 0.4 + 0.004, d * 0.22), COLORS.black));
  merged(P, body, "caixa", mats.paintedMetal);
  // Conectores de alta tensão na face de trás (lado da cabine), alinhados com o cabo da bateria.
  const back = -d / 2 - 0.02;
  merged(P, [g.box(0.11, 0.06, 0.04, w * 0.3, -h * 0.15, back), g.box(0.03, 0.03, 0.03, w * 0.3 - 0.022, -h * 0.15, back - 0.03), g.box(0.03, 0.03, 0.03, w * 0.3 + 0.022, -h * 0.15, back - 0.03)], "conectores", mats.orange);
}

/** Carregador de bordo do "8 em 1": o nível elevado da tampa, com aletas e conector laranja. */
function buildCharger8in1(P, [w, h, d]) {
  const { g, mats } = P;
  const body = [g.box(w * 0.96, h * 0.7, d * 0.92, 0, -h * 0.15, 0)];
  for (let i = 0; i < 7; i++) body.push(g.box(0.008, h * 0.3, d * 0.8, -w * 0.4 + (i * w * 0.8) / 6, h * 0.35, 0)); // aletas
  merged(P, body, "caixa", mats.aluBright);
  merged(P, [g.box(0.045, 0.04, 0.04, -w * 0.5 - 0.015, -h * 0.15, 0)], "conector", mats.orange);
}

/** Inversor: caixa de alumínio com aletas na tampa, etiqueta de alerta e conectores/cabos laranja. */
function buildInverter(P, [w, h, d]) {
  const { g, mats } = P;
  const body = [g.box(w * 0.96, h * 0.64, d * 0.94, 0, -h * 0.14, 0), g.box(w * 0.98, 0.012, d * 0.96, 0, h * 0.2, 0)];
  const n = 13;
  for (let i = 0; i < n; i++) body.push(g.box(0.01, h * 0.22, d * 0.8, -w * 0.43 + (i * w * 0.86) / (n - 1), h * 0.32, 0));
  for (const m of body) g.paint(m, COLORS.aluBright);
  body.push(g.paint(g.box(0.08, 0.004, 0.055, w * 0.3, h * 0.21, d * 0.32), COLORS.sticker)); // etiqueta de alerta
  merged(P, body, "caixa", mats.paintedMetal);
  const side = -w * 0.5;
  const plugs = [];
  for (let i = 0; i < 3; i++) {
    const z = -d * 0.25 + i * d * 0.25;
    plugs.push(g.box(0.045, 0.04, 0.04, side - 0.02, -h * 0.1, z), g.cylY(0.022, 0.2, side - 0.035, -h * 0.1 - 0.12, z, 10));
  }
  merged(P, plugs, "conectores", mats.orange);
}

/** BMS: caixa preta sobre placa de alumínio, com conector. */
function buildBMS(P, [w, h, d]) {
  const { g, mats } = P;
  merged(
    P,
    [g.paint(g.box(w, h * 0.8, d, 0, -h * 0.1, 0), COLORS.black), g.paint(g.box(0.06, 0.04, 0.03, -w * 0.3, 0, d / 2 + 0.012), COLORS.black), g.paint(g.box(w * 1.08, 0.012, d * 1.1, 0, -h * 0.5 - 0.006, 0), COLORS.alu)],
    "caixa",
    mats.paintedPlastic,
  );
}

/** Carregador de bordo: caixa de alumínio aletada (como a segunda caixa da foto do cofre). */
function buildCharger(P, [w, h, d]) {
  const { g, mats } = P;
  const body = [g.box(w * 0.95, h * 0.75, d * 0.93, 0, -h * 0.1, 0)];
  for (let i = 0; i < 10; i++) body.push(g.box(w * 0.9, h * 0.16, 0.008, 0, h * 0.35, -d * 0.4 + (i * d * 0.8) / 9));
  merged(P, body, "caixa", mats.aluBright);
  merged(P, [g.box(0.045, 0.045, 0.045, w * 0.5, -h * 0.05, -d * 0.18), g.box(0.045, 0.045, 0.045, w * 0.5, -h * 0.05, d * 0.18)], "conectores", mats.orange);
}

/** Radiador com aletas e o reservatório rosa do líquido de arrefecimento. */
function buildRadiator(P, [w, h, d]) {
  const { g, mats } = P;
  const tank = { x: -w / 2 + 0.14, y: h / 2 + 0.08, z: -0.16 };
  const core = [g.paint(g.box(w - 0.04, h - 0.04, d * 0.6), COLORS.black), g.paint(g.cylY(0.05, 0.03, tank.x, tank.y + 0.075, tank.z), COLORS.black)];
  const frame = [g.box(w, 0.02, d, 0, h / 2 - 0.01, 0), g.box(w, 0.02, d, 0, -h / 2 + 0.01, 0), g.box(0.02, h, d, w / 2 - 0.01, 0, 0), g.box(0.02, h, d, -w / 2 + 0.01, 0, 0)];
  for (let i = 1; i < 24; i++) frame.push(g.box(0.004, h - 0.05, d * 0.75, -w / 2 + (i * w) / 24, 0, 0));
  merged(P, [...core, ...frame.map((m) => g.paint(m, COLORS.alu))], "radiador", mats.paintedRadiator);
  merged(P, [g.box(0.16, 0.12, 0.1, tank.x, tank.y, tank.z)], "reservatorio", mats.pink);
}

/** Cabos de alta tensão: par laranja (positivo e negativo). */
function buildCables(P, size, spec) {
  const { scene, mats } = P;
  const tubes = [-1, 1].map((s) =>
    MeshBuilder.CreateTube("ilustrativo-tmp", { path: spec.path.map((p) => p.add(new Vector3(s * 0.022, 0, 0))), radius: 0.016, tessellation: 10 }, scene),
  );
  merged(P, tubes, "cabos", mats.orange);
}
