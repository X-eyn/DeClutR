import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const itemsRoute = readFileSync(join(root, "app", "api", "items", "route.ts"), "utf8");
const itemRoute = readFileSync(join(root, "app", "api", "items", "[id]", "route.ts"), "utf8");
const googleSyncPath = join(root, "lib", "google-sync.ts");
const googleSync = existsSync(googleSyncPath) ? readFileSync(googleSyncPath, "utf8") : "";

function assertIncludes(source, text, label) {
  assert.ok(source.includes(text), `${label} should include ${text}`);
}

function assertMatches(source, pattern, label) {
  assert.match(source, pattern, label);
}

assertIncludes(itemsRoute, "export async function POST", "collection route");
assertIncludes(itemRoute, "export async function PATCH", "item route");
assertIncludes(itemRoute, "export async function DELETE", "item route");

for (const [label, source] of [
  ["POST /api/items", itemsRoute],
  ["PATCH/DELETE /api/items/[id]", itemRoute],
]) {
  assertIncludes(source, "const session = await auth();", label);
  assertIncludes(source, 'NextResponse.json({ error: "Unauthorized" }, { status: 401 })', label);
  assertIncludes(source, "syncPending:", label);
}

assertIncludes(itemsRoute, 'NextResponse.json({ error: "title, type, and dueDate are required" }, { status: 400 })', "POST validation");
assertIncludes(itemsRoute, "prisma.temporalItem.create", "POST mutation");
assertIncludes(itemsRoute, "{ status: 201 }", "POST success status");
assert.ok(
  /after\(\s*async\s*\(\)\s*=>\s*\{/.test(itemsRoute) ||
    (itemsRoute.includes("scheduleCreatedItemGoogleSync") && /after\(\s*async\s*\(\)\s*=>\s*\{/.test(googleSync)),
  "POST /api/items should queue Google sync work through after() or the google-sync scheduler"
);
assertMatches(itemRoute, /getItem\(session\.user\.id,\s*id\)/, "item mutations should load by user id");
assertIncludes(itemRoute, 'NextResponse.json({ error: "Not found" }, { status: 404 })', "item not-found handling");
assertIncludes(itemRoute, "prisma.temporalItem.update", "PATCH mutation");
assertIncludes(itemRoute, "prisma.temporalItem.delete", "DELETE mutation");
assert.ok(
  /after\(\s*async\s*\(\)\s*=>\s*\{/.test(itemRoute) ||
    (itemRoute.includes("scheduleUpdatedItemGoogleSync") &&
      itemRoute.includes("scheduleDeletedItemGoogleSync") &&
      /after\(\s*async\s*\(\)\s*=>\s*\{/.test(googleSync)),
  "PATCH/DELETE /api/items/[id] should queue Google sync work through after() or the google-sync scheduler"
);

console.log("Mutation API validation passed.");
