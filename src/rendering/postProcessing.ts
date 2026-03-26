import type { SceneConfig } from '../types/config';
import { createRandom } from '../utils/random';
import { withAlpha } from '../utils/color';
import { TAU } from '../utils/math';

type GrainPoint = {
  x: number;
  y: number;
  phase: number;
  strength: number;
  size: number;
};

type PostProcessParams = {
  ctx: CanvasRenderingContext2D;
  sourceCanvas: HTMLCanvasElement;
  config: SceneConfig;
  progress: number;
  width: number;
  height: number;
};

type GrainCache = {
  key: string;
  points: GrainPoint[];
};

function createGrainKey(config: SceneConfig, width: number, height: number): string {
  return JSON.stringify({
    seed: config.seed,
    grain: config.postprocessing.grain,
    width,
    height,
  });
}

function buildGrain(config: SceneConfig, width: number, height: number): GrainPoint[] {
  const random = createRandom(config.seed * 211 + 17);
  const pointCount = Math.max(24, Math.round(config.postprocessing.grain * 240));
  const maxSize = Math.max(1, Math.round(Math.min(width, height) * 0.0016));

  return Array.from({ length: pointCount }, () => ({
    x: random.range(0, width),
    y: random.range(0, height),
    phase: random.range(0, TAU),
    strength: random.range(0.4, 1),
    size: random.range(1, maxSize + 1),
  }));
}

export function createPostProcessor() {
  let grainCache: GrainCache | null = null;

  function getGrain(config: SceneConfig, width: number, height: number): GrainPoint[] {
    const key = createGrainKey(config, width, height);
    if (grainCache && grainCache.key === key) {
      return grainCache.points;
    }

    const points = buildGrain(config, width, height);
    grainCache = { key, points };
    return points;
  }

  return {
    process({ ctx, sourceCanvas, config, progress, width, height }: PostProcessParams): void {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(sourceCanvas, 0, 0, width, height);

      if (config.postprocessing.grain > 0.01) {
        const grainPoints = getGrain(config, width, height);
        ctx.save();
        ctx.globalCompositeOperation = 'soft-light';

        for (const point of grainPoints) {
          const alpha = config.postprocessing.grain * 0.038 * point.strength * (0.78 + 0.22 * Math.sin(progress * TAU + point.phase));
          ctx.fillStyle = withAlpha('#ffffff', alpha);
          ctx.fillRect(point.x, point.y, point.size, point.size);
        }

        ctx.restore();
      }
    },
  };
}
