export type InternalAuthResult =
  | { headers: Record<string, string> }
  | { error: "missing" };

export function getInternalAuthHeaders(): InternalAuthResult {
  const internalKey = process.env.PTP_INTERNAL_KEY;
  const internalKeyPresent = Boolean(internalKey);
  console.info("internal key present: " + internalKeyPresent);
  if (!internalKey) {
    return { error: "missing" };
  }
  return {
    headers: {
      "X-PTP-Internal-Key": internalKey,
      "Authorization": `Bearer ${internalKey}`,
    },
  };
}