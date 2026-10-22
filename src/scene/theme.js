import { PALETTE, SHOWROOM, URL_PARAMS } from "../config.js";

/**
 * Temas do showroom (config: SHOWROOM.theme; para testar, ?tema=futurista|realista na URL).
 *
 *   futurista  fundo escuro, piso com grade luminosa, LEDs ciano/azuis e título holográfico.
 *   realista   estúdio claro e neutro, como o showroom virtual da BYD: piso cinza polido, parede
 *              curva clara ao fundo, luzes brancas e letreiro escuro na parede — o carro aparece
 *              com as cores reais, sem o tom azulado das luzes coloridas.
 *
 * Cores em hex sRGB. Só muda a aparência: a montagem do showroom é a mesma nos dois temas.
 */
export const THEMES = {
  futurista: {
    background: PALETTE.background,
    fogDensity: 0.03,
    exposure: 1.05,
    contrast: 1.12,
    environmentIntensity: SHOWROOM.environmentIntensity,
    floor: { color: "#070d18", roughness: 0.36, environment: 0.55, grid: PALETTE.blue, gridLevel: 0.55 },
    platformBase: { color: "#0b1422", metallic: 0.8, roughness: 0.3 },
    platformTop: { color: "#0a1322", specular: "#526173", dial: "0, 229, 255", dialLevel: 0.9, mirror: 0.34 },
    ledTop: PALETTE.cyan,
    ledBase: PALETTE.blue,
    spill: "0, 200, 255",
    halo: "#c9f6ff",
    haloInner: PALETTE.cyan,
    pillars: PALETTE.blue,
    wall: null,
    title: "holograma",
    totemLed: PALETTE.cyan,
    glowIntensity: 0.75,
    lights: {
      hemi: { color: "#cfe6ff", ground: "#0a1626", intensity: 0.42 },
      key: { color: "#f4f8ff", intensity: 2.3 },
      rim: { color: PALETTE.cyan, intensity: 1.1 },
      fill: { color: PALETTE.blue, intensity: 0.55 },
    },
  },
  realista: {
    background: "#d5d9de",
    fogDensity: 0.016,
    exposure: 1.0,
    contrast: 1.06,
    environmentIntensity: 1.0,
    floor: { color: "#8e949b", roughness: 0.2, environment: 0.85, grid: null, gridLevel: 0 },
    platformBase: { color: "#d9dce0", metallic: 0.1, roughness: 0.3 },
    // Material Standard (sem tone mapping de energia): cor escura para ficar cinza-médio sob a luz principal.
    platformTop: { color: "#40464d", specular: "#3a4046", dial: "255, 255, 255", dialLevel: 0.16, mirror: 0.18 },
    ledTop: "#aab3bd",
    ledBase: "#8a939d",
    spill: null,
    halo: "#ffffff",
    haloInner: "#ffffff",
    pillars: "#f4f8ff",
    // Parede curva (ciclorama) ao redor, como o fundo branco do showroom virtual da BYD.
    wall: { color: "#e3e6ea", height: 7 },
    title: "letreiro",
    totemLed: "#ffffff",
    glowIntensity: 0.25,
    lights: {
      hemi: { color: "#ffffff", ground: "#868c94", intensity: 0.55 },
      key: { color: "#ffffff", intensity: 2.0 },
      rim: { color: "#ffffff", intensity: 0.55 },
      fill: { color: "#eaf0f6", intensity: 0.35 },
    },
  },
};

export const THEME = THEMES[URL_PARAMS.get("tema")] ?? THEMES[SHOWROOM.theme] ?? THEMES.futurista;
