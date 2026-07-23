export function generateQrToken(sessionId: string, subjectId: string, facultyId: string): string {
  const payload = {
    sid: sessionId,
    sub: subjectId,
    fac: facultyId,
    ts: Date.now(),
    nonce: Math.random().toString(36).slice(2),
  };
  return btoa(JSON.stringify(payload));
}

export function decodeQrToken(token: string): { sid: string; sub: string; fac: string; ts: number; nonce: string } | null {
  try {
    const parsed = JSON.parse(atob(token));
    if (!parsed || typeof parsed.sid !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function generateManualCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() ?? '',
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory?.toString() ?? '',
  ];
  const fingerprint = components.join('|');
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    hash = ((hash << 5) - hash) + fingerprint.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function getClientIP(): string {
  return '0.0.0.0';
}
