import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const SECRET      = new TextEncoder().encode(process.env.JWT_SECRET || 'sitesutra-fallback-dev-secret-32ch')
const COOKIE_NAME = 'sitesutra_session'

export interface SessionPayload {
  userId: string
  email:  string
  role:   'ADMIN' | 'SUPERVISOR'
  name:   string
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(SECRET)

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7,
    path:     '/',
  })
  return token
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function requireSession(): Promise<SessionPayload | null> {
  return getSession()
}

export async function requireAdmin(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') return null
  return session
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
