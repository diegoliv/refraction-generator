import type { SceneConfig } from '../types/config';
import { hexToRgb, mix, rgbToString, withAlpha } from '../utils/color';
import { clamp, TAU } from '../utils/math';
import { createRandom } from '../utils/random';
import { buildRayRuntime, type RayBandRuntime } from './rayRuntime';

type WashOrb = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  phase: number;
  speed: number;
  tintMix: number;
};

type CachedScene = {
  key: string;
  washOrbs: WashOrb[];
  rayRuntime: RayBandRuntime[];
};

type WedgeParams = {
  centerX: number;
  centerY: number;
  startRadius: number;
  endRadius: number;
  startAngle: number;
  endAngle: number;
};

type CoreRenderParams = {
  ctx: CanvasRenderingContext2D;
  config: SceneConfig;
  progress: number;
  width: number;
  height: number;
};

function createSceneKey(config: SceneConfig): string {
  return JSON.stringify({
    seed: config.seed,
    background: config.background,
    rays: config.rays,
    particles: config.particles,
    postprocessing: config.postprocessing,
  });
}

function buildWashOrbs(config: SceneConfig): WashOrb[] {
  const random = createRandom(config.seed);

  return Array.from({ length: 5 }, () => ({
    x: random.range(0.16, 0.84),
    y: random.range(0.14, 0.86),
    radius: random.range(0.18, 0.46),
    alpha: random.range(0.07, 0.17),
    phase: random.range(0, TAU),
    speed: random.range(0.8, 2),
    tintMix: random.range(0.2, 0.85),
  }));
}

function getCachedScene(config: SceneConfig, cached: CachedScene | null): CachedScene {
  const key = createSceneKey(config);
  if (cached && cached.key === key) {
    return cached;
  }

  return {
    key,
    washOrbs: buildWashOrbs(config),
    rayRuntime: buildRayRuntime(config),
  };
}

function drawBackground(ctx: CanvasRenderingContext2D, config: SceneConfig, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, config.background.topColor);
  gradient.addColorStop(1, config.background.bottomColor);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawAtmosphericHaze(ctx: CanvasRenderingContext2D, config: SceneConfig, progress: number, width: number, height: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(progress * TAU * 0.5);
  const haze = ctx.createRadialGradient(
    width * 0.48,
    height * 0.42,
    0,
    width * 0.48,
    height * 0.42,
    Math.max(width, height) * 0.72,
  );
  haze.addColorStop(0, withAlpha(mix(config.background.washColor, '#ffffff', 0.16), 0.06 + pulse * 0.02));
  haze.addColorStop(0.45, withAlpha(config.background.washColor, 0.032));
  haze.addColorStop(1, withAlpha(config.background.washColor, 0));

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawAnimatedWash(ctx: CanvasRenderingContext2D, config: SceneConfig, progress: number, width: number, height: number, washOrbs: WashOrb[]): void {
  const bandTint = config.rays.bands[1]?.color ?? config.background.washColor;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = `blur(${Math.round(Math.min(width, height) * config.postprocessing.softness * 0.09)}px)`;

  washOrbs.forEach((orb) => {
    const offsetX = Math.cos(progress * TAU * orb.speed + orb.phase) * width * 0.07;
    const offsetY = Math.sin(progress * TAU * orb.speed * 0.85 + orb.phase) * height * 0.055;
    const centerX = orb.x * width + offsetX;
    const centerY = orb.y * height + offsetY;
    const radius = orb.radius * Math.max(width, height);
    const tint = mix(config.background.washColor, bandTint, orb.tintMix);

    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, withAlpha(mix(tint, '#ffffff', 0.24), orb.alpha * 1.05));
    gradient.addColorStop(0.28, withAlpha(tint, orb.alpha * 0.68));
    gradient.addColorStop(0.65, withAlpha(tint, orb.alpha * 0.18));
    gradient.addColorStop(1, withAlpha(tint, 0));

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });

  ctx.restore();
}

