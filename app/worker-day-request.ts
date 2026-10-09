'use client';
import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}
const requested = () => new URLSearchParams(window.location.search).get('experience') === 'worker-day';
const serverSnapshot = () => false;

/** Read the explicit browser opt-in without synchronous state updates in an effect. */
export function useWorkerDayRequest(): boolean {
  return useSyncExternalStore(subscribe, requested, serverSnapshot);
}
