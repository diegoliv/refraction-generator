export type Random = {
  next: () => number;
  range: (min: number, max: number) => number;
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRandom(seed: number): Random {
  const next = mulberry32(seed);

  return {
    next,
    range: (min, max) => min + (max - min) * next(),
  };
}
