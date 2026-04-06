import type { RayBand, RayBezierProfile, SceneConfig } from '../types/config';
import { cloneScene } from '../utils/scene';
import type { AnimatablePath, AnimatableValue } from './types';

type TrackKind = 'number' | 'color' | 'profile' | 'bands';

export type TrackDefinition = {
  kind: TrackKind;
  getValue: (scene: SceneConfig) => AnimatableValue;
  setValue: (scene: SceneConfig, value: AnimatableValue) => SceneConfig;
};

function updateScene(scene: SceneConfig, apply: (draft: SceneConfig) => void): SceneConfig {
  const next = cloneScene(scene);
  apply(next);
  return next;
}

function numberTrack(getValue: (scene: SceneConfig) => number, apply: (scene: SceneConfig, value: number) => void): TrackDefinition {
  return {
    kind: 'number',
    getValue,
    setValue: (scene, value) => updateScene(scene, (draft) => apply(draft, value as number)),
  };
}

function colorTrack(getValue: (scene: SceneConfig) => string, apply: (scene: SceneConfig, value: string) => void): TrackDefinition {
  return {
    kind: 'color',
    getValue,
    setValue: (scene, value) => updateScene(scene, (draft) => apply(draft, value as string)),
  };
}

function profileTrack(getValue: (scene: SceneConfig) => RayBezierProfile, apply: (scene: SceneConfig, value: RayBezierProfile) => void): TrackDefinition {
  return {
    kind: 'profile',
    getValue,
    setValue: (scene, value) => updateScene(scene, (draft) => apply(draft, value as RayBezierProfile)),
  };
}

function bandsTrack(getValue: (scene: SceneConfig) => RayBand[], apply: (scene: SceneConfig, value: RayBand[]) => void): TrackDefinition {
  return {
    kind: 'bands',
    getValue,
    setValue: (scene, value) => updateScene(scene, (draft) => apply(draft, value as RayBand[])),
  };
}

export const trackRegistry: Record<AnimatablePath, TrackDefinition> = {
  'background.topColor': colorTrack((scene) => scene.background.topColor, (scene, value) => { scene.background.topColor = value; }),
  'background.bottomColor': colorTrack((scene) => scene.background.bottomColor, (scene, value) => { scene.background.bottomColor = value; }),
  'background.washColor': colorTrack((scene) => scene.background.washColor, (scene, value) => { scene.background.washColor = value; }),
  'rays.originX': numberTrack((scene) => scene.rays.originX, (scene, value) => { scene.rays.originX = value; }),
  'rays.originY': numberTrack((scene) => scene.rays.originY, (scene, value) => { scene.rays.originY = value; }),
  'rays.rotation': numberTrack((scene) => scene.rays.rotation, (scene, value) => { scene.rays.rotation = value; }),
  'rays.length': numberTrack((scene) => scene.rays.length, (scene, value) => {
    scene.rays.length = value;
    scene.rays.startDistance = -value * 0.5;
    scene.rays.endDistance = value * 0.5;
  }),
  'rays.opacity': numberTrack((scene) => scene.rays.opacity, (scene, value) => { scene.rays.opacity = value; }),
  'rays.blur': numberTrack((scene) => scene.rays.blur, (scene, value) => { scene.rays.blur = value; }),
  'rays.loopCount': numberTrack((scene) => scene.rays.loopCount, (scene, value) => { scene.rays.loopCount = value; }),
  'rays.shape.diameter': numberTrack((scene) => scene.rays.shape.diameter, (scene, value) => { scene.rays.shape.diameter = value; }),
  'rays.shape.wallProfile': profileTrack((scene) => scene.rays.shape.wallProfile, (scene, value) => { scene.rays.shape.wallProfile = value; }),
  'rays.blurProfile': profileTrack((scene) => scene.rays.blurProfile, (scene, value) => { scene.rays.blurProfile = value; }),
  'rays.opacityProfile': profileTrack((scene) => scene.rays.opacityProfile, (scene, value) => { scene.rays.opacityProfile = value; }),
  'rays.bands': bandsTrack((scene) => scene.rays.bands, (scene, value) => { scene.rays.bands = value; }),
  'particles.count': numberTrack((scene) => scene.particles.count, (scene, value) => { scene.particles.count = value; }),
  'particles.minSize': numberTrack((scene) => scene.particles.minSize, (scene, value) => { scene.particles.minSize = value; }),
  'particles.maxSize': numberTrack((scene) => scene.particles.maxSize, (scene, value) => { scene.particles.maxSize = value; }),
  'particles.minSpeed': numberTrack((scene) => scene.particles.minSpeed, (scene, value) => { scene.particles.minSpeed = value; }),
  'particles.maxSpeed': numberTrack((scene) => scene.particles.maxSpeed, (scene, value) => { scene.particles.maxSpeed = value; }),
  'particles.opacity': numberTrack((scene) => scene.particles.opacity, (scene, value) => { scene.particles.opacity = value; }),
  'particles.twinkle': numberTrack((scene) => scene.particles.twinkle, (scene, value) => { scene.particles.twinkle = value; }),
  'particles.spread': numberTrack((scene) => scene.particles.spread, (scene, value) => { scene.particles.spread = value; }),
  'particles.directionRandomness': numberTrack((scene) => scene.particles.directionRandomness, (scene, value) => { scene.particles.directionRandomness = value; }),
  'particles.color': colorTrack((scene) => scene.particles.color, (scene, value) => { scene.particles.color = value; }),
  'particles.streakLength': numberTrack((scene) => scene.particles.streakLength, (scene, value) => { scene.particles.streakLength = value; }),
  'particles.streakSoftness': numberTrack((scene) => scene.particles.streakSoftness, (scene, value) => { scene.particles.streakSoftness = value; }),
  'particles.streakTaper': numberTrack((scene) => scene.particles.streakTaper, (scene, value) => { scene.particles.streakTaper = value; }),
  'particles.streakDensity': numberTrack((scene) => scene.particles.streakDensity, (scene, value) => { scene.particles.streakDensity = value; }),
  'particles.streakFlow': numberTrack((scene) => scene.particles.streakFlow, (scene, value) => { scene.particles.streakFlow = value; }),
  'particles.streakContrast': numberTrack((scene) => scene.particles.streakContrast, (scene, value) => { scene.particles.streakContrast = value; }),
};

