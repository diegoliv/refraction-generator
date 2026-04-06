import { resolveAnimatedScene } from '../animation/resolveAnimatedScene';
import type { AnimationConfig } from '../animation/types';
import type { SceneConfig } from '../types/config';
import { createSceneRenderer, preloadSceneAssets } from '../rendering/refractionRenderer';
import { getExactFrameCount, getFrameProgress } from '../utils/loop';
import type { ExportOptions, ExportProgress } from './types';

type WritableFileStream = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
};

type FileHandle = {
  createWritable: () => Promise<WritableFileStream>;
};

type DirectoryHandle = {
  getFileHandle: (name: string, options: { create: boolean }) => Promise<FileHandle>;
};

type FileWindow = Window & {
  showDirectoryPicker?: () => Promise<DirectoryHandle>;
};

function formatFrameName(prefix: string, frameIndex: number): string {
  return `${prefix}_${String(frameIndex).padStart(4, '0')}.png`;
}

export function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'refraction-sequence';
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode PNG frame.'));
        return;
      }

      resolve(blob);
    }, 'image/png');
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function createExportCanvas(config: SceneConfig): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; frameCount: number } {
  const width = config.export.width;
  const height = config.export.height;
  const frameCount = getExactFrameCount(config.export.duration, config.export.fps);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Drawing context is unavailable for export.');
  }

  return { canvas, ctx, frameCount };
}

export async function createFrameRenderer(config: SceneConfig, animation: AnimationConfig | undefined, ctx: CanvasRenderingContext2D, width: number, height: number, frameCount: number) {
  await preloadSceneAssets(config);
  const renderer = createSceneRenderer();

  return (frameIndex: number) => {
    const progress = getFrameProgress(frameIndex, frameCount);
    const resolvedConfig = animation ? resolveAnimatedScene(config, animation, progress) : config;

    renderer.render({
      ctx,
      config: resolvedConfig,
      progress,
      width,
      height,
    });
  };
}

export async function renderSingleFrame(config: SceneConfig, animation: AnimationConfig | undefined, progress: number) {
  const { canvas, ctx, frameCount } = createExportCanvas(config);
  await preloadSceneAssets(config);
  const renderer = createSceneRenderer();
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const resolvedConfig = animation ? resolveAnimatedScene(config, animation, safeProgress) : config;

  renderer.render({
    ctx,
    config: resolvedConfig,
    progress: safeProgress,
    width: config.export.width,
    height: config.export.height,
  });

  return { canvas, ctx, frameCount };
}

async function saveFramesToDirectory(
  canvas: HTMLCanvasElement,
  frameCount: number,
  prefix: string,
  renderFrame: (frameIndex: number) => void,
  onProgress?: (progress: ExportProgress) => void,
): Promise<void> {
  const picker = (window as FileWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error('Directory export is not supported in this browser.');
  }

  const directoryHandle = await picker();

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    renderFrame(frameIndex);
    const blob = await canvasToBlob(canvas);
    const fileHandle = await directoryHandle.getFileHandle(formatFrameName(prefix, frameIndex), { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    onProgress?.({
      frame: frameIndex + 1,
      totalFrames: frameCount,
      progress: (frameIndex + 1) / frameCount,
      status: `Saved ${frameIndex + 1} / ${frameCount}`,
    });
  }
}

async function downloadFramesSequentially(
  canvas: HTMLCanvasElement,
  frameCount: number,
  prefix: string,
  renderFrame: (frameIndex: number) => void,
  onProgress?: (progress: ExportProgress) => void,
): Promise<void> {
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    renderFrame(frameIndex);
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, formatFrameName(prefix, frameIndex));

    onProgress?.({
      frame: frameIndex + 1,
      totalFrames: frameCount,
      progress: (frameIndex + 1) / frameCount,
      status: `Downloaded ${frameIndex + 1} / ${frameCount}`,
    });

    await new Promise((resolve) => window.setTimeout(resolve, 20));
  }
}

export async function exportSinglePng({ config, animation, presetName, onProgress }: ExportOptions, progress = 0): Promise<void> {
  onProgress?.({
    frame: 0,
    totalFrames: 1,
    progress: 0,
    status: 'Rendering PNG frame...',
  });

  const { canvas } = await renderSingleFrame(config, animation, progress);
  const blob = await canvasToBlob(canvas);
  const fileName = `${sanitizeName(presetName)}_shader_${config.export.width}x${config.export.height}.png`;
  downloadBlob(blob, fileName);

  onProgress?.({
    frame: 1,
    totalFrames: 1,
    progress: 1,
    status: 'PNG export complete.',
  });
}

export async function exportPngSequence({ config, animation, presetName, onProgress }: ExportOptions): Promise<void> {
  const { canvas, ctx, frameCount } = createExportCanvas(config);
  const prefix = `${sanitizeName(presetName)}_shader_${config.export.width}x${config.export.height}_${config.export.fps}fps`;

  onProgress?.({
    frame: 0,
    totalFrames: frameCount,
    progress: 0,
    status: 'Preparing shader export...',
  });

  const renderFrame = await createFrameRenderer(config, animation, ctx, config.export.width, config.export.height, frameCount);

  const picker = (window as FileWindow).showDirectoryPicker;
  if (picker) {
    await saveFramesToDirectory(canvas, frameCount, prefix, renderFrame, onProgress);
    return;
  }

  await downloadFramesSequentially(canvas, frameCount, prefix, renderFrame, onProgress);
}

export type { ExportProgress };
