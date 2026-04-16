'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';

const navItems = [
  { href: '/', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>), label: 'Overview' },
  { href: '/planner', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
    </svg>), label: 'Purchase Planner' },
  { href: '/inventory', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>), label: 'Inventory Live' },
  { href: '/forecast', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>), label: 'Forecast Stok' },
  { href: '/cogs', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>), label: 'COGS & Margin' },
  { href: '/suppliers', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>), label: 'Supplier Hub' },
  { href: '/po-budget', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>), label: 'PO & Budget' },
  { href: '/settings', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>), label: 'Settings' },
  { href: '/smart-events', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>), label: 'Smart Events' },
  { href: '/bantuan', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>), label: 'Bantuan' },
];

// Mobile bottom nav — 5 primary items
const mobileItems = navItems.slice(0, 5);

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();

  const handleLogout = () => {
    localStorage.removeItem('foodstocks_auth');
    router.push('/login');
  };

  if (pathname === '/login') return null;

  return (
    <>
      {/* ── Sidebar — desktop ─────────────────────────── */}
      <aside style={{
        width: 228,
        minHeight: '100vh',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        flexDirection: 'column',  /* display handled by Tailwind hidden/md:flex */
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 100,
      }} className="hidden md:flex">

        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#D60001',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '0 2px 8px rgba(214,0,1,0.3)',
            }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: 14, letterSpacing: -0.5 }}>FS</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.2 }}>Foodstocks</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>PPIC Dashboard</div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ padding: '10px 8px', flex: 1, overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                marginBottom: 2,
                borderRadius: 8,
                textDecoration: 'none',
                background: isActive ? '#FEF2F2' : 'transparent',
                borderLeft: isActive ? '3px solid #D60001' : '3px solid transparent',
                color: isActive ? '#D60001' : 'var(--text-secondary)',
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
              >
                <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.65 }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: user + theme toggle + logout */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          {/* Jubelio status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 5px #10B981' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jubelio terhubung</span>
          </div>

          {/* User row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: '#D60001',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 11 }}>FS</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Foodstocks</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Admin</div>
            </div>
            {/* Theme toggle icon */}
            <button onClick={toggle} title={theme === 'light' ? 'Dark mode' : 'Light mode'} style={{
              background: 'none', border: 'none', padding: 4, borderRadius: 6,
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1,
              display: 'flex', alignItems: 'center',
            }}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>

          {/* Logout */}
          <button onClick={handleLogout} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 10px', borderRadius: 7,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-red)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Keluar
          </button>
        </div>
      </aside>

      {/* ── Bottom nav — mobile ────────────────────────── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        /* display handled by Tailwind flex/md:hidden */
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }} className="flex md:hidden">
        {mobileItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '10px 4px 8px',
              textDecoration: 'none',
              color: isActive ? '#D60001' : 'var(--text-muted)',
              fontSize: 10, fontWeight: isActive ? 600 : 400,
              borderTop: isActive ? '2px solid #D60001' : '2px solid transparent',
              transition: 'color 0.12s',
            }}>
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 60, textOverflow: 'ellipsis' }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
