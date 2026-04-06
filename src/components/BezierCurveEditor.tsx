import { useEffect, useMemo, useRef, useState } from 'react';
import type { RayBezierProfile } from '../types/config';
import { cn } from '../lib/utils';
import { getAnimatedFieldClasses, type AnimatedFieldState } from './fieldAnimationStyles';
import { Button } from './ui/button';

type ProfileCurveEditorProps = {
  label: string;
  description: string;
  profile: RayBezierProfile;
  startLabel: string;
  endLabel: string;
  topLabel: string;
  bottomLabel: string;
  lineColor?: string;
  selected?: boolean;
  onSelect?: (additive: boolean) => void;
  animationState?: AnimatedFieldState;
  onChange: (profile: RayBezierProfile) => void;
  onReset?: () => void;
};

const WIDTH = 244;
const HEIGHT = 164;
const PADDING = 18;
const INNER_WIDTH = WIDTH - PADDING * 2;
const INNER_HEIGHT = HEIGHT - PADDING * 2;

type HandleKey = 'start' | 'cp1' | 'mid' | 'cp2' | 'end';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toCanvasPoint(x: number, y: number) {
  return {
    x: PADDING + x * INNER_WIDTH,
    y: HEIGHT - PADDING - y * INNER_HEIGHT,
  };
}

function fromCanvasPoint(clientX: number, clientY: number, rect: DOMRect) {
  return {
    x: clamp((clientX - rect.left - PADDING) / INNER_WIDTH, 0, 1),
    y: clamp((HEIGHT - PADDING - (clientY - rect.top)) / INNER_HEIGHT, 0, 1),
  };
}

function normalizeProfile(next: RayBezierProfile): RayBezierProfile {
  return {
    start: clamp(next.start, 0, 1),
    mid: clamp(next.mid, 0, 1),
    end: clamp(next.end, 0, 1),
    cp1x: clamp(next.cp1x, 0, 0.5),
    cp1y: clamp(next.cp1y, 0, 1),
    cp2x: clamp(next.cp2x, 0.5, 1),
    cp2y: clamp(next.cp2y, 0, 1),
  };
}

