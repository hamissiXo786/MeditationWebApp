export { default } from './src/SmartSpectraModule';
export { default as SmartSpectraCameraView } from './src/SmartSpectraCameraView';
export * from './src/SmartSpectra.types';

/** Normalise SDK enum names (`NO_FACE_FOUND`, or camelCase `noFaceFound`) to SCREAMING_SNAKE. */
export function normaliseCode(code: string): string {
  if (code.includes('_') || code === code.toUpperCase()) return code.toUpperCase();
  return code.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}
