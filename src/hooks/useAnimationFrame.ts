import { useEffect, useRef } from 'react';

export function useAnimationFrame(callback: (timeMs: number) => void, enabled: boolean): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let frameId = 0;

    const loop = (time: number) => {
      callbackRef.current(time);
      frameId = window.requestAnimationFrame(loop);
    };

    frameId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [enabled]);
}
