const assert = require('node:assert/strict');
require('ts-node').register({ compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { angularDelta, homeTarget, springStep, HOME_ANGLE, TAU } = require('./compass.ts');
assert(Math.abs(angularDelta(Math.PI - 0.01, -Math.PI + 0.01) - 0.02) < 1e-10);
for (const initial of [-20, 0, 32]) {
  for (const initialVelocity of [-25, 0, 25]) {
    let angle = initial;
    let velocity = initialVelocity;
    const target = homeTarget(angle, velocity);
    for (let frame = 0; frame < 600; frame++) ({ angle, velocity } = springStep(angle, velocity, target, 1 / 60));
    assert(Math.abs(angle - target) < 0.001);
    assert(Math.abs(velocity) < 0.001);
    assert(Math.abs(angularDelta(HOME_ANGLE, angle)) < 0.001);
    assert(Math.abs((target - HOME_ANGLE) / TAU - Math.round((target - HOME_ANGLE) / TAU)) < 1e-10);
  }
}
console.log('Compass wrap, flick and spring settling checks passed.');
