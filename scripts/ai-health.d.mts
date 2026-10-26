export type ProviderEntry = { provider: string; role: string; key?: string; model?: string; baseUrl?: string };
export type ProbeResult = { provider: string; role: string; model: string | null; verdict: string; detail?: string };
export function providersFromEnv(env: Record<string, string | undefined>): ProviderEntry[];
export function probeProvider(entry: ProviderEntry, fetcher?: typeof fetch): Promise<ProbeResult>;
export function probeAll(env: Record<string, string | undefined>, fetcher?: typeof fetch): Promise<ProbeResult[]>;
