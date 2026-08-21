import type { AuthChangeEvent, Session, SupabaseClient, Subscription } from '@supabase/supabase-js'

import { getSupabaseClient } from '../../shared/api/supabase'
import type { Database } from '../../shared/types/database.generated'

export type AuthStatus = 'anonymous' | 'authenticated' | 'error' | 'idle' | 'initializing'
export type AuthSessionListener = (session: Session | null, event: AuthChangeEvent) => void
export type ProtectedStateReset = () => void
export type AuthStoreListener = () => void

export interface AuthSessionReader {
  readonly epoch: number
  getAccessToken(): Promise<string>
  handleUnauthorized(): void
  onSessionChange(listener: AuthSessionListener): () => void
}

export class AuthSessionError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'AuthSessionError'
  }
}

export class AuthSessionManager implements AuthSessionReader {
  private client: SupabaseClient<Database> | undefined
  private exchangePromises = new Map<string, Promise<void>>()
  private initPromise: Promise<void> | undefined
  private listeners = new Set<AuthSessionListener>()
  private protectedStateResets = new Set<ProtectedStateReset>()
  private revision = 0
  private storeListeners = new Set<AuthStoreListener>()
  private subscription: Subscription | undefined
  private currentSession: Session | null = null
  private currentStatus: AuthStatus = 'idle'

  constructor(private readonly clientFactory: () => SupabaseClient<Database> = getSupabaseClient) {}

  get epoch(): number {
    return this.revision
  }

  get session(): Session | null {
    return this.currentSession
  }

  get status(): AuthStatus {
    return this.currentStatus
  }

  subscribe(listener: AuthStoreListener): () => void {
    this.storeListeners.add(listener)
    return () => {
      this.storeListeners.delete(listener)
    }
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.currentStatus = 'initializing'
    this.notifyStore()
    this.initPromise = this.initializeOnce().catch((error: unknown) => {
      // A transient restore failure must not poison every later navigation in this page lifetime.
      this.initPromise = undefined
      throw error
    })
    return this.initPromise
  }

  async signInWithGoogle(): Promise<void> {
    const callbackUrl = new URL('/auth/callback', window.location.origin).toString()
    const { error } = await this.getClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    })

    if (error) {
      throw new AuthSessionError('oauth_start_failed')
    }
  }

  async completeOAuthCallback(code: string): Promise<void> {
    const normalizedCode = code.trim()

    if (!normalizedCode) {
      throw new AuthSessionError('oauth_code_missing')
    }

    const existing = this.exchangePromises.get(normalizedCode)
    if (existing) {
      // StrictMode remounts must await the same in-flight / completed exchange.
      return existing
    }

    const exchangePromise = this.exchangeCodeOnce(normalizedCode)
    this.exchangePromises.set(normalizedCode, exchangePromise)
    await exchangePromise
  }

  private async exchangeCodeOnce(normalizedCode: string): Promise<void> {
    // Keep the code marked for this page lifetime so a remount cannot exchange it twice.
    const startRevision = this.revision
    const { data, error } = await this.getClient().auth.exchangeCodeForSession(normalizedCode)

    if (error || !data.session) {
      throw new AuthSessionError('oauth_exchange_failed')
    }

    if (this.revision === startRevision) {
      this.applySession(data.session, 'SIGNED_IN')
    }
  }

  async signOut(): Promise<void> {
    const client = this.getClient()

    // Fail closed before the network-backed revocation finishes.
    this.applySession(null, 'SIGNED_OUT')

    const { error } = await client.auth.signOut({ scope: 'local' })

    if (error) {
      throw new AuthSessionError('logout_failed')
    }
  }

  async getAccessToken(): Promise<string> {
    await this.initialize()

    if (this.currentStatus === 'error') {
      throw new AuthSessionError('session_unavailable')
    }

    const requestRevision = this.revision
    const { data, error } = await this.getClient().auth.getSession()

    const currentToken = this.currentSession?.access_token
    const authChangedToAnotherSession =
      requestRevision !== this.revision && currentToken !== data.session?.access_token

    if (error || !data.session || authChangedToAnotherSession) {
      throw new AuthSessionError('authentication_required')
    }

    if (this.currentSession?.access_token !== data.session.access_token) {
      this.applySession(data.session, 'TOKEN_REFRESHED')
    }

    return data.session.access_token
  }

  handleUnauthorized(): void {
    if (!this.currentSession) {
      return
    }

    this.applySession(null, 'SIGNED_OUT')
    void this.getClient()
      .auth.signOut({ scope: 'local' })
      .catch(() => undefined)
  }

  onSessionChange(listener: AuthSessionListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  registerProtectedStateReset(reset: ProtectedStateReset): () => void {
    this.protectedStateResets.add(reset)
    return () => {
      this.protectedStateResets.delete(reset)
    }
  }

  destroy(): void {
    this.subscription?.unsubscribe()
    this.subscription = undefined
    this.listeners.clear()
    this.protectedStateResets.clear()
    this.storeListeners.clear()
  }

  private async initializeOnce(): Promise<void> {
    try {
      const client = this.getClient()
      this.subscribeToAuthChanges(client)
      const startRevision = this.revision
      const { data, error } = await client.auth.getSession()

      if (error) {
        throw error
      }

      if (this.revision === startRevision) {
        this.applySession(data.session, 'INITIAL_SESSION')
      }
    } catch {
      this.applySession(null, 'SIGNED_OUT')
      this.currentStatus = 'error'
      this.notifyStore()
      throw new AuthSessionError('session_restore_failed')
    }
  }

  private subscribeToAuthChanges(client: SupabaseClient<Database>): void {
    if (this.subscription) {
      return
    }

    const { data } = client.auth.onAuthStateChange((event, session) => {
      // Supabase warns against awaiting another auth call from this callback.
      this.applySession(session, event)
    })

    this.subscription = data.subscription
  }

  private applySession(session: Session | null, event: AuthChangeEvent): void {
    const hadSession = Boolean(this.currentSession)
    this.revision += 1
    this.currentSession = session
    this.currentStatus = session ? 'authenticated' : 'anonymous'
    this.notifyStore()

    if (hadSession && !session) {
      for (const reset of this.protectedStateResets) {
        reset()
      }
    }

    for (const listener of this.listeners) {
      listener(session, event)
    }
  }

  private notifyStore(): void {
    for (const listener of this.storeListeners) {
      listener()
    }
  }

  private getClient(): SupabaseClient<Database> {
    this.client ??= this.clientFactory()
    return this.client
  }
}

export const authSession = new AuthSessionManager()
