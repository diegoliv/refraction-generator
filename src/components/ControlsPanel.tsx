import { useMemo } from 'react';
import type { AnimationTrack, AnimatablePath, AnimatableValue } from '../animation/types';
import { defaultBlurProfile, defaultOpacityProfile, defaultWallProfile } from '../config/defaults';
import type { SceneConfig } from '../types/config';
import type { AnimatedFieldState } from './fieldAnimationStyles';
import { BackgroundGradientField } from './BackgroundGradientField';
import { BackgroundImageField } from './BackgroundImageField';
import { ProfileCurveEditor } from './BezierCurveEditor';
import { ColorField, NumberField, RangeField, SelectField, ToggleField } from './fields';
import { GradientEditor } from './GradientEditor';
import { Button } from './ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

type ControlsPanelProps = {
  config: SceneConfig;
  playhead: number;
  animationTracks: AnimationTrack[];
  selectedFieldPaths: AnimatablePath[];
  autoKeying: boolean;
  onSelectFields: (paths: AnimatablePath[], additive: boolean) => void;
  onAutoKeyframe: (path: AnimatablePath, value: AnimatableValue) => void;
  onPatchExport: (patch: Partial<SceneConfig['export']>) => void;
  onPatchBackground: (patch: Partial<SceneConfig['background']>) => void;
  onPatchRays: (patch: Partial<SceneConfig['rays']>) => void;
  onPatchParticles: (patch: Partial<SceneConfig['particles']>) => void;
  onPatchPostprocessing: (patch: Partial<SceneConfig['postprocessing']>) => void;
  onReplaceRayBands: (bands: SceneConfig['rays']['bands']) => void;
  onSeedChange: (seed: number) => void;
};

const KEYFRAME_TOLERANCE = 0.0005;

