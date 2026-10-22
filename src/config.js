/**
 * Configuração central do EV Experience XR.
 *
 * Tudo que depende do modelo 3D fica aqui: arquivo, orientação, layout dos componentes
 * elétricos e valores da simulação. Trocar de veículo = ajustar VEHICLE_MODELS e SIMULATION.
 */

export const APP = {
  name: "EV Experience XR",
  subtitle: "Laboratório Virtual de Veículos Elétricos",
};

/**
 * Identificação da escola (totem no showroom, placa em VR e tela de carregamento).
 * `logoUrl` é opcional: salve a arte oficial em public/textures/ e informe o caminho aqui
 * (ex.: "textures/senai-logo.png") para substituir o logotipo desenhado. null = só o desenho
 * (nenhuma requisição extra na abertura).
 */
export const INSTITUTION = {
  eyebrow: "Escola SENAI",
  schoolName: "Antonio Adolpho Lobbe",
  fullName: "SENAI Antonio Adolpho Lobbe",
  logoUrl: null,
};

/** Paleta oficial (hex sRGB). */
export const PALETTE = {
  background: "#08111F",
  blue: "#00B8FF",
  cyan: "#00E5FF",
  orange: "#FF9F43",
  text: "#F5F7FA",
};

/**
 * Modelos candidatos, em ordem de prioridade (o primeiro arquivo encontrado em
 * `public/models/` é carregado). Otimize GLBs novos com `npm run otimizar-modelo`.
 *
 *  rotationDeg  correção de orientação (frente do carro → +Z, teto → +Y);
 *               `autoFront` acerta sozinho a frente pela posição dos faróis/lanternas.
 *  drivetrain   eixo do(s) motor(es): "front" | "rear" | "awd". Posiciona as peças
 *               ilustrativas quando o GLB não traz os componentes internos.
 *  powertrain   "8em1": motor, redutor, inversor e carregador de bordo ilustrativos montados como
 *               um só bloco (conjunto “8 em 1” da BYD e-Platform 3.0). Sem ele: peças separadas.
 *  battery      "blade": bateria ilustrativa com lâminas (BYD Blade). Sem ele: módulos.
 *  chargePort   onde fica a porta de recarga: { side: "left"|"right", end: "front"|"rear" } — usado
 *               quando o GLB não traz a tomada modelada (peça com "tomada"/"porta_recarga" no nome).
 *  extraPatterns regras extras de identificação de peças só para este arquivo.
 *  notes        linha "No BYD Dolphin" nos painéis educativos (valores aproximados).
 */
