import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SHOPEE_BASE = 'https://partner.test-stable.shopeemobile.com';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const partnerId = process.env.SHOPEE_PARTNER_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;

  if (!partnerId || !partnerKey) {
    return NextResponse.json({ error: 'SHOPEE_PARTNER_ID atau SHOPEE_PARTNER_KEY belum diset di environment' }, { status: 500 });
  }

  const partnerIdInt = parseInt(partnerId, 10);
  const path = '/api/v2/shop/auth_partner';
  const ts = Math.floor(Date.now() / 1000);
  const baseString = `${partnerIdInt}${path}${ts}`;
  const sign = crypto.createHmac('sha256', partnerKey.trim()).update(baseString).digest('hex');

  const redirect = 'https://foodstocks-ppic.vercel.app/api/shopee/callback';
  const authUrl = `${SHOPEE_BASE}${path}?partner_id=${partnerIdInt}&timestamp=${ts}&sign=${sign}&redirect=${encodeURIComponent(redirect)}`;

  if (searchParams.get('json') === '1') {
    return NextResponse.json({ baseString, sign, authUrl, partnerIdInt, ts });
  }

  return NextResponse.redirect(authUrl);
}
