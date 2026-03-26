# Refraction Generator

Small local creative tool for generating seamless abstract video loop foundations in the browser.

## Stack

- React
- Vite
- TypeScript
- Zustand
- Canvas 2D

## Implemented In This Step

- Typed built-in presets with visual range
- Preset duplication, reset, and tasteful randomization
- JSON save and load for portable presets
- Stable versioned preset serialization using the existing `SceneConfig`
- Live preview updates across presets and imported settings

## Built-in Presets

- Classic Rainbow Prism
- Pastel Soft Spectrum
- Golden Refraction
- Brand-like Duotone Refraction

## Folder Structure

```text
src/
  components/
    ControlsPanel.tsx
    Panel.tsx
    PresetPanel.tsx
    PreviewCanvas.tsx
    fields.tsx
  config/
    defaults.ts
  hooks/
    useAnimationFrame.ts
  rendering/
    particleRenderer.ts
    postProcessing.ts
    refractionRenderer.ts
    types.ts
  store/
    appStore.ts
  types/
    config.ts
  utils/
    color.ts
    loop.ts
    math.ts
    presets.ts
    random.ts
```