export const VEHICLE_MODELS = [
  {
    id: "2021_byd_dolphin_ev",
    // GLB preparado (peças nomeadas) e otimizado — veja scripts/preparar-dolphin.mjs e o README.
    url: "models/2021_byd_dolphin_ev.glb",
    label: "BYD Dolphin",
    badge: "100% elétrico · tração dianteira",
    provisional: false,
    credit: "Modelo 3D: “2021 BYD Dolphin EV” por Ddiaz Design (Sketchfab, licença CC BY-NC-SA 4.0)",
    rotationDeg: { x: 0, y: 0, z: 0 },
    autoFront: true,
    // Hatch da e-Platform 3.0: um só conjunto elétrico (motor + redutor + inversor) no eixo dianteiro.
    drivetrain: "front",
    powertrain: "8em1", // como na foto do trem de força do Dolphin (site da BYD)
    battery: "blade", // bateria Blade: lâminas no pacote, sem módulos
    chargePort: { side: "right", end: "front" }, // para-lama dianteiro direito (a tomada está modelada no GLB)
    extraPatterns: {
      // A tomada faz parte da carroceria; o carregador de bordo continua como peça ilustrativa.
      carroceria: [/tomada_recarga/i],
    },
    // Ajustes finos de material (nome do material no GLB). clearCoat = verniz, só fora do perfil leve.
    // Realismo: o arquivo do Sketchfab marca pneus, plásticos, couro e tecido como ~60% "metálicos" —
    // por isso tudo parecia plástico cromado. Materiais não metálicos voltam a metálico 0, com a
    // rugosidade de cada acabamento. Cores conforme o Dolphin do showroom virtual da BYD.
    materials: {
      // Prata metálico com verniz (o arquivo original vem em azul).
      D_Paint_Color: { color: "#bcc1c6", metallic: 0.85, roughness: 0.28, clearCoat: { intensity: 1, roughness: 0.04 } },
      // Teto e colunas em preto brilhante.
      D_Color_2: { metallic: 0.5, roughness: 0.24, clearCoat: { intensity: 0.8, roughness: 0.08 } },
      // Filetes laranja na saia lateral e nos cantos dos para-choques.
      D_M_Color: { color: "#e2581f", metallic: 0.35, roughness: 0.32, clearCoat: { intensity: 0.8, roughness: 0.06 } },
      // Insertos das rodas (separados da pintura pelo preparar-dolphin): grafite, como nas rodas do Dolphin.
      D_Paint_Roda: { color: "#3a3f45", metallic: 0.6, roughness: 0.35 },
      D_tire: { metallic: 0, roughness: 0.88 },
      D_Plastic: { metallic: 0.3, roughness: 0.38 }, // aros, grade, peças técnicas
      D_Plastic_S: { metallic: 0.05, roughness: 0.26 }, // molduras pretas brilhantes das janelas
      D_col_plas: { metallic: 0, roughness: 0.62 }, // revestimento preto das soleiras
      D_PlasIN: { metallic: 0, roughness: 0.58 },
      D_Plastic_N_2: { metallic: 0, roughness: 0.72 },
      phong6: { metallic: 0, roughness: 0.7 },
      D_carpet: { metallic: 0, roughness: 0.95 },
      D_Roof: { metallic: 0, roughness: 0.9 }, // forro do teto
      D_Cuero_1: { color: "#3d5875", metallic: 0, roughness: 0.5 }, // azul do interior, mais sóbrio que o do arquivo
      D_Cuero_2: { metallic: 0, roughness: 0.5 },
      D_Cuero_3: { metallic: 0, roughness: 0.52 },
      D_Cuero_4: { metallic: 0, roughness: 0.52 },
      D_Til: { metallic: 0, roughness: 0.85 }, // tecido perfurado dos bancos
      D_Til_2: { metallic: 0, roughness: 0.85 },
      D_Orange_ST: { metallic: 0, roughness: 0.7 }, // costuras
      D_Dashboard: { color: "#3b5e84", metallic: 0.15, roughness: 0.4 },
      D_orange: { metallic: 0.15, roughness: 0.4 },
    },
    notes: {
      bateria:
        "Bateria Blade da própria BYD (LFP, lítio-ferro-fosfato): células longas, em forma de lâmina, montadas direto no pacote sob o assoalho. 30,7 ou 44,9 kWh no lançamento (2021); 44,9 kWh na versão vendida no Brasil (varia por versão e ano).",
      motor:
        "Motor síncrono de ímãs permanentes no eixo dianteiro (tração dianteira): 70 kW e 180 N·m na versão de 44,9 kWh; as versões mais fortes chegam a 130–150 kW.",
      inversor:
        "Faz parte do trem de força “8 em 1” da e-Platform 3.0, que reúne motor, redutor, inversor, carregador de bordo, conversor CC-CC, distribuição de alta tensão e os controladores num só conjunto.",
      redutor: "Redução fixa, de uma marcha, no mesmo conjunto do motor e do inversor, no eixo dianteiro.",
      ecu: "O controlador do veículo (VCU) e o gerenciamento da bateria (BMS) também fazem parte do conjunto “8 em 1”.",
      recarga:
        "Tomada no para-lama dianteiro direito (modelada no 3D). CA de 6,6–7 kW pelo carregador de bordo e CC rápida de até ~60 kW na bateria de 44,9 kWh.",
      refrigeracao: "Gestão térmica integrada da e-Platform 3.0, com bomba de calor, para a bateria, o motor e a eletrônica de potência.",
      portas: "Quatro portas e tampa traseira (hatch): clique em uma delas para abrir ou fechar.",
    },
  },
];

