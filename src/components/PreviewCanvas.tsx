import { useEffect, useRef } from 'react';
import type { AnimationConfig } from '../animation/types';
import { resolveAnimatedScene } from '../animation/resolveAnimatedScene';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { createSceneRenderer } from '../rendering/refractionRenderer';
import type { SceneConfig } from '../types/config';
import { getLoopProgress } from '../utils/loop';

type PreviewCanvasProps = {
  config: SceneConfig;
  animation: AnimationConfig;
  isPlaying: boolean;
  playhead: number;
  onProgressChange?: (progress: number) => void;
};

function getPreviewSize(container: HTMLElement, config: SceneConfig): { width: number; height: number } {
  const rect = container.getBoundingClientRect();
  const maxHeight = Math.max(320, window.innerHeight - 180);
  const aspectRatio = config.export.width / config.export.height;
  const width = Math.max(1, Math.min(rect.width, maxHeight * aspectRatio));
  const height = Math.max(1, width / aspectRatio);

  return { width, height };
}

export function PreviewCanvas({ config, animation, isPlaying, playhead, onProgressChange }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef(createSceneRenderer());
  const loopStartRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef(0);
  const lastRenderedProgressRef = useRef(playhead);

  const renderFrame = (progress: number) => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context || canvas.width <= 0 || canvas.height <= 0) {
      return;
    }

    const resolvedConfig = resolveAnimatedScene(config, animation, progress);
    lastRenderedProgressRef.current = progress;
    onProgressChange?.(progress);

    rendererRef.current.render({
      ctx: context,
      config: resolvedConfig,
      progress,
      width: canvas.width,
      height: canvas.height,
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return undefined;
    }

    contextRef.current = canvas.getContext('2d');

    const resize = () => {
      const { width, height } = getPreviewSize(container, config);
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      renderFrame(lastRenderedProgressRef.current);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => observer.disconnect();
  }, [config.export.height, config.export.width]);

  useEffect(() => {
    loopStartRef.current = null;
    pausedElapsedRef.current = playhead * config.export.duration * 1000;
  }, [config.seed, config.export.duration, playhead]);

  useEffect(() => {
    if (!isPlaying) {
      renderFrame(playhead);
      return;
    }

    loopStartRef.current = null;
  }, [animation, config, isPlaying, playhead]);

  useAnimationFrame((timeMs) => {
    if (loopStartRef.current === null) {
      loopStartRef.current = timeMs - pausedElapsedRef.current;
    }

    const elapsedMs = timeMs - loopStartRef.current;
    pausedElapsedRef.current = elapsedMs;
    renderFrame(getLoopProgress(elapsedMs, config.export.duration));
  }, isPlaying);

  return (
    <div ref={containerRef} className="preview-stage flex h-full min-h-[360px] flex-1 items-center justify-center p-6">
      <canvas ref={canvasRef} className="max-w-full" />
    </div>
  );
}
