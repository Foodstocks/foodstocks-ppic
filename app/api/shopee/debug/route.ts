import { NextResponse } from 'next/server';
import crypto from 'crypto';

const SHOPEE_BASE = 'https://partner.test-stable.shopeemobile.com';

export async function GET() {
  const partnerId = process.env.SHOPEE_PARTNER_ID;
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;

  if (!partnerId || !partnerKey) {
    return NextResponse.json({ error: 'Env vars tidak ditemukan' });
  }

  const partnerIdInt = parseInt(partnerId, 10);
  const path = '/api/v2/shop/auth_partner';
  const ts = Math.floor(Date.now() / 1000);
  const baseString = `${partnerIdInt}${path}${ts}`;
  const redirect = encodeURIComponent('https://foodstocks-ppic.vercel.app/api/shopee/callback');

  const keyFull   = partnerKey.trim();                                                   // shpk + hex
  const keyNoShpk = keyFull.startsWith('shpk') ? keyFull.slice(4) : keyFull;           // hex only
  const keyDecoded = Buffer.from(keyNoShpk, 'hex');                                     // decoded bytes

  function sign(key: string | Buffer, upper: boolean) {
    const h = crypto.createHmac('sha256', key).update(baseString).digest('hex');
    return upper ? h.toUpperCase() : h;
  }

  const variants: Record<string, string> = {
    '1_fullKey_lower':   sign(keyFull,    false),
    '2_fullKey_upper':   sign(keyFull,    true),
    '3_noShpk_lower':    sign(keyNoShpk,  false),
    '4_noShpk_upper':    sign(keyNoShpk,  true),
    '5_decoded_lower':   sign(keyDecoded, false),
    '6_decoded_upper':   sign(keyDecoded, true),
  };

  const urls: Record<string, string> = {};
  for (const [name, s] of Object.entries(variants)) {
    urls[name] = `${SHOPEE_BASE}${path}?partner_id=${partnerIdInt}&timestamp=${ts}&sign=${s}&redirect=${redirect}`;
  }

  return NextResponse.json({ baseString, partnerIdInt, ts, variants, urls });
}
