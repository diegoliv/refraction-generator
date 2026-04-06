import type { RayBand, RayBezierProfile } from '../types/config';
import { lerp } from '../utils/math';
import { parseColor, rgbToHex } from '../utils/color';

export function interpolateNumber(start: number, end: number, progress: number): number {
  return lerp(start, end, progress);
}

export function interpolateColor(start: string, end: string, progress: number): string {
  const startRgb = parseColor(start);
  const endRgb = parseColor(end);

  return rgbToHex({
    r: Math.round(lerp(startRgb.r, endRgb.r, progress)),
    g: Math.round(lerp(startRgb.g, endRgb.g, progress)),
    b: Math.round(lerp(startRgb.b, endRgb.b, progress)),
  });
}

export function interpolateProfile(start: RayBezierProfile, end: RayBezierProfile, progress: number): RayBezierProfile {
  return {
    start: lerp(start.start, end.start, progress),
    mid: lerp(start.mid, end.mid, progress),
    end: lerp(start.end, end.end, progress),
    cp1x: lerp(start.cp1x, end.cp1x, progress),
    cp1y: lerp(start.cp1y, end.cp1y, progress),
    cp2x: lerp(start.cp2x, end.cp2x, progress),
    cp2y: lerp(start.cp2y, end.cp2y, progress),
  };
}

function canInterpolateBands(start: RayBand[], end: RayBand[]): boolean {
  return start.length === end.length && start.every((band, index) => band.id === end[index]?.id);
}

export function interpolateBands(start: RayBand[], end: RayBand[], progress: number): RayBand[] {
  if (!canInterpolateBands(start, end)) {
    return progress < 0.5 ? start : end;
  }

  return start.map((band, index) => ({
    id: band.id,
    color: interpolateColor(band.color, end[index].color, progress),
    offset: lerp(band.offset, end[index].offset, progress),
    weight: lerp(band.weight, end[index].weight, progress),
    softness: lerp(band.softness, end[index].softness, progress),
  }));
}

