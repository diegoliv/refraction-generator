import { createRuntimeId } from '../utils/scene';
import type { AnimationConfig, AnimationTrack, AnimatablePath, Keyframe } from './types';

export const defaultAnimationConfig: AnimationConfig = {
  enabled: true,
  tracks: [],
};

export function cloneAnimation<T extends AnimationConfig | AnimationTrack | Keyframe>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createAnimationTrack(path: AnimatablePath): AnimationTrack {
  return {
    id: createRuntimeId('track'),
    path,
    enabled: true,
    keyframes: [],
  };
}

export function createKeyframe<T>(time: number, value: T): Keyframe<T> {
  return {
    id: createRuntimeId('keyframe'),
    time,
    value,
    easing: 'linear',
  };
}
