'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, go to dashboard
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
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #4F6EF7, #8B5CF6)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(79,110,247,0.3)',
            marginBottom: 16,
          }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>FS</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
            Selamat datang kembali
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
            Masuk untuk akses dashboard PPIC
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '32px',
          boxShadow: 'var(--shadow-md)',
        }}>
          <form onSubmit={handleLogin}>
            {/* Password field */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block', fontSize: 13, fontWeight: 600,
                color: 'var(--text-secondary)', marginBottom: 8,
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
                    padding: '12px 44px 12px 14px',
                    fontSize: 14,
                    background: 'var(--bg-hover)',
                    border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border)'}`,
                    borderRadius: 10,
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--accent-blue)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(79,110,247,0.12)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = error ? 'var(--accent-red)' : 'var(--border)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 4, lineHeight: 1,
                    fontSize: 13,
                  }}
                >
                  {show ? '🙈' : '👁️'}
                </button>
              </div>
              {error && (
                <p style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 6, marginBottom: 0 }}>
                  {error}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !password}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 10,
                border: 'none',
                background: loading || !password ? 'var(--border)' : 'linear-gradient(135deg, #4F6EF7, #6366F1)',
                color: loading || !password ? 'var(--text-muted)' : 'white',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading || !password ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                boxShadow: loading || !password ? 'none' : '0 2px 8px rgba(79,110,247,0.3)',
              }}
            >
              {loading ? 'Masuk...' : 'Masuk →'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', marginTop: 24 }}>
          Foodstocks PPIC Dashboard · Akses terbatas
        </p>
      </div>
    </div>
  );
}
