import { create } from 'zustand';
import { defaultSceneConfig, presets } from '../config/defaults';
import type { PresetDefinition, RayBand, SceneConfig } from '../types/config';
import { createDuplicatedPreset, createImportedPreset, normalizeSceneConfig, randomizeSceneTastefully } from '../utils/presets';
import { cloneScene, createRuntimeId } from '../utils/scene';
import { normalizeBandOffsets } from '../utils/gradientStops';

type PatchableSection = 'background' | 'export' | 'rays' | 'particles' | 'postprocessing';

type AppState = {
  scene: SceneConfig;
  presets: PresetDefinition[];
  activePresetId: string;
  isPlaying: boolean;
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
  applyPreset: (presetId: string) => void;
  duplicateCurrentPreset: (name?: string) => void;
  importPreset: (name: string, config: SceneConfig) => void;
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

export const useAppStore = create<AppState>((set, get) => ({
  scene: cloneScene(defaultSceneConfig),
  presets: builtinPresets,
  activePresetId: builtinPresets[0]?.id ?? 'classic-rainbow-prism',
  isPlaying: true,
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
  applyPreset: (presetId) => {
    const preset = get().presets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    set({
      scene: cloneScene(preset.config),
      activePresetId: presetId,
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
    }));
  },
  importPreset: (name, config) => {
    const imported = createImportedPreset(name, normalizeSceneConfig(config));

    set((current) => ({
      presets: [...current.presets, imported],
      activePresetId: imported.id,
      scene: cloneScene(imported.config),
    }));
  },
  randomizePreset: () => {
    const randomized = randomizeSceneTastefully(get().scene);

    set((state) => ({
      scene: randomized,
      activePresetId: state.activePresetId,
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
    });
  },
}));