function drawSubtleWave(ctx: CanvasRenderingContext2D, progress: number, width: number, height: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.strokeStyle = withAlpha('#ffffff', 0.048);
  ctx.lineWidth = Math.max(1, Math.round(width * 0.0022));

  const amplitude = height * 0.055;
  const baseY = height * 0.52;
  const shift = Math.sin(progress * TAU) * height * 0.028;

  ctx.beginPath();
  ctx.moveTo(0, baseY + shift);
  ctx.bezierCurveTo(
    width * 0.28,
    baseY - amplitude,
    width * 0.72,
    baseY + amplitude,
    width,
    baseY - shift,
  );
  ctx.stroke();
  ctx.restore();
}

function drawWedgePath(ctx: CanvasRenderingContext2D, wedge: WedgeParams): void {
  ctx.beginPath();
  ctx.arc(wedge.centerX, wedge.centerY, wedge.endRadius, wedge.startAngle, wedge.endAngle);
  ctx.arc(wedge.centerX, wedge.centerY, wedge.startRadius, wedge.endAngle, wedge.startAngle, true);
  ctx.closePath();
}

function fillClippedGradient(
  ctx: CanvasRenderingContext2D,
  wedge: WedgeParams,
  gradientBuilder: () => CanvasGradient,
  blurPx: number,
  composite: GlobalCompositeOperation = 'screen',
): void {
  ctx.save();
  ctx.globalCompositeOperation = composite;
  drawWedgePath(ctx, wedge);
  ctx.clip();
  ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
  ctx.fillStyle = gradientBuilder();
  ctx.fillRect(
    wedge.centerX - wedge.endRadius * 1.2,
    wedge.centerY - wedge.endRadius * 1.2,
    wedge.endRadius * 2.4,
    wedge.endRadius * 2.4,
  );
  ctx.restore();
}

function drawBandAmbient(
  ctx: CanvasRenderingContext2D,
  wedge: WedgeParams,
  color: string,
  alpha: number,
  width: number,
  height: number,
): void {
  const midAngle = (wedge.startAngle + wedge.endAngle) * 0.5;
  const farX = wedge.centerX + Math.cos(midAngle) * wedge.endRadius;
  const farY = wedge.centerY + Math.sin(midAngle) * wedge.endRadius;

  fillClippedGradient(ctx, wedge, () => {
    const gradient = ctx.createLinearGradient(wedge.centerX, wedge.centerY, farX, farY);
    gradient.addColorStop(0, withAlpha(color, 0));
    gradient.addColorStop(0.22, withAlpha(color, alpha * 0.18));
    gradient.addColorStop(0.55, withAlpha(mix(color, '#ffffff', 0.1), alpha * 0.46));
    gradient.addColorStop(1, withAlpha(color, 0));
    return gradient;
  }, Math.max(width, height) * 0.018, 'lighter');
}

function drawRayVeil(
  ctx: CanvasRenderingContext2D,
  color: string,
  alpha: number,
  wedge: WedgeParams,
  blurPx: number,
): void {
  fillClippedGradient(ctx, wedge, () => {
    const gradient = ctx.createRadialGradient(
      wedge.centerX,
      wedge.centerY,
      wedge.startRadius * 0.9,
      wedge.centerX,
      wedge.centerY,
      wedge.endRadius,
    );
    gradient.addColorStop(0, withAlpha(color, 0));
    gradient.addColorStop(0.16, withAlpha(color, alpha * 0.22));
    gradient.addColorStop(0.42, withAlpha(mix(color, '#ffffff', 0.24), alpha));
    gradient.addColorStop(0.72, withAlpha(color, alpha * 0.34));
    gradient.addColorStop(1, withAlpha(color, 0));
    return gradient;
  }, blurPx, 'screen');
}

