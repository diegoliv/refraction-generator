import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { ControlsPanel } from './components/ControlsPanel';
import { ExportPanel } from './components/ExportPanel';
import { Panel } from './components/Panel';
import { PresetPanel } from './components/PresetPanel';
import { PreviewCanvas } from './components/PreviewCanvas';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { ScrollArea } from './components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { exportMp4Video } from './export/mp4Video';
import { exportPngSequence, exportSinglePng, type ExportProgress } from './export/pngSequence';
import { useAppStore } from './store/appStore';
import { parsePresetFile, serializePresetFile } from './utils/presets';

function StatusPill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{children}</span>;
}

export function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewProgressRef = useRef(0);
  const [exportState, setExportState] = useState<ExportProgress>({
    frame: 0,
    totalFrames: 0,
    progress: 0,
    status: 'Ready to export.',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [activeExportFormat, setActiveExportFormat] = useState<'png' | 'png-frame' | 'mp4' | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [sidebarTab, setSidebarTab] = useState('inspector');

  const {
    scene,
    presets,
    activePresetId,
    isPlaying,
    patchBackground,
    patchExport,
    patchRays,
    patchParticles,
    patchPostprocessing,
    replaceRayBands,
    setSeed,
    setPlaying,
    applyPreset,
    duplicateCurrentPreset,
    importPreset,
    randomizePreset,
    resetToDefaultPreset,
  } = useAppStore();

  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0];
  const frameCount = Math.max(1, Math.round(scene.export.duration * scene.export.fps));

  const handleSaveJson = () => {
    const json = serializePresetFile(activePreset?.name ?? 'Untitled Preset', scene);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(activePreset?.name ?? 'preset').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadJson = () => {
    fileInputRef.current?.click();
  };

  const openDuplicateDialog = () => {
    setDuplicateName(`${activePreset?.name ?? 'Preset'} Copy`);
    setDuplicateDialogOpen(true);
  };

  const handleConfirmDuplicate = () => {
    duplicateCurrentPreset(duplicateName);
    setDuplicateDialogOpen(false);
  };

  const runExport = async (format: 'png' | 'png-frame' | 'mp4') => {
    try {
      setIsExporting(true);
      setActiveExportFormat(format);

      if (format === 'png-frame') {
        await exportSinglePng(
          {
            config: scene,
            presetName: activePreset?.name ?? 'Preset',
            onProgress: setExportState,
          },
          previewProgressRef.current,
        );
      } else {
        const exportFn = format === 'mp4' ? exportMp4Video : exportPngSequence;
        await exportFn({
          config: scene,
          presetName: activePreset?.name ?? 'Preset',
          onProgress: setExportState,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed.';
      setExportState((current) => ({
        ...current,
        status: message,
      }));
    } finally {
      setIsExporting(false);
      setActiveExportFormat(null);
    }
  };

  const handleExportPng = () => runExport('png');
  const handleExportSinglePng = () => runExport('png-frame');
  const handleExportMp4 = () => runExport('mp4');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (!file) {
            return;
          }

          try {
            const text = await file.text();
            const parsed = parsePresetFile(text);
            importPreset(parsed.name, parsed.config);
            setSidebarTab('library');
          } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Unable to load preset JSON.');
          }
        }}
      />

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Preset</DialogTitle>
            <DialogDescription>Create an editable copy from the current scene.</DialogDescription>
          </DialogHeader>
          <Input value={duplicateName} onChange={(event) => setDuplicateName(event.target.value)} placeholder="Preset name" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmDuplicate}>Create Duplicate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen pr-[376px]">
        <aside className="fixed inset-y-0 right-0 z-20 w-[376px] border-l border-border/80 bg-panel">
          <div className="flex h-full flex-col">
            <div className="border-b border-border/70 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Refraction Generator</div>
                <Button variant="ghost" size="sm" onClick={() => setPlaying(!isPlaying)}>{isPlaying ? <Pause /> : <Play />}{isPlaying ? 'Pause' : 'Play'}</Button>
              </div>
            </div>

            <Tabs value={sidebarTab} onValueChange={setSidebarTab} className="flex min-h-0 flex-1 flex-col">
              <div className="border-b border-border/70 px-3 py-2">
                <TabsList className="grid h-8 w-full grid-cols-3">
                  <TabsTrigger value="inspector" className="text-[12px]">Inspector</TabsTrigger>
                  <TabsTrigger value="workflow" className="text-[12px]">Export</TabsTrigger>
                  <TabsTrigger value="library" className="text-[12px]">Library</TabsTrigger>
                </TabsList>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <TabsContent value="inspector" className="p-3">
                  <ControlsPanel
                    config={scene}
                    onPatchExport={patchExport}
                    onPatchBackground={patchBackground}
                    onPatchRays={patchRays}
                    onPatchParticles={patchParticles}
                    onPatchPostprocessing={patchPostprocessing}
                    onReplaceRayBands={replaceRayBands}
                    onSeedChange={setSeed}
                  />
                </TabsContent>
                <TabsContent value="workflow" className="space-y-3 p-3">
                  <ExportPanel
                    width={scene.export.width}
                    height={scene.export.height}
                    duration={scene.export.duration}
                    fps={scene.export.fps}
                    isExporting={isExporting}
                    activeFormat={activeExportFormat}
                    progress={exportState.progress}
                    status={exportState.status}
                    onExportSinglePng={handleExportSinglePng}
                    onExportPng={handleExportPng}
                    onExportMp4={handleExportMp4}
                  />
                </TabsContent>
                <TabsContent value="library" className="space-y-3 p-3">
                  <PresetPanel
                    presets={presets}
                    activePresetId={activePresetId}
                    onApplyPreset={applyPreset}
                    onDuplicatePreset={openDuplicateDialog}
                    onRandomizePreset={randomizePreset}
                    onResetDefaultPreset={resetToDefaultPreset}
                    onSaveJson={handleSaveJson}
                    onLoadJson={handleLoadJson}
                  />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col px-0 py-0">
          <Panel
            title="Preview"
            actions={
              <div className="flex items-center gap-1.5">
                <StatusPill>{scene.export.duration.toFixed(1)}s / {scene.export.fps} fps</StatusPill>
                <StatusPill>{frameCount} frames</StatusPill>
                <StatusPill>{scene.particles.enabled ? `${scene.particles.count} particles` : 'Particles off'}</StatusPill>
              </div>
            }
            className="flex min-h-screen flex-col rounded-none border-0"
            bodyClassName="flex flex-1 flex-col p-0"
          >
            <PreviewCanvas config={scene} isPlaying={isPlaying} onProgressChange={(progress) => { previewProgressRef.current = progress; }} />
          </Panel>
        </main>
      </div>
    </div>
  );
}
