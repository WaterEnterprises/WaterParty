import { useEffect, useRef } from "react";
import { onBackButton } from "../lib/capacitor";

/**
 * Register a native back-button handler in a Capacitor WebView.
 *
 * Accepts a handler that receives the current pathname so the caller can
 * decide what to do based on the route. The hook automatically cleans up
 * when the component unmounts or dependencies change.
 *
 * @example
 * ```ts
 * useBackButton((path) => {
 *   if (path.startsWith('/chat/')) navigate('/messages');
 *   else window.history.back();
 * });
 * ```
 */
export function useBackButton(handler: (currentPath: string) => void) {
  // Store the latest handler in a ref so we never stale-close over state
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return onBackButton(() => {
      try {
        handlerRef.current(window.location.pathname);
      } catch {
        /* handler is user code — guard against runtime errors */
      }
    });
  }, []);
}
