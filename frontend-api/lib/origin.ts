const allowedOrigins = new Set([
  "https://powertunepro.com",
  "https://www.powertunepro.com",
  "https://ptp-calculators.vercel.app",
  "http://localhost:3000",
]);

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return allowedOrigins.has(origin);
}

export function isAllowedHost(host: string | string[] | undefined): boolean {
  const value = Array.isArray(host) ? host[0] : host;
  if (!value) return false;
  return value === "ptp-calculators.vercel.app" || value.startsWith("localhost:");
}