export const VEHICLE = {
  /**
   * Medidas de referência (m), usadas apenas para corrigir a escala se o modelo
   * vier em outra unidade (mm, cm) — não são exibidas ao usuário.
   * Conferir com a ficha técnica oficial do veículo.
   */
  referenceLength: 4.125, // BYD Dolphin 2021 (China): 4,125 × 1,77 × 1,57 m, entre-eixos 2,70 m (global/Brasil: 4,29 m)
  /** Faixa plausível de comprimento (m). Fora dela, o modelo é reescalado para `referenceLength`. */
  plausibleLength: [3.0, 6.5],

  /**
   * Otimização de draw calls: une malhas que compartilham material dentro do mesmo
   * conjunto (ex.: os 24 pedaços de uma roda viram ~4 malhas). Mantém a separação
   * por conjunto, que é a granularidade usada por raio X e exploded view.
   *   "assembly"  — une por conjunto de topo do GLB (recomendado)
   *   "component" — une por categoria de componente (para GLBs sem hierarquia)
   *   "none"      — mantém todas as malhas originais
   */
  mergeStrategy: "assembly",
  /**
   * Componentes que se movem em bloco: além de unidos dentro de cada conjunto, são unidos entre
   * conjuntos por material. Portas, rodas e freios ficam por conjunto.
   */
  mergeAcross: ["carroceria", "vidros", "interior", "chassi"],
  /**
   * Malhas que nunca são unidas: precisam de pivô próprio (ex.: portas que abrem) ou de posição
   * própria (a tomada de recarga, ponto de chegada do cabo do carregador externo).
   */
  keepSeparate: [/porta_painel|porta_contorno|porta_macaneta|door|^boot|tomada_recarga/i],
};

export const SHOWROOM = {
  /**
   * Aparência (src/scene/theme.js): "realista" — estúdio claro e neutro, como o showroom virtual
   * da BYD — ou "futurista" — fundo escuro com LEDs ciano. Teste o outro com ?tema= na URL.
   */
  theme: "realista",
  platformHeight: 0.12,
  /** Folga entre o carro e a borda da plataforma (m). */
  platformMargin: 0.8,
  turntableDegPerSecond: 6,
  floorSize: 80,
  environmentTexture: "textures/studio.env",
  environmentIntensity: 0.85,
};

export const XR = {
  /** Distância do ponto de partida em VR até a borda da plataforma (m). */
  spawnClearance: 1.4,
  /** Ângulo do snap turn (graus) no thumbstick esquerdo/direito. */
  snapTurnDeg: 45,
  /** Foveação fixa no Quest (0 = desligada, 1 = máxima). */
  fixedFoveation: 0.5,
};

/**
 * Simulação educativa (Etapa 3). VALORES APROXIMADOS inspirados no BYD Dolphin de 44,9 kWh
 * (motor dianteiro de 70 kW, ~1.500 kg, 0–100 km/h em ~11 s, CA 6,6 kW, CC até ~60 kW) — a
 * simulação é demonstrativa e não reproduz medições do veículo. Confira a ficha da versão/ano.
 */
export const SIMULATION = {
  massKg: 1500,
  batteryKwh: 44.9,
  initialSoc: 72,
  maxPowerKw: 70, // potência máxima de tração retirada da bateria (um motor)
  maxRegenKw: 40, // potência máxima de regeneração devolvida à bateria
  maxAccel: 3.4, // m/s² (tração dianteira: aderência limita a arrancada)
  brakeDecel: 3.0, // m/s² ao segurar "Frear"
  maxSpeedKmh: 150,
  driveEfficiency: 0.9, // bateria → rodas
  regenEfficiency: 0.7, // rodas → bateria
  auxKw: 0.5, // eletrônica, iluminação, climatização leve
  rollingCoef: 0.011,
  dragAreaM2: 0.68, // Cd × área frontal (hatch compacto)
  regenMinKmh: 8, // abaixo disso a regeneração some e o freio a disco completa a parada
  regenSocLimit: 95, // acima disso a bateria aceita menos regeneração
  lowSoc: 8, // abaixo disso a potência de tração é reduzida
  acKw: 6.6, // recarga CA (carregador de bordo)
  dcKw: 60, // recarga rápida CC (pico, cai perto da carga completa)
  chargeTimeScale: 60, // na recarga, 1 s de tela = 1 min simulado
};

/**
 * Parâmetros de URL úteis para teste: ?q=low|medium|high, ?nointro, ?debug, ?model=models/x.glb&rot=0,90,0,
 * ?ilustrativo (esconde os componentes internos reais para testar as representações ilustrativas).
 */
export const URL_PARAMS = new URLSearchParams(window.location.search);
