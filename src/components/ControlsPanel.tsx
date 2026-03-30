import type { SceneConfig } from '../types/config';
import { createCylinderShape, defaultBlurProfile, defaultOpacityProfile, defaultWallProfile } from '../config/defaults';
import { BackgroundGradientField } from './BackgroundGradientField';
import { BackgroundImageField } from './BackgroundImageField';
import { ProfileCurveEditor } from './BezierCurveEditor';
import { ColorField, NumberField, RangeField, SelectField, ToggleField } from './fields';
import { GradientEditor } from './GradientEditor';
import { Button } from './ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

type ControlsPanelProps = {
  config: SceneConfig;
  onPatchExport: (patch: Partial<SceneConfig['export']>) => void;
  onPatchBackground: (patch: Partial<SceneConfig['background']>) => void;
  onPatchRays: (patch: Partial<SceneConfig['rays']>) => void;
  onPatchParticles: (patch: Partial<SceneConfig['particles']>) => void;
  onPatchPostprocessing: (patch: Partial<SceneConfig['postprocessing']>) => void;
  onReplaceRayBands: (bands: SceneConfig['rays']['bands']) => void;
  onSeedChange: (seed: number) => void;
};

export function ControlsPanel({
  config,
  onPatchExport,
  onPatchBackground,
  onPatchRays,
  onPatchParticles,
  onPatchPostprocessing,
  onReplaceRayBands,
  onSeedChange,
}: ControlsPanelProps) {
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
              <BackgroundGradientField topColor={config.background.topColor} bottomColor={config.background.bottomColor} onChange={({ topColor, bottomColor }) => onPatchBackground({ topColor, bottomColor })} />
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
            <RangeField label="Center X" value={config.rays.originX} min={0} max={1} step={0.01} onChange={(value) => onPatchRays({ originX: value })} />
            <RangeField label="Center Y" value={config.rays.originY} min={0} max={1} step={0.01} onChange={(value) => onPatchRays({ originY: value })} />
            <RangeField label="Rotation" value={config.rays.rotation} min={-180} max={180} step={1} onChange={(value) => onPatchRays({ rotation: value })} formatValue={(value) => `${value.toFixed(0)} deg`} />
            <RangeField label="Length" value={config.rays.length} min={0} max={1} step={0.01} onChange={(value) => onPatchRays({ length: value })} formatValue={(value) => `${Math.round(value * 100)}%`} />
            <RangeField label="Diameter" value={config.rays.shape.diameter} min={0.1} max={2.6} step={0.01} onChange={(value) => onPatchRays({ shape: { ...config.rays.shape, diameter: value } })} />
            <RangeField label="Opacity" value={config.rays.opacity} min={0} max={1} step={0.01} onChange={(value) => onPatchRays({ opacity: value })} />
            <RangeField label="Blur Amount" value={config.rays.blur} min={0} max={2.5} step={0.01} onChange={(value) => onPatchRays({ blur: value })} />
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
                  onChange={(wallProfile) => onPatchRays({ shape: { ...config.rays.shape, wallProfile } })}
                  onReset={() => onPatchRays({ shape: { ...config.rays.shape, wallProfile: { ...defaultWallProfile } } })}
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
                  onChange={(blurProfile) => onPatchRays({ blurProfile })}
                  onReset={() => onPatchRays({ blurProfile: { ...defaultBlurProfile } })}
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="opacity-profile">
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
                  onChange={(opacityProfile) => onPatchRays({ opacityProfile })}
                  onReset={() => onPatchRays({ opacityProfile: { ...defaultOpacityProfile } })}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="gradient">
        <AccordionTrigger>Gradient Stops</AccordionTrigger>
        <AccordionContent><GradientEditor bands={config.rays.bands} onChange={onReplaceRayBands} /></AccordionContent>
      </AccordionItem>

      <AccordionItem value="particles">
        <AccordionTrigger>Particles</AccordionTrigger>
        <AccordionContent>
          <ToggleField label="Enable floating dust" checked={config.particles.enabled} onChange={(checked) => onPatchParticles({ enabled: checked })} />
          <div className="grid gap-x-3 gap-y-1 md:grid-cols-2">
            <RangeField label="Count" value={config.particles.count} min={0} max={500} step={1} onChange={(value) => onPatchParticles({ count: value })} />
            <RangeField label="Opacity" value={config.particles.opacity} min={0} max={1} step={0.01} onChange={(value) => onPatchParticles({ opacity: value })} />
            <ColorField label="Color" value={config.particles.color} onChange={(value) => onPatchParticles({ color: value })} />
            <SelectField label="Direction" value={config.particles.direction} options={[{ label: 'Into apex', value: 'into-apex' }, { label: 'From apex', value: 'from-apex' }]} onChange={(value) => onPatchParticles({ direction: value as SceneConfig['particles']['direction'] })} />
            <RangeField label="Min Size" value={config.particles.minSize} min={0.2} max={4} step={0.01} onChange={(value) => onPatchParticles({ minSize: value })} />
            <RangeField label="Max Size" value={config.particles.maxSize} min={0.2} max={6} step={0.01} onChange={(value) => onPatchParticles({ maxSize: value })} />
            <RangeField label="Min Speed" value={config.particles.minSpeed} min={0} max={1} step={0.01} onChange={(value) => onPatchParticles({ minSpeed: value })} />
            <RangeField label="Max Speed" value={config.particles.maxSpeed} min={0} max={1.5} step={0.01} onChange={(value) => onPatchParticles({ maxSpeed: value })} />
            <RangeField label="Twinkle" value={config.particles.twinkle} min={0} max={1} step={0.01} onChange={(value) => onPatchParticles({ twinkle: value })} />
            <RangeField label="Spread" value={config.particles.spread} min={0.1} max={1.5} step={0.01} onChange={(value) => onPatchParticles({ spread: value })} />
            <RangeField label="Direction Randomness" value={config.particles.directionRandomness} min={0} max={1} step={0.01} onChange={(value) => onPatchParticles({ directionRandomness: value })} />
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
