import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import { parseColor, rgbToHex } from '../utils/color';
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

function FieldShell({ label, description, value, children }: { label: string; description?: string; value?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 py-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-foreground">{label}</span>
        {value ? <span className="text-[10px] text-muted-foreground">{value}</span> : null}
      </div>
      {description ? <span className="text-[10px] leading-4 text-muted-foreground">{description}</span> : null}
      {children}
    </label>
  );
}

export function NumberField({ label, description, value, min, max, step = 0.01, onChange, formatValue, inputClassName }: NumberFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(event.target.value));
  };

  return (
    <FieldShell label={label} description={description} value={formatValue ? formatValue(value) : formatNumberValue(value, step)}>
      <Input className={cn('h-8 bg-input text-[13px]', inputClassName)} type="number" value={value} min={min} max={max} step={step} onChange={handleChange} />
    </FieldShell>
  );
}

type RangeFieldProps = NumberFieldProps;

export function RangeField({ label, description, value, min = 0, max = 1, step = 0.01, onChange, formatValue }: RangeFieldProps) {
  const displayValue = formatValue ? formatValue(value) : formatNumberValue(value, step);

  return (
    <FieldShell label={label} description={description} value={displayValue}>
      <div className="space-y-1.5">
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

export function SelectField({ label, description, value, options, onChange, placeholder }: SelectFieldProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <FieldShell label={label} description={description} value={selectedLabel}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
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
    </FieldShell>
  );
}

type ColorFieldProps = BaseFieldProps & {
  value: string;
  onChange: (value: string) => void;
};

export function ColorField({ label, description, value, onChange }: ColorFieldProps) {
  const [draftValue, setDraftValue] = useState(value);
  const frameRef = useRef<number | null>(null);
  const latestValueRef = useRef(value);

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
    <FieldShell label={label} description={description} value={draftValue}>
      <div className="flex items-center gap-2">
        <input
          className="h-8 w-10 rounded-md border border-border/80 bg-input p-1"
          type="color"
          value={swatch}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDraftValue(nextValue);
            flushColor(nextValue);
          }}
        />
        <Input
          className="h-8 bg-input text-[13px]"
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commitTextValue}
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

export function ToggleField({ label, description, checked, onChange }: ToggleFieldProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-foreground">{label}</div>
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
