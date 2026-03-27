import type { SceneConfig } from '../types/config';
import { colorAlpha, hexToRgb } from '../utils/color';
import { normalizeBandOffsets } from '../utils/gradientStops';
import { lerp } from '../utils/math';
import { ensureCanvasSize } from './canvas';
import type { RenderParams, SceneRenderer } from './types';

const GRADIENT_TEXTURE_WIDTH = 4096;
const GRADIENT_TEXTURE_HEIGHT = 2;
const MAX_SHADER_PARTICLES = 500;

function srgbChannelToLinear(value: number): number {
  return Math.pow(value / 255, 2.2);
}

function linearChannelToSrgb(value: number): number {
  return Math.pow(Math.max(0, Math.min(1, value)), 1 / 2.2) * 255;
}


const VERTEX_SHADER_SOURCE = `
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision highp float;

uniform vec2 uResolution;
uniform float uConeProgress;
uniform float uParticleProgress;
uniform float uSeed;
uniform vec2 uOrigin;
uniform float uRotation;
uniform float uFanAngle;
uniform float uStartDistance;
uniform float uEndDistance;
uniform float uOpacity;
uniform float uStartBlur;
uniform float uEndBlur;
uniform float uGlobalBlur;
uniform float uBackgroundMode;
uniform vec3 uBackgroundTop;
uniform vec3 uBackgroundBottom;
uniform vec3 uBackgroundWash;
uniform float uBackgroundTopAlpha;
uniform float uBackgroundBottomAlpha;
uniform vec2 uBackgroundImageSize;
uniform float uBackgroundImageReady;
uniform float uParticleCount;
uniform float uParticleMinSize;
uniform float uParticleMaxSize;
uniform float uParticleMinSpeed;
uniform float uParticleMaxSpeed;
uniform float uParticleOpacity;
uniform float uParticleTwinkle;
uniform float uParticleSpread;
uniform float uParticleDirectionRandomness;
uniform float uParticleDirection;
uniform vec3 uParticleColor;
uniform float uGrainAmount;
uniform sampler2D uGradientTexture;
uniform sampler2D uGradientBlurTexture;
uniform sampler2D uBackgroundImage;

varying vec2 vUv;

const float TAU = 6.283185307179586;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec3 toLinear(vec3 color) {
  return pow(max(color, vec3(0.0)), vec3(2.2));
}

vec3 toSrgb(vec3 color) {
  return pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
}

float interleavedGradientNoise(vec2 uv) {
  return fract(52.9829189 * fract(dot(uv, vec2(0.06711056, 0.00583715))));
}

vec3 sampleGradient(float t) {
  return texture2D(uGradientTexture, vec2(fract(t), 0.5)).rgb;
}

vec3 sampleBlurredGradient(float t) {
  return texture2D(uGradientBlurTexture, vec2(fract(t), 0.5)).rgb;
}

vec4 alphaOver(vec4 dst, vec4 src) {
  float outAlpha = src.a + dst.a * (1.0 - src.a);
  vec3 premultiplied = src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a);
  vec3 outColor = outAlpha > 0.0 ? premultiplied / outAlpha : vec3(0.0);
  return vec4(outColor, outAlpha);
}

vec2 coverUv(vec2 uv) {
  float canvasAspect = uResolution.x / max(uResolution.y, 1.0);
  float imageAspect = uBackgroundImageSize.x / max(uBackgroundImageSize.y, 1.0);
  vec2 result = uv;

  if (imageAspect > canvasAspect) {
    float scale = canvasAspect / imageAspect;
    result.x = (uv.x - 0.5) * scale + 0.5;
  } else {
    float scale = imageAspect / canvasAspect;
    result.y = (uv.y - 0.5) * scale + 0.5;
  }

  return result;
}

vec4 renderGradientBackground(vec2 uv, vec2 origin, vec2 aspect) {
  float gradientMix = 1.0 - uv.y;
  vec3 base = mix(uBackgroundBottom, uBackgroundTop, gradientMix);
  float alpha = mix(uBackgroundBottomAlpha, uBackgroundTopAlpha, gradientMix);
  return vec4(base, alpha);
}

vec4 renderBackground(vec2 uv, vec2 origin, vec2 aspect) {
  if (uBackgroundMode > 0.5 && uBackgroundImageReady > 0.5) {
    vec2 imageUv = coverUv(uv);
    return texture2D(uBackgroundImage, imageUv);
  }

  return renderGradientBackground(uv, origin, aspect);
}

vec4 renderCone(vec2 uv, vec2 origin, vec2 aspect) {
  vec2 p = (uv - origin) * aspect;
  float rotation = radians(uRotation);
  vec2 axis = vec2(cos(rotation), sin(rotation));
  vec2 side = vec2(-axis.y, axis.x);

  float axial = dot(p, axis);
  float lateral = dot(p, side);
  float startDistance = max(0.0, uStartDistance);
  float endDistance = max(startDistance + 0.001, uEndDistance);
  float axialRange = max(0.0001, endDistance - startDistance);
  float axialT = clamp((axial - startDistance) / axialRange, 0.0, 1.0);

  float tipBlur = max(0.0, uStartBlur + uGlobalBlur);
  float tailBlur = max(0.0, uEndBlur + uGlobalBlur);

  float halfAngle = radians(uFanAngle) * 0.5;
  float halfWidth = max(0.0002, tan(halfAngle) * max(axial, 0.0));
  float coneCoord = lateral / halfWidth;

  float startSoft = 0.0007 + tipBlur * 0.022;
  float endSoft = 0.001 + tailBlur * 0.18;
  float axialMask = smoothstep(startDistance - startSoft, startDistance + startSoft, axial) *
    (1.0 - smoothstep(endDistance - endSoft, endDistance + endSoft, axial));

  float edgeSoftness = 0.0014 + mix(tipBlur * 0.08, tailBlur * 0.22, axialT);
  float edgeMask = 1.0 - smoothstep(1.0 - edgeSoftness, 1.0 + edgeSoftness * 1.15, abs(coneCoord));
  float coneMask = axialMask * edgeMask;

  float gradientRotation = fract(uConeProgress);
  float baseU = fract(coneCoord * 0.5 + 0.5 + gradientRotation);
  float blurAmount = mix(tipBlur, tailBlur, axialT);
  float blurMix = clamp(blurAmount / 2.5, 0.0, 1.0);
  float sampleJitter = (interleavedGradientNoise(floor(uv * uResolution) + vec2(uSeed * 0.11, uSeed * 0.23)) - 0.5) / float(4096.0);
  float sampleU = fract(baseU + sampleJitter);

  vec3 sharpGradient = toLinear(sampleGradient(sampleU));
  vec3 blurredGradient = toLinear(sampleBlurredGradient(sampleU));
  vec3 gradientColor = mix(sharpGradient, blurredGradient, blurMix * 0.5);
  vec3 tintLift = mix(vec3(1.0), sharpGradient, 0.18);
  gradientColor = mix(gradientColor, tintLift, 0.05);

  float coreLift = exp(-pow(coneCoord / mix(0.11 + tipBlur * 0.03, 0.24 + tailBlur * 0.06, axialT), 2.0)) * mix(0.11, 0.028, axialT);
  float innerGlow = exp(-pow(coneCoord / (0.18 + blurAmount * 0.04 + axialT * 0.06), 2.0)) * mix(0.012, 0.035, clamp(blurAmount / 2.5, 0.0, 1.0));
  float edgeAura = exp(-pow((abs(coneCoord) - 0.94) / (0.04 + blurAmount * 0.1 + axialT * 0.12), 2.0)) * (0.03 + axialT * 0.035 + blurAmount * 0.018);
  float outerVeil = exp(-pow((abs(coneCoord) - 1.02) / (0.08 + blurAmount * 0.14 + axialT * 0.08), 2.0)) * (0.02 + blurAmount * 0.014);
  float apexGlow = exp(-pow(axialT / max(0.025, 0.05 + tipBlur * 0.1), 2.0)) * 0.14;
  float depthFade = mix(1.0, 0.44, axialT);

  vec3 beamColor = gradientColor * depthFade;
  beamColor += gradientColor * coreLift;
  beamColor += gradientColor * innerGlow;
  beamColor += gradientColor * edgeAura;
  beamColor += gradientColor * outerVeil;
  beamColor += tintLift * apexGlow;

  float alpha = coneMask * uOpacity * mix(1.0, 0.26, axialT);
  beamColor = toSrgb(beamColor);
  float coneDither = (interleavedGradientNoise(floor(uv * uResolution) + vec2(19.0, 73.0) + uSeed) - 0.5) / 255.0;
  beamColor += vec3(coneDither) * mix(0.9, 0.25, alpha);
  return vec4(clamp(beamColor, 0.0, 1.0), alpha);
}

vec4 renderParticles(vec2 uv, vec2 origin, vec2 aspect) {
  vec4 total = vec4(0.0);
  float count = min(uParticleCount, float(${MAX_SHADER_PARTICLES}.0));
  float pixelScale = 1.0 / max(1.0, min(uResolution.x, uResolution.y));

  float rotation = radians(uRotation);
  vec2 axis = vec2(cos(rotation), sin(rotation));
  vec2 side = vec2(-axis.y, axis.x);
  float startDistance = max(0.0, uStartDistance);
  float endDistance = max(startDistance + 0.001, uEndDistance);
  float coneLength = max(0.0001, endDistance - startDistance);
  float halfAngle = radians(uFanAngle) * 0.5;
  float spreadScale = mix(0.62, 1.18, clamp(uParticleSpread, 0.0, 1.5) / 1.5);

  for (int i = 0; i < ${MAX_SHADER_PARTICLES}; i += 1) {
    float fi = float(i);
    if (fi >= count) {
      continue;
    }

    float id = fi + 1.0 + uSeed * 0.013;
    float size = mix(uParticleMinSize, uParticleMaxSize, hash11(id * 3.71));
    float speed = mix(uParticleMinSpeed, uParticleMaxSpeed, hash11(id * 7.13));
    float speedNorm = clamp(speed / 1.5, 0.0, 1.0);
    float cycles = max(1.0, floor(mix(1.0, 6.0, speedNorm) + 0.5));
    float twinklePhase = hash11(id * 11.23) * TAU;
    float twinkleSpeed = mix(0.8, 2.2, hash11(id * 13.73));
    float alphaSeed = mix(0.42, 1.0, hash11(id * 19.19));
    float swayPhase = hash11(id * 23.41) * TAU;
    float swayAmount = mix(0.015, 0.075, hash11(id * 29.97)) * (0.25 + uParticleDirectionRandomness * 0.9);
    float sideSign = hash11(id * 37.17) > 0.5 ? 1.0 : -1.0;
    float radialSelector = hash11(id * 41.43);
    float radialNoise = hash11(id * 47.77);
    float travel = uParticleDirection > 0.0
      ? fract(hash11(id * 17.37) - uParticleProgress * cycles)
      : fract(hash11(id * 17.37) + uParticleProgress * cycles);

    float axialT = travel;
    float axial = startDistance + axialT * coneLength;
    float halfWidth = max(0.0012, tan(halfAngle) * max(axial, 0.0));

    float edgeBias = smoothstep(0.46, 0.9, radialSelector);
    float interiorRadius = mix(0.08, 0.72, pow(radialNoise, 0.95));
    float edgeRadius = mix(0.86, 1.26, pow(radialNoise, 0.78));
    float radialAbs = mix(interiorRadius, edgeRadius, edgeBias) * spreadScale;

    float funnelFloor = mix(0.18, 0.78, edgeBias);
    float funnel = mix(funnelFloor, 1.0, smoothstep(0.03, 0.3, axialT));
    float lateral = sideSign * radialAbs * halfWidth * funnel;
    float sway = sin(uParticleProgress * TAU * cycles + swayPhase) * halfWidth * swayAmount * mix(0.3, 1.0, axialT);
    float axialJitter = cos(uParticleProgress * TAU * cycles + swayPhase * 0.7) * coneLength * 0.006 * uParticleDirectionRandomness;

    vec2 localParticle = axis * (axial + axialJitter) + side * (lateral + sway);
    vec2 particleUv = origin + localParticle / aspect;

    vec2 localDelta = (uv - particleUv) * aspect;
    float along = dot(localDelta, axis);
    float across = dot(localDelta, side);

    float coreRadius = max(0.00045, size * pixelScale * 1.18);
    float twinkle = 1.0 - uParticleTwinkle + uParticleTwinkle * (0.5 + 0.5 * sin(uParticleProgress * TAU * twinkleSpeed + twinklePhase));
    float fadeNear = smoothstep(0.0, 0.03, axialT);
    float fadeFar = 1.0 - smoothstep(0.9, 1.0, axialT);
    float circleMask = 1.0 - smoothstep(coreRadius * 0.92, coreRadius, length(vec2(along, across)));
    float alpha = uParticleOpacity * 0.68 * alphaSeed * twinkle * fadeNear * fadeFar * circleMask;

    total.rgb += uParticleColor * alpha;
    total.a += alpha;
  }

  total.a = clamp(total.a, 0.0, 1.0);
  if (total.a > 0.0) {
    total.rgb = clamp(total.rgb / total.a, 0.0, 1.0);
  } else {
    total.rgb = vec3(0.0);
  }
  return total;
}

float renderGrain(vec2 uv) {
  if (uGrainAmount <= 0.0) {
    return 0.0;
  }

  vec2 grid = floor(uv * uResolution * 0.75);
  float phase = sin(uParticleProgress * TAU + hash11(grid.x * 0.37 + grid.y * 1.91 + uSeed * 0.07) * TAU);
  float grain = hash11(dot(grid, vec2(12.9898, 78.233)) + uSeed * 0.123) - 0.5;
  return grain * (0.5 + 0.5 * phase) * uGrainAmount * 0.08;
}

void main() {
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 origin = uOrigin;

  vec4 color = renderBackground(vUv, origin, aspect);
  vec4 cone = renderCone(vUv, origin, aspect);
  vec4 particles = renderParticles(vUv, origin, aspect);
  color = alphaOver(color, cone);
  color = alphaOver(color, particles);
  float grainMask = clamp(max(cone.a, particles.a), 0.0, 1.0);
  color.rgb = clamp(color.rgb + renderGrain(vUv) * grainMask, 0.0, 1.0);

  gl_FragColor = vec4(color.rgb, clamp(color.a, 0.0, 1.0));
}
`;

