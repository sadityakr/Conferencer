"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "conferencer:name";
const EVENT = "conferencer:name-changed";

/** The current person's display name, kept in this browser (no login yet). */
export function useName(): [string, (n: string) => void, boolean] {
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        setName(localStorage.getItem(KEY) ?? "");
      } catch {
        /* storage unavailable */
      }
      setReady(true);
    };
    read();
    window.addEventListener(EVENT, read);
    return () => window.removeEventListener(EVENT, read);
  }, []);
  const save = useCallback((n: string) => {
    try {
      localStorage.setItem(KEY, n.trim());
    } catch {
      /* ignore */
    }
    setName(n.trim());
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [name, save, ready];
}
