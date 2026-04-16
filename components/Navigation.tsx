'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';

// ── Icons ────────────────────────────────────────────────────

const Icon = {
  overview: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5"/>
      <rect x="14" y="3" width="7" height="5" rx="1.5"/>
      <rect x="14" y="12" width="7" height="9" rx="1.5"/>
      <rect x="3" y="16" width="7" height="5" rx="1.5"/>
    </svg>
  ),
  inventory: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  ),
  planner: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  ),
  poBudget: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
      <line x1="7" y1="15" x2="10" y2="15"/>
      <line x1="14" y1="15" x2="17" y2="15"/>
    </svg>
  ),
  forecast: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  smartEvents: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  cogs: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
      <path d="M22 12A10 10 0 0 0 12 2v10z"/>
    </svg>
  ),
  suppliers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1.5"/>
      <path d="M16 8h4l3 3v5h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="4" x2="14" y2="4"/>
      <line x1="10" y1="4" x2="3" y2="4"/>
      <line x1="21" y1="12" x2="12" y2="12"/>
      <line x1="8" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="20" x2="16" y2="20"/>
      <line x1="12" y1="20" x2="3" y2="20"/>
      <line x1="14" y1="2" x2="14" y2="6"/>
      <line x1="8" y1="10" x2="8" y2="14"/>
      <line x1="16" y1="18" x2="16" y2="22"/>
    </svg>
  ),
  bantuan: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="4"/>
      <line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/>
      <line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/>
      <line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/>
      <line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/>
    </svg>
  ),
};

// ── Nav groups ───────────────────────────────────────────────

const navGroups = [
  {
    label: null,
    items: [
      { href: '/', icon: Icon.overview, label: 'Overview' },
    ],
  },
  {
    label: 'Operasional',
    items: [
      { href: '/inventory',  icon: Icon.inventory,  label: 'Inventory Live' },
      { href: '/planner',    icon: Icon.planner,    label: 'Purchase Planner' },
      { href: '/po-budget',  icon: Icon.poBudget,   label: 'PO & Budget' },
    ],
  },
  {
    label: 'Analitik & Prediksi',
    items: [
      { href: '/forecast',      icon: Icon.forecast,      label: 'Forecast Stok' },
      { href: '/smart-events',  icon: Icon.smartEvents,   label: 'Smart Events' },
      { href: '/cogs',          icon: Icon.cogs,          label: 'COGS & Margin' },
    ],
  },
  {
    label: 'Manajemen',
    items: [
      { href: '/suppliers', icon: Icon.suppliers, label: 'Supplier Hub' },
      { href: '/settings',  icon: Icon.settings,  label: 'Settings' },
    ],
  },
  {
    label: 'Lainnya',
    items: [
      { href: '/bantuan', icon: Icon.bantuan, label: 'Bantuan' },
    ],
  },
];

// Mobile bottom nav — 5 primary items
const mobileItems = [
  { href: '/',          icon: Icon.overview,    label: 'Overview' },
  { href: '/inventory', icon: Icon.inventory,   label: 'Inventory' },
  { href: '/planner',   icon: Icon.planner,     label: 'Planner' },
  { href: '/forecast',  icon: Icon.forecast,    label: 'Forecast' },
  { href: '/po-budget', icon: Icon.poBudget,    label: 'PO & Budget' },
];

// ── Component ────────────────────────────────────────────────

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
        flexDirection: 'column',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 100,
      }} className="hidden md:flex">

        {/* Logo */}
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src="/logo.png"
              alt="Foodstocks"
              style={{ height: 36, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>PPIC Dashboard</div>
          </div>
        </div>

        {/* Nav groups */}
        <nav style={{ padding: '8px 8px', flex: 1, overflowY: 'auto' }}>
          {navGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: group.label ? 4 : 0 }}>
              {/* Category label */}
              {group.label && (
                <div style={{
                  padding: '10px 12px 4px',
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  letterSpacing: 0.7,
                  textTransform: 'uppercase',
                }}>
                  {group.label}
                </div>
              )}
              {/* Items */}
              {group.items.map(item => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '7.5px 12px',
                      marginBottom: 1,
                      borderRadius: 7,
                      textDecoration: 'none',
                      background: isActive ? '#FEF2F2' : 'transparent',
                      color: isActive ? '#D60001' : 'var(--text-secondary)',
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      transition: 'background 0.1s, color 0.1s',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
                  >
                    <span style={{
                      flexShrink: 0,
                      opacity: isActive ? 1 : 0.5,
                      display: 'flex', alignItems: 'center',
                    }}>
                      {item.icon}
                    </span>
                    <span style={{ letterSpacing: -0.1 }}>{item.label}</span>
                    {isActive && (
                      <span style={{
                        marginLeft: 'auto',
                        width: 5, height: 5, borderRadius: '50%',
                        background: '#D60001',
                        flexShrink: 0,
                      }} />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom: user + theme toggle + logout */}
        <div style={{ padding: '10px 12px 14px', borderTop: '1px solid var(--border)' }}>
          {/* Jubelio status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#10B981', boxShadow: '0 0 0 2px rgba(16,185,129,0.2)',
            }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jubelio terhubung</span>
          </div>

          {/* User row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'linear-gradient(135deg, #D60001 0%, #FF3B3B 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 10 }}>FS</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Foodstocks</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Admin</div>
            </div>
            {/* Theme toggle */}
            <button
              onClick={toggle}
              title={theme === 'light' ? 'Dark mode' : 'Light mode'}
              style={{
                background: 'none', border: 'none', padding: '4px 5px', borderRadius: 6,
                color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {theme === 'light' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              )}
            </button>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 10px', borderRadius: 7,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2';
              (e.currentTarget as HTMLButtonElement).style.color = '#D60001';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#FCA5A5';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
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
              transition: 'color 0.1s',
            }}>
              <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.5 }}>{item.icon}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 60, textOverflow: 'ellipsis' }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
