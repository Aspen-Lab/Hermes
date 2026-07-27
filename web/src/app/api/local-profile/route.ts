// GET /api/local-profile — dev-only. Reads the last-saved profile snapshot
//     from a JSON file on disk (.local-data/profile.json, gitignored), so a
//     "fresh" browser origin (new dev-server port, different browser,
//     incognito, cleared localStorage) can recover onboarding state without
//     redoing setup or requiring a Supabase account.
// PUT /api/local-profile — dev-only. Overwrites the snapshot with the
//     current profile.
//
// NODE_ENV is set to "development" by `next dev` and "production" by
// `next build`/`next start`, so this never touches the filesystem outside
// local dev (important on read-only/ephemeral hosts like Vercel).

import { NextResponse, type NextRequest } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { UserProfile } from "@/types";

const SNAPSHOT_DIR = path.join(process.cwd(), ".local-data");
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, "profile.json");

function blockOutsideDev(): NextResponse | null {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "local-profile is dev-only" }, { status: 404 });
  }
  return null;
}

export async function GET() {
  const blocked = blockOutsideDev();
  if (blocked) return blocked;

  try {
    const raw = await readFile(SNAPSHOT_PATH, "utf-8");
    return NextResponse.json({ profile: JSON.parse(raw) as UserProfile });
  } catch {
    return NextResponse.json({ profile: null });
  }
}

export async function PUT(request: NextRequest) {
  const blocked = blockOutsideDev();
  if (blocked) return blocked;

  const profile = (await request.json()) as UserProfile;
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(profile, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}
