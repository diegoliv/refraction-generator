import type { SceneConfig } from '../types/config';

export type RenderParams = {
  ctx: CanvasRenderingContext2D;
  config: SceneConfig;
  progress: number;
  width: number;
  height: number;
};

export type SceneRenderer = {
  mode: 'shader';
  requestedMode: 'shader';
  isFallback: boolean;
  fallbackReason?: string;
  render: (params: RenderParams) => void;
};
