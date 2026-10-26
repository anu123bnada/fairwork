// Filters the offers already loaded on the saved-offers screen. It never asks the server, so it cannot find offers that are not loaded yet.
type Item = { role: string | null; decision?: string };
export function filterOffers<T extends Item>(items: readonly T[], query: string, decision: string): T[] {
  const needle = query.normalize("NFKC").trim().toLocaleLowerCase();
  return items.filter(item => (!needle || (item.role ?? "").normalize("NFKC").toLocaleLowerCase().includes(needle)) && (decision === "all" || (item.decision ?? "considering") === decision));
}