type ShaderResources = {
  gl: WebGLRenderingContext;
  buffer: WebGLBuffer;
  program: WebGLProgram;
  gradientTexture: WebGLTexture;
  gradientBlurTexture: WebGLTexture;
  backgroundTexture: WebGLTexture;
  gradientCanvas: HTMLCanvasElement;
  gradientBlurCanvas: HTMLCanvasElement;
  gradientKey: string;
  backgroundImageKey: string;
  backgroundImageReady: boolean;
  backgroundImageSize: { width: number; height: number };
  attributes: {
    position: number;
  };
  uniforms: {
    resolution: WebGLUniformLocation | null;
    coneProgress: WebGLUniformLocation | null;
    particleProgress: WebGLUniformLocation | null;
    seed: WebGLUniformLocation | null;
    origin: WebGLUniformLocation | null;
    rotation: WebGLUniformLocation | null;
    fanAngle: WebGLUniformLocation | null;
    startDistance: WebGLUniformLocation | null;
    endDistance: WebGLUniformLocation | null;
    opacity: WebGLUniformLocation | null;
    startBlur: WebGLUniformLocation | null;
    endBlur: WebGLUniformLocation | null;
    globalBlur: WebGLUniformLocation | null;
    backgroundMode: WebGLUniformLocation | null;
    backgroundTop: WebGLUniformLocation | null;
    backgroundBottom: WebGLUniformLocation | null;
    backgroundWash: WebGLUniformLocation | null;
    backgroundTopAlpha: WebGLUniformLocation | null;
    backgroundBottomAlpha: WebGLUniformLocation | null;
    backgroundImageSize: WebGLUniformLocation | null;
    backgroundImageReady: WebGLUniformLocation | null;
    particleCount: WebGLUniformLocation | null;
    particleMinSize: WebGLUniformLocation | null;
    particleMaxSize: WebGLUniformLocation | null;
    particleMinSpeed: WebGLUniformLocation | null;
    particleMaxSpeed: WebGLUniformLocation | null;
    particleOpacity: WebGLUniformLocation | null;
    particleTwinkle: WebGLUniformLocation | null;
    particleSpread: WebGLUniformLocation | null;
    particleDirectionRandomness: WebGLUniformLocation | null;
    particleDirection: WebGLUniformLocation | null;
    particleColor: WebGLUniformLocation | null;
    grainAmount: WebGLUniformLocation | null;
    gradientTexture: WebGLUniformLocation | null;
    gradientBlurTexture: WebGLUniformLocation | null;
    backgroundImage: WebGLUniformLocation | null;
  };
};