function drawRayCore(
  ctx: CanvasRenderingContext2D,
  color: string,
  alpha: number,
  wedge: WedgeParams,
  blurPx: number,
): void {
  const centerColor = hexToRgb(mix(color, '#ffffff', 0.5));
  const outerColor = hexToRgb(color);

  fillClippedGradient(ctx, wedge, () => {
    const gradient = ctx.createRadialGradient(
      wedge.centerX,
      wedge.centerY,
      wedge.startRadius,
      wedge.centerX,
      wedge.centerY,
      wedge.endRadius * 0.9,
    );
    gradient.addColorStop(0, rgbToString(centerColor, 0));
    gradient.addColorStop(0.18, rgbToString(centerColor, alpha * 0.22));
    gradient.addColorStop(0.38, rgbToString(centerColor, alpha * 0.74));
    gradient.addColorStop(0.58, rgbToString(outerColor, alpha * 0.42));
    gradient.addColorStop(0.9, rgbToString(outerColor, alpha * 0.08));
    gradient.addColorStop(1, withAlpha(color, 0));
    return gradient;
  }, blurPx, 'screen');
}

function drawRayRibs(
  ctx: CanvasRenderingContext2D,
  color: string,
  alpha: number,
  wedge: WedgeParams,
  blurPx: number,
  lean: number,
): void {
  const angleMid = (wedge.startAngle + wedge.endAngle) * 0.5;
  const angleSpan = wedge.endAngle - wedge.startAngle;
  const ribCount = 4;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = `blur(${(blurPx * 0.26).toFixed(1)}px)`;
  ctx.strokeStyle = withAlpha(mix(color, '#ffffff', 0.58), alpha * 0.24);
  ctx.lineCap = 'round';

  for (let index = 0; index < ribCount; index += 1) {
    const t = ribCount > 1 ? index / (ribCount - 1) : 0.5;
    const angle = wedge.startAngle + angleSpan * (0.14 + t * 0.72);
    const innerRadius = wedge.startRadius * (1.02 + t * 0.02);
    const outerRadius = wedge.endRadius * (0.82 + t * 0.09);
    const bend = lean * angleSpan * wedge.endRadius * 0.08;

    ctx.lineWidth = Math.max(1.2, angleSpan * wedge.endRadius * 0.013 * (1 - Math.abs(t - 0.5) * 0.6));
    ctx.beginPath();
    ctx.moveTo(wedge.centerX + Math.cos(angle) * innerRadius, wedge.centerY + Math.sin(angle) * innerRadius);
    ctx.bezierCurveTo(
      wedge.centerX + Math.cos((angle + angleMid) * 0.5) * ((innerRadius + outerRadius) * 0.46) + Math.cos(angleMid + Math.PI / 2) * bend,
      wedge.centerY + Math.sin((angle + angleMid) * 0.5) * ((innerRadius + outerRadius) * 0.46) + Math.sin(angleMid + Math.PI / 2) * bend,
      wedge.centerX + Math.cos((angle + angleMid) * 0.5) * ((innerRadius + outerRadius) * 0.72) - Math.cos(angleMid + Math.PI / 2) * bend * 0.7,
      wedge.centerY + Math.sin((angle + angleMid) * 0.5) * ((innerRadius + outerRadius) * 0.72) - Math.sin(angleMid + Math.PI / 2) * bend * 0.7,
      wedge.centerX + Math.cos(angle) * outerRadius,
      wedge.centerY + Math.sin(angle) * outerRadius,
    );
    ctx.stroke();
  }

  ctx.restore();
}

