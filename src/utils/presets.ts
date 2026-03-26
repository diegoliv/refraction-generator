import { defaultSceneConfig } from '../config/defaults';
import type { PresetDefinition, RayBand, SceneConfig } from '../types/config';
import { clamp } from './math';
import { normalizeBandOffsets } from './gradientStops';
import { createRandom } from './random';
import { cloneScene, createRuntimeId } from './scene';

export const PRESET_SCHEMA_VERSION = 1;

type PortablePresetFile = {
  version: number;
  name: string;
  config: SceneConfig;
};

function normalizeParticleRanges(config: SceneConfig): void {
  const sizeMin = Math.min(config.particles.minSize, config.particles.maxSize);
  const sizeMax = Math.max(config.particles.minSize, config.particles.maxSize);
  config.particles.minSize = sizeMin;
  config.particles.maxSize = sizeMax;

  const speedMin = Math.min(config.particles.minSpeed, config.particles.maxSpeed);
  const speedMax = Math.max(config.particles.minSpeed, config.particles.maxSpeed);
  config.particles.minSpeed = speedMin;
  config.particles.maxSpeed = speedMax;
}

function normalizeBands(bands: Partial<RayBand>[]): RayBand[] {
  const fallbackBands = cloneScene(defaultSceneConfig).rays.bands;
  const merged = bands.map((band, index) => ({
    id: band.id || createRuntimeId('band'),
    color: band.color ?? fallbackBands[Math.min(index, fallbackBands.length - 1)]?.color ?? '#ffffff',
    offset: band.offset ?? Number.NaN,
    weight: band.weight ?? 1,
    softness: band.softness ?? 1,
  }));

  return normalizeBandOffsets(merged);
}

export function normalizeSceneConfig(scene: Partial<SceneConfig>): SceneConfig {
  const merged: SceneConfig = {
    ...cloneScene(defaultSceneConfig),
    ...scene,
    background: {
      ...defaultSceneConfig.background,
      ...scene.background,
    },
    rays: {
      ...defaultSceneConfig.rays,
      ...scene.rays,
      bands: normalizeBands(scene.rays?.bands ?? defaultSceneConfig.rays.bands),
    },
    particles: {
      ...defaultSceneConfig.particles,
      ...scene.particles,
    },
    postprocessing: {
      ...defaultSceneConfig.postprocessing,
      ...scene.postprocessing,
    },
    export: {
      ...defaultSceneConfig.export,
      ...scene.export,
    },
  };

  merged.background.type = merged.background.type === 'image' ? 'image' : 'gradient';
  merged.background.imageSrc = typeof merged.background.imageSrc === 'string' ? merged.background.imageSrc : '';
  merged.rays.bands = merged.rays.bands.length > 0 ? merged.rays.bands : cloneScene(defaultSceneConfig).rays.bands;
  merged.rays.startBlur = clamp(merged.rays.startBlur ?? 0, 0, 2.5);
  merged.rays.blur = clamp(merged.rays.blur, 0, 2.5);
  merged.rays.driftAmount = 0;
  merged.rays.driftSpeed = 0;
  merged.rays.rotationSpeed = 1;
  merged.rays.pausedWhileParticlesMove = Boolean(merged.rays.pausedWhileParticlesMove);
  normalizeParticleRanges(merged);
  merged.particles.direction = merged.particles.direction === 'from-apex' ? 'from-apex' : 'into-apex';
  merged.particles.color = typeof merged.particles.color === 'string' && merged.particles.color.trim() ? merged.particles.color : defaultSceneConfig.particles.color;
  merged.postprocessing.globalBlur = clamp(merged.postprocessing.globalBlur, 0, 2.5);
  merged.postprocessing.bloom = 0;
  merged.postprocessing.vignette = 0;
  merged.postprocessing.brightness = 1;

  return merged;
}

export function serializePresetFile(name: string, config: SceneConfig): string {
  const payload: PortablePresetFile = {
    version: PRESET_SCHEMA_VERSION,
    name,
    config: normalizeSceneConfig(config),
  };

  return JSON.stringify(payload, null, 2);
}

