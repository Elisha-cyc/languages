import { useEffect, useRef, useState } from "react";
import { Accelerometer } from "expo-sensors";

// How much the reading must change between two samples (in g) to count as movement.
// A phone on a mattress feels you shift as small vibrations, so you may need to tune this.
export const MOTION_THRESHOLD = 0.03;

export async function askMotionPermission() {
  try {
    const result = await Accelerometer.requestPermissionsAsync();
    return result.granted;
  } catch (e) {
    return false;
  }
}

// Watches the accelerometer while `active` is true.
// available: null while checking, then true or false
// moving: true for a moment after movement
// lastMotionAt: a ref holding the time of the last movement
export function useMotionSensor(active) {
  const lastMotionAt = useRef(Date.now());
  const [available, setAvailable] = useState(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let subscription = null;
    let previous = null;
    let calmTimer;

    (async () => {
      try {
        const ok = await Accelerometer.isAvailableAsync();
        if (cancelled) return;
        if (!ok) {
          setAvailable(false);
          return;
        }

        Accelerometer.setUpdateInterval(250);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          if (previous) {
            const change = Math.hypot(
              x - previous.x,
              y - previous.y,
              z - previous.z,
            );
            if (change > MOTION_THRESHOLD) {
              lastMotionAt.current = Date.now();
              setMoving(true);
              clearTimeout(calmTimer);
              calmTimer = setTimeout(() => setMoving(false), 1500);
            }
          }
          previous = { x, y, z };
        });
        setAvailable(true);
      } catch (e) {
        if (!cancelled) setAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(calmTimer);
      if (subscription) subscription.remove();
    };
  }, [active]);

  return { available, moving, lastMotionAt };
}
