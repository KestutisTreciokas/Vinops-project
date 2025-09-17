// Lightweight health endpoint for uptime checks and load balancers.
// Next.js App Router (app/.../route.ts)
import type { NextRequest } from "next/server";

function payload() {
  return {
    status: "ok",
    service: "vinops-web",
    now: new Date().toISOString(),
    uptime_sec: Math.round(process.uptime()),
    version: process.env.APP_VERSION ?? "dev",
    commit: process.env.GIT_SHA ?? null,
    env: process.env.NODE_ENV ?? "development",
  };
}

export async function GET(_req: NextRequest) {
  return new Response(JSON.stringify(payload()), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export const dynamic = "force-dynamic";
