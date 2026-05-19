import { createContext, useContext } from 'react';
export const LFCtx = createContext(null);
export const useLF = () => useContext(LFCtx);

export const haptic = (ms = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
};
