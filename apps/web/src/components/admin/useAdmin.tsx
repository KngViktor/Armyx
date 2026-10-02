'use client';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import type { AdminRole } from '@armyx/shared';
import { api, ApiError } from '@/lib/api';

export interface AdminMe { id: string; email: string; role: AdminRole }
const Ctx = createContext<AdminMe | null>(null);
export const useAdmin = () => useContext(Ctx);

/** Role helper mirroring the API's rules (the API remains the authority). */
export const can = (me: AdminMe | null, ...roles: AdminRole[]) => !!me && (me.role === 'super_admin' || roles.includes(me.role));

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);
  useEffect(() => {
    api<AdminMe>('/admin/auth/me').then(setMe).catch((e) => {
      if (e instanceof ApiError && e.status === 401) router.replace('/admin/login');
    });
  }, [router]);
  if (!me) return <div className="p-10 text-muted" aria-live="polite">Checking your session…</div>;
  return <Ctx.Provider value={me}>{children}</Ctx.Provider>;
}
