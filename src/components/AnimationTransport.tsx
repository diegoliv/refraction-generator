import { Pause, Play, SkipBack, SkipForward, Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnimatablePath, AnimationTrack } from '../animation/types';
import { useAnimationFrame } from '../hooks/useAnimationFrame';
import { cn } from '../lib/utils';
import { getLoopProgress } from '../utils/loop';
import { Button } from './ui/button';
import { Input } from './ui/input';

type KeyframeUpdate = {
  trackId: string;
  keyframeId: string;
  time: number;
};

type KeyframePosition = {
  trackId: string;
  keyframeId: string;
  time: number;
  laneIndex: number;
};

type MarqueeBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type AnimationTransportProps = {
  autoKeying: boolean;
  isPlaying: boolean;
  playhead: number;
  duration: number;
  tracks: AnimationTrack[];
  selectedFieldPaths: AnimatablePath[];
  selectedKeyframeIds: string[];
  onTogglePlaying: () => void;
  onStop: () => void;
  onJumpToStart: () => void;
  onJumpToEnd: () => void;
  onPlayheadChange: (progress: number) => void;
  onAutoKeyingChange: (enabled: boolean) => void;
  onAddKeyframes: () => void;
  onMoveKeyframes: (updates: KeyframeUpdate[]) => void;
  onSelectedKeyframeIdsChange: (ids: string[]) => void;
};

const LANE_HEIGHT = 48;
const KEYFRAME_SELECT_TOLERANCE = 0.0005;
const SNAP_STEP = 0.05;
const SNAP_THRESHOLD = 0.008;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snapProgress(value: number): number {
  const snapped = clamp(Math.round(value / SNAP_STEP) * SNAP_STEP, 0, 1);
  return Math.abs(snapped - value) <= SNAP_THRESHOLD ? snapped : clamp(value, 0, 1);
}

function formatPathLabel(path: AnimatablePath): string {
  return path
    .replace('background.', 'Background / ')
    .replace('rays.', 'Tunnel / ')
    .replace('particles.', 'Particles / ')
    .replace('.shape.', ' / ')
    .replace(/\./g, ' / ');
}

function formatTime(progress: number): string {
  return progress.toFixed(3);
}

function getProgressFromPointer(event: PointerEvent | React.PointerEvent, rect: DOMRect, snap = false): number {
  const raw = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  return snap ? snapProgress(raw) : raw;
}

