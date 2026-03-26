import type { SceneConfig } from '../types/config';
import type { SceneRenderer } from './types';
import { createShaderSceneRenderer, preloadShaderAssets } from './shaderSceneRenderer';

export function createSceneRenderer(): SceneRenderer {
  return createShaderSceneRenderer();
}

export async function preloadSceneAssets(config: SceneConfig): Promise<void> {
  await preloadShaderAssets(config);
}

export type { SceneConfig };
