"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppData, emptyData } from "@/lib/model";
type Store = {
  data: AppData;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  mutate: (
    path: string,
    method: string,
    body?: unknown,
  ) => Promise<Record<string, unknown>>;
};
const Context = createContext<Store | null>(null);
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/data", { cache: "no-store" });
      const text = await r.text();
      const value = text ? JSON.parse(text) : {};
      if (r.status === 401) {
        setData(emptyData);
        setError("");
        return;
      }
      if (!r.ok) throw new Error(value.error);
      setData(value);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your journal.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  const mutate = useCallback(
    async (path: string, method: string, body?: unknown) => {
      const r = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await r.text();
      let value: Record<string, unknown> = {};
      if (text) {
        try {
          value = JSON.parse(text) as Record<string, unknown>;
        } catch {
          throw new Error(`The server returned an invalid response (${r.status}).`);
        }
      }
      if (!r.ok)
        throw new Error(
          typeof value.error === "string"
            ? value.error
            : `The server returned an empty response (${r.status}).`,
        );
      await refresh();
      return value;
    },
    [refresh],
  );
  return (
    <Context.Provider value={{ data, loading, error, refresh, mutate }}>
      {error && (
        <div className="global-error" role="alert">
          {error} <button onClick={() => void refresh()}>Retry</button>
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
export function useData() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing DataProvider");
  return context;
}
