import { create } from 'zustand';
import { cloneAnimation, createAnimationTrack, createKeyframe, defaultAnimationConfig } from '../animation/defaults';
import { trackRegistry } from '../animation/trackRegistry';
import type { AnimationConfig, AnimatablePath, AnimatableValue, AnimationEasing } from '../animation/types';
import { defaultSceneConfig, presets } from '../config/defaults';
import type { PresetDefinition, RayBand, SceneConfig } from '../types/config';
import { normalizeBandOffsets } from '../utils/gradientStops';
import { createDuplicatedPreset, createImportedPreset, normalizeSceneConfig, randomizeSceneTastefully } from '../utils/presets';
import { cloneScene, createRuntimeId } from '../utils/scene';

type PatchableSection = 'background' | 'export' | 'rays' | 'particles' | 'postprocessing';

type AppState = {
  scene: SceneConfig;
  animation: AnimationConfig;
  presets: PresetDefinition[];
  activePresetId: string;
  isPlaying: boolean;
  playhead: number;
  autoKeying: boolean;
  selectedKeyframeId: string | null;
  patchBackground: (patch: Partial<SceneConfig['background']>) => void;
  patchExport: (patch: Partial<SceneConfig['export']>) => void;
  patchRays: (patch: Partial<SceneConfig['rays']>) => void;
  patchParticles: (patch: Partial<SceneConfig['particles']>) => void;
  patchPostprocessing: (patch: Partial<SceneConfig['postprocessing']>) => void;
  addRayBand: () => void;
  replaceRayBands: (bands: RayBand[]) => void;
  updateRayBand: (id: string, patch: Partial<RayBand>) => void;
  removeRayBand: (id: string) => void;
  setSeed: (seed: number) => void;
  setPlaying: (isPlaying: boolean) => void;
  setPlayhead: (playhead: number) => void;
  setAutoKeying: (enabled: boolean) => void;
  addAnimationTrack: (path: AnimatablePath) => void;
  removeAnimationTrack: (trackId: string) => void;
  setSelectedKeyframe: (keyframeId: string | null) => void;
  addKeyframeFromCurrentValue: (path: AnimatablePath, time?: number) => void;
  upsertKeyframeValue: (path: AnimatablePath, time: number, value: AnimatableValue) => void;
  updateKeyframe: (trackId: string, keyframeId: string, patch: Partial<{ time: number; easing: AnimationEasing }>) => void;
  removeKeyframe: (trackId: string, keyframeId: string) => void;
  applyPreset: (presetId: string) => void;
  duplicateCurrentPreset: (name?: string) => void;
  importPreset: (name: string, config: SceneConfig, animation?: AnimationConfig) => void;
  randomizePreset: () => void;
  resetToDefaultPreset: () => void;
};

const builtinPresets = presets.map((preset) => ({
  ...preset,
  config: cloneScene(preset.config),
}));

function updateScene(setter: (scene: SceneConfig) => SceneConfig) {
  return (state: AppState): Pick<AppState, 'scene'> => ({
    scene: setter(state.scene),
  });
}

function patchSection<K extends PatchableSection>(scene: SceneConfig, key: K, patch: Partial<SceneConfig[K]>): SceneConfig {
  return {
    ...scene,
    [key]: {
      ...scene[key],
      ...patch,
    },
  } as SceneConfig;
}

function resetAnimationState() {
  return {
    animation: cloneAnimation(defaultAnimationConfig),
    playhead: 0,
    selectedKeyframeId: null,
  };
}

