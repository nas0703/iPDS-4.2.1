import { useState, useEffect, useRef, useCallback } from "react";

interface UseIdleTimeoutOptions {
  timeoutMs?: number; // Default: 30 minutes
  warningMs?: number; // Default: 60 seconds before timeout
  enabled?: boolean;
  onTimeout: () => void;
}

export function useIdleTimeout({
  timeoutMs = 30 * 60 * 1000, // 30 minutes
  warningMs = 60 * 1000,      // 60 seconds warning
  enabled = true,
  onTimeout,
}: UseIdleTimeoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(warningMs / 1000));
  
  const lastActivityRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);
  const lastThrottleRef = useRef<number>(Date.now());

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  // Extend / Reset activity timer
  const extendSession = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setSecondsRemaining(Math.ceil(warningMs / 1000));
  }, [warningMs]);

  useEffect(() => {
    if (!enabled) {
      setShowWarning(false);
      return;
    }

    // Reset timestamp on activation
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    // Activity event handler (throttled to once per second)
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastThrottleRef.current > 1000) {
        lastThrottleRef.current = now;
        lastActivityRef.current = now;
        if (showWarning) {
          setShowWarning(false);
        }
      }
    };

    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "touchstart",
      "touchmove",
      "scroll",
      "click",
      "wheel",
    ];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check interval every 1 second
    const intervalId = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const warningThreshold = timeoutMs - warningMs;

      if (elapsed >= timeoutMs) {
        // Inactivity limit reached -> trigger timeout
        setShowWarning(false);
        try {
          sessionStorage.setItem(
            "ipds_idle_timeout_notice",
            "Sesi anda telah tamat secara automatik selepas 30 minit tiada aktiviti. Sila log masuk semula demi keselamatan."
          );
        } catch (e) {
          // Fallback if sessionStorage is disabled
        }
        onTimeoutRef.current();
      } else if (elapsed >= warningThreshold) {
        // Within warning window -> show countdown
        const remainingMs = Math.max(0, timeoutMs - elapsed);
        const remainingSecs = Math.max(1, Math.ceil(remainingMs / 1000));
        setSecondsRemaining(remainingSecs);
        setShowWarning(true);
      } else {
        if (showWarning) {
          setShowWarning(false);
        }
      }
    }, 1000);

    // Handle tab visibility change (e.g. tablet sleep or background tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const now = Date.now();
        const elapsed = now - lastActivityRef.current;
        if (elapsed >= timeoutMs) {
          setShowWarning(false);
          try {
            sessionStorage.setItem(
              "ipds_idle_timeout_notice",
              "Sesi anda telah tamat secara automatik selepas 30 minit tiada aktiviti. Sila log masuk semula demi keselamatan."
            );
          } catch (e) {}
          onTimeoutRef.current();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, timeoutMs, warningMs, showWarning]);

  return {
    showWarning,
    secondsRemaining,
    extendSession,
  };
}