export function parsePresetFile(text: string): { name: string; config: SceneConfig } {
  const parsed = JSON.parse(text) as PortablePresetFile;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Preset JSON is invalid.');
  }

  if (parsed.version !== PRESET_SCHEMA_VERSION) {
    throw new Error(`Unsupported preset version: ${String(parsed.version)}`);
  }

  if (typeof parsed.name !== 'string' || !parsed.name.trim()) {
    throw new Error('Preset name is missing.');
  }

  return {
    name: parsed.name.trim(),
    config: normalizeSceneConfig(parsed.config),
  };
}

export function createImportedPreset(name: string, config: SceneConfig): PresetDefinition {
  return {
    id: createRuntimeId('imported'),
    name,
    kind: 'imported',
    config: normalizeSceneConfig(config),
  };
}

export function createDuplicatedPreset(name: string, config: SceneConfig): PresetDefinition {
  return {
    id: createRuntimeId('custom'),
    name,
    kind: 'custom',
    config: normalizeSceneConfig(config),
  };
}

export function randomizeSceneTastefully(baseScene: SceneConfig): SceneConfig {
  const seed = Math.floor(Math.random() * 1000000);
  const random = createRandom(seed);
  const paletteFamilies = [
    {
      backgroundTop: '#f7f5f0',
      backgroundBottom: '#ece9e1',
      washColor: '#faf7f1',
      bands: ['#87a1e6', '#9ddfdc', '#bfe2a5', '#eadc98', '#e2b28d', '#d8abc5', '#b6b9e5'],
    },
    {
      backgroundTop: '#f8f4fa',
      backgroundBottom: '#eeebe9',
      washColor: '#faf7fb',
      bands: ['#b0bce8', '#c0e7ec', '#d7e8bc', '#f0e1b0', '#e8c8bd', '#d9c3e9'],
    },
    {
      backgroundTop: '#f6f2ea',
      backgroundBottom: '#ece4d8',
      washColor: '#f8f3e5',
      bands: ['#ecd78f', '#e6c58d', '#dda37f', '#f3ebbc'],
    },
    {
      backgroundTop: '#f2f5f7',
      backgroundBottom: '#e7e8e3',
      washColor: '#f5f6f2',
      bands: ['#90b9e6', '#b9ddd0'],
    },
  ];
  const family = paletteFamilies[Math.floor(random.range(0, paletteFamilies.length)) % paletteFamilies.length];
  const stops = family.bands.map((color, index) => ({
    id: createRuntimeId('band-random'),
    color,
    offset: family.bands.length === 1 ? 0 : index / (family.bands.length - 1),
    weight: random.range(0.88, 1.12),
    softness: random.range(0.9, 1),
  }));

  return normalizeSceneConfig({
    ...baseScene,
    seed,
    background: {
      type: 'gradient',
      topColor: family.backgroundTop,
      bottomColor: family.backgroundBottom,
      washColor: family.washColor,
      imageSrc: '',
    },
    rays: {
      ...baseScene.rays,
      enabled: true,
      originX: random.range(0.86, 0.96),
      originY: random.range(0.42, 0.62),
      rotation: random.range(160, 200),
      fanAngle: random.range(54, 82),
      startDistance: random.range(0, 0.04),
      endDistance: random.range(1.05, 1.38),
      opacity: random.range(0.58, 0.82),
      startBlur: random.range(0, 0.24),
      blur: random.range(0.72, 1.48),
      driftAmount: 0,
      driftSpeed: 0,
      rotationSpeed: 1,
      pausedWhileParticlesMove: false,
      bands: stops,
    },
    particles: {
      ...baseScene.particles,
      enabled: true,
      count: Math.round(random.range(12, 38)),
      minSize: random.range(0.35, 0.8),
      maxSize: random.range(0.9, 1.8),
      minSpeed: random.range(0.03, 0.08),
      maxSpeed: random.range(0.08, 0.18),
      opacity: random.range(0.015, 0.06),
      twinkle: random.range(0.08, 0.22),
      spread: random.range(0.28, 0.56),
      directionRandomness: random.range(0.08, 0.2),
      direction: random.range(0, 1) > 0.25 ? 'into-apex' : 'from-apex',
      color: '#ffffff',
    },
    postprocessing: {
      ...baseScene.postprocessing,
      softness: random.range(0.6, 0.78),
      globalBlur: random.range(0.08, 0.42),
      bloom: 0,
      grain: random.range(0, 0.05),
      vignette: 0,
      brightness: 1,
    },
    export: {
      ...baseScene.export,
      duration: random.range(4, 8),
    },
  });
}
