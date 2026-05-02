export interface NavOutcome {
  status: number;
  finalUrl: string;
}

export function detectAuthExpiry(outcome: NavOutcome, loginUrl: string): boolean {
  if (outcome.status === 401 || outcome.status === 403) return true;
  try {
    const finalPath = new URL(outcome.finalUrl).pathname;
    return finalPath === loginUrl;
  } catch {
    return outcome.finalUrl.endsWith(loginUrl);
  }
}
