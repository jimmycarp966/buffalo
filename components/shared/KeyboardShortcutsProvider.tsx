"use client";

import { useGlobalShortcuts } from "@/hooks/useKeyboardShortcuts";

export function KeyboardShortcutsProvider() {
  useGlobalShortcuts();
  return null;
}

