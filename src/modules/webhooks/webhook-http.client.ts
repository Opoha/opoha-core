/**
 * Injectable HTTP port for outbound webhook delivery (Phase 8 D-02).
 * Production uses global fetch; tests inject a mock.
 */
export type WebhookHttpRequest = {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
};

export type WebhookHttpResponse = {
  status: number;
  body: string;
};

export type WebhookHttpClient = {
  post(request: WebhookHttpRequest): Promise<WebhookHttpResponse>;
};

export const WEBHOOK_HTTP_CLIENT = Symbol('WEBHOOK_HTTP_CLIENT');

/** Default fetch-backed client. Truncates response body to 4 KiB. */
export function createFetchWebhookHttpClient(fetchImpl: typeof fetch = fetch): WebhookHttpClient {
  return {
    async post(request) {
      const res = await fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      const text = await res.text();
      return {
        status: res.status,
        body: text.length > 4096 ? `${text.slice(0, 4096)}…` : text,
      };
    },
  };
}
