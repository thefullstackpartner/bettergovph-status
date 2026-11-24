export function jsonResponse(
  data: unknown,
  init: { status?: number; cacheControl?: string } = {}
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (init.cacheControl) {
    headers['Cache-Control'] = init.cacheControl;
  }
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers,
  });
}
