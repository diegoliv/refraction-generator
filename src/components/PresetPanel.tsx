import { CopyPlus, Download, FolderUp, Shuffle, Undo2 } from 'lucide-react';
import type { PresetDefinition } from '../types/config';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

type PresetPanelProps = {
  presets: PresetDefinition[];
  activePresetId: string;
  onApplyPreset: (presetId: string) => void;
  onDuplicatePreset: () => void;
  onRandomizePreset: () => void;
  onResetDefaultPreset: () => void;
  onSaveJson: () => void;
  onLoadJson: () => void;
};

const PRESET_KIND_LABEL: Record<PresetDefinition['kind'], string> = {
  builtin: 'Built-in',
  custom: 'Custom',
  imported: 'Imported',
};

export function PresetPanel({
  presets,
  activePresetId,
  onApplyPreset,
  onDuplicatePreset,
  onRandomizePreset,
  onResetDefaultPreset,
  onSaveJson,
  onLoadJson,
}: PresetPanelProps) {
  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0];

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/70 bg-muted/35 px-2.5 py-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Current</div>
        <div className="mt-1 text-[12px] font-medium text-foreground">{activePreset.name}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{PRESET_KIND_LABEL[activePreset.kind]}</div>
      </div>

      <div className="space-y-0.5">
        {presets.map((preset) => {
          const active = preset.id === activePresetId;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors',
                active ? 'bg-primary/12 text-foreground' : 'text-muted-foreground hover:bg-muted/45 hover:text-foreground',
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium">{preset.name}</div>
                <div className="text-[10px] uppercase tracking-[0.14em] opacity-75">{PRESET_KIND_LABEL[preset.kind]}</div>
              </div>
              <div className={cn('ml-3 h-1.5 w-1.5 rounded-full', active ? 'bg-primary' : 'bg-border')} />
            </button>
          );
        })}
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="ghost" size="sm" onClick={onDuplicatePreset}><CopyPlus />Duplicate</Button>
        <Button variant="ghost" size="sm" onClick={onRandomizePreset}><Shuffle />Randomize</Button>
        <Button variant="ghost" size="sm" onClick={onResetDefaultPreset}><Undo2 />Reset</Button>
        <Button variant="ghost" size="sm" onClick={onLoadJson}><FolderUp />Load JSON</Button>
      </div>

      <Button className="w-full" size="sm" onClick={onSaveJson}><Download />Save JSON</Button>
    </div>
  );
}
