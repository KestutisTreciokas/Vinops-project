export const dynamic = 'force-static';

export async function GET() {
  return new Response('ok', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    status: 200,
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
