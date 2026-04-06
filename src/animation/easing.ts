import type { AnimationEasing } from './types';

export function applyEasing(easing: AnimationEasing, progress: number): number {
  const t = Math.max(0, Math.min(1, progress));

  switch (easing) {
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return 1 - (1 - t) * (1 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'hold':
      return 0;
    case 'linear':
    default:
      return t;
  }
}
