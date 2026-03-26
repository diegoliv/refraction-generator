import type { RayBand } from '../types/config';
import { clamp } from './math';
import { rgbToHex, hexToRgb } from './color';
import { createRuntimeId } from './scene';

function sortBandsByOffset(bands: RayBand[]): RayBand[] {
  return [...bands].sort((a, b) => a.offset - b.offset);
}

export function normalizeBandOffsets(bands: RayBand[]): RayBand[] {
  if (bands.length === 0) {
    return [];
  }

  const hasOffsets = bands.every((band) => Number.isFinite(band.offset));
  if (hasOffsets) {
    return sortBandsByOffset(bands).map((band) => ({
      ...band,
      offset: clamp(band.offset, 0, 1),
    }));
  }

  const totalWeight = bands.reduce((sum, band) => sum + Math.max(0.001, band.weight), 0);
  let cursor = 0;

  return bands.map((band, index) => {
    const offset = index === bands.length - 1 ? 1 : clamp(cursor, 0, 1);
    cursor += Math.max(0.001, band.weight) / totalWeight;
    return {
      ...band,
      offset,
    };
  });
}

export function bandsToGradientString(bands: RayBand[]): string {
  const normalized = normalizeBandOffsets(bands);
  const gradientStops = normalized.map((band) => `${band.color} ${(band.offset * 100).toFixed(2)}%`);
  return `linear-gradient(90deg, ${gradientStops.join(', ')})`;
}

type GradientColorPoint = {
  value: string;
  left: number;
};

type GradientObject = {
  colors?: GradientColorPoint[];
};

export function gradientObjectToBands(gradient: GradientObject | undefined, existingBands: RayBand[]): RayBand[] {
  const points = (gradient?.colors ?? [])
    .filter((point) => typeof point?.value === 'string' && Number.isFinite(point.left))
    .sort((a, b) => a.left - b.left);

  if (points.length === 0) {
    return normalizeBandOffsets(existingBands);
  }

  return points.map((point, index) => {
    const fallback = existingBands[index] ?? existingBands[existingBands.length - 1];
    return {
      id: existingBands[index]?.id ?? createRuntimeId('band'),
      color: rgbToHex(hexToRgb(point.value)),
      offset: clamp(point.left / 100, 0, 1),
      weight: Math.max(0.001, (index === 0 ? point.left : point.left - points[index - 1].left) / 100) || fallback?.weight || 1,
      softness: fallback?.softness ?? 1,
    };
  });
}
