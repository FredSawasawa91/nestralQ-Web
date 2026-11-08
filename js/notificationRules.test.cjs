const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createTracker } = require('./notificationRules.js');

const sample = {
  sensors: { temperature: 24, motionDetected: 0 },
  device: { fanState: false, heaterState: false, bulbState: false, autoMode: true },
  thresholds: { minTemp: 22, maxTemp: 28 },
};

describe('desktop notification transitions', () => {
  it('suppresses the first device report and alerts on temperature transitions', () => {
    const tracker = createTracker();
    assert.deepEqual(tracker.update(sample), []);
    assert.equal(
      tracker.update({
        ...sample,
        sensors: { ...sample.sensors, temperature: 30 },
      })[0].title,
      'Temperature out of range'
    );
    assert.equal(
      tracker.update({
        ...sample,
        sensors: { ...sample.sensors, temperature: 27 },
      })[0].title,
      'Temperature back in range'
    );
  });

  it('notifies once per motion rising edge', () => {
    const tracker = createTracker();
    tracker.update(sample);
    const detected = {
      ...sample,
      sensors: { ...sample.sensors, motionDetected: 1 },
    };
    assert.equal(tracker.update(detected)[0].title, 'Motion detected');
    assert.deepEqual(tracker.update(detected), []);
    tracker.update(sample);
    assert.equal(tracker.update(detected)[0].title, 'Motion detected');
  });

  it('does not alert for an existing temperature when thresholds first load', () => {
    const tracker = createTracker();
    const hot = { ...sample, sensors: { ...sample.sensors, temperature: 27 } };
    tracker.update(hot);
    const updatedRange = { ...hot, thresholds: { minTemp: 18, maxTemp: 25 } };
    assert.deepEqual(
      tracker.update(updatedRange, { sensorsReady: false, actuatorsReady: false }),
      []
    );
    assert.deepEqual(tracker.update(updatedRange), []);
  });

  it('reports actuator changes only in automatic mode and after startup snapshots', () => {
    const tracker = createTracker();
    tracker.update(sample);
    const changed = {
      ...sample,
      device: { ...sample.device, fanState: true },
    };
    assert.deepEqual(
      tracker.update(changed, { actuatorsReady: false }),
      []
    );
    assert.equal(
      tracker.update({ ...changed, device: { ...changed.device, fanState: false } })[0].title,
      'Automatic control updated'
    );
    const manual = { ...sample, device: { ...sample.device, autoMode: false, fanState: true } };
    assert.deepEqual(tracker.update(manual), []);
  });
});
