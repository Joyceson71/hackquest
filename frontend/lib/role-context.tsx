'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type UserRole = 'admin' | 'employee' | null;

interface RoleContextValue {
  role: UserRole;
  userEmail: string | null;
  userName: string | null;
  setRole: (role: UserRole) => void;
  setUserEmail: (email: string | null) => void;
  setUserName: (name: string | null) => void;
  clearRole: () => void;
}

const RoleContext = createContext<RoleContextValue>({
  role: null,
  userEmail: null,
  userName: null,
  setRole: () => {},
  setUserEmail: () => {},
  setUserName: () => {},
  clearRole: () => {},
});

const ROLE_STORAGE_KEY = 'meetingcompiler_user_role';
const EMAIL_STORAGE_KEY = 'meetingcompiler_user_email';
const NAME_STORAGE_KEY = 'meetingcompiler_user_name';

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = localStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(null);
  const [userEmail, setUserEmailState] = useState<string | null>(null);
  const [userName, setUserNameState] = useState<string | null>(null);

  // Hydrate from localStorage only on client to prevent hydration mismatch
  useEffect(() => {
    setRoleState(loadFromStorage<UserRole>(ROLE_STORAGE_KEY, null));
    setUserEmailState(loadFromStorage<string | null>(EMAIL_STORAGE_KEY, null));
    setUserNameState(loadFromStorage<string | null>(NAME_STORAGE_KEY, null));
  }, []);

  const setRole = useCallback((r: UserRole) => {
    setRoleState(r);
    if (r) {
      localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(r));
    } else {
      localStorage.removeItem(ROLE_STORAGE_KEY);
    }
  }, []);

  const setUserEmail = useCallback((email: string | null) => {
    setUserEmailState(email);
    if (email) {
      localStorage.setItem(EMAIL_STORAGE_KEY, JSON.stringify(email));
    } else {
      localStorage.removeItem(EMAIL_STORAGE_KEY);
    }
  }, []);

  const setUserName = useCallback((name: string | null) => {
    setUserNameState(name);
    if (name) {
      localStorage.setItem(NAME_STORAGE_KEY, JSON.stringify(name));
    } else {
      localStorage.removeItem(NAME_STORAGE_KEY);
    }
  }, []);

  const clearRole = useCallback(() => {
    setRoleState(null);
    setUserEmailState(null);
    setUserNameState(null);
    localStorage.removeItem(ROLE_STORAGE_KEY);
    localStorage.removeItem(EMAIL_STORAGE_KEY);
    localStorage.removeItem(NAME_STORAGE_KEY);
  }, []);

  return (
    <RoleContext.Provider value={{ role, userEmail, userName, setRole, setUserEmail, setUserName, clearRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}

/**
 * Determines if a given email belongs to an admin.
 * Checks NEXT_PUBLIC_ADMIN_EMAILS env var (comma-separated list).
 * Falls back to the role that was explicitly selected at login.
 */
export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length === 0) return false;
  return adminEmails.includes(email.toLowerCase());
}
