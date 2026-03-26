import { Download, Film, Image } from 'lucide-react';
import { Button } from './ui/button';

type ExportPanelProps = {
  width: number;
  height: number;
  duration: number;
  fps: number;
  isExporting: boolean;
  activeFormat: 'png' | 'png-frame' | 'mp4' | null;
  progress: number;
  status: string;
  onExportPng: () => void;
  onExportSinglePng: () => void;
  onExportMp4: () => void;
};

export function ExportPanel({ width, height, duration, fps, isExporting, activeFormat, progress, status, onExportPng, onExportSinglePng, onExportMp4 }: ExportPanelProps) {
  const frameCount = Math.max(1, Math.round(duration * fps));
  const percent = Math.round(progress * 100);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="rounded-md border border-border/70 bg-muted/35 px-2 py-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Frames</div>
          <div className="mt-1 font-medium text-foreground">{frameCount}</div>
        </div>
        <div className="rounded-md border border-border/70 bg-muted/35 px-2 py-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Resolution</div>
          <div className="mt-1 font-medium text-foreground">{width} x {height}</div>
        </div>
        <div className="col-span-2 rounded-md border border-border/70 bg-muted/35 px-2 py-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Timing</div>
          <div className="mt-1 font-medium text-foreground">{duration.toFixed(1)}s / {fps} fps</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button className="w-full" size="sm" onClick={onExportSinglePng} disabled={isExporting} variant="outline">
          <Image />
          {isExporting && activeFormat === 'png-frame' ? 'Exporting PNG...' : 'Single PNG'}
        </Button>
        <Button className="w-full" size="sm" onClick={onExportPng} disabled={isExporting} variant="outline">
          <Download />
          {isExporting && activeFormat === 'png' ? 'Exporting PNG...' : 'PNG Sequence'}
        </Button>
        <Button className="w-full" size="sm" onClick={onExportMp4} disabled={isExporting}>
          <Film />
          {isExporting && activeFormat === 'mp4' ? 'Encoding MP4...' : 'MP4 Video'}
        </Button>
      </div>

      <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 p-2.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <span>Progress</span>
          <span>{percent}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-[10px] leading-4 text-muted-foreground">{status}</p>
      </div>

      <p className="text-[10px] leading-4 text-muted-foreground">Single PNG captures the current preview frame. PNG sequence and MP4 use the same deterministic export renderer.</p>
    </div>
  );
}
