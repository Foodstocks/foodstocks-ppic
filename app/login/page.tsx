'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('foodstocks_auth');
    const appPassword = process.env.NEXT_PUBLIC_APP_PASSWORD ?? '';
    if (appPassword && stored === appPassword) {
      router.replace('/');
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      const appPassword = process.env.NEXT_PUBLIC_APP_PASSWORD ?? '';
      if (password === appPassword) {
        localStorage.setItem('foodstocks_auth', password);
        router.replace('/');
      } else {
        setError('Password salah. Coba lagi.');
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F7F8FA',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        display: 'flex',
        width: '100%',
        maxWidth: 960,
        minHeight: 560,
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
      }}>

        {/* ── LEFT: Form ── */}
        <div style={{
          flex: 1,
          background: '#fff',
          padding: '56px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <div style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
            Selamat datang kembali
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 36px' }}>
            Masukkan password untuk akses dashboard PPIC.
          </p>

          <form onSubmit={handleLogin}>
            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block', fontSize: 13, fontWeight: 600,
                color: '#374151', marginBottom: 8,
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Masukkan password"
                  autoFocus
                  required
                  style={{
                    width: '100%',
                    padding: '13px 44px 13px 14px',
                    fontSize: 14,
                    background: '#F9FAFB',
                    border: `1.5px solid ${error ? '#EF4444' : '#E5E7EB'}`,
                    borderRadius: 10,
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#D60001';
                    e.target.style.boxShadow = '0 0 0 3px rgba(214,0,1,0.12)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = error ? '#EF4444' : '#E5E7EB';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  style={{
                    position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#9CA3AF', padding: 0, lineHeight: 1, display: 'flex',
                  }}
                >
                  {show ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {error && (
                <p style={{ fontSize: 12, color: '#EF4444', marginTop: 6, marginBottom: 0 }}>
                  {error}
                </p>
              )}
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={loading || !password}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 10,
                border: 'none',
                background: loading || !password
                  ? '#E5E7EB'
                  : 'linear-gradient(135deg, #FF0101 0%, #D60001 100%)',
                color: loading || !password ? '#9CA3AF' : 'white',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading || !password ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                boxShadow: loading || !password ? 'none' : '0 4px 14px rgba(214,0,1,0.35)',
                letterSpacing: 0.2,
              }}
            >
              {loading ? 'Masuk...' : 'Masuk'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#D1D5DB', marginTop: 40 }}>
            © 2025 Foodstocks. Akses terbatas.
          </p>
          </div>
        </div>

        {/* ── RIGHT: Branding Panel ── */}
        <div style={{
          flex: 1,
          background: 'linear-gradient(140deg, #FF0101 0%, #D60001 55%, #B40001 100%)',
          padding: '56px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', top: -60, right: -60,
            width: 220, height: 220, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }} />
          <div style={{
            position: 'absolute', bottom: -80, left: -40,
            width: 280, height: 280, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }} />

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: 15, letterSpacing: -0.5 }}>FS</span>
            </div>
            <span style={{ color: 'white', fontWeight: 700, fontSize: 16, letterSpacing: -0.3 }}>Foodstocks</span>
          </div>

          {/* Headline */}
          <div style={{ position: 'relative' }}>
            <h2 style={{
              color: 'white', fontSize: 28, fontWeight: 700, lineHeight: 1.35,
              margin: '0 0 14px', letterSpacing: -0.5,
            }}>
              Kendali penuh atas stok & pembelian bisnis kulinermu
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
              Pantau inventory, rencanakan pembelian, dan kelola COGS secara real-time — semua dalam satu dashboard.
            </p>
          </div>

          {/* Mini dashboard mockup */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(8px)',
            borderRadius: 16,
            padding: '20px',
            border: '1px solid rgba(255,255,255,0.15)',
            position: 'relative',
          }}>
            {/* Mockup header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />
              <div style={{ width: 60, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.3)' }} />
              <div style={{ flex: 1 }} />
              <div style={{ width: 40, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.2)' }} />
            </div>
            {/* Stat cards row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'SKU Aktif', value: '247' },
                { label: 'Draft PO', value: '12' },
                { label: 'Stok Kritis', value: '8' },
              ].map(item => (
                <div key={item.label} style={{
                  flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 10,
                  padding: '10px 12px',
                }}>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>{item.value}</div>
                </div>
              ))}
            </div>
            {/* Bar chart mockup */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 48 }}>
              {[60, 80, 50, 90, 70, 85, 65].map((h, i) => (
                <div key={i} style={{
                  flex: 1, height: `${h}%`,
                  background: i === 3
                    ? 'rgba(255,255,255,0.7)'
                    : 'rgba(255,255,255,0.25)',
                  borderRadius: '4px 4px 0 0',
                }} />
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