export function ProfileCurveEditor({
  label,
  description,
  profile,
  startLabel,
  endLabel,
  topLabel,
  bottomLabel,
  lineColor = 'rgba(255,255,255,0.95)',
  selected,
  onSelect,
  animationState = 'static',
  onChange,
  onReset,
}: ProfileCurveEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activeHandleRef = useRef<HandleKey | null>(null);
  const [activeHandle, setActiveHandle] = useState<HandleKey | null>(null);

  const points = useMemo(() => ({
    start: toCanvasPoint(0, profile.start),
    cp1: toCanvasPoint(profile.cp1x, profile.cp1y),
    mid: toCanvasPoint(0.5, profile.mid),
    cp2: toCanvasPoint(profile.cp2x, profile.cp2y),
    end: toCanvasPoint(1, profile.end),
  }), [profile]);

  useEffect(() => {
    if (!activeHandle) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const svg = svgRef.current;
      const handle = activeHandleRef.current;
      if (!svg || !handle) {
        return;
      }

      const rect = svg.getBoundingClientRect();
      const point = fromCanvasPoint(event.clientX, event.clientY, rect);

      if (handle === 'start') {
        onChange(normalizeProfile({ ...profile, start: point.y }));
        return;
      }
      if (handle === 'mid') {
        onChange(normalizeProfile({ ...profile, mid: point.y }));
        return;
      }
      if (handle === 'end') {
        onChange(normalizeProfile({ ...profile, end: point.y }));
        return;
      }
      if (handle === 'cp1') {
        onChange(normalizeProfile({ ...profile, cp1x: point.x, cp1y: point.y }));
        return;
      }
      onChange(normalizeProfile({ ...profile, cp2x: point.x, cp2y: point.y }));
    };

    const handlePointerUp = () => {
      activeHandleRef.current = null;
      setActiveHandle(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeHandle, onChange, profile]);

  const tone = getAnimatedFieldClasses(animationState);
  const path = `M ${points.start.x} ${points.start.y} Q ${points.cp1.x} ${points.cp1.y}, ${points.mid.x} ${points.mid.y} Q ${points.cp2.x} ${points.cp2.y}, ${points.end.x} ${points.end.y}`;
  const handles = [
    { key: 'start' as const, point: points.start, fill: '#f7f7f7' },
    { key: 'cp1' as const, point: points.cp1, fill: '#8fd6c9' },
    { key: 'mid' as const, point: points.mid, fill: '#9bbcff' },
    { key: 'cp2' as const, point: points.cp2, fill: '#f0c29f' },
    { key: 'end' as const, point: points.end, fill: '#f7f7f7' },
  ];

  return (
    <div
      data-field-selectable="true"
      className={cn(
        'space-y-2 rounded-md border border-transparent px-2 py-2 transition-colors',
        onSelect ? 'cursor-pointer hover:border-border/70 hover:bg-muted/20' : '',
        tone.shell,
        selected && 'shadow-[inset_0_0_0_1px_rgba(13,153,255,0.35)]',
      )}
      onPointerDown={(event) => onSelect?.(event.shiftKey)}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className={cn('text-[11px] font-medium text-foreground', tone.label)}>{label}</div>
          <div className="text-[10px] leading-4 text-muted-foreground">{description}</div>
        </div>
        {onReset ? <Button type="button" size="sm" variant="ghost" onClick={onReset}>Reset</Button> : null}
      </div>

      <div className={cn('rounded-md border border-border/70 bg-input/35 p-2', tone.input)}>
        <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[164px] w-full touch-none select-none">
          <rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={10} fill="rgba(255,255,255,0.03)" />
          {[0, 0.25, 0.5, 0.75, 1].map((step) => {
            const x = PADDING + step * INNER_WIDTH;
            const y = HEIGHT - PADDING - step * INNER_HEIGHT;
            return (
              <g key={step}>
                <line x1={x} y1={PADDING} x2={x} y2={HEIGHT - PADDING} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                <line x1={PADDING} y1={y} x2={WIDTH - PADDING} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
              </g>
            );
          })}
          <path d={`M ${points.start.x} ${points.start.y} L ${points.end.x} ${points.end.y}`} fill="none" stroke="rgba(255,255,255,0.18)" strokeDasharray="5 5" />
          <line x1={points.start.x} y1={points.start.y} x2={points.cp1.x} y2={points.cp1.y} stroke="rgba(255,255,255,0.22)" />
          <line x1={points.mid.x} y1={points.mid.y} x2={points.cp1.x} y2={points.cp1.y} stroke="rgba(255,255,255,0.22)" />
          <line x1={points.mid.x} y1={points.mid.y} x2={points.cp2.x} y2={points.cp2.y} stroke="rgba(255,255,255,0.22)" />
          <line x1={points.end.x} y1={points.end.y} x2={points.cp2.x} y2={points.cp2.y} stroke="rgba(255,255,255,0.22)" />
          <path d={path} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" />
          {handles.map(({ key, point, fill }) => (
            <circle
              key={key}
              cx={point.x}
              cy={point.y}
              r={activeHandle === key ? 7 : key === 'mid' ? 6.5 : 6}
              fill={fill}
              stroke="rgba(15,23,42,0.8)"
              strokeWidth={2}
              onPointerDown={(event) => {
                event.preventDefault();
                onSelect?.(event.shiftKey);
                activeHandleRef.current = key;
                setActiveHandle(key);
              }}
              className="cursor-grab"
            />
          ))}
          <text x={PADDING} y={HEIGHT - 2} fill="rgba(255,255,255,0.58)" fontSize="10">{startLabel}</text>
          <text x={WIDTH / 2} y={HEIGHT - 2} fill="rgba(255,255,255,0.58)" fontSize="10" textAnchor="middle">Center</text>
          <text x={WIDTH - PADDING} y={HEIGHT - 2} fill="rgba(255,255,255,0.58)" fontSize="10" textAnchor="end">{endLabel}</text>
          <text x={2} y={PADDING + 4} fill="rgba(255,255,255,0.58)" fontSize="10">{topLabel}</text>
          <text x={2} y={HEIGHT - PADDING + 4} fill="rgba(255,255,255,0.58)" fontSize="10">{bottomLabel}</text>
        </svg>
      </div>
    </div>
  );
}
