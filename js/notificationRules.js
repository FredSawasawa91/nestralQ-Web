(function (root, factory) {
  const rules = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = rules;
  if (root) root.NestralQNotifications = rules;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const ACTUATORS = [
    ['fanState', 'Fan'],
    ['heaterState', 'Heater'],
    ['bulbState', 'Light'],
  ];

  function isEnabled(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  function createTracker() {
    let previous = null;

    return {
      reset() {
        previous = null;
      },
      update(current, { sensorsReady = true, actuatorsReady = true } = {}) {
        const sensors = current.sensors || {};
        const device = current.device || {};
        const thresholds = current.thresholds || {};
        const next = {
          temperature: Number(sensors.temperature),
          motionDetected: isEnabled(sensors.motionDetected),
          minTemp: Number(thresholds.minTemp),
          maxTemp: Number(thresholds.maxTemp),
          device: {
            fanState: isEnabled(device.fanState),
            heaterState: isEnabled(device.heaterState),
            bulbState: isEnabled(device.bulbState),
            autoMode: isEnabled(device.autoMode),
          },
        };
        if (!previous) {
          previous = next;
          return [];
        }

        const notifications = [];
        if (
          sensorsReady &&
          Number.isFinite(previous.temperature) &&
          Number.isFinite(next.temperature) &&
          Number.isFinite(next.minTemp) &&
          Number.isFinite(next.maxTemp) &&
          next.minTemp < next.maxTemp
        ) {
          const wasOut = previous.temperature < previous.minTemp ||
            previous.temperature > previous.maxTemp;
          const isOut = next.temperature < next.minTemp ||
            next.temperature > next.maxTemp;
          if (!wasOut && isOut) {
            const side = next.temperature < next.minTemp ? 'below the minimum' : 'above the maximum';
            notifications.push({
              title: 'Temperature out of range',
              body: `Temperature is ${next.temperature.toFixed(1)}°C, ${side}.`,
            });
          } else if (wasOut && !isOut) {
            notifications.push({
              title: 'Temperature back in range',
              body: `Temperature is back in range at ${next.temperature.toFixed(1)}°C.`,
            });
          }
          if (!previous.motionDetected && next.motionDetected) {
            notifications.push({
              title: 'Motion detected',
              body: 'Motion was detected in your home.',
            });
          }
        } else if (sensorsReady && !previous.motionDetected && next.motionDetected) {
          notifications.push({
            title: 'Motion detected',
            body: 'Motion was detected in your home.',
          });
        }

        if (actuatorsReady && next.device.autoMode) {
          const changed = ACTUATORS
            .filter(([key]) => previous.device[key] !== next.device[key])
            .map(([key, name]) =>
              `${name} turned ${next.device[key] ? 'on' : 'off'} automatically`
            );
          if (changed.length) {
            notifications.push({
              title: 'Automatic control updated',
              body: changed.join(', ') + '.',
            });
          }
        }

        previous = next;
        return notifications;
      },
    };
  }

  return { createTracker };
});