export function ControlsPanel({
  config,
  playhead,
  animationTracks,
  selectedFieldPaths,
  autoKeying,
  onSelectFields,
  onAutoKeyframe,
  onPatchExport,
  onPatchBackground,
  onPatchRays,
  onPatchParticles,
  onPatchPostprocessing,
  onReplaceRayBands,
  onSeedChange,
}: ControlsPanelProps) {
  const tracksByPath = useMemo(() => new Map(animationTracks.map((track) => [track.path, track])), [animationTracks]);

  const hasKeyframeAtPlayhead = (path: AnimatablePath) => {
    const track = tracksByPath.get(path);
    return Boolean(track?.keyframes.some((keyframe) => Math.abs(keyframe.time - playhead) < KEYFRAME_TOLERANCE));
  };

  const getAnimationState = (paths: AnimatablePath[]): AnimatedFieldState => {
    let hasAnimatedTrack = false;

    for (const path of paths) {
      const track = tracksByPath.get(path);
      if (!track || track.keyframes.length === 0) {
        continue;
      }

      hasAnimatedTrack = true;
      if (track.keyframes.some((keyframe) => Math.abs(keyframe.time - playhead) < KEYFRAME_TOLERANCE)) {
        return 'keyed';
      }
    }

    return hasAnimatedTrack ? 'animated' : 'static';
  };

  const fieldProps = (paths: AnimatablePath[]) => ({
    selected: paths.every((path) => selectedFieldPaths.includes(path)),
    onSelect: (additive: boolean) => onSelectFields(paths, additive),
    animationState: getAnimationState(paths),
  });

  const syncAnimatedValue = (path: AnimatablePath, value: AnimatableValue) => {
    if (autoKeying || hasKeyframeAtPlayhead(path)) {
      onAutoKeyframe(path, value);
    }
  };

  return (
    <Accordion type="multiple" defaultValue={['scene', 'background', 'rays', 'gradient']} className="space-y-0">
      <AccordionItem value="scene">
        <AccordionTrigger>Scene</AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-x-3 gap-y-1 md:grid-cols-2">
            <NumberField label="Width" value={config.export.width} min={256} max={4096} step={1} onChange={(value) => onPatchExport({ width: value })} formatValue={(value) => `${value}px`} />
            <NumberField label="Height" value={config.export.height} min={256} max={4096} step={1} onChange={(value) => onPatchExport({ height: value })} formatValue={(value) => `${value}px`} />
            <NumberField label="Duration" value={config.export.duration} min={1} max={30} step={0.5} onChange={(value) => onPatchExport({ duration: value })} formatValue={(value) => `${value.toFixed(1)}s`} />
            <NumberField label="FPS" value={config.export.fps} min={1} max={60} step={1} onChange={(value) => onPatchExport({ fps: value })} formatValue={(value) => `${value} fps`} />
            <NumberField label="Seed" value={config.seed} min={0} max={999999} step={1} onChange={onSeedChange} />
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="background">
        <AccordionTrigger>Background</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3 py-1">
            <div className="flex gap-1 rounded-md bg-muted/45 p-1">
              <Button type="button" size="sm" variant={config.background.type === 'gradient' ? 'default' : 'ghost'} className="flex-1" onClick={() => onPatchBackground({ type: 'gradient' })}>Gradient</Button>
              <Button type="button" size="sm" variant={config.background.type === 'image' ? 'default' : 'ghost'} className="flex-1" onClick={() => onPatchBackground({ type: 'image' })}>Image</Button>
            </div>
            {config.background.type === 'gradient' ? (
              <BackgroundGradientField
                topColor={config.background.topColor}
                bottomColor={config.background.bottomColor}
                onChange={({ topColor, bottomColor }) => {
                  onPatchBackground({ topColor, bottomColor });
                  syncAnimatedValue('background.topColor', topColor);
                  syncAnimatedValue('background.bottomColor', bottomColor);
                }}
                {...fieldProps(['background.topColor', 'background.bottomColor'])}
              />
            ) : (
              <BackgroundImageField imageSrc={config.background.imageSrc} onChange={(imageSrc) => onPatchBackground({ imageSrc })} />
            )}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="rays">
        <AccordionTrigger>Tunnel</AccordionTrigger>
        <AccordionContent>
          <ToggleField label="Enable refraction tunnel" checked={config.rays.enabled} onChange={(checked) => onPatchRays({ enabled: checked })} />
          <ToggleField label="Play animation" checked={!config.rays.pausedWhileParticlesMove} onChange={(checked) => onPatchRays({ pausedWhileParticlesMove: !checked })} />
          <div className="grid gap-x-3 gap-y-1 md:grid-cols-2">
            <RangeField label="Center X" value={config.rays.originX} min={0} max={1} step={0.01} onChange={(value) => { onPatchRays({ originX: value }); syncAnimatedValue('rays.originX', value); }} {...fieldProps(['rays.originX'])} />
            <RangeField label="Center Y" value={config.rays.originY} min={0} max={1} step={0.01} onChange={(value) => { onPatchRays({ originY: value }); syncAnimatedValue('rays.originY', value); }} {...fieldProps(['rays.originY'])} />
            <RangeField label="Rotation" value={config.rays.rotation} min={-180} max={180} step={1} onChange={(value) => { onPatchRays({ rotation: value }); syncAnimatedValue('rays.rotation', value); }} formatValue={(value) => `${value.toFixed(0)} deg`} {...fieldProps(['rays.rotation'])} />
            <RangeField label="Length" value={config.rays.length} min={0} max={1} step={0.01} onChange={(value) => { onPatchRays({ length: value }); syncAnimatedValue('rays.length', value); }} formatValue={(value) => `${Math.round(value * 100)}%`} {...fieldProps(['rays.length'])} />
            <RangeField label="Diameter" value={config.rays.shape.diameter} min={0.1} max={2.6} step={0.01} onChange={(value) => { onPatchRays({ shape: { ...config.rays.shape, diameter: value } }); syncAnimatedValue('rays.shape.diameter', value); }} {...fieldProps(['rays.shape.diameter'])} />
            <RangeField label="Opacity" value={config.rays.opacity} min={0} max={1} step={0.01} onChange={(value) => { onPatchRays({ opacity: value }); syncAnimatedValue('rays.opacity', value); }} {...fieldProps(['rays.opacity'])} />
            <RangeField label="Blur Amount" value={config.rays.blur} min={0} max={2.5} step={0.01} onChange={(value) => { onPatchRays({ blur: value }); syncAnimatedValue('rays.blur', value); }} {...fieldProps(['rays.blur'])} />
            <NumberField label="Loop Count" value={config.rays.loopCount} min={0} max={32} step={0.25} onChange={(value) => onPatchRays({ loopCount: value })} formatValue={(value) => `${value.toFixed(2)}x`} />
          </div>

          <Accordion type="multiple" defaultValue={['wall-profile']} className="pt-2">
            <AccordionItem value="wall-profile">
              <AccordionTrigger>Wall Profile</AccordionTrigger>
              <AccordionContent>
                <ProfileCurveEditor
                  label="Wall Profile"
                  description="Drag the endpoints and midpoint to control tunnel width across left, center, and right."
                  profile={config.rays.shape.wallProfile}
                  startLabel="Left"
                  endLabel="Right"
                  topLabel="Wide"
                  bottomLabel="Narrow"
                  lineColor="rgba(255,255,255,0.95)"
                  onChange={(wallProfile) => { onPatchRays({ shape: { ...config.rays.shape, wallProfile } }); syncAnimatedValue('rays.shape.wallProfile', wallProfile); }}
                  onReset={() => onPatchRays({ shape: { ...config.rays.shape, wallProfile: { ...defaultWallProfile } } })}
                  {...fieldProps(['rays.shape.wallProfile'])}
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="blur-profile">
              <AccordionTrigger>Blur Profile</AccordionTrigger>
              <AccordionContent>
                <ProfileCurveEditor
                  label="Blur Profile"
                  description="Scales blur across left, center, and right. Top means full blur amount, bottom means none."
                  profile={config.rays.blurProfile}
                  startLabel="Left"
                  endLabel="Right"
                  topLabel="100%"
                  bottomLabel="0%"
                  lineColor="rgba(186,219,255,0.95)"
                  onChange={(blurProfile) => { onPatchRays({ blurProfile }); syncAnimatedValue('rays.blurProfile', blurProfile); }}
                  onReset={() => onPatchRays({ blurProfile: { ...defaultBlurProfile } })}
                  {...fieldProps(['rays.blurProfile'])}
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="opacity-profile" className="border-b-0">
              <AccordionTrigger>Opacity Profile</AccordionTrigger>
              <AccordionContent>
                <ProfileCurveEditor
                  label="Opacity Profile"
                  description="Controls visibility across left, center, and right. Top means fully visible, bottom means transparent."
                  profile={config.rays.opacityProfile}
                  startLabel="Left"
                  endLabel="Right"
                  topLabel="100%"
                  bottomLabel="0%"
                  lineColor="rgba(255,212,174,0.95)"
                  onChange={(opacityProfile) => { onPatchRays({ opacityProfile }); syncAnimatedValue('rays.opacityProfile', opacityProfile); }}
                  onReset={() => onPatchRays({ opacityProfile: { ...defaultOpacityProfile } })}
                  {...fieldProps(['rays.opacityProfile'])}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="gradient">
        <AccordionTrigger>Gradient Stops</AccordionTrigger>
        <AccordionContent>
          <GradientEditor bands={config.rays.bands} onChange={(bands) => { onReplaceRayBands(bands); syncAnimatedValue('rays.bands', bands); }} {...fieldProps(['rays.bands'])} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="particles">
        <AccordionTrigger>Particles</AccordionTrigger>
        <AccordionContent>
          <ToggleField label="Enable particles" checked={config.particles.enabled} onChange={(checked) => onPatchParticles({ enabled: checked })} />
          <div className="grid gap-x-3 gap-y-1 md:grid-cols-2">
            <RangeField label="Count" value={config.particles.count} min={0} max={500} step={1} onChange={(value) => { onPatchParticles({ count: value }); syncAnimatedValue('particles.count', value); }} {...fieldProps(['particles.count'])} />
            <SelectField label="Style" value={config.particles.style} options={[{ label: 'Dust', value: 'dust' }, { label: 'Light Streaks', value: 'light-streaks' }]} onChange={(value) => onPatchParticles({ style: value as SceneConfig['particles']['style'] })} />
            <RangeField label="Opacity" value={config.particles.opacity} min={0} max={1} step={0.01} onChange={(value) => { onPatchParticles({ opacity: value }); syncAnimatedValue('particles.opacity', value); }} {...fieldProps(['particles.opacity'])} />
            <ColorField label="Color" value={config.particles.color} onChange={(value) => { onPatchParticles({ color: value }); syncAnimatedValue('particles.color', value); }} {...fieldProps(['particles.color'])} />
            <SelectField label="Emission Direction" value={config.particles.direction} options={[{ label: 'Start to End', value: 'forward' }, { label: 'End to Start', value: 'reverse' }]} onChange={(value) => onPatchParticles({ direction: value as SceneConfig['particles']['direction'] })} />
            <RangeField label={config.particles.style === 'light-streaks' ? 'Min Thickness' : 'Min Size'} value={config.particles.minSize} min={0.2} max={4} step={0.01} onChange={(value) => { onPatchParticles({ minSize: value }); syncAnimatedValue('particles.minSize', value); }} {...fieldProps(['particles.minSize'])} />
            <RangeField label={config.particles.style === 'light-streaks' ? 'Max Thickness' : 'Max Size'} value={config.particles.maxSize} min={0.2} max={6} step={0.01} onChange={(value) => { onPatchParticles({ maxSize: value }); syncAnimatedValue('particles.maxSize', value); }} {...fieldProps(['particles.maxSize'])} />
            <RangeField label="Min Speed" value={config.particles.minSpeed} min={0} max={1} step={0.01} onChange={(value) => { onPatchParticles({ minSpeed: value }); syncAnimatedValue('particles.minSpeed', value); }} {...fieldProps(['particles.minSpeed'])} />
            <RangeField label="Max Speed" value={config.particles.maxSpeed} min={0} max={1.5} step={0.01} onChange={(value) => { onPatchParticles({ maxSpeed: value }); syncAnimatedValue('particles.maxSpeed', value); }} {...fieldProps(['particles.maxSpeed'])} />
            <RangeField label="Twinkle" value={config.particles.twinkle} min={0} max={1} step={0.01} onChange={(value) => { onPatchParticles({ twinkle: value }); syncAnimatedValue('particles.twinkle', value); }} {...fieldProps(['particles.twinkle'])} />
            <RangeField label="Spread" value={config.particles.spread} min={0.1} max={1.5} step={0.01} onChange={(value) => { onPatchParticles({ spread: value }); syncAnimatedValue('particles.spread', value); }} {...fieldProps(['particles.spread'])} />
            <RangeField label="Direction Randomness" value={config.particles.directionRandomness} min={0} max={1} step={0.01} onChange={(value) => { onPatchParticles({ directionRandomness: value }); syncAnimatedValue('particles.directionRandomness', value); }} {...fieldProps(['particles.directionRandomness'])} />
            {config.particles.style === 'light-streaks' ? (
              <>
                <RangeField label="Streak Length" value={config.particles.streakLength} min={0} max={1} step={0.01} onChange={(value) => { onPatchParticles({ streakLength: value }); syncAnimatedValue('particles.streakLength', value); }} {...fieldProps(['particles.streakLength'])} />
                <RangeField label="Streak Softness" value={config.particles.streakSoftness} min={0} max={1} step={0.01} onChange={(value) => { onPatchParticles({ streakSoftness: value }); syncAnimatedValue('particles.streakSoftness', value); }} {...fieldProps(['particles.streakSoftness'])} />
                <RangeField label="Streak Taper" value={config.particles.streakTaper} min={0} max={1} step={0.01} onChange={(value) => { onPatchParticles({ streakTaper: value }); syncAnimatedValue('particles.streakTaper', value); }} {...fieldProps(['particles.streakTaper'])} />
                <RangeField label="Streak Density" value={config.particles.streakDensity} min={0} max={1} step={0.01} onChange={(value) => { onPatchParticles({ streakDensity: value }); syncAnimatedValue('particles.streakDensity', value); }} {...fieldProps(['particles.streakDensity'])} />
                <RangeField label="Streak Flow" value={config.particles.streakFlow} min={0} max={1} step={0.01} onChange={(value) => { onPatchParticles({ streakFlow: value }); syncAnimatedValue('particles.streakFlow', value); }} {...fieldProps(['particles.streakFlow'])} />
                <RangeField label="Streak Contrast" value={config.particles.streakContrast} min={0} max={1} step={0.01} onChange={(value) => { onPatchParticles({ streakContrast: value }); syncAnimatedValue('particles.streakContrast', value); }} {...fieldProps(['particles.streakContrast'])} />
              </>
            ) : null}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="finish">
        <AccordionTrigger>Finishing</AccordionTrigger>
        <AccordionContent>
          <div className="grid gap-x-3 gap-y-1 md:grid-cols-2">
            <RangeField label="Global Blur" value={config.postprocessing.globalBlur} min={0} max={2.5} step={0.01} onChange={(value) => onPatchPostprocessing({ globalBlur: value })} />
            <RangeField label="Grain / Noise" value={config.postprocessing.grain} min={0} max={1} step={0.01} onChange={(value) => onPatchPostprocessing({ grain: value })} />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

