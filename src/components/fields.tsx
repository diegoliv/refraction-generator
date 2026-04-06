import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { parseColor, rgbToHex } from '../utils/color';
import { getAnimatedFieldClasses, type AnimatedFieldState } from './fieldAnimationStyles';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

type BaseFieldProps = {
  label: string;
  description?: string;
  selected?: boolean;
  onSelect?: (additive: boolean) => void;
  animationState?: AnimatedFieldState;
};

type NumberFieldProps = BaseFieldProps & {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  inputClassName?: string;
};

function formatNumberValue(value: number, step: number): string {
  if (!Number.isFinite(value)) {
    return '--';
  }

  const decimals = step >= 1 ? 0 : Math.min(3, `${step}`.split('.')[1]?.length ?? 2);
  return value.toFixed(decimals);
}

function FieldShell({ label, description, value, children, selected, onSelect, animationState = 'static' }: { label: string; description?: string; value?: React.ReactNode; children: React.ReactNode; selected?: boolean; onSelect?: (additive: boolean) => void; animationState?: AnimatedFieldState }) {
  const tone = getAnimatedFieldClasses(animationState);

  return (
    <label
      data-field-selectable="true"
      className={cn(
        'flex flex-col gap-1.5 rounded-md border border-transparent px-2 py-2 transition-colors',
        onSelect ? 'cursor-pointer hover:border-border/70 hover:bg-muted/20' : 'px-0 py-1',
        tone.shell,
        selected && 'shadow-[inset_0_0_0_1px_rgba(13,153,255,0.35)]',
      )}
      onPointerDown={(event) => onSelect?.(event.shiftKey)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[11px] font-medium text-foreground', tone.label)}>{label}</span>
        {value ? <div className={cn('text-[10px] text-muted-foreground', tone.value)}>{value}</div> : null}
      </div>
      {description ? <span className="text-[10px] leading-4 text-muted-foreground">{description}</span> : null}
      {children}
    </label>
  );
}

function RangeValueEditor({
  value,
  min,
  max,
  step,
  formatValue,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue?: (value: number) => string;
  onCommit: (value: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(String(value));
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraftValue(String(value));
    }
  }, [isEditing, value]);

  useEffect(() => {
    if (!isEditing) {
      return undefined;
    }

    inputRef.current?.focus();
    inputRef.current?.select();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (wrapperRef.current?.contains(target)) {
        return;
      }

      const nextValue = Number(draftValue);
      if (Number.isFinite(nextValue)) {
        onCommit(nextValue);
      }
      setIsEditing(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [draftValue, isEditing, onCommit]);

  if (isEditing) {
    return (
      <div ref={wrapperRef} className="w-16">
        <Input
          ref={inputRef}
          className="h-6 px-1 text-right text-[10px]"
          type="number"
          min={min}
          max={max}
          step={step}
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const nextValue = Number(draftValue);
              if (Number.isFinite(nextValue)) {
                onCommit(nextValue);
              }
              setIsEditing(false);
            }
            if (event.key === 'Escape') {
              setDraftValue(String(value));
              setIsEditing(false);
            }
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="rounded px-1 py-0.5 text-[10px] hover:bg-white/6"
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsEditing(true);
      }}
    >
      {formatValue ? formatValue(value) : formatNumberValue(value, step)}
    </button>
  );
}

export function NumberField({ label, description, value, min, max, step = 0.01, onChange, formatValue, inputClassName, selected, onSelect, animationState = 'static' }: NumberFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value));
  };
  const tone = getAnimatedFieldClasses(animationState);

  return (
    <FieldShell label={label} description={description} value={formatValue ? formatValue(value) : formatNumberValue(value, step)} selected={selected} onSelect={onSelect} animationState={animationState}>
      <Input className={cn('h-8 bg-input text-[13px]', tone.input, inputClassName)} type="number" value={value} min={min} max={max} step={step} onChange={handleChange} onFocus={() => onSelect?.(false)} />
    </FieldShell>
  );
}

type RangeFieldProps = NumberFieldProps;

