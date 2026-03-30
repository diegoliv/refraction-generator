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
  render: (params: RenderParams) => void;
};
