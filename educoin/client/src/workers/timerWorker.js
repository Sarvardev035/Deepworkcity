// Web Worker — runs off the main thread so tab visibility doesn't pause it
let intervalId = null;
let startTime = null;
let elapsedBeforePause = 0;
let running = false;

self.onmessage = (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'START': {
      startTime = Date.now() - (payload?.elapsed ?? 0);
      elapsedBeforePause = 0;
      running = true;
      intervalId = setInterval(() => {
        if (running) {
          const elapsed = Date.now() - startTime;
          self.postMessage({ type: 'TICK', elapsed });
        }
      }, 1000);
      break;
    }
    case 'STOP': {
      running = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      const elapsed = startTime ? Date.now() - startTime : 0;
      self.postMessage({ type: 'STOPPED', elapsed });
      break;
    }
    case 'RESET': {
      running = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      startTime = null;
      self.postMessage({ type: 'RESET_ACK' });
      break;
    }
  }
};
