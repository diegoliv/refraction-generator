import { createCylinderShape, defaultBlurProfile, defaultOpacityProfile, defaultSceneConfig, defaultWallProfile, linearProfile } from '../config/defaults';
import type { PresetDefinition, RayBand, RayBezierProfile, RayShapeConfig, SceneConfig } from '../types/config';
import { clamp, lerp } from './math';
import { normalizeBandOffsets } from './gradientStops';
import { createRandom } from './random';
import { cloneScene, createRuntimeId } from './scene';

export const PRESET_SCHEMA_VERSION = 1;

type PortablePresetFile = {
  version: number;
  name: string;
  config: SceneConfig;
};

type LegacyShape = {
  mode?: string;
  apexSize?: number;
  baseSize?: number;
  profile?: Partial<RayBezierProfile>;
  wallProfile?: Partial<RayBezierProfile>;
};

function cloneProfile(profile: RayBezierProfile): RayBezierProfile {
  return { ...profile };
}

function legacyMidValue(merged: Partial<RayBezierProfile>, start: number, end: number): number {
  if (typeof merged.mid === 'number') {
    return merged.mid;
  }

  const cp1y = typeof merged.cp1y === 'number' ? merged.cp1y : lerp(start, end, 0.33);
  const cp2y = typeof merged.cp2y === 'number' ? merged.cp2y : lerp(start, end, 0.67);
  return clamp(0.125 * start + 0.375 * cp1y + 0.375 * cp2y + 0.125 * end, 0, 1);
}

function normalizeCurveProfile(profile: Partial<RayBezierProfile> | undefined, fallback: RayBezierProfile): RayBezierProfile {
  const merged = {
    ...fallback,
    ...profile,
  };

  const start = clamp(merged.start, 0, 1);
  const end = clamp(merged.end, 0, 1);
  const mid = clamp(legacyMidValue(merged, start, end), 0, 1);

  return {
    start,
    mid,
    end,
    cp1x: clamp(merged.cp1x, 0, 0.5),
    cp1y: clamp(merged.cp1y, 0, 1),
    cp2x: clamp(merged.cp2x, 0.5, 1),
    cp2y: clamp(merged.cp2y, 0, 1),
  };
}

function createLegacyTunnelShape(rays: Partial<SceneConfig['rays']> | undefined): RayShapeConfig {
  const legacyShape = rays?.shape as LegacyShape | undefined;
  const storedWallProfile = legacyShape?.wallProfile;
  if (storedWallProfile) {
    return {
      diameter: clamp(typeof (legacyShape as { diameter?: number })?.diameter === 'number' ? (legacyShape as { diameter?: number }).diameter ?? 1.18 : 1.18, 0.1, 2.6),
      wallProfile: normalizeCurveProfile(storedWallProfile, defaultWallProfile),
    };
  }

  const legacyProfile = legacyShape?.profile;
  const apexSize = typeof legacyShape?.apexSize === 'number' ? legacyShape.apexSize : 0.18;
  const baseSize = typeof legacyShape?.baseSize === 'number' ? legacyShape.baseSize : 1.18;
  const diameter = Math.max(0.12, baseSize, apexSize);
  const start = clamp(apexSize / diameter, 0, 1);
  const end = clamp(baseSize / diameter, 0, 1);
  const mid = clamp((start + end) * 0.5, 0, 1);

  return {
    diameter,
    wallProfile: normalizeCurveProfile(
      legacyProfile
        ? {
            start,
            mid,
            end,
            cp1x: legacyProfile.cp1x,
            cp1y: lerp(start, end, clamp(legacyProfile.cp1y ?? 0.33, 0, 1)),
            cp2x: legacyProfile.cp2x,
            cp2y: lerp(start, end, clamp(legacyProfile.cp2y ?? 0.67, 0, 1)),
          }
        : { ...linearProfile, start, mid, end },
      { ...defaultWallProfile, start, mid, end },
    ),
  };
}

