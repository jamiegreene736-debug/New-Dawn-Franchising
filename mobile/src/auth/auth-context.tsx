import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { runtimeConfig } from '@/config/runtime';
import {
  mobileAuthClient,
  type AuthenticatedSession,
  type MobileAccount,
  type MobileLocale,
  type MobileRole,
  type InvestorPathway,
  type VerificationResponse,
} from '@/services/auth-client';
import { clearStoredSession, readStoredSession, writeStoredSession } from '@/services/session-store';
import { usePrototype } from '@/prototype/prototype-context';

type AuthState = {
  ready: boolean;
  account: MobileAccount | null;
  accessToken: string | null;
  pendingVerificationToken: string;
  register: (input: { email: string; password: string; role: MobileRole; locale: MobileLocale }) => Promise<void>;
  verifyEmail: (token: string) => Promise<VerificationResponse['status']>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestDeletion: () => Promise<void>;
  loadInvestorPath: () => Promise<InvestorPathway>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const { setRole } = usePrototype();
  const [ready, setReady] = useState(runtimeConfig.mode === 'prototype');
  const [account, setAccount] = useState<MobileAccount | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [pendingVerificationToken, setPendingVerificationToken] = useState('');

  const adoptSession = useCallback(async (session: AuthenticatedSession) => {
    setRole(session.account.roles.includes('partner') ? 'partner' : 'investor');
    setAccount(session.account);
    setAccessToken(session.accessToken);
    setRefreshToken(session.refreshToken);
    await writeStoredSession({ account: session.account, refreshToken: session.refreshToken });
  }, [setRole]);

  useEffect(() => {
    if (!mobileAuthClient) return;
    let active = true;
    void (async () => {
      try {
        const stored = await readStoredSession();
        if (!stored) return;
        const session = await mobileAuthClient.refresh(stored.refreshToken);
        if (active) await adoptSession(session);
      } catch {
        await clearStoredSession();
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, [adoptSession]);

  const value = useMemo<AuthState>(() => ({
    ready,
    account,
    accessToken,
    pendingVerificationToken,
    register: async (input) => {
      if (!mobileAuthClient) throw new Error('Registration is unavailable in prototype mode.');
      const result = await mobileAuthClient.register(input);
      setPendingVerificationToken(result.testToken ?? '');
    },
    verifyEmail: async (token) => {
      if (!mobileAuthClient) throw new Error('Verification is unavailable in prototype mode.');
      const result = await mobileAuthClient.verifyEmail({ token, deviceLabel: 'iPhone pilot' });
      setPendingVerificationToken('');
      if (result.status === 'authenticated') await adoptSession(result);
      return result.status;
    },
    signIn: async (email, password) => {
      if (!mobileAuthClient) throw new Error('Sign in is unavailable in prototype mode.');
      await adoptSession(await mobileAuthClient.login({ email, password, deviceLabel: 'iPhone pilot' }));
    },
    signOut: async () => {
      const token = refreshToken;
      setAccount(null);
      setAccessToken(null);
      setRefreshToken(null);
      await clearStoredSession();
      if (token && mobileAuthClient) {
        try { await mobileAuthClient.logout(token); } catch { /* Local sign-out remains authoritative. */ }
      }
    },
    requestDeletion: async () => {
      if (!mobileAuthClient || !refreshToken) throw new Error('Please sign in again.');
      const current = await mobileAuthClient.refresh(refreshToken);
      await adoptSession(current);
      await mobileAuthClient.requestDeletion(current.accessToken);
      setAccount(null);
      setAccessToken(null);
      setRefreshToken(null);
      await clearStoredSession();
    },
    loadInvestorPath: async () => {
      if (!mobileAuthClient || !accessToken) throw new Error('Please sign in again.');
      return mobileAuthClient.getInvestorPath(accessToken);
    },
  }), [accessToken, account, pendingVerificationToken, ready, refreshToken, adoptSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
