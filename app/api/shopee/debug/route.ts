import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SHOPEE_BASE = 'https://partner.test-stable.shopeemobile.com';

export async function GET() {
  const partnerId = process.env.SHOPEE_PARTNER_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;

  if (!partnerId || !partnerKey) {
    return NextResponse.json({ error: 'Env vars tidak ditemukan', SHOPEE_PARTNER_ID: partnerId ?? 'KOSONG', SHOPEE_PARTNER_KEY: partnerKey ? '(ada)' : 'KOSONG' });
  }

  const partnerIdInt = parseInt(partnerId, 10);
  const path = '/api/v2/shop/auth_partner';
  const ts = Math.floor(Date.now() / 1000);
  const baseString = `${partnerIdInt}${path}${ts}`;
  const keyTrimmed = partnerKey.trim();
  const keyHexOnly = keyTrimmed.startsWith('shpk') ? keyTrimmed.slice(4) : keyTrimmed;

  // 3 variasi key — salah satunya yang benar
  const sign_A = crypto.createHmac('sha256', Buffer.from(keyTrimmed)).update(baseString).digest('hex');         // full key as string
  const sign_B = crypto.createHmac('sha256', Buffer.from(keyHexOnly)).update(baseString).digest('hex');        // key tanpa prefix shpk
  const sign_C = crypto.createHmac('sha256', Buffer.from(keyHexOnly, 'hex')).update(baseString).digest('hex'); // key tanpa prefix, hex-decoded

  const redirect = 'https://foodstocks-ppic.vercel.app/api/shopee/callback';
  const makeUrl = (s: string) => `${SHOPEE_BASE}${path}?partner_id=${partnerIdInt}&timestamp=${ts}&sign=${s}&redirect=${encodeURIComponent(redirect)}`;

  return NextResponse.json({
    baseString,
    sign_A_fullKey: sign_A,
    sign_B_noPrefix: sign_B,
    sign_C_hexDecoded: sign_C,
    url_A: makeUrl(sign_A),
    url_B: makeUrl(sign_B),
    url_C: makeUrl(sign_C),
  });
}
