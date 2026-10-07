// Durable server-side key/value settings and coupon metadata stored in PostgreSQL.
// Payment replay protection lives in payment_claims and is enforced transactionally
// by lib/db.ts; this module is never used as a security fallback or in-memory store.

import { getDatabase, isDatabaseConfigured } from "@/lib/db";

export function ledgerPersistent(): boolean {
  return isDatabaseConfigured();
}

export async function ledgerGet<T>(key: string): Promise<T | null> {
  const rows = await getDatabase()<{ value: T }[]>`
    SELECT value FROM app_kv WHERE key = ${key} LIMIT 1
  `;
  return rows[0]?.value ?? null;
}

export async function ledgerSet(key: string, value: unknown): Promise<boolean> {
  const rows = await getDatabase()<{ key: string }[]>`
    INSERT INTO app_kv (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    RETURNING key
  `;
  return rows.length === 1;
}

export async function ledgerDelete(key: string): Promise<boolean> {
  const rows = await getDatabase()<{ key: string }[]>`
    DELETE FROM app_kv WHERE key = ${key} RETURNING key
  `;
  return rows.length === 1;
}

export async function ledgerList(prefix: string): Promise<Record<string, unknown>> {
  const rows = await getDatabase()<{ key: string; value: unknown }[]>`
    SELECT key, value FROM app_kv
    WHERE left(key, length(${prefix})) = ${prefix}
    ORDER BY key
    LIMIT 1000
  `;
  return Object.fromEntries(rows.map(({ key, value }) => [key, value]));
}

export interface CouponState {
  uses: number;
  maxUses: number; // 0 = unlimited
  revoked: boolean;
}

export async function getCouponStateRecord(code: string): Promise<CouponState | null> {
  return ledgerGet<CouponState>(`cpn_${code.toUpperCase()}`);
}

export async function getCouponState(code: string): Promise<CouponState> {
  return (await getCouponStateRecord(code)) ?? { uses: 0, maxUses: 0, revoked: false };
}

export async function setCouponState(code: string, state: CouponState): Promise<boolean> {
  return ledgerSet(`cpn_${code.toUpperCase()}`, state);
}
