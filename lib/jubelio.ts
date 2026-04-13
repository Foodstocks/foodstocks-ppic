// ============================================================
// JUBELIO WMS API CLIENT
// Fase 2: Replace hardcoded data with live Jubelio data
// Base URL: https://api2.jubelio.com
// Auth: POST /login → token (expires 12h)
// ============================================================

const JUBELIO_BASE_URL = 'https://api2.jubelio.com';

interface JubelioTokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: JubelioTokenCache | null = null;

export async function getJubelioToken(): Promise<string> {
  // Check cache (12h expiry with 30min buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 30 * 60 * 1000) {
    return tokenCache.token;
  }

  const email = process.env.JUBELIO_EMAIL;
  const password = process.env.JUBELIO_PASSWORD;

  if (!email || !password) {
    throw new Error('Jubelio credentials not configured. Set JUBELIO_EMAIL and JUBELIO_PASSWORD in environment variables.');
  }

  const res = await fetch(`${JUBELIO_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jubelio login failed: ${err}`);
  }

  const data = await res.json();
  const token = data.token || data.access_token;

  tokenCache = {
    token,
    expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
  };

  return token;
}

async function jubelioFetch(path: string, options: RequestInit = {}) {
  const token = await getJubelioToken();
  const res = await fetch(`${JUBELIO_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Jubelio API error ${res.status}: ${path}`);
  }

  return res.json();
}

// -------------------------------------------------------
// INVENTORY
// -------------------------------------------------------
export async function fetchInventoryItems(page = 1, pageSize = 100) {
  return jubelioFetch(`/inventory/items/?page=${page}&pageSize=${pageSize}`);
}

export async function fetchItemsToBuy() {
  return jubelioFetch('/inventory/items/to-buy');
}

export async function fetchInventoryActivity(createdSince?: string) {
  const qs = createdSince ? `?createdSince=${createdSince}` : '';
  return jubelioFetch(`/inventory/activity/${qs}`);
}

export async function fetchAllStocks(itemIds: string[]) {
  return jubelioFetch('/inventory/items/all-stocks/', {
    method: 'POST',
    body: JSON.stringify({ item_ids: itemIds }),
  });
}

// -------------------------------------------------------
// SALES
// -------------------------------------------------------
export async function fetchCompletedSalesOrders(createdSince?: string, page = 1, pageSize = 100) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (createdSince) params.set('createdSince', createdSince);
  return jubelioFetch(`/sales/orders/completed/?${params}`);
}

// -------------------------------------------------------
// PURCHASE ORDERS
// -------------------------------------------------------
export async function fetchPurchaseOrders(page = 1, pageSize = 100, createdSince?: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (createdSince) params.set('createdSince', createdSince);
  return jubelioFetch(`/purchase/orders/?${params}`);
}

export async function createPurchaseOrder(poData: unknown) {
  return jubelioFetch('/purchase/orders/', {
    method: 'POST',
    body: JSON.stringify(poData),
  });
}

export async function fetchOverdueBills() {
  return jubelioFetch('/purchase/bills/overdue/');
}

export async function fetchUnpaidBills() {
  return jubelioFetch('/purchase/bills/unpaid/');
}

// -------------------------------------------------------
// SUPPLIERS
// -------------------------------------------------------
export async function fetchSuppliers(page = 1, pageSize = 100) {
  return jubelioFetch(`/contacts/suppliers/?page=${page}&pageSize=${pageSize}`);
}

// -------------------------------------------------------
// LOCATIONS
// -------------------------------------------------------
export async function fetchLocations() {
  return jubelioFetch('/locations/');
}
