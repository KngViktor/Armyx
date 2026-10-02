'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { BarChart3, ClipboardList, FileDown, LogOut, Menu, ScrollText, Settings2, Users, X } from 'lucide-react';
import { ROLE_LABELS, type AdminRole } from '@armyx/shared';
import { api } from '@/lib/api';
import { AdminProvider, can, useAdmin } from './useAdmin';
import { QueueBanner } from '@/components/ui/QueueBanner';

const NAV: { href: string; label: string; Icon: typeof BarChart3; roles: AdminRole[] }[] = [
  { href: '/admin', label: 'Dashboard', Icon: BarChart3, roles: ['recruitment_officer', 'reviewer', 'viewer'] },
  { href: '/admin/applicants', label: 'Applicants', Icon: ClipboardList, roles: ['recruitment_officer', 'reviewer', 'viewer'] },
  { href: '/admin/exercises', label: 'Exercises & centres', Icon: Settings2, roles: ['recruitment_officer', 'reviewer', 'viewer'] },
  { href: '/admin/exports', label: 'Exports', Icon: FileDown, roles: ['recruitment_officer'] },
  { href: '/admin/audit', label: 'Audit log', Icon: ScrollText, roles: [] },
  { href: '/admin/users', label: 'Admin users', Icon: Users, roles: [] },
];

function Shell({ children }: { children: React.ReactNode }) {
  const me = useAdmin()!;
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const logout = async () => {
    await api('/admin/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/admin/login');
  };
  const nav = (
    <ul className="space-y-1">
      {NAV.filter((n) => can(me, ...n.roles)).map(({ href, label, Icon }) => {
        const active = href === '/admin' ? path === '/admin' : path.startsWith(href);
        return (
          <li key={href}>
            <Link href={href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${active ? 'bg-gold-500 font-semibold text-olive-950' : 'text-khaki-100 hover:bg-white/10'}`}>
              <Icon aria-hidden className="h-5 w-5" />{label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
  return (
    <div className="flex min-h-dvh bg-sand">
      <aside className="hidden w-64 shrink-0 flex-col bg-olive-900 p-4 text-white lg:flex">
        <Link href="/admin" className="mb-8 flex items-center gap-3 px-2">
          <Image src="/images/crest.png" alt="" width={40} height={40} className="h-10 w-10 rounded-full" />
          <span className="leading-tight"><span className="block font-serif font-bold">NIGERIAN ARMY</span><span className="text-xs text-gold-300">Recruitment admin</span></span>
        </Link>
        <nav aria-label="Admin">{nav}</nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-olive-100 bg-white px-4 py-3 sm:px-6">
          <button className="rounded-md p-2 lg:hidden" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}><Menu aria-hidden /></button>
          <p className="truncate text-sm text-muted">Signed in as <strong className="text-ink">{me.email}</strong> · <span className="badge bg-olive-50 text-olive-800">{ROLE_LABELS[me.role]}</span></p>
          <button onClick={logout} className="btn-outline min-h-9 px-3 py-1.5"><LogOut aria-hidden className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></button>
        </header>
        {open && (
          <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setOpen(false)}>
            <div className="h-full w-72 bg-olive-900 p-4" onClick={(e) => e.stopPropagation()}>
              <button className="mb-6 rounded-md p-2 text-white" aria-label="Close navigation" onClick={() => setOpen(false)}><X aria-hidden /></button>
              <nav aria-label="Admin mobile">{nav}</nav>
            </div>
          </div>
        )}
        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <QueueBanner />
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <AdminProvider><Shell>{children}</Shell></AdminProvider>;
}
