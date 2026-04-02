import { useEffect, useRef, useState } from 'react';

export default function CountUp({ end, duration = 1000, prefix = '', suffix = '' }) {
  const [count, setCount] = useState(0);
  const startRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (end === 0 || end === null || end === undefined) {
      setCount(0);
      return;
    }

    const startValue = 0;
    const endValue = Number(end);

    const step = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(startValue + (endValue - startValue) * eased));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    startRef.current = null;
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [end, duration]);

  return (
    <span>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}
