import { useMemo, useSyncExternalStore } from "react";
import { parseDatum } from "@/lib/registration";

const keinAbo = () => () => {};

function heuteAlsIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Das heutige Datum im Browser. Beim Prerender leer bzw. null, danach das echte Datum. */
export function useHeute(): { iso: string; datum: Date | null } {
  const iso = useSyncExternalStore(keinAbo, heuteAlsIso, () => "");
  const datum = useMemo(() => (iso ? parseDatum(iso) : null), [iso]);
  return { iso, datum };
}
