import type { RayBand, RayBezierProfile, SceneConfig } from '../types/config';

export type AnimatablePath =
  | 'background.topColor'
  | 'background.bottomColor'
  | 'background.washColor'
  | 'rays.originX'
  | 'rays.originY'
  | 'rays.rotation'
  | 'rays.length'
  | 'rays.opacity'
  | 'rays.blur'
  | 'rays.loopCount'
  | 'rays.shape.diameter'
  | 'rays.shape.wallProfile'
  | 'rays.blurProfile'
  | 'rays.opacityProfile'
  | 'rays.bands'
  | 'particles.count'
  | 'particles.minSize'
  | 'particles.maxSize'
  | 'particles.minSpeed'
  | 'particles.maxSpeed'
  | 'particles.opacity'
  | 'particles.twinkle'
  | 'particles.spread'
  | 'particles.directionRandomness'
  | 'particles.color'
  | 'particles.streakLength'
  | 'particles.streakSoftness'
  | 'particles.streakTaper'
  | 'particles.streakDensity'
  | 'particles.streakFlow'
  | 'particles.streakContrast';

export type AnimationEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'hold';

export type AnimatableValue = number | string | RayBezierProfile | RayBand[];

export type Keyframe<T = AnimatableValue> = {
  id: string;
  time: number;
  value: T;
  easing: AnimationEasing;
};

export type AnimationTrack<T = AnimatableValue> = {
  id: string;
  path: AnimatablePath;
  enabled: boolean;
  keyframes: Keyframe<T>[];
};

export type AnimationConfig = {
  enabled: boolean;
  tracks: AnimationTrack[];
};

export type SceneDocument = {
  scene: SceneConfig;
  animation: AnimationConfig;
};