type ShaderInitResult = {
  resources?: ShaderResources;
  error?: string;
};

const imageAssetCache = new Map<string, Promise<HTMLImageElement>>();
const loadedImageAssets = new Map<string, HTMLImageElement>();

function loadImageAsset(src: string): Promise<HTMLImageElement> {
  const cached = imageAssetCache.get(src);
  if (cached) {
    return cached;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      loadedImageAssets.set(src, image);
      resolve(image);
    };
    image.onerror = () => {
      imageAssetCache.delete(src);
      reject(new Error(`Failed to load background image: ${src}`));
    };
    image.src = src;
  });

  imageAssetCache.set(src, promise);
  return promise;
}

export async function preloadShaderAssets(config: SceneConfig): Promise<void> {
  if (config.background.type !== 'image' || !config.background.imageSrc) {
    return;
  }

  await loadImageAsset(config.background.imageSrc);
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): { shader?: WebGLShader; error?: string } {
  const shader = gl.createShader(type);
  if (!shader) {
    return { error: 'Unable to create shader object.' };
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error.';
    gl.deleteShader(shader);
    return { error };
  }

  return { shader };
}

function createProgram(gl: WebGLRenderingContext): { program?: WebGLProgram; error?: string } {
  const vertexResult = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentResult = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

  if (!vertexResult.shader || !fragmentResult.shader) {
    return { error: fragmentResult.error || vertexResult.error || 'Unable to compile shader program.' };
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexResult.shader);
    gl.deleteShader(fragmentResult.shader);
    return { error: 'Unable to create shader program.' };
  }

  gl.attachShader(program, vertexResult.shader);
  gl.attachShader(program, fragmentResult.shader);
  gl.linkProgram(program);
  gl.deleteShader(vertexResult.shader);
  gl.deleteShader(fragmentResult.shader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program) || 'Unknown shader link error.';
    gl.deleteProgram(program);
    return { error };
  }

  return { program };
}

