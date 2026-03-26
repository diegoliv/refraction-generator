export type ExportProgress = {
  frame: number;
  totalFrames: number;
  progress: number;
  status: string;
};

export type ExportOptions = {
  config: import('../types/config').SceneConfig;
  presetName: string;
  onProgress?: (progress: ExportProgress) => void;
};
