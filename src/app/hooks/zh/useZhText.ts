"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createConverter } from "js-opencc";

let cachedConverter: ((text: string) => string) | null = null;
let initPromise: Promise<(text: string) => string> | null = null;
const identity = (text: string) => text;

/**
 * Auto-converts Simplified Chinese UI text to Traditional Chinese for zh-hant locale.
 * Uses URL pathname detection (compatible with both i18n and non-i18n projects).
 * Module-level caching for instant subsequent calls.
 */
export function useZhText(): (text: string) => string {
  const pathname = usePathname();
  const isTraditional = pathname.startsWith("/zh-hant");
  const [, setReady] = useState(!!cachedConverter);

  useEffect(() => {
    if (!isTraditional || cachedConverter) return;
    if (!initPromise) {
      initPromise = createConverter({ from: "cn", to: "t" });
    }
    initPromise.then((fn) => {
      cachedConverter = fn;
      setReady(true);
    });
  }, [isTraditional]);

  return isTraditional && cachedConverter ? cachedConverter : identity;
}
