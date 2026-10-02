'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';

export interface Me { id: string; surname: string; firstName: string; email: string; phone: string; twoFactorEnabled: boolean }

/** Loads the signed-in applicant; redirects to login when there is no session. */
export function useApplicant() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const reload = useCallback(() => {
    api<Me>('/auth/me')
      .then(setMe)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace(`/portal/login?next=${encodeURIComponent(location.pathname)}`);
      });
  }, [router]);
  useEffect(reload, [reload]);
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/portal/login');
  };
  return { me, reload, logout };
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="container-x flex justify-center py-12 sm:py-16">
      <div className="card w-full max-w-lg overflow-hidden">
        <div className="border-b-4 border-gold-500 bg-olive-800 px-6 py-5 text-white sm:px-8">
          <h1 className="font-serif text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-khaki-100">{subtitle}</p>}
        </div>
        <div className="p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
