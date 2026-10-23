export function profileProbe(response: { status: number; data?: { error?: { code?: unknown } } | null }): { available: boolean; note: string };