function createSeamlessGradientCanvas(config: SceneConfig): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = GRADIENT_TEXTURE_WIDTH;
  canvas.height = GRADIENT_TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }

  const stops = normalizeBandOffsets(config.rays.bands.length > 0 ? config.rays.bands : [{ id: 'fallback', color: '#ffffff', offset: 0, weight: 1, softness: 1 }]);
  const imageData = ctx.createImageData(canvas.width, canvas.height);

  for (let x = 0; x < canvas.width; x += 1) {
    const t = x / canvas.width;
    let currentIndex = 0;

    for (let index = 0; index < stops.length; index += 1) {
      const start = stops[index].offset;
      const next = stops[(index + 1) % stops.length];
      const end = index === stops.length - 1 ? next.offset + 1 : next.offset;
      const wrappedT = index === stops.length - 1 && t < stops[0].offset ? t + 1 : t;
      if (wrappedT >= start && wrappedT <= end) {
        currentIndex = index;
        break;
      }
    }

    const current = stops[currentIndex];
    const next = stops[(currentIndex + 1) % stops.length] ?? current;
    const start = current.offset;
    const end = currentIndex === stops.length - 1 ? next.offset + 1 : next.offset;
    const wrappedT = currentIndex === stops.length - 1 && t < stops[0].offset ? t + 1 : t;
    const span = Math.max(0.0001, end - start);
    const localT = (wrappedT - start) / span;
    const currentColor = hexToRgb(current.color);
    const nextColor = hexToRgb(next.color);
    const r = Math.round(linearChannelToSrgb(lerp(srgbChannelToLinear(currentColor.r), srgbChannelToLinear(nextColor.r), localT)));
    const g = Math.round(linearChannelToSrgb(lerp(srgbChannelToLinear(currentColor.g), srgbChannelToLinear(nextColor.g), localT)));
    const b = Math.round(linearChannelToSrgb(lerp(srgbChannelToLinear(currentColor.b), srgbChannelToLinear(nextColor.b), localT)));

    for (let y = 0; y < canvas.height; y += 1) {
      const offset = (y * canvas.width + x) * 4;
      imageData.data[offset] = r;
      imageData.data[offset + 1] = g;
      imageData.data[offset + 2] = b;
      imageData.data[offset + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function createBlurredGradientCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return source;
  }

  const tiled = document.createElement('canvas');
  tiled.width = source.width * 3;
  tiled.height = source.height;
  const tiledCtx = tiled.getContext('2d');
  if (!tiledCtx) {
    return source;
  }

  tiledCtx.drawImage(source, 0, 0);
  tiledCtx.drawImage(source, source.width, 0);
  tiledCtx.drawImage(source, source.width * 2, 0);

  ctx.filter = 'blur(24px)';
  ctx.drawImage(tiled, -source.width, 0);
  ctx.filter = 'none';
  return canvas;
}
function createGradientKey(config: SceneConfig): string {
  return JSON.stringify(normalizeBandOffsets(config.rays.bands).map((stop) => ({
    color: stop.color,
    offset: stop.offset,
  })));
}

function setTextureDefaults(gl: WebGLRenderingContext): void {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function createShaderResources(canvas: HTMLCanvasElement): ShaderInitResult {
  const maybeGl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    depth: false,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    stencil: false,
  }) || canvas.getContext('experimental-webgl', {
    alpha: true,
    antialias: true,
    depth: false,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    stencil: false,
  });

  if (!maybeGl) {
    return { error: 'WebGL context is unavailable in this browser.' };
  }

  const gl = maybeGl as WebGLRenderingContext;
  const programResult = createProgram(gl);
  if (!programResult.program) {
    return { error: programResult.error };
  }

  const buffer = gl.createBuffer();
  const gradientTexture = gl.createTexture();
  const gradientBlurTexture = gl.createTexture();
  const backgroundTexture = gl.createTexture();
  if (!buffer || !gradientTexture || !gradientBlurTexture || !backgroundTexture) {
    gl.deleteProgram(programResult.program);
    return { error: 'Unable to create WebGL buffer or texture.' };
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]),
    gl.STATIC_DRAW,
  );

  gl.bindTexture(gl.TEXTURE_2D, gradientTexture);
  setTextureDefaults(gl);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);

  gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
  setTextureDefaults(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

  return {
    resources: {
      gl,
      buffer,
      program: programResult.program,
      gradientTexture,
      gradientBlurTexture,
      backgroundTexture,
      gradientCanvas: document.createElement('canvas'),
      gradientBlurCanvas: document.createElement('canvas'),
      gradientKey: '',
      backgroundImageKey: '',
      backgroundImageReady: false,
      backgroundImageSize: { width: 1, height: 1 },
      attributes: {
        position: gl.getAttribLocation(programResult.program, 'aPosition'),
      },
      uniforms: {
        resolution: gl.getUniformLocation(programResult.program, 'uResolution'),
        coneProgress: gl.getUniformLocation(programResult.program, 'uConeProgress'),
        particleProgress: gl.getUniformLocation(programResult.program, 'uParticleProgress'),
        seed: gl.getUniformLocation(programResult.program, 'uSeed'),
        origin: gl.getUniformLocation(programResult.program, 'uOrigin'),
        rotation: gl.getUniformLocation(programResult.program, 'uRotation'),
        fanAngle: gl.getUniformLocation(programResult.program, 'uFanAngle'),
        startDistance: gl.getUniformLocation(programResult.program, 'uStartDistance'),
        endDistance: gl.getUniformLocation(programResult.program, 'uEndDistance'),
        opacity: gl.getUniformLocation(programResult.program, 'uOpacity'),
        startBlur: gl.getUniformLocation(programResult.program, 'uStartBlur'),
        endBlur: gl.getUniformLocation(programResult.program, 'uEndBlur'),
        globalBlur: gl.getUniformLocation(programResult.program, 'uGlobalBlur'),
        backgroundMode: gl.getUniformLocation(programResult.program, 'uBackgroundMode'),
        backgroundTop: gl.getUniformLocation(programResult.program, 'uBackgroundTop'),
        backgroundBottom: gl.getUniformLocation(programResult.program, 'uBackgroundBottom'),
        backgroundWash: gl.getUniformLocation(programResult.program, 'uBackgroundWash'),
        backgroundTopAlpha: gl.getUniformLocation(programResult.program, 'uBackgroundTopAlpha'),
        backgroundBottomAlpha: gl.getUniformLocation(programResult.program, 'uBackgroundBottomAlpha'),
        backgroundImageSize: gl.getUniformLocation(programResult.program, 'uBackgroundImageSize'),
        backgroundImageReady: gl.getUniformLocation(programResult.program, 'uBackgroundImageReady'),
        particleCount: gl.getUniformLocation(programResult.program, 'uParticleCount'),
        particleMinSize: gl.getUniformLocation(programResult.program, 'uParticleMinSize'),
        particleMaxSize: gl.getUniformLocation(programResult.program, 'uParticleMaxSize'),
        particleMinSpeed: gl.getUniformLocation(programResult.program, 'uParticleMinSpeed'),
        particleMaxSpeed: gl.getUniformLocation(programResult.program, 'uParticleMaxSpeed'),
        particleOpacity: gl.getUniformLocation(programResult.program, 'uParticleOpacity'),
        particleTwinkle: gl.getUniformLocation(programResult.program, 'uParticleTwinkle'),
        particleSpread: gl.getUniformLocation(programResult.program, 'uParticleSpread'),
        particleDirectionRandomness: gl.getUniformLocation(programResult.program, 'uParticleDirectionRandomness'),
        particleDirection: gl.getUniformLocation(programResult.program, 'uParticleDirection'),
        particleColor: gl.getUniformLocation(programResult.program, 'uParticleColor'),
        grainAmount: gl.getUniformLocation(programResult.program, 'uGrainAmount'),
        gradientTexture: gl.getUniformLocation(programResult.program, 'uGradientTexture'),
        gradientBlurTexture: gl.getUniformLocation(programResult.program, 'uGradientBlurTexture'),
        backgroundImage: gl.getUniformLocation(programResult.program, 'uBackgroundImage'),
      },
    },
  };
}