function upsertTrackKeyframe(animation: AnimationConfig, path: AnimatablePath, time: number, value: AnimatableValue) {
  const targetTime = Math.max(0, Math.min(1, time));
  const existingTrack = animation.tracks.find((track) => track.path === path);
  const keyframe = createKeyframe(targetTime, value);

  if (!existingTrack) {
    const track = createAnimationTrack(path);
    track.keyframes = [keyframe];
    return {
      animation: {
        ...animation,
        tracks: [...animation.tracks, track],
      },
      keyframeId: keyframe.id,
    };
  }

  const nextTrack = {
    ...existingTrack,
    keyframes: [...existingTrack.keyframes.filter((entry) => Math.abs(entry.time - targetTime) > 0.0001), keyframe]
      .sort((left, right) => left.time - right.time),
  };

  return {
    animation: {
      ...animation,
      tracks: animation.tracks.map((track) => (track.id === existingTrack.id ? nextTrack : track)),
    },
    keyframeId: keyframe.id,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  scene: cloneScene(defaultSceneConfig),
  animation: cloneAnimation(defaultAnimationConfig),
  presets: builtinPresets,
  activePresetId: builtinPresets[0]?.id ?? 'classic-rainbow-prism',
  isPlaying: true,
  playhead: 0,
  autoKeying: true,
  selectedKeyframeId: null,
  patchBackground: (patch) => set((state) => updateScene((scene) => patchSection(scene, 'background', patch))(state)),
  patchExport: (patch) => set((state) => updateScene((scene) => patchSection(scene, 'export', patch))(state)),
  patchRays: (patch) => set((state) => updateScene((scene) => patchSection(scene, 'rays', patch))(state)),
  patchParticles: (patch) => set((state) => updateScene((scene) => patchSection(scene, 'particles', patch))(state)),
  patchPostprocessing: (patch) => set((state) => updateScene((scene) => patchSection(scene, 'postprocessing', patch))(state)),
  addRayBand: () => {
    set((state) => updateScene((scene) => ({
      ...scene,
      rays: {
        ...scene.rays,
        bands: normalizeBandOffsets([
          ...scene.rays.bands,
          {
            id: createRuntimeId('band'),
            color: '#ffffff',
            offset: 1,
            weight: 1,
            softness: 1,
          },
        ]),
      },
    }))(state));
  },
  replaceRayBands: (bands) => {
    set((state) => updateScene((scene) => ({
      ...scene,
      rays: {
        ...scene.rays,
        bands: normalizeBandOffsets(bands),
      },
    }))(state));
  },
  updateRayBand: (id, patch) => {
    set((state) => updateScene((scene) => ({
      ...scene,
      rays: {
        ...scene.rays,
        bands: normalizeBandOffsets(scene.rays.bands.map((band) => (band.id === id ? { ...band, ...patch } : band))),
      },
    }))(state));
  },
  removeRayBand: (id) => {
    set((state) => updateScene((scene) => ({
      ...scene,
      rays: {
        ...scene.rays,
        bands: normalizeBandOffsets(scene.rays.bands.filter((band) => band.id !== id)),
      },
    }))(state));
  },
  setSeed: (seed) => set((state) => updateScene((scene) => ({ ...scene, seed }))(state)),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setPlayhead: (playhead) => set({ playhead: Math.max(0, Math.min(1, playhead)) }),
  setAutoKeying: (autoKeying) => set({ autoKeying }),
  addAnimationTrack: (path) => {
    set((state) => {
      if (state.animation.tracks.some((track) => track.path === path)) {
        return state;
      }

      return {
        animation: {
          ...state.animation,
          tracks: [...state.animation.tracks, createAnimationTrack(path)],
        },
      };
    });
  },
  removeAnimationTrack: (trackId) => set((state) => ({
    animation: {
      ...state.animation,
      tracks: state.animation.tracks.filter((track) => track.id !== trackId),
    },
    selectedKeyframeId: null,
  })),
  setSelectedKeyframe: (keyframeId) => set({ selectedKeyframeId: keyframeId }),
  addKeyframeFromCurrentValue: (path, time) => {
    set((state) => {
      const definition = trackRegistry[path];
      const next = upsertTrackKeyframe(state.animation, path, time ?? state.playhead, definition.getValue(state.scene));
      return {
        animation: next.animation,
        selectedKeyframeId: next.keyframeId,
      };
    });
  },
  upsertKeyframeValue: (path, time, value) => {
    set((state) => {
      const next = upsertTrackKeyframe(state.animation, path, time, value);
      return {
        animation: next.animation,
        selectedKeyframeId: next.keyframeId,
      };
    });
  },
  updateKeyframe: (trackId, keyframeId, patch) => set((state) => ({
    animation: {
      ...state.animation,
      tracks: state.animation.tracks.map((track) => (
        track.id === trackId
          ? {
              ...track,
              keyframes: track.keyframes
                .map((keyframe) => (keyframe.id === keyframeId ? {
                  ...keyframe,
                  ...patch,
                  time: patch.time === undefined ? keyframe.time : Math.max(0, Math.min(1, patch.time)),
                } : keyframe))
                .sort((left, right) => left.time - right.time),
            }
          : track
      )),
    },
  })),
  removeKeyframe: (trackId, keyframeId) => set((state) => ({
    animation: {
      ...state.animation,
      tracks: state.animation.tracks.map((track) => (
        track.id === trackId
          ? { ...track, keyframes: track.keyframes.filter((keyframe) => keyframe.id !== keyframeId) }
          : track
      )),
    },
    selectedKeyframeId: state.selectedKeyframeId === keyframeId ? null : state.selectedKeyframeId,
  })),
  applyPreset: (presetId) => {
    const preset = get().presets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    set({
      scene: cloneScene(preset.config),
      activePresetId: presetId,
      ...resetAnimationState(),
    });
  },
  duplicateCurrentPreset: (name) => {
    const state = get();
    const source = state.presets.find((preset) => preset.id === state.activePresetId);
    const presetName = name?.trim() || `${source?.name ?? 'Preset'} Copy`;
    const duplicated = createDuplicatedPreset(presetName, state.scene);

    set((current) => ({
      presets: [...current.presets, duplicated],
      activePresetId: duplicated.id,
      scene: cloneScene(duplicated.config),
      ...resetAnimationState(),
    }));
  },
  importPreset: (name, config, animation) => {
    const imported = createImportedPreset(name, normalizeSceneConfig(config));

    set((current) => ({
      presets: [...current.presets, imported],
      activePresetId: imported.id,
      scene: cloneScene(imported.config),
      animation: animation ? cloneAnimation(animation) : cloneAnimation(defaultAnimationConfig),
      playhead: 0,
      selectedKeyframeId: null,
    }));
  },
  randomizePreset: () => {
    const randomized = randomizeSceneTastefully(get().scene);

    set((state) => ({
      scene: randomized,
      activePresetId: state.activePresetId,
      playhead: 0,
    }));
  },
  resetToDefaultPreset: () => {
    const fallback = builtinPresets[0];
    if (!fallback) {
      return;
    }

    set({
      scene: cloneScene(fallback.config),
      activePresetId: fallback.id,
      ...resetAnimationState(),
    });
  },
}));
