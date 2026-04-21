import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SHOPEE_BASE = 'https://partner.test-stable.shopeemobile.com';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const shopId = searchParams.get('shop_id');

  if (!code || !shopId) {
    return new NextResponse(errorHtml('Parameter code atau shop_id tidak ditemukan dari Shopee.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const partnerId = process.env.SHOPEE_PARTNER_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;

  if (!partnerId || !partnerKey) {
    return new NextResponse(errorHtml('SHOPEE_PARTNER_ID atau SHOPEE_PARTNER_KEY belum diset.'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    const path = '/api/v2/auth/token/get';
    const ts = Math.floor(Date.now() / 1000);
    const baseString = `${partnerId}${path}${ts}`;
    const sign = crypto.createHmac('sha256', partnerKey.trim()).update(baseString).digest('hex').toUpperCase();

    const tokenUrl = `${SHOPEE_BASE}${path}?partner_id=${partnerId}&timestamp=${ts}&sign=${sign}`;
    const body = { code, shop_id: parseInt(shopId), partner_id: parseInt(partnerId) };

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (json.error || !json.access_token) {
      return new NextResponse(errorHtml(`Gagal dapat token dari Shopee: ${json.message || json.error || 'unknown error'}`), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const expiry = Math.floor(Date.now() / 1000) + (json.expire_in ?? 14400);

    return new NextResponse(successHtml({
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? '',
      shopId,
      expiry: String(expiry),
    }), {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err) {
    return new NextResponse(errorHtml(`Error: ${err instanceof Error ? err.message : 'unknown'}`), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function successHtml(tokens: { accessToken: string; refreshToken: string; shopId: string; expiry: string }) {
  return `<!DOCTYPE html>
<html>
<head><title>Shopee Connected</title></head>
<body>
<script>
  try {
    localStorage.setItem('shopee_access_token', ${JSON.stringify(tokens.accessToken)});
    localStorage.setItem('shopee_refresh_token', ${JSON.stringify(tokens.refreshToken)});
    localStorage.setItem('shopee_shop_id', ${JSON.stringify(tokens.shopId)});
    localStorage.setItem('shopee_token_expiry', ${JSON.stringify(tokens.expiry)});
    window.location.replace('/settings?tab=shopee&connected=1');
  } catch(e) {
    document.write('<p>Gagal simpan token: ' + e.message + '</p>');
  }
</script>
<p>Menyimpan koneksi Shopee...</p>
</body>
</html>`;
}

function errorHtml(msg: string) {
  return `<!DOCTYPE html>
<html>
<head><title>Shopee Error</title></head>
<body>
<script>
  window.location.replace('/settings?tab=shopee&error=${encodeURIComponent(msg)}');
</script>
<p>Error: ${msg}</p>
</body>
</html>`;
}