function createLegacyBlurProfile(rays: Partial<SceneConfig['rays']> | undefined): RayBezierProfile {
  if (rays?.blurProfile) {
    return normalizeCurveProfile(rays.blurProfile, defaultBlurProfile);
  }

  const startBlur = typeof rays?.startBlur === 'number' ? rays.startBlur : defaultSceneConfig.rays.startBlur;
  const endBlur = typeof rays?.blur === 'number' ? rays.blur : defaultSceneConfig.rays.blur;
  const maxBlur = Math.max(0.001, startBlur, endBlur);
  const start = clamp(startBlur / maxBlur, 0, 1);
  const end = clamp(endBlur / maxBlur, 0, 1);
  const mid = clamp((start + end) * 0.5, 0, 1);

  return normalizeCurveProfile({
    ...linearProfile,
    start,
    mid,
    end,
    cp1y: start,
    cp2y: end,
  }, defaultBlurProfile);
}

function createLegacyOpacityProfile(rays: Partial<SceneConfig['rays']> | undefined): RayBezierProfile {
  if (rays?.opacityProfile) {
    return normalizeCurveProfile(rays.opacityProfile, defaultOpacityProfile);
  }

  const startBlur = typeof rays?.startBlur === 'number' ? rays.startBlur : defaultSceneConfig.rays.startBlur;
  const endBlur = typeof rays?.blur === 'number' ? rays.blur : defaultSceneConfig.rays.blur;
  const startOpacity = clamp(1 - startBlur / 2.5, 0, 1);
  const endOpacity = clamp(1 - endBlur / 3.5, 0.2, 1);

  return normalizeCurveProfile({
    ...defaultOpacityProfile,
    start: startOpacity,
    mid: Math.max(startOpacity, endOpacity, 0.82),
    end: endOpacity,
  }, defaultOpacityProfile);
}

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
  const legacyRays = scene.rays;
  const hasExplicitLength = typeof legacyRays?.length === 'number';
  const legacyStartDistance = typeof legacyRays?.startDistance === 'number' ? legacyRays.startDistance : defaultSceneConfig.rays.startDistance;
  const legacyEndDistance = typeof legacyRays?.endDistance === 'number' ? legacyRays.endDistance : defaultSceneConfig.rays.endDistance;
  const legacyLength = clamp(hasExplicitLength ? legacyRays.length ?? defaultSceneConfig.rays.length : (legacyEndDistance - legacyStartDistance) / Math.max(defaultSceneConfig.export.width / defaultSceneConfig.export.height, 1), 0, 1);
  const legacyMidpoint = hasExplicitLength ? 0 : (legacyStartDistance + legacyEndDistance) * 0.5;
  const rotationRadians = ((legacyRays?.rotation ?? defaultSceneConfig.rays.rotation) * Math.PI) / 180;
  const axisX = Math.cos(rotationRadians);
  const axisY = Math.sin(rotationRadians);
  const originX = clamp((legacyRays?.originX ?? defaultSceneConfig.rays.originX) + axisX * legacyMidpoint, -1, 2);
  const originY = clamp((legacyRays?.originY ?? defaultSceneConfig.rays.originY) + axisY * legacyMidpoint, -1, 2);
  const centeredStartDistance = -legacyLength * 0.5;
  const centeredEndDistance = legacyLength * 0.5;
  const legacyShape = createLegacyTunnelShape(scene.rays);
  const defaultShape = createCylinderShape();
  const requestedShape = scene.rays?.shape as Partial<RayShapeConfig & LegacyShape & { diameter?: number }> | undefined;
  const wallFallback = requestedShape?.wallProfile
    ? normalizeCurveProfile(requestedShape.wallProfile, defaultWallProfile)
    : legacyShape.wallProfile;
  const blurFallback = createLegacyBlurProfile(scene.rays);
  const opacityFallback = createLegacyOpacityProfile(scene.rays);

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
      originX,
      originY,
      length: legacyLength,
      startDistance: centeredStartDistance,
      endDistance: centeredEndDistance,
      blurProfile: blurFallback,
      opacityProfile: opacityFallback,
      shape: {
        ...defaultShape,
        ...legacyShape,
        ...(requestedShape && 'wallProfile' in requestedShape ? requestedShape : {}),
        diameter: clamp(typeof requestedShape?.diameter === 'number' ? requestedShape.diameter : legacyShape.diameter, 0.1, 2.6),
        wallProfile: normalizeCurveProfile(requestedShape?.wallProfile ?? legacyShape.wallProfile, wallFallback),
      },
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
  merged.rays.length = clamp(merged.rays.length, 0, 1);
  merged.rays.startDistance = -merged.rays.length * 0.5;
  merged.rays.endDistance = merged.rays.length * 0.5;
  merged.rays.startBlur = clamp(merged.rays.startBlur ?? 0, 0, 2.5);
  merged.rays.blur = clamp(merged.rays.blur, 0, 2.5);
  merged.rays.blurProfile = normalizeCurveProfile(merged.rays.blurProfile, blurFallback);
  merged.rays.opacityProfile = normalizeCurveProfile(merged.rays.opacityProfile, opacityFallback);
  merged.rays.driftAmount = 0;
  merged.rays.driftSpeed = 0;
  merged.rays.rotationSpeed = 1;
  merged.rays.pausedWhileParticlesMove = Boolean(merged.rays.pausedWhileParticlesMove);
  merged.rays.shape.diameter = clamp(merged.rays.shape.diameter, 0.1, 2.6);
  merged.rays.shape.wallProfile = normalizeCurveProfile(merged.rays.shape.wallProfile, wallFallback);
  normalizeParticleRanges(merged);
  merged.particles.style = merged.particles.style === 'light-streaks' ? 'light-streaks' : 'dust';
  const particleDirection = scene.particles?.direction as string | undefined;
  merged.particles.direction = particleDirection === 'reverse' || particleDirection === 'from-apex' ? 'reverse' : 'forward';
  merged.particles.color = typeof merged.particles.color === 'string' && merged.particles.color.trim() ? merged.particles.color : defaultSceneConfig.particles.color;
  merged.particles.streakLength = clamp(merged.particles.streakLength ?? defaultSceneConfig.particles.streakLength, 0, 1);
  merged.particles.streakSoftness = clamp(merged.particles.streakSoftness ?? defaultSceneConfig.particles.streakSoftness, 0, 1);
  merged.particles.streakTaper = clamp(merged.particles.streakTaper ?? defaultSceneConfig.particles.streakTaper, 0, 1);
  merged.particles.streakDensity = clamp(merged.particles.streakDensity ?? defaultSceneConfig.particles.streakDensity, 0, 1);
  merged.particles.streakFlow = clamp(merged.particles.streakFlow ?? defaultSceneConfig.particles.streakFlow, 0, 1);
  merged.particles.streakContrast = clamp(merged.particles.streakContrast ?? defaultSceneConfig.particles.streakContrast, 0, 1);
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
  const length = random.range(0.55, 0.95);
  const diameter = random.range(0.86, 1.42);
  const leftWidth = random.range(0.12, 1);
  const rightWidth = random.range(0.82, 1);
  const midWidth = random.range(0.2, 1);

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
      originX: random.range(0.28, 0.72),
      originY: random.range(0.38, 0.62),
      rotation: random.range(160, 200),
      fanAngle: random.range(54, 82),
      length,
      startDistance: -length * 0.5,
      endDistance: length * 0.5,
      opacity: random.range(0.58, 0.82),
      startBlur: random.range(0, 0.24),
      blur: random.range(0.72, 1.48),
      blurProfile: {
        start: random.range(0.2, 0.8),
        mid: random.range(0.45, 1),
        end: random.range(0.85, 1),
        cp1x: random.range(0.12, 0.38),
        cp1y: random.range(0.2, 0.8),
        cp2x: random.range(0.62, 0.88),
        cp2y: random.range(0.7, 1),
      },
      opacityProfile: {
        start: random.range(0, 0.25),
        mid: random.range(0.72, 1),
        end: random.range(0.75, 1),
        cp1x: random.range(0.12, 0.38),
        cp1y: random.range(0.05, 0.5),
        cp2x: random.range(0.62, 0.88),
        cp2y: random.range(0.75, 1),
      },
      driftAmount: 0,
      driftSpeed: 0,
      rotationSpeed: 1,
      pausedWhileParticlesMove: false,
      shape: {
        diameter,
        wallProfile: {
          start: leftWidth,
          mid: midWidth,
          end: rightWidth,
          cp1x: random.range(0.12, 0.38),
          cp1y: random.range(0.18, 1),
          cp2x: random.range(0.62, 0.88),
          cp2y: random.range(0.18, 1),
        },
      },
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
      direction: random.range(0, 1) > 0.25 ? 'forward' : 'reverse',
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
