import type { SceneConfig } from '../types/config';

export function cloneScene(scene: SceneConfig): SceneConfig {
  return JSON.parse(JSON.stringify(scene)) as SceneConfig;
}

export function createRuntimeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}
