'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';

const navItems = [
  { href: '/', icon: '📊', label: 'Overview' },
  { href: '/planner', icon: '🧠', label: 'Purchase Planner' },
  { href: '/inventory', icon: '📦', label: 'Inventory Live' },
  { href: '/forecast', icon: '📈', label: 'Forecast Stok' },
  { href: '/cogs', icon: '💹', label: 'COGS & Margin' },
  { href: '/suppliers', icon: '🏭', label: 'Supplier Hub' },
  { href: '/po-budget', icon: '📋', label: 'PO & Budget' },
  { href: '/settings', icon: '⚙️', label: 'Settings' },
  { href: '/bantuan', icon: '❓', label: 'Bantuan' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <>
      {/* Sidebar — desktop */}
      <aside style={{
        width: 220,
        minHeight: '100vh',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
      }} className="hidden md:flex">
        {/* Logo + Theme Toggle */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>🛒</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Foodstocks</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>WMS Dashboard</div>
            </div>
          </div>
          {/* Theme toggle — full width button */}
          <button onClick={toggle} style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '7px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
          }}>
            <span style={{ fontSize: 15 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ padding: '12px 0', flex: 1 }}>
          {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                margin: '2px 8px',
                borderRadius: 8,
                textDecoration: 'none',
                background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                color: isActive ? '#3b82f6' : 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Status indicator */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#10b981',
              boxShadow: '0 0 6px #10b981',
            }}></div>
            <span>Fase 2 — Live Data</span>
          </div>
          <div style={{ fontSize: 11, color: '#10b981' }}>
            Jubelio WMS terhubung
          </div>
        </div>
      </aside>

    </>
  );
}
