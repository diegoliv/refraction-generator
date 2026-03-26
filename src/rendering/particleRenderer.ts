import type { SceneConfig } from '../types/config';
import { hexToRgb, mix, rgbToString, withAlpha } from '../utils/color';
import { fract, TAU } from '../utils/math';
import { createRandom } from '../utils/random';

type Particle = {
  x: number;
  y: number;
  size: number;
  speed: number;
  direction: number;
  twinklePhase: number;
  twinkleSpeed: number;
  alpha: number;
  swayPhase: number;
  swayAmount: number;
  tintMix: number;
};

type ParticleCache = {
  key: string;
  particles: Particle[];
};

type RenderParticleParams = {
  ctx: CanvasRenderingContext2D;
  config: SceneConfig;
  progress: number;
  width: number;
  height: number;
};

function createParticleKey(config: SceneConfig): string {
  return JSON.stringify({
    seed: config.seed,
    particles: config.particles,
    washColor: config.background.washColor,
    rayBands: config.rays.bands,
  });
}

function buildParticles(config: SceneConfig): Particle[] {
  const random = createRandom(config.seed * 173 + 29);
  const minSize = Math.min(config.particles.minSize, config.particles.maxSize);
  const maxSize = Math.max(config.particles.minSize, config.particles.maxSize);
  const minSpeed = Math.min(config.particles.minSpeed, config.particles.maxSpeed);
  const maxSpeed = Math.max(config.particles.minSpeed, config.particles.maxSpeed);

  return Array.from({ length: config.particles.count }, () => ({
    x: random.next(),
    y: random.next(),
    size: random.range(minSize, maxSize),
    speed: random.range(minSpeed, maxSpeed),
    direction: (-Math.PI / 2) + random.range(-1, 1) * config.particles.directionRandomness,
    twinklePhase: random.range(0, TAU),
    twinkleSpeed: random.range(0.8, 2.2),
    alpha: random.range(0.42, 1),
    swayPhase: random.range(0, TAU),
    swayAmount: random.range(0.005, 0.028),
    tintMix: random.range(0.2, 0.85),
  }));
}

function getParticleCache(config: SceneConfig, cache: ParticleCache | null): ParticleCache {
  const key = createParticleKey(config);
  if (cache && cache.key === key) {
    return cache;
  }

  return {
    key,
    particles: buildParticles(config),
  };
}

export function createParticleRenderer() {
  let cache: ParticleCache | null = null;

  return {
    render({ ctx, config, progress, width, height }: RenderParticleParams): void {
      if (!config.particles.enabled || config.particles.count <= 0) {
        return;
      }

      cache = getParticleCache(config, cache);
      const bandColors = config.rays.bands.map((band) => band.color);
      const baseTint = mix(config.background.washColor, '#ffffff', 0.72);
      const spreadScale = Math.max(0.18, config.particles.spread);
      const minDimension = Math.min(width, height);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (let index = 0; index < cache.particles.length; index += 1) {
        const particle = cache.particles[index];
        const travel = fract(progress * particle.speed + particle.twinklePhase / TAU);
        const driftX = Math.cos(particle.direction) * travel * spreadScale * 0.46;
        const driftY = Math.sin(particle.direction) * travel * spreadScale * 0.46;
        const swayX = Math.cos(progress * TAU + particle.swayPhase) * particle.swayAmount * (0.4 + config.particles.directionRandomness);
        const swayY = Math.sin(progress * TAU * 0.85 + particle.swayPhase) * particle.swayAmount * 0.9;
        const x = fract(particle.x + driftX + swayX) * width;
        const y = fract(particle.y + driftY + swayY) * height;
        const twinkle = 1 - config.particles.twinkle + config.particles.twinkle * (0.5 + 0.5 * Math.sin(progress * TAU * particle.twinkleSpeed + particle.twinklePhase));
        const alpha = config.particles.opacity * particle.alpha * twinkle;
        const coreRadius = Math.max(0.9, particle.size * minDimension * 0.0038);
        const glowRadius = coreRadius * (5.6 + particle.alpha * 2.8 + twinkle * 1.8);
        const rayTint = bandColors.length > 0 ? bandColors[index % bandColors.length] : '#ffffff';
        const tint = mix(baseTint, rayTint, particle.tintMix);
        const innerRgb = hexToRgb(mix(tint, '#ffffff', 0.6));
        const midRgb = hexToRgb(mix(tint, '#ffffff', 0.2));
        const outerRgb = hexToRgb(tint);

        const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        glow.addColorStop(0, rgbToString(innerRgb, alpha * 0.8));
        glow.addColorStop(0.14, rgbToString(innerRgb, alpha * 0.56));
        glow.addColorStop(0.38, rgbToString(midRgb, alpha * 0.28));
        glow.addColorStop(1, withAlpha(tint, 0));

        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, TAU);
        ctx.fill();

        const core = ctx.createRadialGradient(x, y, 0, x, y, coreRadius * 1.8);
        core.addColorStop(0, rgbToString(innerRgb, alpha * 1.18));
        core.addColorStop(0.55, rgbToString(midRgb, alpha * 0.36));
        core.addColorStop(1, rgbToString(outerRgb, 0));

        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(x, y, coreRadius * 1.8, 0, TAU);
        ctx.fill();
      }

      ctx.restore();
    },
  };
}
