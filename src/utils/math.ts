type Vec2 = {
  x: number;
  y: number;
};

export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) {
    return 0;
  }

  return (value - a) / (b - a);
}

export function smoothstep(min: number, max: number, value: number): number {
  const t = clamp(inverseLerp(min, max, value), 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export function fract(value: number): number {
  return value - Math.floor(value);
}

export function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

export function polarToCartesian(angle: number, radius: number): Vec2 {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

export function rotate(point: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}
