import type { SceneConfig } from '../types/config';
import { createRandom } from '../utils/random';

export type RayBandRuntime = {
  id: string;
  jitter: number;
  pulse: number;
  spreadScale: number;
  brightness: number;
  lean: number;
  shimmer: number;
};

export function buildRayRuntime(config: SceneConfig): RayBandRuntime[] {
  const random = createRandom(config.seed * 97 + 11);

  return config.rays.bands.map((band) => ({
    id: band.id,
    jitter: random.range(-1, 1),
    pulse: random.range(0, Math.PI * 2),
    spreadScale: random.range(0.92, 1.18),
    brightness: random.range(0.88, 1.18),
    lean: random.range(-1, 1),
    shimmer: random.range(0, Math.PI * 2),
  }));
}
