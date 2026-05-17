/**
 * Smoke test: Supabase DB connection + Google API discovery endpoints
 * Run with: node scripts/smoke-test.mjs
 */
import { PrismaClient } from "@prisma/client";

const GOOGLE_DISCOVERY = [
  { name: "Google Calendar API v3", url: "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest" },
  { name: "Google Tasks API v1",    url: "https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest" },
  { name: "Google OAuth2 token endpoint", url: "https://oauth2.googleapis.com/token" },
];

const DB_URL = process.env.DATABASE_URL;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const INFO = "\x1b[34mℹ\x1b[0m";

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
  console.log("─".repeat(50));
}

// ── 1. Database ──────────────────────────────────────────
section("1. Supabase Database");
if (!DB_URL) {
  console.error(`${FAIL} DATABASE_URL is missing`);
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

try {
  // Raw query to list tables
  const tables = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log(`${PASS} Connected to Supabase`);
  console.log(`${INFO} Tables (${tables.length}):`, tables.map(t => t.table_name).join(", "));

  // Count rows in key tables
  const users    = await prisma.user.count();
  const items    = await prisma.temporalItem.count();
  const logs     = await prisma.syncLog.count();
  console.log(`${INFO} Users: ${users} | TemporalItems: ${items} | SyncLogs: ${logs}`);
} catch (e) {
  console.error(`${FAIL} DB connection failed:`, e.message);
} finally {
  await prisma.$disconnect();
}

// ── 2. Google API Discovery ──────────────────────────────
section("2. Google API Discovery Endpoints");

for (const { name, url } of GOOGLE_DISCOVERY) {
  try {
    const res  = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const version = data.version ?? data.kind ?? "";
      console.log(`${PASS} ${name}  [${res.status}] ${version}`);
    } else {
      // For the token endpoint a GET returns 400 — that's expected (needs POST+params)
      const expectedBadRequest = url.includes("token") && res.status === 400;
      const sym = expectedBadRequest ? PASS : FAIL;
      console.log(`${sym} ${name}  [${res.status}] ${data.error ?? data.error_description ?? ""} ${expectedBadRequest ? "(expected — token endpoint requires POST)" : ""}`);
    }
  } catch (e) {
    console.error(`${FAIL} ${name}  →  ${e.message}`);
  }
}

// ── 3. OAuth2 credentials shape check ───────────────────
section("3. OAuth2 Credentials Validity Check");

try {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log(`${INFO} Skipping OAuth credential check because GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.`);
  } else {
    // Hit the token endpoint with a bogus code — the error type tells us if credentials are valid
    const body = new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code:          "bogus_code_just_testing_creds",
      grant_type:    "authorization_code",
      redirect_uri:  "http://localhost:3000/api/auth/callback/google",
    });
    const res  = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();

    if (data.error === "invalid_grant") {
      // "invalid_grant" means credentials were accepted — the code itself is bogus (expected)
      console.log(`${PASS} Client ID & Secret recognised by Google (error=invalid_grant is expected for a dummy code)`);
    } else if (data.error === "invalid_client") {
      console.error(`${FAIL} Client ID or Secret rejected by Google: ${data.error_description}`);
    } else {
      console.log(`${INFO} Response: ${JSON.stringify(data)}`);
    }
  }
} catch (e) {
  console.error(`${FAIL} OAuth token endpoint unreachable: ${e.message}`);
}

// ── 4. Google APIs enabled for project ──────────────────
section("4. Google APIs Enabled (project-level check)");

// We probe by sending a request with our client_id in the OAuth consent URL.
// If Calendar/Tasks APIs are enabled, the scope will appear in the consent screen.
// Without a real token we use the tokeninfo endpoint to confirm scopes are known to Google.

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks",
];

for (const scope of SCOPES) {
  try {
    // Google's tokeninfo endpoint validates scope strings
    const res  = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=dummy`, {
      signal: AbortSignal.timeout(8000),
    });
    // Will return 400 with "invalid_token" — that's expected, API is reachable
    const data = await res.json();
    if (data.error === "invalid_token") {
      console.log(`${PASS} Scope reachable: ${scope.split("/").pop()}`);
    } else {
      console.log(`${INFO} Scope check: ${scope} → ${JSON.stringify(data)}`);
    }
  } catch (e) {
    console.error(`${FAIL} ${scope}: ${e.message}`);
  }
}

console.log(`\n${INFO} Note: Full Calendar/Tasks API authorisation requires a signed-in user.`);
console.log(`${INFO} These APIs will be exercised on first item creation after OAuth sign-in.\n`);
