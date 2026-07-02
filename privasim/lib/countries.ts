// ISO 3166-1 alpha-2 → display name for every country we commonly sell.
// Used by the chatbot (country detection), SEO metadata, and shop pages.

export const COUNTRY_NAMES: Record<string, string> = {
  AD: "Andorra", AE: "United Arab Emirates", AL: "Albania", AM: "Armenia",
  AR: "Argentina", AT: "Austria", AU: "Australia", AZ: "Azerbaijan",
  BA: "Bosnia and Herzegovina", BD: "Bangladesh", BE: "Belgium", BG: "Bulgaria",
  BH: "Bahrain", BR: "Brazil", CA: "Canada", CH: "Switzerland", CL: "Chile",
  CN: "China", CO: "Colombia", CR: "Costa Rica", CY: "Cyprus", CZ: "Czech Republic",
  DE: "Germany", DK: "Denmark", DO: "Dominican Republic", DZ: "Algeria",
  EC: "Ecuador", EE: "Estonia", EG: "Egypt", ES: "Spain", FI: "Finland",
  FR: "France", GB: "United Kingdom", GE: "Georgia", GR: "Greece",
  GT: "Guatemala", HK: "Hong Kong", HR: "Croatia", HU: "Hungary",
  ID: "Indonesia", IE: "Ireland", IL: "Israel", IN: "India", IS: "Iceland",
  IT: "Italy", JO: "Jordan", JP: "Japan", KE: "Kenya", KH: "Cambodia",
  KR: "South Korea", KW: "Kuwait", KZ: "Kazakhstan", LA: "Laos", LK: "Sri Lanka",
  LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MA: "Morocco", MC: "Monaco",
  MD: "Moldova", ME: "Montenegro", MK: "North Macedonia", MM: "Myanmar",
  MN: "Mongolia", MO: "Macau", MT: "Malta", MX: "Mexico", MY: "Malaysia",
  NG: "Nigeria", NL: "Netherlands", NO: "Norway", NP: "Nepal", NZ: "New Zealand",
  OM: "Oman", PA: "Panama", PE: "Peru", PH: "Philippines", PK: "Pakistan",
  PL: "Poland", PT: "Portugal", QA: "Qatar", RO: "Romania", RS: "Serbia",
  SA: "Saudi Arabia", SE: "Sweden", SG: "Singapore", SI: "Slovenia",
  SK: "Slovakia", TH: "Thailand", TN: "Tunisia", TR: "Turkey", TW: "Taiwan",
  TZ: "Tanzania", UA: "Ukraine", US: "United States", UY: "Uruguay",
  UZ: "Uzbekistan", VN: "Vietnam", ZA: "South Africa",
};

// Lowercased name/alias → ISO code, for free-text matching in the chatbot.
const ALIASES: Record<string, string> = {
  usa: "US", "united states": "US", america: "US", "u.s.": "US", "u.s.a.": "US",
  uk: "GB", "united kingdom": "GB", england: "GB", britain: "GB",
  uae: "AE", emirates: "AE", dubai: "AE",
  "south korea": "KR", korea: "KR",
  "czech republic": "CZ", czechia: "CZ",
  holland: "NL", "the netherlands": "NL",
  turkiye: "TR",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

// Find a country mentioned in free text. Returns ISO code or null.
export function detectCountry(text: string): string | null {
  const lower = ` ${text.toLowerCase().replace(/[^a-z\s.]/g, " ")} `;

  for (const [alias, code] of Object.entries(ALIASES)) {
    if (lower.includes(` ${alias} `) || lower.includes(` ${alias}?`)) return code;
  }
  for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
    if (lower.includes(` ${name.toLowerCase()} `)) return code;
  }
  // Bare ISO code as its own word ("esim for JP")
  const codeMatch = text.match(/\b([A-Z]{2})\b/);
  if (codeMatch && COUNTRY_NAMES[codeMatch[1]]) return codeMatch[1];

  return null;
}
