import type { SessionDef } from '../session/types';

const checkIn = (durationSec = 60): SessionDef['steps'][number] => ({
  id: 'check-in',
  title: 'Arriving',
  kind: 'checkIn',
  durationSec,
  cues: [
    { atSec: 0, text: 'Welcome. Find a comfortable seat, and let your phone rest where it can see your face and shoulders.' },
    { atSec: 12, text: 'For the next minute, there is nothing to do. Just let yourself arrive, breathing however feels natural.' },
    { atSec: 40, text: 'Notice the weight of your body. Notice the air moving in and out.' },
  ],
});

const checkOut = (durationSec = 60): SessionDef['steps'][number] => ({
  id: 'check-out',
  title: 'Noticing',
  kind: 'checkOut',
  durationSec,
  cues: [
    { atSec: 0, text: 'Let the breath return to its own rhythm. No guidance now. Just rest.' },
    { atSec: 30, text: 'Notice how you feel compared with when you sat down.' },
    { atSec: 52, text: 'When you are ready, gently open your eyes.' },
  ],
});

export const ARRIVE: SessionDef = {
  id: 'arrive',
  title: 'Arrive',
  subtitle: '6 min · adaptive breathing',
  description:
    'A guide that starts at your own breathing pace and slows down with you, step by step, toward about six breaths a minute.',
  motionCue: 'If you can, let the body become still. Let the phone and the floor hold you.',
  struggleCue: 'There is no need to force it. Let each breath be easy. The guide will meet you where you are.',
  steps: [
    checkIn(60),
    {
      id: 'settle',
      title: 'Settling',
      kind: 'guided',
      durationSec: 45,
      adapt: [{ kind: 'skipIfBreathingBelow', bpm: 8, cue: 'You have already settled into a slow, easy breath. Let us begin.' }],
      cues: [
        { atSec: 0, text: 'Let your shoulders drop. Soften your jaw, and the space between your eyebrows.' },
        { atSec: 20, text: 'Let the out-breath be a little longer than the in-breath, like a quiet sigh.' },
      ],
    },
    {
      id: 'breathe',
      title: 'Breathe with the light',
      kind: 'guided',
      durationSec: 150,
      pacer: { targetBpm: 6, inhaleRatio: 0.4 },
      adapt: [
        {
          kind: 'extendWhileBreathingAbove',
          bpm: 8,
          extendSec: 30,
          maxExtensions: 2,
          cue: 'Let us stay with the breath a little longer.',
        },
      ],
      cues: [
        { atSec: 0, text: 'Now breathe with the light. In as it grows, out as it fades. It begins at your own pace.' },
        { atSec: 45, text: 'Each time you follow, the guide slows a little. Let it carry you.' },
        { atSec: 100, text: 'If the mind wanders, that is fine. Return to the light, and the next breath.' },
      ],
    },
    {
      id: 'rest',
      title: 'Resting',
      kind: 'guided',
      durationSec: 30,
      cues: [{ atSec: 0, text: 'Let the guide go. The orb now simply follows your own breathing. Rest in it.' }],
    },
    checkOut(60),
  ],
};

export const BODY_SCAN: SessionDef = {
  id: 'body-scan',
  title: 'Body scan',
  subtitle: '10 min · guided awareness',
  description:
    'Move your attention slowly through the body. The orb mirrors your real breathing, and you get a before and after reading at the end.',
  motionCue: 'Notice any urge to move, and see if you can let it pass, like a wave.',
  struggleCue: 'There is no right way to breathe here. Let it be easy.',
  steps: [
    checkIn(60),
    {
      id: 'breath',
      title: 'Finding the breath',
      kind: 'guided',
      durationSec: 60,
      pacer: { targetBpm: 8, inhaleRatio: 0.45 },
      cues: [{ atSec: 0, text: 'Follow the light for a few breaths, to steady the attention.' }],
    },
    {
      id: 'scan',
      title: 'Body scan',
      kind: 'guided',
      durationSec: 360,
      cues: [
        { atSec: 0, text: 'Let the breath find its own rhythm. Bring your attention to the soles of your feet.' },
        { atSec: 30, text: 'Notice your feet. Warmth, coolness, pressure. Whatever is there.' },
        { atSec: 60, text: 'Move up into the lower legs and knees. Letting them soften.' },
        { atSec: 95, text: 'The thighs and hips. Feel them supported by what you are sitting on.' },
        { atSec: 130, text: 'The belly. Notice it rise and fall with each breath.' },
        { atSec: 165, text: 'The chest and upper back. The gentle movement of breathing.' },
        { atSec: 200, text: 'The shoulders. Let them sink, a little more with each out-breath.' },
        { atSec: 235, text: 'Down the arms, into the hands and fingertips.' },
        { atSec: 270, text: 'The neck, the jaw, the face. Let every small muscle rest.' },
        { atSec: 310, text: 'Now hold the whole body in awareness at once, breathing.' },
      ],
    },
    {
      id: 'rest',
      title: 'Resting',
      kind: 'guided',
      durationSec: 60,
      cues: [{ atSec: 0, text: 'Rest here. Nothing to do and nowhere to be.' }],
    },
    checkOut(60),
  ],
};

export const SESSIONS: SessionDef[] = [ARRIVE, BODY_SCAN];

export function getSession(id: string): SessionDef | undefined {
  return SESSIONS.find((s) => s.id === id);
}

export function plannedMinutes(def: SessionDef): number {
  return Math.round(def.steps.reduce((s, x) => s + x.durationSec, 0) / 60);
}
