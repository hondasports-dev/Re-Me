export function handleWorkerFetch(request: Request): Response {
  const url = new URL(request.url)

  if (url.pathname === '/api/health' || url.pathname === '/api/health/') {
    return Response.json({ status: 'ok' })
  }

  return new Response('Not found', { status: 404 })
}
