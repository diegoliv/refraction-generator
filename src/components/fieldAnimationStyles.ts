export type AnimatedFieldState = 'static' | 'animated' | 'keyed';

export function getAnimatedFieldClasses(state: AnimatedFieldState) {
  switch (state) {
    case 'keyed':
      return {
        shell: 'border-amber-400/45 bg-amber-400/[0.08]',
        label: 'text-amber-100',
        value: 'text-amber-100/80',
        input: 'border-amber-400/40 bg-amber-400/[0.10] text-amber-50',
      };
    case 'animated':
      return {
        shell: 'border-emerald-400/30 bg-emerald-400/[0.06]',
        label: 'text-emerald-100',
        value: 'text-emerald-100/75',
        input: 'border-emerald-400/35 bg-emerald-400/[0.08] text-emerald-50',
      };
    default:
      return {
        shell: '',
        label: '',
        value: '',
        input: '',
      };
  }
}
