import { useEffect, useMemo, useRef, useState } from 'react';
import ColorPicker, { useColorPicker } from 'react-best-gradient-color-picker';
import { cn } from '../lib/utils';
import type { RayBand } from '../types/config';
import { bandsToGradientString, gradientObjectToBands, normalizeBandOffsets } from '../utils/gradientStops';
import { getAnimatedFieldClasses, type AnimatedFieldState } from './fieldAnimationStyles';

type GradientEditorProps = {
  bands: RayBand[];
  selected?: boolean;
  onSelect?: (additive: boolean) => void;
  animationState?: AnimatedFieldState;
  onChange: (bands: RayBand[]) => void;
};

function serializeBands(bands: RayBand[]): string {
  return JSON.stringify(normalizeBandOffsets(bands).map((band) => ({
    color: band.color.toLowerCase(),
    offset: Number(band.offset.toFixed(4)),
  })));
}

export function GradientEditor({ bands, selected, onSelect, animationState = 'static', onChange }: GradientEditorProps) {
  const propBandsSignature = useMemo(() => serializeBands(bands), [bands]);
  const [gradientValue, setGradientValue] = useState(() => bandsToGradientString(bands));
  const [pickerWidth, setPickerWidth] = useState(280);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  const bandsRef = useRef(bands);
  const gradientValueRef = useRef(gradientValue);
  const propBandsSignatureRef = useRef(propBandsSignature);
  const { getGradientObject } = useColorPicker(gradientValue, setGradientValue);
  const getGradientObjectRef = useRef(getGradientObject);
  const tone = getAnimatedFieldClasses(animationState);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    bandsRef.current = bands;
    propBandsSignatureRef.current = propBandsSignature;
  }, [bands, propBandsSignature]);

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
    const nextGradientValue = bandsToGradientString(bands);
    if (propBandsSignature !== propBandsSignatureRef.current || nextGradientValue !== gradientValueRef.current) {
      gradientValueRef.current = nextGradientValue;
      setGradientValue(nextGradientValue);
    }
  }, [bands, propBandsSignature]);

  useEffect(() => {
    const parsed = gradientObjectToBands(getGradientObjectRef.current(gradientValue), bandsRef.current);
    const parsedSignature = serializeBands(parsed);

    if (parsedSignature !== propBandsSignatureRef.current) {
      onChangeRef.current(parsed);
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
      <div className="gradient-editor__meta">
        <span>Drag stops, add colors, and reposition them directly on the gradient rail.</span>
        <strong className={tone.label}>{bands.length} stops</strong>
      </div>
      <div ref={containerRef} className={cn('gradient-editor__picker rounded-sm', tone.input)}>
        <ColorPicker
          className="gradient-editor__color-picker"
          style={{ body: { width: '100%', background: 'transparent' } }}
          value={gradientValue}
          onChange={setGradientValue}
          width={pickerWidth}
          height={180}
          hideColorTypeBtns={true}
          hideGradientType={true}
          hideGradientAngle={true}
          hideAdvancedSliders={true}
          hideColorGuide={true}
          hideEyeDrop={true}
          hideInputType={true}
          hidePresets={true}
          disableLightMode={true}
          hidePickerSquare={false}
          hideOpacity={true}
        />
      </div>
    </div>
  );
}
