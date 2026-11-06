import type { HrvReading, Reading, Validation, ValidationCode } from './types';

/** Readings older than this are treated as missing (e.g. after the face left the frame). */
export const MAX_READING_AGE_MS = 15_000;

/** A reading we are willing to act on: SmartSpectra marked it stable and it is recent. */
export function trusted<T extends Reading | HrvReading>(r: T | null, now: number): T | null {
  if (!r || !r.stable) return null;
  if (now - r.timestamp > MAX_READING_AGE_MS) return null;
  return r;
}

const HINTS: Partial<Record<ValidationCode, string>> = {
  OK: 'Looking good. Stay comfortable and still.',
  NO_FACE_FOUND: 'Let the camera see your face.',
  MULTIPLE_FACES_FOUND: 'Only one person in view, please.',
  FACE_NOT_CENTERED: 'Center your face in the frame.',
  FACE_SIZE_OUT_OF_RANGE: 'Adjust your distance to the phone.',
  TOO_DARK: 'A little more light on your face would help.',
  TOO_BRIGHT: 'The light is a bit harsh. Try softer light.',
  CHEST_NOT_VISIBLE: 'Move back so your shoulders and chest are in view.',
  CAMERA_TUNING: 'Adjusting the camera…',
  FRAME_RATE_TOO_LOW: 'The camera is struggling. Try more light.',
  EXCESSIVE_MOTION: 'Prop your phone up and settle into stillness.',
  FACE_TOO_CLOSE: 'Move the phone a little further away.',
  FACE_TOO_FAR: 'Bring the phone a little closer.',
  FACE_TOO_HIGH: 'Tilt the phone up slightly.',
  FACE_TOO_LOW: 'Tilt the phone down slightly.',
  FACE_NOT_FORWARD: 'Face the phone directly.',
};

/** Calm, user-facing text for a validation code, falling back to the SDK's own hint. */
export function hintFor(v: Pick<Validation, 'code' | 'hint'> | null): string {
  if (!v) return 'Starting the camera…';
  return HINTS[v.code] ?? (v.hint || 'Adjusting…');
}

/** True once the camera has reported OK continuously for `holdMs`. */
export function positioningReady(v: Validation | null, now: number, holdMs = 2000): boolean {
  return !!v && v.code === 'OK' && now - v.since >= holdMs;
}
