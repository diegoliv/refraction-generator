import { useEffect, useMemo, useRef, useState } from 'react';
import ColorPicker, { useColorPicker } from 'react-best-gradient-color-picker';
import type { RayBand } from '../types/config';
import { bandsToGradientString, gradientObjectToBands, normalizeBandOffsets } from '../utils/gradientStops';

type GradientEditorProps = {
  bands: RayBand[];
  onChange: (bands: RayBand[]) => void;
};

function serializeBands(bands: RayBand[]): string {
  return JSON.stringify(normalizeBandOffsets(bands).map((band) => ({
    color: band.color.toLowerCase(),
    offset: Number(band.offset.toFixed(4)),
  })));
}

export function GradientEditor({ bands, onChange }: GradientEditorProps) {
  const propBandsSignature = useMemo(() => serializeBands(bands), [bands]);
  const [gradientValue, setGradientValue] = useState(() => bandsToGradientString(bands));
  const [pickerWidth, setPickerWidth] = useState(280);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedSignatureRef = useRef(propBandsSignature);
  const { getGradientObject } = useColorPicker(gradientValue, setGradientValue);

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
    if (propBandsSignature !== lastEmittedSignatureRef.current) {
      setGradientValue(bandsToGradientString(bands));
      lastEmittedSignatureRef.current = propBandsSignature;
    }
  }, [bands, propBandsSignature]);

  useEffect(() => {
    const parsed = gradientObjectToBands(getGradientObject(gradientValue), bands);
    const parsedSignature = serializeBands(parsed);

    if (parsedSignature !== propBandsSignature) {
      lastEmittedSignatureRef.current = parsedSignature;
      onChange(parsed);
    }
  }, [bands, getGradientObject, gradientValue, onChange, propBandsSignature]);

  return (
    <div className="gradient-editor">
      <div className="gradient-editor__meta">
        <span>Drag stops, add colors, and reposition them directly on the gradient rail.</span>
        <strong>{bands.length} stops</strong>
      </div>
      <div ref={containerRef} className="gradient-editor__picker">
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
