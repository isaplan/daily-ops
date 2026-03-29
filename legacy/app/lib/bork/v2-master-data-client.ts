/**
 * Bork Master Data API Client
 * Fetches product groups, payment methods, cost centers, users from Bork API.
 *
 * @exports-to:
 *   ✓ app/api/bork/v2/master-sync/route.ts => fetchBorkProductGroups, fetchBorkPaymentMethods, fetchBorkCostCenters, fetchBorkUsers
 */

async function borkFetch(baseUrl: string, apiKey: string, path: string): Promise<unknown[]> {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const url = `${cleanBaseUrl}${path}?appid=${apiKey}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Bork API request failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data;
}

export async function fetchBorkProductGroups(
  baseUrl: string,
  apiKey: string
): Promise<unknown[]> {
  return borkFetch(baseUrl, apiKey, '/catalog/productgrouplist.json');
}

export async function fetchBorkPaymentMethods(
  baseUrl: string,
  apiKey: string
): Promise<unknown[]> {
  return borkFetch(baseUrl, apiKey, '/catalog/paymodegrouplist.json');
}

export async function fetchBorkCostCenters(
  baseUrl: string,
  apiKey: string
): Promise<unknown[]> {
  return borkFetch(baseUrl, apiKey, '/centers.json');
}

export async function fetchBorkUsers(
  baseUrl: string,
  apiKey: string
): Promise<unknown[]> {
  return borkFetch(baseUrl, apiKey, '/users.json');
}
