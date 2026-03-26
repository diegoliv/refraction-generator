import { clamp } from './math';

type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

function parseHexColor(input: string): Rgba | null {
  const normalized = input.trim().replace('#', '');
  if (![3, 4, 6, 8].includes(normalized.length)) {
    return null;
  }

  const compact = normalized.length <= 4
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  const value = Number.parseInt(compact.slice(0, 6), 16);
  if (Number.isNaN(value)) {
    return null;
  }

  const alphaHex = compact.length >= 8 ? compact.slice(6, 8) : 'ff';
  const alphaValue = Number.parseInt(alphaHex, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
    a: Number.isNaN(alphaValue) ? 1 : clamp(alphaValue / 255, 0, 1),
  };
}

function parseRgbFunction(input: string): Rgba | null {
  const match = input.trim().match(/rgba?\(([^)]+)\)/i);
  if (!match) {
    return null;
  }

  const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((value) => !Number.isFinite(value))) {
    return null;
  }

  return {
    r: clamp(parts[0], 0, 255),
    g: clamp(parts[1], 0, 255),
    b: clamp(parts[2], 0, 255),
    a: clamp(parts[3] ?? 1, 0, 1),
  };
}

export function parseColor(color: string): Rgba {
  return parseHexColor(color) ?? parseRgbFunction(color) ?? { r: 255, g: 255, b: 255, a: 1 };
}

export function hexToRgb(color: string) {
  const rgba = parseColor(color);
  return { r: rgba.r, g: rgba.g, b: rgba.b };
}

export function colorAlpha(color: string): number {
  return parseColor(color).a;
}

export function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const toHex = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function rgbToString(rgb: { r: number; g: number; b: number }, alpha = 1): string {
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${clamp(alpha, 0, 1)})`;
}

export function withAlpha(color: string, alpha: number): string {
  return rgbToString(hexToRgb(color), alpha);
}

export function mix(colorA: string, colorB: string, t: number): string {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  const amount = clamp(t, 0, 1);

  return `rgba(${Math.round(a.r + (b.r - a.r) * amount)}, ${Math.round(a.g + (b.g - a.g) * amount)}, ${Math.round(a.b + (b.b - a.b) * amount)}, ${clamp(a.a + (b.a - a.a) * amount, 0, 1)})`;
}
