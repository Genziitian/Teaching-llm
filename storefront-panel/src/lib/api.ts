// Panel-only API surface. Data comes from the class server, never from Supabase directly.
const readJsonResponse = async (res: Response) => {
  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();

  if (contentType.includes('application/json')) {
    return rawText ? JSON.parse(rawText) : {};
  }

  throw new Error(`API returned ${contentType || 'non-JSON'} instead of JSON`);
};

export const apiService = {
  // Manager Dashboard Data (same response shape as the storefront's /api/manager-fetch)
  managerFetch: async (tab: string, filter: string = 'all', search: string = '', from: string = '', to: string = '') => {
    const params = new URLSearchParams({ tab, filter, search });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/storefront/manager-fetch?${params.toString()}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) {
      let message = 'Failed to fetch manager data';
      try {
        const errorData = await readJsonResponse(res);
        message = errorData.error || message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    return readJsonResponse(res);
  },
};
