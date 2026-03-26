import { useEffect, useRef } from 'react';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { createSceneRenderer } from '../rendering/refractionRenderer';
import type { SceneConfig } from '../types/config';
import { getLoopProgress } from '../utils/loop';

type PreviewCanvasProps = {
  config: SceneConfig;
  isPlaying: boolean;
  onProgressChange?: (progress: number) => void;
};

function getPreviewSize(container: HTMLElement, config: SceneConfig): { width: number; height: number } {
  const rect = container.getBoundingClientRect();
  const maxHeight = Math.max(320, window.innerHeight - 52);
  const aspectRatio = config.export.width / config.export.height;
  const width = Math.max(1, Math.min(rect.width, maxHeight * aspectRatio));
  const height = Math.max(1, width / aspectRatio);

  return { width, height };
}

export function PreviewCanvas({ config, isPlaying, onProgressChange }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef(createSceneRenderer());
  const loopStartRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return undefined;
    }

    const resize = () => {
      const { width, height } = getPreviewSize(container, config);
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => observer.disconnect();
  }, [config.export.height, config.export.width]);

  useEffect(() => {
    loopStartRef.current = null;
    pausedElapsedRef.current = 0;
  }, [config.seed, config.export.duration]);

  useEffect(() => {
    if (isPlaying) {
      loopStartRef.current = null;
    }
  }, [isPlaying]);

  useAnimationFrame((timeMs) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    if (loopStartRef.current === null) {
      loopStartRef.current = timeMs - pausedElapsedRef.current;
    }

    const elapsedMs = isPlaying ? timeMs - loopStartRef.current : pausedElapsedRef.current;
    if (!isPlaying) {
      pausedElapsedRef.current = elapsedMs;
    }

    const progress = getLoopProgress(elapsedMs, config.export.duration);
    onProgressChange?.(progress);

    rendererRef.current.render({
      ctx: context,
      config,
      progress,
      width: canvas.width,
      height: canvas.height,
    });
  }, true);

  return (
    <div ref={containerRef} className="preview-stage flex min-h-[calc(100vh-38px)] flex-1 items-center justify-center">
      <canvas ref={canvasRef} className="max-w-full" />
    </div>
  );
}

