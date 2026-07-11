export type WalletType = "monero" | "ethereum";

export type CryptoType = "monero" | "ethereum" | "usdt_eth";

export type OrderStatus = "pending" | "completed" | "activated" | "expired" | "cancelled";

export type InvoiceStatus = "pending" | "confirmed" | "expired" | "failed";

export type ProductType = "data" | "phone";

export interface EsimPackage {
  code: string;
  name: string;
  country: string;
  countryCode: string;
  dataAmount: string;
  durationDays: number;
  priceUsd: number;
  /** Server-computed display price using the live owner-set margin.
   *  Present on API responses; display-only (invoice price is authoritative). */
  retailUsd?: number;
  type: ProductType;
  networks: string[];
  smsSupported?: boolean;
  voiceSupported?: boolean;
  topupAllowed?: boolean;
}

export interface CountryCoverage {
  code: string;
  name: string;
  flagEmoji: string;
  dataEsims: {
    count: number;
    priceRangeMin: number;
    priceRangeMax: number;
  };
  phoneEsims: {
    count: number;
    priceRangeMin: number;
    priceRangeMax: number;
  };
}

export interface CryptoInvoice {
  id: string;
  invoiceId: string;
  amountUsd: number;
  amountCrypto: number;
  cryptoType: CryptoType;
  paymentAddress: string;
  qrCode: string;
  paymentUrl: string;
  status: InvoiceStatus;
  expiresAt: string;
  createdAt: string;
}

export interface Order {
  id: string;
  packageCode: string;
  packageName: string;
  country: string;
  dataAmount: string;
  durationDays: number;
  status: OrderStatus;
  costUsd: number;
  costCrypto: number;
  cryptoType: CryptoType;
  dataUsedGb: number;
  dataRemainingGb: number;
  expiresAt: string;
  activatedAt: string | null;
  createdAt: string;
}

export interface OrderDecrypted {
  iccid: string;
  activationCode: string;
  smDpAddress: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  publishedAt: string;
  featured: boolean;
}

export interface AuthChallenge {
  challenge: string;
  expiresAt: string;
}

export interface AuthToken {
  jwt: string;
  expiresIn: number;
}

export interface CryptoPrices {
  xmr: number;
  eth: number;
  updatedAt: number;
}

export interface JWTPayload {
  walletHash: string;
  walletType: WalletType;
  iat: number;
  exp: number;
}

export interface PikaSimPackage {
  packageCode: string;
  // Name fields
  name?: string;
  packageName?: string;
  // Location fields (API may use either form)
  location?: string;
  locationCode?: string;
  destination?: string;
  destinationCode?: string;
  // Data fields
  volumeGB?: number;
  volume?: number;
  data?: string;
  isUnlimited?: boolean;
  // Duration
  duration?: number;
  validityDays?: number;
  durationUnit?: string;
  // Type — REST returns NUMERIC dataType (1 = data eSIM); older/MCP shapes
  // use the strings "data"/"phone".
  dataType?: string | number;
  type?: string;
  // Price
  priceUSD?: number;
  priceUsd?: number;
  price?: number;
  priceFormatted?: string;
  currencyCode?: string;
  // Features
  networks?: string[];
  sms?: boolean;
  voice?: boolean;
  topup?: boolean;
  slug?: string;
}

export interface PikaSimPurchaseResult {
  orderId: string;
  iccid: string;
  activationCode: string;
  smDpAddress: string;
  status: string;
  qrCodeUrl?: string;
}
