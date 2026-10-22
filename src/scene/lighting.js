import { Color3, DirectionalLight, HemisphericLight, ShadowGenerator, Vector3 } from "../babylon.js";
import { THEME } from "./theme.js";

/**
 * Iluminação de showroom: ambiente de estúdio (IBL) + luz principal + recorte e preenchimento.
 * As cores vêm do tema (theme.js): azul/ciano no futurista, brancas no realista. Usa apenas luzes
 * direcionais — sem atenuação por distância, comportam-se igual em materiais PBR e Standard e
 * custam pouco no Quest.
 */
export function createLighting(scene, quality) {
  const hemi = new HemisphericLight("light-ambient", new Vector3(0, 1, 0), scene);
  const L = THEME.lights;
  hemi.diffuse = Color3.FromHexString(L.hemi.color);
  hemi.groundColor = Color3.FromHexString(L.hemi.ground);
  hemi.specular = Color3.Black();

  // Luz principal, de cima e levemente à frente-direita; é a única que projeta sombra.
  const key = new DirectionalLight("light-key", new Vector3(-0.3, -1, -0.35).normalize(), scene);
  key.position = new Vector3(5, 12, 6);
  key.diffuse = Color3.FromHexString(L.key.color);

  // Recorte por trás do carro: desenha a silhueta contra o fundo.
  const rim = new DirectionalLight("light-rim", new Vector3(-0.55, -0.35, 0.75).normalize(), scene);
  rim.diffuse = Color3.FromHexString(L.rim.color);
  rim.specular = Color3.FromHexString(L.rim.color);

  // Preenchimento pelo lado oposto (desligado no perfil leve).
  const fill = new DirectionalLight("light-fill", new Vector3(0.8, -0.25, -0.55).normalize(), scene);
  fill.diffuse = Color3.FromHexString(L.fill.color);
  fill.specular = Color3.FromHexString(L.fill.color).scale(0.6);
  fill.setEnabled(quality.fillLight);

  const base = { hemi: L.hemi.intensity, key: L.key.intensity, rim: L.rim.intensity, fill: L.fill.intensity, env: THEME.environmentIntensity };

  let shadowGenerator = null;
  if (quality.shadows) {
    shadowGenerator = new ShadowGenerator(quality.shadowMapSize, key);
    shadowGenerator.usePercentageCloserFiltering = true;
    shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    shadowGenerator.bias = 0.0006;
    shadowGenerator.normalBias = 0.015;
    shadowGenerator.darkness = 0.35;
    shadowGenerator.transparencyShadow = true;
    key.shadowMinZ = 1;
    key.shadowMaxZ = 30;
  }

  let level = 1;
  function setLevel(k) {
    level = k;
    hemi.intensity = base.hemi * k;
    key.intensity = base.key * k;
    rim.intensity = base.rim * k;
    fill.intensity = base.fill * k;
    scene.environmentIntensity = base.env * (0.15 + 0.85 * k);
  }
  setLevel(1);

  return {
    hemi,
    key,
    rim,
    fill,
    shadowGenerator,
    setLevel,
    get level() {
      return level;
    },
    /** Liga sombras do carro e restringe recorte e preenchimento à carroceria. */
    attachVehicle(vehicleMeshes, receivers) {
      if (!vehicleMeshes.length) return;
      rim.includedOnlyMeshes = vehicleMeshes.slice();
      fill.includedOnlyMeshes = vehicleMeshes.slice();
      if (shadowGenerator) {
        for (const m of vehicleMeshes) shadowGenerator.addShadowCaster(m, false);
        for (const r of receivers) r.receiveShadows = true;
      }
    },
    setShadowsEnabled(on) {
      key.shadowEnabled = !!shadowGenerator && on;
    },
  };
}
