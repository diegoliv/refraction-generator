import { useEffect, useMemo, useRef, useState } from 'react';
import ColorPicker, { useColorPicker } from 'react-best-gradient-color-picker';

type BackgroundGradientFieldProps = {
  topColor: string;
  bottomColor: string;
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

export function BackgroundGradientField({ topColor, bottomColor, onChange }: BackgroundGradientFieldProps) {
  const colorsSignature = useMemo(() => serializeColors(topColor, bottomColor), [topColor, bottomColor]);
  const [gradientValue, setGradientValue] = useState(() => toGradientString(topColor, bottomColor));
  const [pickerWidth, setPickerWidth] = useState(280);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedSignatureRef = useRef(colorsSignature);
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
    if (colorsSignature !== lastEmittedSignatureRef.current) {
      setGradientValue(toGradientString(topColor, bottomColor));
      lastEmittedSignatureRef.current = colorsSignature;
    }
  }, [bottomColor, colorsSignature, topColor]);

  useEffect(() => {
    const gradient = getGradientObject(gradientValue);
    const colors = [...(gradient?.colors ?? [])].sort((a, b) => a.left - b.left);
    const nextTop = normalizeColor(colors[0]?.value, topColor);
    const nextBottom = normalizeColor(colors[colors.length - 1]?.value, bottomColor);
    const nextSignature = serializeColors(nextTop, nextBottom);

    if (nextSignature !== colorsSignature) {
      lastEmittedSignatureRef.current = nextSignature;
      onChange({ topColor: nextTop, bottomColor: nextBottom });
    }
  }, [bottomColor, colorsSignature, getGradientObject, gradientValue, onChange, topColor]);

  return (
    <div className="gradient-editor">
      <div ref={containerRef} className="gradient-editor__picker">
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