function updateGradientTexture(resources: ShaderResources, config: SceneConfig): void {
  const key = createGradientKey(config);
  if (resources.gradientKey === key) {
    return;
  }

  resources.gradientCanvas = createSeamlessGradientCanvas(config);
  resources.gradientBlurCanvas = createBlurredGradientCanvas(resources.gradientCanvas);
  resources.gradientKey = key;

  const { gl, gradientTexture, gradientBlurTexture, gradientCanvas, gradientBlurCanvas } = resources;
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

  gl.bindTexture(gl.TEXTURE_2D, gradientTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gradientCanvas);

  gl.bindTexture(gl.TEXTURE_2D, gradientBlurTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gradientBlurCanvas);
}

function updateBackgroundTexture(resources: ShaderResources, config: SceneConfig): void {
  const nextKey = config.background.type === 'image' ? config.background.imageSrc : '';
  if (resources.backgroundImageKey === nextKey) {
    return;
  }

  resources.backgroundImageKey = nextKey;
  resources.backgroundImageReady = false;
  resources.backgroundImageSize = { width: 1, height: 1 };

  const { gl, backgroundTexture } = resources;
  gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

  if (!nextKey) {
    return;
  }

  const uploadImage = (image: HTMLImageElement) => {
    if (resources.backgroundImageKey !== nextKey) {
      return;
    }

    resources.backgroundImageReady = true;
    resources.backgroundImageSize = { width: image.naturalWidth || 1, height: image.naturalHeight || 1 };
    gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  };

  const markError = () => {
    if (resources.backgroundImageKey === nextKey) {
      resources.backgroundImageReady = false;
    }
  };

  const readyImage = loadedImageAssets.get(nextKey);
  if (readyImage) {
    uploadImage(readyImage);
    return;
  }

  void loadImageAsset(nextKey).then(uploadImage).catch(markError);
}

