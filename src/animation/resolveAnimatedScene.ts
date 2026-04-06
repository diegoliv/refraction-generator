import { cloneScene } from '../utils/scene';
import type { SceneConfig } from '../types/config';
import { applyEasing } from './easing';
import { interpolateBands, interpolateColor, interpolateNumber, interpolateProfile } from './interpolate';
import { trackRegistry } from './trackRegistry';
import type { AnimationConfig, AnimationTrack, AnimatableValue, Keyframe } from './types';

type KeyframePair<T = AnimatableValue> = {
  start: Keyframe<T>;
  end: Keyframe<T>;
  progress: number;
};

function sortKeyframes<T>(keyframes: Keyframe<T>[]): Keyframe<T>[] {
  return [...keyframes].sort((left, right) => left.time - right.time);
}

function getWrappedPair<T>(track: AnimationTrack<T>, progress: number): KeyframePair<T> | null {
  const keyframes = sortKeyframes(track.keyframes);
  if (keyframes.length === 0) {
    return null;
  }

  if (keyframes.length === 1) {
    return {
      start: keyframes[0],
      end: keyframes[0],
      progress: 0,
    };
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const start = keyframes[index];
    const end = keyframes[index + 1];
    if (progress >= start.time && progress <= end.time) {
      const span = Math.max(0.000001, end.time - start.time);
      return {
        start,
        end,
        progress: (progress - start.time) / span,
      };
    }
  }

  const start = keyframes[keyframes.length - 1];
  const end = keyframes[0];
  const wrappedProgress = progress >= start.time ? progress : progress + 1;
  const wrappedEnd = end.time + 1;
  return {
    start,
    end,
    progress: (wrappedProgress - start.time) / Math.max(0.000001, wrappedEnd - start.time),
  };
}

function interpolateValue(track: AnimationTrack, pair: KeyframePair): AnimatableValue {
  const definition = trackRegistry[track.path];
  const easedProgress = applyEasing(pair.start.easing ?? 'linear', pair.progress);
  const start = pair.start.value;
  const end = pair.end.value;

  switch (definition.kind) {
    case 'number':
      return interpolateNumber(start as number, end as number, easedProgress);
    case 'color':
      return interpolateColor(start as string, end as string, easedProgress);
    case 'profile':
      return interpolateProfile(start as Parameters<typeof interpolateProfile>[0], end as Parameters<typeof interpolateProfile>[1], easedProgress);
    case 'bands':
      return interpolateBands(start as Parameters<typeof interpolateBands>[0], end as Parameters<typeof interpolateBands>[1], easedProgress);
    default:
      return easedProgress < 0.5 ? start : end;
  }
}

export function resolveAnimatedScene(scene: SceneConfig, animation: AnimationConfig, progress: number): SceneConfig {
  if (!animation.enabled || animation.tracks.length === 0) {
    return scene;
  }

  let resolvedScene = cloneScene(scene);

  for (const track of animation.tracks) {
    if (!track.enabled || track.keyframes.length === 0) {
      continue;
    }

    const pair = getWrappedPair(track, progress);
    if (!pair) {
      continue;
    }

    const value = pair.start.id === pair.end.id ? pair.start.value : interpolateValue(track, pair);
    resolvedScene = trackRegistry[track.path].setValue(resolvedScene, value);
  }

  return resolvedScene;
}
