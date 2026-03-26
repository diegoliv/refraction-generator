export type RayBand = {
  id: string;
  color: string;
  offset: number;
  weight: number;
  softness: number;
};

export type SceneConfig = {
  seed: number;
  background: {
    type: 'gradient' | 'image';
    topColor: string;
    bottomColor: string;
    washColor: string;
    imageSrc: string;
  };
  rays: {
    enabled: boolean;
    originX: number;
    originY: number;
    rotation: number;
    fanAngle: number;
    startDistance: number;
    endDistance: number;
    opacity: number;
    startBlur: number;
    blur: number;
    driftAmount: number;
    driftSpeed: number;
    rotationSpeed: number;
    pausedWhileParticlesMove: boolean;
    bands: RayBand[];
  };
  particles: {
    enabled: boolean;
    count: number;
    minSize: number;
    maxSize: number;
    minSpeed: number;
    maxSpeed: number;
    opacity: number;
    twinkle: number;
    spread: number;
    directionRandomness: number;
    direction: 'into-apex' | 'from-apex';
    color: string;
  };
  postprocessing: {
    softness: number;
    globalBlur: number;
    bloom: number;
    grain: number;
    vignette: number;
    brightness: number;
  };
  export: {
    width: number;
    height: number;
    duration: number;
    fps: number;
  };
};

export type PresetDefinition = {
  id: string;
  name: string;
  kind: 'builtin' | 'custom' | 'imported';
  config: SceneConfig;
};
