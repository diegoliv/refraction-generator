import { useEffect, useMemo, useRef, useState } from 'react';
import ColorPicker, { useColorPicker } from 'react-best-gradient-color-picker';
import { cn } from '../lib/utils';
import { getAnimatedFieldClasses, type AnimatedFieldState } from './fieldAnimationStyles';

type BackgroundGradientFieldProps = {
  topColor: string;
  bottomColor: string;
  selected?: boolean;
  onSelect?: (additive: boolean) => void;
  animationState?: AnimatedFieldState;
  onChange: (colors: { topColor: string; bottomColor: string }) => void;
};

function serializeColors(topColor: string, bottomColor: string): string {
  return JSON.stringify([topColor.toLowerCase(), bottomColor.toLowerCase()]);
}

function toGradientString(topColor: string, bottomColor: string): string {
  return `linear-gradient(180deg, ${topColor} 0%, ${bottomColor} 100%)`;
}

function normalizeColor(value: string | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function BackgroundGradientField({ topColor, bottomColor, selected, onSelect, animationState = 'static', onChange }: BackgroundGradientFieldProps) {
  const colorsSignature = useMemo(() => serializeColors(topColor, bottomColor), [topColor, bottomColor]);
  const [gradientValue, setGradientValue] = useState(() => toGradientString(topColor, bottomColor));
  const [pickerWidth, setPickerWidth] = useState(280);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  const colorsRef = useRef({ topColor, bottomColor });
  const colorsSignatureRef = useRef(colorsSignature);
  const gradientValueRef = useRef(gradientValue);
  const { getGradientObject } = useColorPicker(gradientValue, setGradientValue);
  const getGradientObjectRef = useRef(getGradientObject);
  const tone = getAnimatedFieldClasses(animationState);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    colorsRef.current = { topColor, bottomColor };
    colorsSignatureRef.current = colorsSignature;
  }, [topColor, bottomColor, colorsSignature]);

  useEffect(() => {
    gradientValueRef.current = gradientValue;
  }, [gradientValue]);

  useEffect(() => {
    getGradientObjectRef.current = getGradientObject;
  }, [getGradientObject]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const updateWidth = () => {
      const nextWidth = Math.max(220, Math.floor(container.clientWidth));
      setPickerWidth(nextWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const nextGradientValue = toGradientString(topColor, bottomColor);
    if (nextGradientValue !== gradientValueRef.current) {
      gradientValueRef.current = nextGradientValue;
      setGradientValue(nextGradientValue);
    }
  }, [topColor, bottomColor]);

  useEffect(() => {
    const gradient = getGradientObjectRef.current(gradientValue);
    const colors = [...(gradient?.colors ?? [])].sort((a, b) => a.left - b.left);
    const current = colorsRef.current;
    const nextTop = normalizeColor(colors[0]?.value, current.topColor);
    const nextBottom = normalizeColor(colors[colors.length - 1]?.value, current.bottomColor);
    const nextSignature = serializeColors(nextTop, nextBottom);

    if (nextSignature !== colorsSignatureRef.current) {
      onChangeRef.current({ topColor: nextTop, bottomColor: nextBottom });
    }
  }, [gradientValue]);

  return (
    <div
      data-field-selectable="true"
      className={cn(
        'gradient-editor rounded-md border border-transparent px-2 py-2 transition-colors',
        onSelect ? 'cursor-pointer hover:border-border/70 hover:bg-muted/20' : '',
        tone.shell,
        selected && 'shadow-[inset_0_0_0_1px_rgba(13,153,255,0.35)]',
      )}
      onPointerDown={(event) => onSelect?.(event.shiftKey)}
    >
      <div ref={containerRef} className={cn('gradient-editor__picker rounded-sm', tone.input)}>
        <ColorPicker
          className="gradient-editor__color-picker"
          style={{ body: { width: '100%', background: 'transparent' } }}
          value={gradientValue}
          onChange={setGradientValue}
          width={pickerWidth}
          height={156}
          hideColorTypeBtns={true}
          hideGradientType={true}
          hideGradientAngle={true}
          hideAdvancedSliders={true}
          hideColorGuide={true}
          hideEyeDrop={true}
          hideInputType={true}
          hidePresets={true}
          disableLightMode={true}
        />
      </div>
    </div>
  );
}
