import { db } from "@/lib/db";

export async function GET() {
  const now = await db.$queryRaw<{ now: Date }[]>`SELECT now()`;
  return new Response(JSON.stringify({ ok: true, now: now[0]?.now }), {
    headers: { "Content-Type": "application/json" },
  });
}
