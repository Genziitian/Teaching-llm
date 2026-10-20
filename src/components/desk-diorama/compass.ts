export const TAU = Math.PI * 2;
export const HOME_ANGLE = Math.atan2(340, 265);

export function angularDelta(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function homeTarget(angle: number, velocity: number) {
  return HOME_ANGLE + Math.round((angle + velocity * 0.18 - HOME_ANGLE) / TAU) * TAU;
}

export function springStep(angle: number, velocity: number, target: number, dt: number) {
  const frequency = 7;
  const acceleration = frequency * frequency * (target - angle) - 2 * 0.8 * frequency * velocity;
  const nextVelocity = velocity + acceleration * Math.min(dt, 1 / 60);
  return { angle: angle + nextVelocity * Math.min(dt, 1 / 60), velocity: nextVelocity };
}
