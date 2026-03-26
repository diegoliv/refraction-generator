export function getLoopProgress(elapsedMs: number, durationSeconds: number): number {
  const safeDurationMs = Math.max(1, durationSeconds * 1000);
  const wrapped = ((elapsedMs % safeDurationMs) + safeDurationMs) % safeDurationMs;
  return wrapped / safeDurationMs;
}

export function getFrameProgress(frameIndex: number, frameCount: number): number {
  const safeFrameCount = Math.max(1, frameCount);
  return frameIndex / safeFrameCount;
}

export function getExactFrameCount(durationSeconds: number, fps: number): number {
  return Math.max(1, Math.round(durationSeconds * fps));
}
