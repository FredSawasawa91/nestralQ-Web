(function () {
  if (typeof firebase === 'undefined') {
    console.error('[Firebase] SDK not loaded. Check the CDN script URLs in index.html');
    return;
  }

  firebase.initializeApp(window.firebaseConfig);
  const db = firebase.database();

  function write(path, value) {
    return db.ref(path).set(value).then(
      () => true,
      (err) => {
        console.error(`[Firebase] Write error /${path}:`, err);
        return false;
      }
    );
  }

  // Returns a real unsubscribe function
  function listen(path, handler) {
    const r = db.ref(path);
    const cb = (snap) => handler(snap);
    r.on('value', cb, (err) =>
      console.error(`[Firebase] Listen error /${path}:`, err.message)
    );
    return () => r.off('value', cb);
  }

  window.fbApi = {
    writeValue: write,
    writeThresholds: async (min, max) =>
      (await write('settings/minTemp', min)) &&
      (await write('settings/maxTemp', max)),
    writeConnectionMode: (mode) => write('settings/connectionMode', mode),

    startSensorsListener: (cb) =>
      listen('sensors', (s) => {
        const d = s.val() || {};
        cb({
          temperature: Number(d.temperature ?? 0),
          humidity: Number(d.humidity ?? 0),
          lightIntensity: Number(d.lightIntensity ?? 0),
          motionDetected: d.motionDetected ? 1 : 0,
        });
      }),

    startCommandsListener: (cb) =>
      listen('commands', (s) => {
        const d = s.val() || {};
        cb({ fan: !!d.fan, heater: !!d.heater, bulb: !!d.bulb });
      }),

    startAutoModeListener: (cb) =>
      listen('settings/autoMode', (s) => cb(s.exists() ? !!s.val() : true)),

    startThresholdsListener: (cb) => {
      const u1 = listen('settings/minTemp', (s) => cb({ minTemp: s.val() ?? 22 }));
      const u2 = listen('settings/maxTemp', (s) => cb({ maxTemp: s.val() ?? 28 }));
      return () => {
        u1();
        u2();
      };
    },

    startHistoryListener: (cb) => {
      const r = db.ref('sensorLog');
      const cb2 = (snap) => {
        const d = snap.val() || {};
        const arr = Object.entries(d)
          .map(([k, v]) => ({ id: k, ...v }))
          .sort((a, b) => b.ts - a.ts);
        cb(arr);
      };
      r.on('value', cb2, (err) =>
        console.error(`[Firebase] Listen error /sensorLog:`, err.message)
      );
      return () => r.off('value', cb2);
    },

    writeSensorLog: (entry) => {
      const ts = Number(entry && entry.ts);
      if (!Number.isFinite(ts) || ts <= 0) return Promise.resolve(false);
      return write('sensorLog/' + ts, {
        temperature: Number(entry.temperature ?? 0),
        humidity: Number(entry.humidity ?? 0),
        lightIntensity: Number(entry.lightIntensity ?? 0),
        motionDetected: !!entry.motionDetected,
        ts: ts,
      });
    },
  };

  console.log('[Firebase] Ready');
})();