function normalizeMarquee(startX: number, startY: number, currentX: number, currentY: number): MarqueeBox {
  return {
    left: Math.min(startX, currentX),
    top: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
}

export function AnimationTransport({
  autoKeying,
  isPlaying,
  playhead,
  duration,
  tracks,
  selectedFieldPaths,
  selectedKeyframeIds,
  onTogglePlaying,
  onStop,
  onJumpToStart,
  onJumpToEnd,
  onPlayheadChange,
  onAutoKeyingChange,
  onAddKeyframes,
  onMoveKeyframes,
  onSelectedKeyframeIdsChange,
}: AnimationTransportProps) {
  const tracksBodyRef = useRef<HTMLDivElement | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const loopStartRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef(playhead * duration * 1000);
  const [displayPlayhead, setDisplayPlayhead] = useState(playhead);
  const [playheadInput, setPlayheadInput] = useState(formatTime(playhead));
  const [marqueeBox, setMarqueeBox] = useState<MarqueeBox | null>(null);

  const visibleTracks = useMemo(
    () => tracks.filter((track) => selectedFieldPaths.includes(track.path)),
    [selectedFieldPaths, tracks],
  );

  const keyframePositions = useMemo<KeyframePosition[]>(() => (
    visibleTracks.flatMap((track, laneIndex) => track.keyframes.map((keyframe) => ({
      trackId: track.id,
      keyframeId: keyframe.id,
      time: keyframe.time,
      laneIndex,
    })))
  ), [visibleTracks]);

  const keyframeLookup = useMemo(() => new Map(keyframePositions.map((entry) => [entry.keyframeId, entry])), [keyframePositions]);

  useEffect(() => {
    if (!isPlaying) {
      pausedElapsedRef.current = playhead * duration * 1000;
      loopStartRef.current = null;
      setDisplayPlayhead(playhead);
    }
  }, [duration, isPlaying, playhead]);

  useEffect(() => {
    setPlayheadInput(formatTime(displayPlayhead));
  }, [displayPlayhead]);

  useEffect(() => {
    if (isPlaying) {
      loopStartRef.current = null;
    }
  }, [isPlaying]);

  useAnimationFrame((timeMs) => {
    if (loopStartRef.current === null) {
      loopStartRef.current = timeMs - pausedElapsedRef.current;
    }

    const elapsedMs = timeMs - loopStartRef.current;
    pausedElapsedRef.current = elapsedMs;
    setDisplayPlayhead(getLoopProgress(elapsedMs, duration));
  }, isPlaying);

  const beginScrub = (event: React.PointerEvent<HTMLElement>, rect: DOMRect, snap = true) => {
    onSelectedKeyframeIdsChange([]);
    const nextProgress = getProgressFromPointer(event, rect, snap);
    setDisplayPlayhead(nextProgress);
    onPlayheadChange(nextProgress);

    const handleMove = (moveEvent: PointerEvent) => {
      const movedProgress = getProgressFromPointer(moveEvent, rect, snap);
      setDisplayPlayhead(movedProgress);
      onPlayheadChange(movedProgress);
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleRulerScrubStart = (event: React.PointerEvent<HTMLElement>) => {
    const ruler = rulerRef.current;
    if (!ruler) {
      return;
    }

    beginScrub(event, ruler.getBoundingClientRect(), true);
  };

  const handlePlayheadDragStart = (event: React.PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    const ruler = rulerRef.current;
    if (!ruler) {
      return;
    }

    beginScrub(event, ruler.getBoundingClientRect(), false);
  };

  const handleLanePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const body = tracksBodyRef.current;
    if (!body) {
      return;
    }

    const rect = body.getBoundingClientRect();

    if (!event.shiftKey) {
      beginScrub(event, rect, false);
      return;
    }

    const startX = clamp(event.clientX - rect.left, 0, rect.width);
    const startY = clamp(event.clientY - rect.top, 0, rect.height);
    let hasMoved = false;

    const handleMove = (moveEvent: PointerEvent) => {
      const currentX = clamp(moveEvent.clientX - rect.left, 0, rect.width);
      const currentY = clamp(moveEvent.clientY - rect.top, 0, rect.height);
      const nextBox = normalizeMarquee(startX, startY, currentX, currentY);

      if (!hasMoved && nextBox.width < 4 && nextBox.height < 4) {
        return;
      }

      hasMoved = true;
      setMarqueeBox(nextBox);

      const hits = keyframePositions.filter((position) => {
        const x = position.time * rect.width;
        const y = position.laneIndex * LANE_HEIGHT + LANE_HEIGHT / 2;
        return x >= nextBox.left && x <= nextBox.left + nextBox.width && y >= nextBox.top && y <= nextBox.top + nextBox.height;
      }).map((position) => position.keyframeId);

      onSelectedKeyframeIdsChange(hits);
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setMarqueeBox(null);
      if (!hasMoved) {
        onSelectedKeyframeIdsChange([]);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleKeyframePointerDown = (event: React.PointerEvent<HTMLButtonElement>, trackId: string, keyframeId: string, time: number) => {
    event.stopPropagation();

    if (event.ctrlKey || event.metaKey) {
      const next = new Set(selectedKeyframeIds);
      if (next.has(keyframeId)) {
        next.delete(keyframeId);
      } else {
        next.add(keyframeId);
      }
      onSelectedKeyframeIdsChange(Array.from(next));
      return;
    }

    const activeIds = selectedKeyframeIds.includes(keyframeId) ? selectedKeyframeIds : [keyframeId];
    onSelectedKeyframeIdsChange(activeIds);

    const body = tracksBodyRef.current;
    if (!body) {
      return;
    }

    const rect = body.getBoundingClientRect();
    const movingEntries = activeIds
      .map((id) => keyframeLookup.get(id))
      .filter((entry): entry is KeyframePosition => Boolean(entry));

    const minDelta = Math.max(...movingEntries.map((entry) => -entry.time), -1);
    const maxDelta = Math.min(...movingEntries.map((entry) => 1 - entry.time), 1);

    const handleMove = (moveEvent: PointerEvent) => {
      const nextTime = getProgressFromPointer(moveEvent, rect, true);
      const delta = clamp(nextTime - time, minDelta, maxDelta);
      onMoveKeyframes(movingEntries.map((entry) => ({
        trackId: entry.trackId,
        keyframeId: entry.keyframeId,
        time: snapProgress(clamp(entry.time + delta, 0, 1)),
      })));
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const commitPlayheadInput = () => {
    const parsed = Number(playheadInput);
    const next = Number.isFinite(parsed) ? clamp(parsed, 0, 1) : displayPlayhead;
    setDisplayPlayhead(next);
    setPlayheadInput(formatTime(next));
    onPlayheadChange(next);
    onSelectedKeyframeIdsChange([]);
  };

  const rulerMarks = Array.from({ length: 21 }, (_, index) => index / 20);
  const labeledMarks = Array.from({ length: 11 }, (_, index) => index / 10);

  return (
    <section data-timeline-root="true" className="border-t border-border/60 bg-[#252525] px-4 py-3 text-foreground">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-md border border-white/8 bg-transparent p-0 text-muted-foreground hover:bg-white/6" onClick={onStop}><Square size={14} /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-md border border-white/8 bg-transparent p-0 text-muted-foreground hover:bg-white/6" onClick={onJumpToStart}><SkipBack size={14} /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-md border border-white/8 bg-transparent p-0 text-muted-foreground hover:bg-white/6" onClick={onTogglePlaying}>{isPlaying ? <Pause size={14} /> : <Play size={14} />}</Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-md border border-white/8 bg-transparent p-0 text-muted-foreground hover:bg-white/6" onClick={onJumpToEnd}><SkipForward size={14} /></Button>
        <label className="ml-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={autoKeying} onChange={(event) => onAutoKeyingChange(event.target.checked)} />
          Auto keying
        </label>
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>Current</span>
          <Input
            className="h-8 w-24 border-white/10 bg-white/4 text-right text-[12px]"
            type="number"
            min={0}
            max={1}
            step={0.001}
            value={playheadInput}
            onChange={(event) => setPlayheadInput(event.target.value)}
            onBlur={commitPlayheadInput}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitPlayheadInput();
              }
            }}
          />
          <Button size="sm" className="h-8 rounded-md px-2 text-[11px]" disabled={selectedFieldPaths.length === 0} onClick={onAddKeyframes}>
            Keyframe
          </Button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
        <span>Timeline</span>
        <span>{visibleTracks.length > 0 ? `${visibleTracks.length} field${visibleTracks.length === 1 ? '' : 's'} selected` : 'Shift-click fields in the inspector to visualize them here'}</span>
      </div>

      <div className="grid grid-cols-[260px_minmax(0,1fr)] items-stretch border-b border-white/6 pb-2">
        <div className="px-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/65">Selected Fields</div>
        <div className="px-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/65">Time</div>
      </div>

      <div className="grid grid-cols-[260px_minmax(0,1fr)]">
        <div className="border-r border-white/6">
          <div className="h-8 border-b border-white/6" />
          {visibleTracks.length === 0 ? (
            <div className="px-2 py-6 text-[11px] text-muted-foreground">No selected fields have animation tracks yet.</div>
          ) : visibleTracks.map((track) => (
            <div key={track.id} className="flex h-12 items-center justify-between border-b border-white/6 px-2 text-[12px] text-foreground/95 last:border-b-0">
              <span className="truncate">{formatPathLabel(track.path)}</span>
              <span className="ml-3 text-[11px] opacity-55">{track.keyframes.length}</span>
            </div>
          ))}
        </div>

        <div>
          <div ref={rulerRef} className="relative h-8 border-b border-white/6" onPointerDown={handleRulerScrubStart}>
            {rulerMarks.map((mark) => (
              <div key={`tick-${mark}`} className="absolute inset-y-0 w-px bg-white/6" style={{ left: `${mark * 100}%` }} />
            ))}
            {labeledMarks.map((mark) => (
              <div key={`label-${mark}`} className="absolute top-2 -translate-x-1/2 text-[11px] text-muted-foreground" style={{ left: `${mark * 100}%` }}>
                {mark.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}
              </div>
            ))}
            <button
              type="button"
              className="absolute top-0 z-20 h-full w-10 -translate-x-1/2 cursor-ew-resize bg-transparent"
              style={{ left: `${displayPlayhead * 100}%` }}
              onPointerDown={handlePlayheadDragStart}
              aria-label="Drag playhead"
            >
              <span className="absolute left-1/2 top-1/2 h-full w-[2px] -translate-x-1/2 -translate-y-1/2 bg-[#67a8ff] shadow-[0_0_0_1px_rgba(103,168,255,0.18)]" />
              <span className="absolute left-1/2 top-[3px] h-4 w-4 -translate-x-1/2 rounded-full border border-[#9bc7ff] bg-[#67a8ff] shadow-[0_0_0_1px_rgba(20,20,20,0.45)]" />
            </button>
          </div>

          <div ref={tracksBodyRef} className="relative" onPointerDown={handleLanePointerDown}>
            {visibleTracks.map((track) => (
              <div key={`lane-${track.id}`} className="relative h-12 border-b border-white/6 last:border-b-0">
                {rulerMarks.map((mark) => (
                  <div key={`grid-${track.id}-${mark}`} className="absolute inset-y-0 w-px bg-white/6" style={{ left: `${mark * 100}%` }} />
                ))}
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/7" />
                {track.keyframes.map((keyframe) => {
                  const isKeyframeSelected = selectedKeyframeIds.includes(keyframe.id);
                  const isAtPlayhead = Math.abs(keyframe.time - displayPlayhead) < KEYFRAME_SELECT_TOLERANCE;
                  return (
                    <button
                      key={keyframe.id}
                      type="button"
                      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 transition-transform hover:scale-110"
                      style={{ left: `${keyframe.time * 100}%` }}
                      onPointerDown={(event) => handleKeyframePointerDown(event, track.id, keyframe.id, keyframe.time)}
                    >
                      <span className={cn(
                        'block h-full w-full rounded-[2px] border',
                        isKeyframeSelected
                          ? 'border-white/80 bg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.25)]'
                          : isAtPlayhead
                            ? 'border-black/20 bg-[#ffcf5a]'
                            : 'border-black/25 bg-[#f0a020]',
                      )} />
                    </button>
                  );
                })}
              </div>
            ))}

            {marqueeBox ? (
              <div
                className="pointer-events-none absolute border border-primary/70 bg-primary/10"
                style={{
                  left: marqueeBox.left,
                  top: marqueeBox.top,
                  width: marqueeBox.width,
                  height: marqueeBox.height,
                }}
              />
            ) : null}

            <div className="pointer-events-none absolute inset-y-0 w-px bg-[#67a8ff]/75" style={{ left: `${displayPlayhead * 100}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