function setColorUniform(gl: WebGLRenderingContext, location: WebGLUniformLocation | null, hex: string): void {
  if (!location) {
    return;
  }

  const rgb = hexToRgb(hex);
  gl.uniform3f(location, rgb.r / 255, rgb.g / 255, rgb.b / 255);
}

function renderShaderScene(resources: ShaderResources, config: SceneConfig, progress: number, width: number, height: number): void {
  const { gl, buffer, program, gradientTexture, gradientBlurTexture, backgroundTexture, attributes, uniforms } = resources;
  updateGradientTexture(resources, config);
  updateBackgroundTexture(resources, config);

  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(attributes.position);
  gl.vertexAttribPointer(attributes.position, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gradientTexture);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, gradientBlurTexture);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);

  gl.uniform2f(uniforms.resolution, width, height);
  gl.uniform1f(uniforms.coneProgress, config.rays.pausedWhileParticlesMove ? 0 : progress);
  gl.uniform1f(uniforms.particleProgress, progress);
  gl.uniform1f(uniforms.seed, config.seed);
  gl.uniform2f(uniforms.origin, config.rays.originX, config.rays.originY);
  gl.uniform1f(uniforms.rotation, config.rays.rotation);
  gl.uniform1f(uniforms.fanAngle, config.rays.fanAngle);
  gl.uniform1f(uniforms.startDistance, config.rays.startDistance);
  gl.uniform1f(uniforms.endDistance, config.rays.endDistance);
  gl.uniform1f(uniforms.opacity, config.rays.enabled ? config.rays.opacity : 0);
  gl.uniform1f(uniforms.startBlur, Math.max(0, config.rays.startBlur));
  gl.uniform1f(uniforms.endBlur, Math.max(0, config.rays.blur));
  gl.uniform1f(uniforms.globalBlur, Math.max(0, config.postprocessing.globalBlur));
  gl.uniform1f(uniforms.backgroundMode, config.background.type === 'image' ? 1 : 0);
  setColorUniform(gl, uniforms.backgroundTop, config.background.topColor);
  setColorUniform(gl, uniforms.backgroundBottom, config.background.bottomColor);
  setColorUniform(gl, uniforms.backgroundWash, config.background.washColor);
  gl.uniform1f(uniforms.backgroundTopAlpha, colorAlpha(config.background.topColor));
  gl.uniform1f(uniforms.backgroundBottomAlpha, colorAlpha(config.background.bottomColor));
  gl.uniform2f(uniforms.backgroundImageSize, resources.backgroundImageSize.width, resources.backgroundImageSize.height);
  gl.uniform1f(uniforms.backgroundImageReady, resources.backgroundImageReady ? 1 : 0);
  gl.uniform1f(uniforms.particleCount, config.particles.enabled ? config.particles.count : 0);
  gl.uniform1f(uniforms.particleMinSize, config.particles.minSize);
  gl.uniform1f(uniforms.particleMaxSize, config.particles.maxSize);
  gl.uniform1f(uniforms.particleMinSpeed, config.particles.minSpeed);
  gl.uniform1f(uniforms.particleMaxSpeed, config.particles.maxSpeed);
  gl.uniform1f(uniforms.particleOpacity, config.particles.opacity);
  gl.uniform1f(uniforms.particleTwinkle, config.particles.twinkle);
  gl.uniform1f(uniforms.particleSpread, config.particles.spread);
  gl.uniform1f(uniforms.particleDirectionRandomness, config.particles.directionRandomness);
  gl.uniform1f(uniforms.particleDirection, config.particles.direction === 'from-apex' ? -1 : 1);
  setColorUniform(gl, uniforms.particleColor, config.particles.color);
  gl.uniform1f(uniforms.grainAmount, config.postprocessing.grain);
  gl.uniform1i(uniforms.gradientTexture, 0);
  gl.uniform1i(uniforms.gradientBlurTexture, 1);
  gl.uniform1i(uniforms.backgroundImage, 2);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export function createShaderSceneRenderer(): SceneRenderer {
  const glCanvas = document.createElement('canvas');
  const shaderInit = createShaderResources(glCanvas);

  if (!shaderInit.resources) {
    throw new Error(shaderInit.error || 'Unknown WebGL initialization error.');
  }

  const shaderResources = shaderInit.resources;

  return {
    mode: 'shader',
    requestedMode: 'shader',
    isFallback: false,
    render({ ctx, config, progress, width, height }: RenderParams): void {
      if (width <= 0 || height <= 0) {
        return;
      }

      ensureCanvasSize(glCanvas, width, height);
      if (glCanvas.width <= 0 || glCanvas.height <= 0) {
        return;
      }

      renderShaderScene(shaderResources, config, progress, width, height);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(glCanvas, 0, 0, width, height);
    },
  };
}


























