// Deployment preflight. Validates that every secret/service the checkout path
// depends on is configured, and turns the result into an actionable message.
//
// Nothing in here ever logs or returns a secret value — only whether the
// variable is present and well-formed.

export interface ConfigIssue {
  key: string;
  message: string;
  /** True when the variable is only needed for a specific payment method. */
  scope?: "monero" | "ethereum" | "usdt_eth" | "topup";
}

const MIN_SECRET_LENGTH = 32;

function secretIssue(key: string, min = MIN_SECRET_LENGTH): ConfigIssue | null {
  const value = process.env[key];
  if (!value || !value.trim()) return { key, message: `${key} is not set` };
  if (value.trim().length < min) {
    return { key, message: `${key} must be at least ${min} characters` };
  }
  return null;
}

export function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

export function isValidMoneroAddress(addr: string): boolean {
  return /^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}([1-9A-HJ-NP-Za-km-z]{11})?$/.test(addr.trim());
}

export function isEncryptionKeyValid(): boolean {
  const configured = process.env.DB_ENCRYPTION_KEY?.trim();
  if (!configured) return false;
  let length: number;
  if (/^[a-fA-F0-9]{64}$/.test(configured)) {
    length = 32;
  } else if (configured.startsWith("base64:")) {
    length = Buffer.from(configured.slice("base64:".length), "base64").length;
  } else {
    length = Buffer.byteLength(configured, "utf8");
  }
  return length === 32;
}

/**
 * Static environment validation. Cheap, side-effect free, safe to call on every
 * request that touches money.
 */
export function checkConfig(scope: { cryptoType?: string; topup?: boolean } = {}): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  if (!process.env.DATABASE_URL?.trim()) {
    issues.push({ key: "DATABASE_URL", message: "DATABASE_URL is not set" });
  }

  // These are secrets we generate ourselves, so they must be long and random.
  for (const key of ["JWT_SECRET", "PAYMENT_HASH_SECRET", "DB_ENCRYPTION_KEY"]) {
    const issue = secretIssue(key);
    if (issue) issues.push(issue);
  }

  // Supplier keys are issued by the provider and may be any length — only
  // require that one is present.
  if (!process.env.PIKASIM_API_KEY?.trim()) {
    issues.push({ key: "PIKASIM_API_KEY", message: "PIKASIM_API_KEY is not set" });
  }

  if (process.env.DB_ENCRYPTION_KEY?.trim() && !isEncryptionKeyValid()) {
    issues.push({
      key: "DB_ENCRYPTION_KEY",
      message: "DB_ENCRYPTION_KEY must encode exactly 32 bytes (64 hex chars or base64:<32-byte key>)",
    });
  }

  const cryptoType = scope.cryptoType;
  if (cryptoType === "ethereum" || cryptoType === "usdt_eth") {
    const address = process.env.ETHEREUM_WALLET_ADDRESS?.trim();
    if (!address) {
      issues.push({ key: "ETHEREUM_WALLET_ADDRESS", message: "ETHEREUM_WALLET_ADDRESS is not set", scope: cryptoType });
    } else if (!isValidEthAddress(address)) {
      issues.push({ key: "ETHEREUM_WALLET_ADDRESS", message: "ETHEREUM_WALLET_ADDRESS is not a valid address", scope: cryptoType });
    }
  }

  if (cryptoType === "monero") {
    const address = process.env.MONERO_WALLET_PRIMARY?.trim();
    if (!address) {
      issues.push({ key: "MONERO_WALLET_PRIMARY", message: "MONERO_WALLET_PRIMARY is not set", scope: "monero" });
    } else if (!isValidMoneroAddress(address)) {
      issues.push({ key: "MONERO_WALLET_PRIMARY", message: "MONERO_WALLET_PRIMARY is not a valid mainnet address", scope: "monero" });
    }
  }

  if (scope.topup && !process.env.DB_ENCRYPTION_KEY?.trim()) {
    // Already reported above; kept explicit because top-up ICCIDs are encrypted.
    issues.push({ key: "DB_ENCRYPTION_KEY", message: "DB_ENCRYPTION_KEY is required to store top-up ICCIDs", scope: "topup" });
  }

  return issues;
}

/** Optional-but-recommended settings that degrade service when missing. */
export function checkOptionalConfig(): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  for (const key of ["COUPON_SIGNING_SECRET", "ADMIN_API_KEY", "CRON_SECRET"]) {
    const issue = secretIssue(key);
    if (issue) issues.push(issue);
  }
  for (const key of ["MONERO_WALLET_RPC_URL", "MONERO_WALLET_RPC_USER", "MONERO_WALLET_RPC_PASSWORD"]) {
    if (!process.env[key]?.trim()) {
      issues.push({ key, message: `${key} is not set — Monero invoices fall back to the static wallet address` });
    }
  }
  if (!process.env.ETHEREUM_RPC_URL?.trim()) {
    issues.push({
      key: "ETHEREUM_RPC_URL",
      message: "ETHEREUM_RPC_URL is not set — ETH/USDT verification relies on public RPC fallbacks",
    });
  }
  return issues;
}

/** Throws when the database cannot answer a trivial query. */
export async function assertDatabaseReachable(): Promise<void> {
  const { isDatabaseConfigured } = await import("@/lib/db");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured");
  }
  const sql = (await import("@/lib/db")).getDatabase();
  await sql`SELECT 1`;
}

export function summarizeIssues(issues: ConfigIssue[]): string {
  return issues.map((issue) => `${issue.key}: ${issue.message}`).join("; ");
}
