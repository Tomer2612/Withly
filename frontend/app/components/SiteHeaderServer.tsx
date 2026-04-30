import { cookies } from 'next/headers';
import SiteHeader from './SiteHeader';

interface JwtPayload {
  email?: string;
  sub?: string;
  exp?: number;
}

interface SiteHeaderServerProps {
  hideNavLinks?: boolean;
  hideAuthButtons?: boolean;
}

// Decode the JWT payload without verifying the signature. The API still
// verifies on every request — this decode is purely so SSR can pick the
// right initial UI for SiteHeader and avoid the auth-state flicker.
function decodeJwt(token: string): JwtPayload | null {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    const json = Buffer.from(payloadBase64, 'base64').toString('utf-8');
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export default async function SiteHeaderServer(props: SiteHeaderServerProps) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  let initialUser: { email: string; userId: string } | null = null;
  if (accessToken) {
    const payload = decodeJwt(accessToken);
    // Only treat the cookie as logged-in if the JWT is structurally valid
    // and not expired. A signature-invalid token will be rejected by the
    // API on the next request anyway, but we don't want SSR to misrender.
    if (
      payload?.email &&
      payload.sub &&
      payload.exp &&
      payload.exp * 1000 > Date.now()
    ) {
      initialUser = { email: payload.email, userId: payload.sub };
    }
  }
  return <SiteHeader {...props} initialUser={initialUser} />;
}
