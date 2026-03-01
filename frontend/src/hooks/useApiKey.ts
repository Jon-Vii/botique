import { useState, useCallback } from "react";

const STORAGE_KEY = "botique_mistral_api_key";

function readStoredKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState(readStoredKey);

  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    try {
      if (key) {
        localStorage.setItem(STORAGE_KEY, key);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  return { apiKey, setApiKey } as const;
}
