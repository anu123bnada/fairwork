import type { Opportunity } from "./schema";

// Side-by-side comparison of saved listings (module 03). It shows what each listing states and marks the rows where they differ. It never converts
// currencies or pay periods and never ranks listings: pay in different currencies or periods is flagged as not directly comparable instead.
export const COMPARE_MAX = 4;
export type CompareRow = { field: "company" | "location" | "workMode" | "pay" | "expires"; values: (string | null)[]; differs: boolean };

export function payCell(item: Opportunity): { amount: number; currency: string; period: string } | null {
  return item.fields.salary === null ? null : { amount: item.fields.salary, currency: item.fields.currency, period: item.fields.payPeriod };
}
export function payComparable(items: readonly Opportunity[]): boolean {
  const pays = items.map(payCell).filter((pay): pay is NonNullable<ReturnType<typeof payCell>> => pay !== null);
  return pays.length < 2 || pays.every(pay => pay.currency === pays[0]!.currency && pay.period === pays[0]!.period);
}
export function compareListings(items: readonly Opportunity[], formatPay: (pay: NonNullable<ReturnType<typeof payCell>>) => string, formatDate: (iso: string) => string): CompareRow[] {
  const rows: Omit<CompareRow, "differs">[] = [
    { field: "company", values: items.map(item => item.companyName) },
    { field: "location", values: items.map(item => item.fields.location) },
    { field: "workMode", values: items.map(item => item.fields.workMode) },
    { field: "pay", values: items.map(item => { const pay = payCell(item); return pay ? formatPay(pay) : null; }) },
    { field: "expires", values: items.map(item => formatDate(item.expiresAt)) },
  ];
  return rows.map(row => ({ ...row, differs: new Set(row.values.map(value => (value ?? "").normalize("NFKC").trim().toLocaleLowerCase())).size > 1 }));
}
