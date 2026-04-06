import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveAnimatedScene } from './animation/resolveAnimatedScene';
import type { AnimatablePath, AnimatableValue } from './animation/types';
import { AnimationTransport } from './components/AnimationTransport';
import { ControlsPanel } from './components/ControlsPanel';
import { ExportPanel } from './components/ExportPanel';
import { Panel } from './components/Panel';
import { PresetPanel } from './components/PresetPanel';
import { PreviewCanvas } from './components/PreviewCanvas';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Button } from './components/ui/button';
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

const DEFAULT_ANIMATION_PATH: AnimatablePath = 'rays.shape.wallProfile';

function toggleSelection(current: AnimatablePath[], nextPaths: AnimatablePath[], additive: boolean): AnimatablePath[] {
  if (!additive) {
    return [...nextPaths];
  }

  const next = new Set(current);
  for (const path of nextPaths) {
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
  }

  return Array.from(next);
}

export function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewProgressRef = useRef(0);
  const [selectedFieldPaths, setSelectedFieldPaths] = useState<AnimatablePath[]>([DEFAULT_ANIMATION_PATH]);
  const [selectedKeyframeIds, setSelectedKeyframeIds] = useState<string[]>([]);
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
    animation,
    presets,
    activePresetId,
    isPlaying,
    playhead,
    autoKeying,
    patchBackground,
    patchExport,
    patchRays,
    patchParticles,
    patchPostprocessing,
    replaceRayBands,
    setSeed,
    setPlaying,
    setPlayhead,
    setAutoKeying,
    addKeyframeFromCurrentValue,
    upsertKeyframeValue,
    updateKeyframe,
    removeKeyframe,
    applyPreset,
    duplicateCurrentPreset,
    importPreset,
    randomizePreset,
    resetToDefaultPreset,
  } = useAppStore();

  const activePreset = presets.find((preset) => preset.id === activePresetId) ?? presets[0];
  const frameCount = Math.max(1, Math.round(scene.export.duration * scene.export.fps));
  const inspectorConfig = useMemo(
    () => resolveAnimatedScene(scene, animation, playhead),
    [scene, animation, playhead],
  );

  const selectedKeyframeEntries = useMemo(
    () => animation.tracks.flatMap((track) => track.keyframes
      .filter((keyframe) => selectedKeyframeIds.includes(keyframe.id))
      .map((keyframe) => ({ trackId: track.id, keyframeId: keyframe.id }))),
    [animation.tracks, selectedKeyframeIds],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== 'Delete' && event.key !== 'Backspace') || selectedKeyframeEntries.length === 0) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea') {
        return;
      }

      for (const entry of selectedKeyframeEntries) {
        removeKeyframe(entry.trackId, entry.keyframeId);
      }
      setSelectedKeyframeIds([]);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [removeKeyframe, selectedKeyframeEntries]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (target.closest('[data-field-selectable="true"]') || target.closest('[data-timeline-root="true"]')) {
        return;
      }

      setSelectedFieldPaths([]);
      setSelectedKeyframeIds([]);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const handleSelectFields = (paths: AnimatablePath[], additive: boolean) => {
    setSelectedFieldPaths((current) => {
      const next = toggleSelection(current, paths, additive);
      return next.length > 0 ? next : paths;
    });
    setSelectedKeyframeIds([]);
  };

  const handleAutoKeyframe = (path: AnimatablePath, value: AnimatableValue) => {
    upsertKeyframeValue(path, playhead, value);
  };

  const handleAddKeyframes = () => {
    for (const path of selectedFieldPaths) {
      addKeyframeFromCurrentValue(path, playhead);
    }
  };

  const handleSaveJson = () => {
    const json = serializePresetFile(activePreset?.name ?? 'Untitled Preset', scene, animation);
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
            animation,
            presetName: activePreset?.name ?? 'Preset',
            onProgress: setExportState,
          },
          previewProgressRef.current,
        );
      } else {
        const exportFn = format === 'mp4' ? exportMp4Video : exportPngSequence;
        await exportFn({
          config: scene,
          animation,
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
            importPreset(parsed.name, parsed.scene, parsed.animation);
            setSelectedFieldPaths([DEFAULT_ANIMATION_PATH]);
            setSelectedKeyframeIds([]);
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
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Refraction Generator</div>
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
                    config={inspectorConfig}
                    playhead={playhead}
                    animationTracks={animation.tracks}
                    selectedFieldPaths={selectedFieldPaths}
                    autoKeying={autoKeying}
                    onSelectFields={handleSelectFields}
                    onAutoKeyframe={handleAutoKeyframe}
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
                    onExportSinglePng={() => runExport('png-frame')}
                    onExportPng={() => runExport('png')}
                    onExportMp4={() => runExport('mp4')}
                  />
                </TabsContent>
                <TabsContent value="library" className="space-y-3 p-3">
                  <PresetPanel
                    presets={presets}
                    activePresetId={activePresetId}
                    onApplyPreset={(presetId) => {
                      applyPreset(presetId);
                      setSelectedFieldPaths([DEFAULT_ANIMATION_PATH]);
                      setSelectedKeyframeIds([]);
                    }}
                    onDuplicatePreset={openDuplicateDialog}
                    onRandomizePreset={randomizePreset}
                    onResetDefaultPreset={() => {
                      resetToDefaultPreset();
                      setSelectedFieldPaths([DEFAULT_ANIMATION_PATH]);
                      setSelectedKeyframeIds([]);
                    }}
                    onSaveJson={handleSaveJson}
                    onLoadJson={handleLoadJson}
                  />
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col">
          <Panel
            title="Preview"
            actions={
              <div className="flex items-center gap-1.5">
                <StatusPill>{scene.export.duration.toFixed(1)}s / {scene.export.fps} fps</StatusPill>
                <StatusPill>{frameCount} frames</StatusPill>
                <StatusPill>{scene.particles.enabled ? `${scene.particles.count} particles` : 'Particles off'}</StatusPill>
              </div>
            }
            className="flex min-h-0 flex-1 flex-col rounded-none border-0"
            bodyClassName="flex flex-1 flex-col p-0"
          >
            <PreviewCanvas
              config={scene}
              animation={animation}
              isPlaying={isPlaying}
              playhead={playhead}
              onProgressChange={(progress) => {
                previewProgressRef.current = progress;
              }}
            />
          </Panel>

          <AnimationTransport
            autoKeying={autoKeying}
            isPlaying={isPlaying}
            playhead={playhead}
            duration={scene.export.duration}
            tracks={animation.tracks}
            selectedFieldPaths={selectedFieldPaths}
            selectedKeyframeIds={selectedKeyframeIds}
            onTogglePlaying={() => {
              if (isPlaying) {
                setPlaying(false);
                setPlayhead(previewProgressRef.current);
              } else {
                setPlaying(true);
              }
            }}
            onStop={() => {
              setPlaying(false);
              setPlayhead(0);
              previewProgressRef.current = 0;
            }}
            onJumpToStart={() => {
              setPlaying(false);
              setPlayhead(0);
              previewProgressRef.current = 0;
            }}
            onJumpToEnd={() => {
              setPlaying(false);
              setPlayhead(1);
              previewProgressRef.current = 1;
            }}
            onPlayheadChange={(progress) => {
              setPlaying(false);
              setPlayhead(progress);
              previewProgressRef.current = progress;
            }}
            onAutoKeyingChange={setAutoKeying}
            onAddKeyframes={handleAddKeyframes}
            onMoveKeyframes={(updates) => {
              for (const update of updates) {
                updateKeyframe(update.trackId, update.keyframeId, { time: update.time });
              }
            }}
            onSelectedKeyframeIdsChange={setSelectedKeyframeIds}
          />
        </main>
      </div>
    </div>
  );
}


