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
  const sign = crypto.createHmac('sha256', partnerKey.trim()).update(baseString).digest('hex');
  const redirect = 'https://foodstocks-ppic.vercel.app/api/shopee/callback';
  const authUrl = `${SHOPEE_BASE}${path}?partner_id=${partnerIdInt}&timestamp=${ts}&sign=${sign}&redirect=${encodeURIComponent(redirect)}`;

  return NextResponse.json({
    partnerIdRaw: partnerId,
    partnerIdInt,
    partnerIdLength: partnerId.length,
    partnerKeyLength: partnerKey.length,
    baseString,
    sign,
    authUrl,
  });
}
