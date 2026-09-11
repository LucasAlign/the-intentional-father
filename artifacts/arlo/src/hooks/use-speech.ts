import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition?: new () => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition?: new () => any;
  }
}

// iOS Safari has flaky SpeechRecognition support: after the native mic
// permission prompt, onstart/onerror/onend can all simply never fire,
// leaving the mic stuck "listening" forever (#74). This timeout forces
// a recovery instead of an indefinite hang.
const START_TIMEOUT_MS = 4000;

export function useSpeech(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  // true from the moment start() is called until a callback resolves it —
  // covers the gap while the permission prompt is up, when `listening` is
  // still false but a second tap must not spin up a second instance.
  const pendingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStartTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearStartTimeout();
    pendingRef.current = false;
    recRef.current = null;
    setListening(false);
  }, [clearStartTimeout]);

  useEffect(() => {
    return () => {
      clearStartTimeout();
      try {
        recRef.current?.abort();
      } catch {
        // ignore — best-effort cleanup on unmount
      }
    };
  }, [clearStartTimeout]);

  const toggle = useCallback(() => {
    if (pendingRef.current || listening) {
      try {
        recRef.current?.stop();
      } catch {
        // some engines throw if stop() is called before start() resolves
      }
      return;
    }
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onstart = () => {
      clearStartTimeout();
      setListening(true);
    };
    rec.onend = () => reset();
    rec.onerror = () => reset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(e.results as any[]).map((r: any) => r[0].transcript as string).join("");
      onResult(transcript);
    };
    recRef.current = rec;
    pendingRef.current = true;
    timeoutRef.current = setTimeout(() => {
      try {
        recRef.current?.abort();
      } catch {
        // ignore — we're forcing a reset regardless
      }
      reset();
    }, START_TIMEOUT_MS);
    try {
      rec.start();
    } catch {
      reset();
    }
  }, [listening, onResult, clearStartTimeout, reset]);

  return { listening, toggle };
}