export function RangeField({ label, description, value, min = 0, max = 1, step = 0.01, onChange, formatValue, selected, onSelect, animationState = 'static' }: RangeFieldProps) {
  const tone = getAnimatedFieldClasses(animationState);

  return (
    <FieldShell
      label={label}
      description={description}
      value={(
        <RangeValueEditor
          value={value}
          min={min}
          max={max}
          step={step}
          formatValue={formatValue}
          onCommit={onChange}
        />
      )}
      selected={selected}
      onSelect={onSelect}
      animationState={animationState}
    >
      <div className={cn('space-y-1.5 rounded-sm px-1 py-1', tone.input)} onPointerDown={(event) => onSelect?.(event.shiftKey)}>
        <Slider value={[value]} min={min} max={max} step={step} onValueChange={(next) => onChange(next[0] ?? value)} />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/80">
          <span>{formatNumberValue(min, step)}</span>
          <span>{formatNumberValue(max, step)}</span>
        </div>
      </div>
    </FieldShell>
  );
}

type SelectFieldProps = BaseFieldProps & {
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SelectField({ label, description, value, options, onChange, placeholder, selected, onSelect, animationState = 'static' }: SelectFieldProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label;
  const tone = getAnimatedFieldClasses(animationState);

  return (
    <FieldShell label={label} description={description} value={selectedLabel} selected={selected} onSelect={onSelect} animationState={animationState}>
      <div onPointerDown={(event) => onSelect?.(event.shiftKey)}>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={tone.input}>
            <SelectValue placeholder={placeholder ?? 'Select option'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </FieldShell>
  );
}

type ColorFieldProps = BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
};

export function ColorField({ label, description, value, onChange, selected, onSelect, animationState = 'static' }: ColorFieldProps) {
  const [draftValue, setDraftValue] = useState(value);
  const frameRef = useRef<number | null>(null);
  const latestValueRef = useRef(value);
  const tone = getAnimatedFieldClasses(animationState);

  useEffect(() => {
    setDraftValue(value);
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }
  }, []);

  const swatch = rgbToHex(parseColor(draftValue));

  const flushColor = (nextValue: string) => {
    latestValueRef.current = nextValue;
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      onChange(latestValueRef.current);
    });
  };

  const commitTextValue = () => {
    onChange(draftValue.trim() || value);
  };

  return (
    <FieldShell label={label} description={description} value={draftValue} selected={selected} onSelect={onSelect} animationState={animationState}>
      <div className="flex items-center gap-2" onPointerDown={(event) => onSelect?.(event.shiftKey)}>
        <input
          className={cn('h-8 w-10 rounded-md border border-border/80 bg-input p-1', tone.input)}
          type="color"
          value={swatch}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDraftValue(nextValue);
            flushColor(nextValue);
          }}
        />
        <Input
          className={cn('h-8 bg-input text-[13px]', tone.input)}
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commitTextValue}
          onFocus={() => onSelect?.(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commitTextValue();
            }
          }}
        />
      </div>
    </FieldShell>
  );
}

type ToggleFieldProps = BaseFieldProps & {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function ToggleField({ label, description, checked, onChange, selected, onSelect, animationState = 'static' }: ToggleFieldProps) {
  const tone = getAnimatedFieldClasses(animationState);

  return (
    <div
      data-field-selectable="true"
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border border-transparent px-2 py-2 transition-colors',
        onSelect ? 'cursor-pointer hover:border-border/70 hover:bg-muted/20' : 'px-0 py-1.5',
        tone.shell,
        selected && 'shadow-[inset_0_0_0_1px_rgba(13,153,255,0.35)]',
      )}
      onPointerDown={(event) => onSelect?.(event.shiftKey)}
    >
      <div className="min-w-0">
        <div className={cn('text-[11px] font-medium text-foreground', tone.label)}>{label}</div>
        {description ? <div className="text-[10px] leading-4 text-muted-foreground">{description}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
          checked ? 'border-primary bg-primary' : 'border-border/80 bg-input',
          animationState !== 'static' && tone.input,
        )}
      >
        <span
          className={cn(
            'block h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
          )}
        />
      </button>
    </div>
  );
}