function drawRefractionHalo(ctx: CanvasRenderingContext2D, config: SceneConfig, progress: number, width: number, height: number): void {
  const centerX = width * (0.42 + Math.cos(progress * TAU * 0.6) * 0.01);
  const centerY = height * (0.46 + Math.sin(progress * TAU * 0.7) * 0.01);
  const radius = Math.max(width, height) * 0.64;
  const halo = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  halo.addColorStop(0, withAlpha(mix(config.background.washColor, '#ffffff', 0.24), 0.085));
  halo.addColorStop(0.36, withAlpha(config.background.washColor, 0.045));
  halo.addColorStop(1, withAlpha(config.background.washColor, 0));

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawRays(
  ctx: CanvasRenderingContext2D,
  config: SceneConfig,
  progress: number,
  width: number,
  height: number,
  rayRuntime: RayBandRuntime[],
): void {
  if (!config.rays.enabled || config.rays.bands.length === 0) {
    return;
  }

  const originX = config.rays.originX * width;
  const originY = config.rays.originY * height;
  const maxDimension = Math.max(width, height);
  const totalWeight = config.rays.bands.reduce((sum, band) => sum + Math.max(0.001, band.weight), 0);
  const fanAngleRad = (config.rays.fanAngle * Math.PI) / 180;
  const baseRotation = (config.rays.rotation * Math.PI) / 180;
  const rotationProgress = progress * TAU;
  const startRadius = config.rays.startDistance * maxDimension;
  const endRadius = Math.max(startRadius + 4, config.rays.endDistance * maxDimension);
  const blurPx = Math.max(10, maxDimension * config.rays.blur * 0.095);

  let currentAngle = baseRotation + rotationProgress - fanAngleRad * 0.5;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  config.rays.bands.forEach((band, index) => {
    const runtime = rayRuntime[index] ?? {
      id: band.id,
      jitter: 0,
      pulse: 0,
      spreadScale: 1,
      brightness: 1,
      lean: 0,
      shimmer: 0,
    };
    const baseSpan = fanAngleRad * (Math.max(0.001, band.weight) / totalWeight);
    const shimmer = 0.5 + 0.5 * Math.sin(progress * TAU * 0.55 + runtime.shimmer);
    const localSpan = baseSpan * runtime.spreadScale;
    const centerOffset = 0;
    const bandCenter = currentAngle + localSpan * 0.5 + centerOffset;
    const feather = localSpan * clamp(0.16 + band.softness * 0.22, 0.12, 0.34);
    const wedge: WedgeParams = {
      centerX: originX,
      centerY: originY,
      startRadius,
      endRadius,
      startAngle: bandCenter - localSpan * 0.5 - feather,
      endAngle: bandCenter + localSpan * 0.5 + feather,
    };
    const alpha = config.rays.opacity * runtime.brightness * (0.76 + shimmer * 0.24);
    const ambientAlpha = alpha * 0.22;

    drawBandAmbient(ctx, wedge, band.color, ambientAlpha, width, height);
    drawRayVeil(ctx, band.color, alpha * 0.34, {
      ...wedge,
      startRadius: startRadius * 0.88,
      endRadius: endRadius * 1.02,
    }, blurPx * (1.05 + band.softness * 0.8));
    drawRayCore(ctx, mix(band.color, '#ffffff', 0.08), alpha * 0.46, {
      ...wedge,
      startRadius: startRadius * 0.92,
      endRadius: endRadius * (0.9 + shimmer * 0.08),
    }, blurPx * (0.66 + band.softness * 0.42));
    drawRayCore(ctx, mix(band.color, '#ffffff', 0.34), alpha * 0.2, {
      ...wedge,
      startRadius: startRadius * 1.02,
      endRadius: endRadius * 0.72,
    }, blurPx * 0.92);
    drawRayRibs(ctx, band.color, alpha, wedge, blurPx, runtime.lean);

    currentAngle += baseSpan;
  });

  ctx.restore();
}

export function createCoreSceneRenderer() {
  let cached: CachedScene | null = null;

  return {
    render({ ctx, config, progress, width, height }: CoreRenderParams): void {
      cached = getCachedScene(config, cached);
      drawBackground(ctx, config, width, height);
      drawAtmosphericHaze(ctx, config, progress, width, height);
      drawAnimatedWash(ctx, config, progress, width, height, cached.washOrbs);
      drawRefractionHalo(ctx, config, progress, width, height);
      drawRays(ctx, config, progress, width, height, cached.rayRuntime);
      drawSubtleWave(ctx, progress, width, height);
    },
  };
}


