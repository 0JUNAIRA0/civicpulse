/**
 * End-to-end smoke test of the API workflow and permission rules.
 * Usage: BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs   (requires seeded data)
 */
import zlib from "node:zlib";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let passed = 0;
let failed = 0;

function check(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

class Client {
  cookie = "";
  async req(method, path, body, isForm = false) {
    const headers = { cookie: this.cookie };
    if (body && !isForm) headers["content-type"] = "application/json";
    const res = await fetch(BASE + path, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined, redirect: "manual" });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json };
  }
  login(email, password) {
    return this.req("POST", "/api/auth/login", { email, password });
  }
}

function png() {
  // 2x2 valid PNG
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.from([0, 255, 0, 0, 0, 255, 0, 0, 0, 0, 255, 255, 255, 0]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function upload(c, buf = png(), name = "photo.png", type = "image/png") {
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type }), name);
  return c.req("POST", "/api/uploads", fd, true);
}

const citizen = new Client();
const manager = new Client();
const otherManager = new Client();
const staff = new Client();
const otherStaff = new Client();
const admin = new Client();
const anon = new Client();

console.log("Auth");
check("anonymous API call is rejected (401)", (await anon.req("GET", "/api/issues")).status === 401);
check("wrong password rejected", (await anon.login("citizen@civicpulse.app", "nope")).status === 401);
check("citizen login", (await citizen.login("citizen@civicpulse.app", "Citizen@123")).status === 200);
check("manager login", (await manager.login("manager.roads@civicpulse.gov", "Manager@123")).status === 200);
check("other manager login", (await otherManager.login("manager.lighting@civicpulse.gov", "Manager@123")).status === 200);
check("staff login", (await staff.login("staff@civicpulse.gov", "Staff@123")).status === 200);
check("other staff login", (await otherStaff.login("staff.lighting1@civicpulse.gov", "Staff@123")).status === 200);
check("admin login", (await admin.login("admin@civicpulse.gov", "Admin@123")).status === 200);
const reg = await anon.req("POST", "/api/auth/register", { name: "Te", email: "bad", password: "weak", confirmPassword: "x" });
check("registration validation returns field errors (422)", reg.status === 422 && reg.json?.error?.fields?.email, JSON.stringify(reg.json));

console.log("Uploads & validation");
const bad = await upload(citizen, Buffer.from("not an image at all, just text"), "x.png", "image/png");
check("non-image upload rejected by magic-byte check", bad.status === 400, JSON.stringify(bad.json));
const up = await upload(citizen);
check("image upload ok", up.status === 201 && up.json?.id);
const outside = await citizen.req("POST", "/api/issues", { title: "Pothole outside the city", description: "This is far away from the service area, should fail.", category: "ROAD_DAMAGE", address: "Somewhere far", latitude: 40.7, longitude: -74, imageIds: [up.json.id] });
check("GPS outside city bounds rejected (422)", outside.status === 422, JSON.stringify(outside.json));
const badGps = await citizen.req("POST", "/api/issues", { title: "Invalid coordinates test", description: "Latitude is out of range so validation must fail.", category: "ROAD_DAMAGE", address: "Nowhere", latitude: 123, longitude: 90.4, imageIds: [up.json.id] });
check("invalid latitude rejected (422)", badGps.status === 422);
const noPhoto = await citizen.req("POST", "/api/issues", { title: "Missing photo report", description: "There is no photo attached to this report at all.", category: "ROAD_DAMAGE", address: "Road 1", latitude: 23.79, longitude: 90.41, imageIds: [] });
check("report without photo rejected", noPhoto.status === 422);

console.log("Citizen reports an issue");
const dup = await citizen.req("GET", "/api/issues/duplicates?lat=23.7806&lng=90.4167&category=ROAD_DAMAGE&title=pothole");
check("duplicate check endpoint responds", dup.status === 200 && Array.isArray(dup.json.items));
const created = await citizen.req("POST", "/api/issues", { title: "Smoke test: deep pothole near Gulshan 1 circle", description: "A deep pothole has opened in the left lane and cars are swerving dangerously.", category: "ROAD_DAMAGE", address: "Gulshan Avenue, Gulshan 1", latitude: 23.7809, longitude: 90.4169, imageIds: [up.json.id] });
check("issue created (201)", created.status === 201, JSON.stringify(created.json));
const issueId = created.json?.issue?.id;
check("reference code assigned", /^CP-\d{4}-\d{5}$/.test(created.json?.issue?.referenceCode ?? ""));
check("auto-routed to Roads department", !!created.json?.issue?.departmentId);
const reuse = await citizen.req("POST", "/api/issues", { title: "Re-using an attached image", description: "This should fail because the image is already attached.", category: "ROAD_DAMAGE", address: "Road 2", latitude: 23.78, longitude: 90.41, imageIds: [up.json.id] });
check("an upload cannot be attached twice", reuse.status === 400);

console.log("Permission checks");
check("citizen cannot verify", (await citizen.req("POST", `/api/issues/${issueId}/verify`, { action: "verify", priority: "HIGH" })).status === 403);
check("citizen cannot change status", (await citizen.req("POST", `/api/issues/${issueId}/status`, { status: "UNDER_REVIEW" })).status === 403);
check("other department manager cannot verify", (await otherManager.req("POST", `/api/issues/${issueId}/verify`, { action: "verify", priority: "HIGH" })).status === 403);
check("other department manager cannot view", (await otherManager.req("GET", `/api/issues/${issueId}`)).status === 403);
check("unassigned staff cannot view", (await staff.req("GET", `/api/issues/${issueId}`)).status === 403);
check("citizen cannot list users", (await citizen.req("GET", "/api/users")).status === 403);
check("citizen cannot read analytics", (await citizen.req("GET", "/api/analytics")).status === 403);
check("manager cannot change settings", (await manager.req("PUT", "/api/settings", {})).status === 403);
check("cannot assign before verification", (await manager.req("POST", `/api/issues/${issueId}/assign`, { assigneeId: "00000000-0000-4000-8000-000000000000" })).status === 400);

console.log("Manager verifies and assigns");
const v = await manager.req("POST", `/api/issues/${issueId}/verify`, { action: "verify", priority: "HIGH", note: "Confirmed by photo" });
check("manager verifies (UNDER_REVIEW)", v.status === 200 && v.json.issue.status === "UNDER_REVIEW", JSON.stringify(v.json));
const me = await manager.req("GET", "/api/auth/me");
const team = await manager.req("GET", `/api/departments/${me.json.user.departmentId}/team`);
const staffMe = (await staff.req("GET", "/api/auth/me")).json.user;
check("team endpoint lists staff with workload", team.status === 200 && team.json.items.some((m) => m.id === staffMe.id && "activeTasks" in m));
const otherStaffMe = (await otherStaff.req("GET", "/api/auth/me")).json.user;
check("cannot assign staff from another department", (await manager.req("POST", `/api/issues/${issueId}/assign`, { assigneeId: otherStaffMe.id })).status === 400);
const a = await manager.req("POST", `/api/issues/${issueId}/assign`, { assigneeId: staffMe.id, instructions: "Barricade first" });
check("task assigned (201)", a.status === 201, JSON.stringify(a.json));
const taskId = a.json?.task?.id;

console.log("Staff works the task");
check("other staff cannot update the task", (await otherStaff.req("PATCH", `/api/tasks/${taskId}`, { status: "IN_PROGRESS" })).status === 403);
check("manager cannot complete staff task", (await manager.req("PATCH", `/api/tasks/${taskId}`, { status: "IN_PROGRESS" })).status === 403);
check("staff starts work", (await staff.req("PATCH", `/api/tasks/${taskId}`, { status: "IN_PROGRESS" })).status === 200);
check("staff reports progress", (await staff.req("POST", `/api/tasks/${taskId}/updates`, { type: "PROGRESS", message: "Lane closed, cutting the damaged area", progress: 40 })).status === 201);
check("staff adds a maintenance note", (await staff.req("POST", `/api/tasks/${taskId}/updates`, { type: "NOTE", message: "Need one more bag of cold mix" })).status === 201);
check("cannot complete without completion photo", (await staff.req("PATCH", `/api/tasks/${taskId}`, { status: "COMPLETED" })).status === 400);
const photo = await upload(staff);
const done = await staff.req("PATCH", `/api/tasks/${taskId}`, { status: "COMPLETED", note: "Patched and compacted", completionImageIds: [photo.json.id] });
check("staff completes with photo (issue RESOLVED)", done.status === 200, JSON.stringify(done.json));

console.log("Review, closing and feedback");
check("citizen cannot review task", (await citizen.req("POST", `/api/tasks/${taskId}/review`, { decision: "approve" })).status === 403);
check("rework needs a note", (await manager.req("POST", `/api/tasks/${taskId}/review`, { decision: "rework" })).status === 400);
check("manager requests rework", (await manager.req("POST", `/api/tasks/${taskId}/review`, { decision: "rework", note: "Edges are uneven" })).status === 200);
check("staff restarts after rework", (await staff.req("PATCH", `/api/tasks/${taskId}`, { status: "IN_PROGRESS" })).status === 200);
check("staff completes again (existing photo counts)", (await staff.req("PATCH", `/api/tasks/${taskId}`, { status: "COMPLETED" })).status === 200);
check("manager approves (CLOSED)", (await manager.req("POST", `/api/tasks/${taskId}/review`, { decision: "approve", note: "Good job" })).status === 200);
const detail = await citizen.req("GET", `/api/issues/${issueId}`);
check("issue is CLOSED", detail.json?.issue?.status === "CLOSED");
const hist = detail.json.issue.history.map((h) => h.toStatus).join(">");
check("status history recorded with users and timestamps", hist === "SUBMITTED>UNDER_REVIEW>ASSIGNED>IN_PROGRESS>RESOLVED>IN_PROGRESS>RESOLVED>CLOSED" && detail.json.issue.history.every((h) => h.changedBy && h.createdAt), hist);
check("citizen leaves feedback", (await citizen.req("POST", `/api/issues/${issueId}/feedback`, { rating: 5, comment: "Fast!" })).status === 201);
check("feedback only once (409)", (await citizen.req("POST", `/api/issues/${issueId}/feedback`, { rating: 4 })).status === 409);
check("closed issue cannot change status", (await manager.req("POST", `/api/issues/${issueId}/status`, { status: "IN_PROGRESS" })).status === 400);
const notes = await citizen.req("GET", "/api/notifications?limit=5");
check("citizen received notifications", notes.json?.items?.some((n) => n.link === `/issues/${issueId}`));

console.log("Lists, search, analytics");
const list = await manager.req("GET", "/api/issues?q=Smoke%20test&pageSize=5&sort=priority&order=desc");
check("search + pagination works", list.status === 200 && list.json.items.length >= 1 && list.json.totalPages >= 1);
const scoped = await manager.req("GET", "/api/issues?pageSize=100");
check("manager list is limited to own department", scoped.json.items.every((i) => i.departmentId === me.json.user.departmentId));
const ranged = await admin.req("GET", "/api/issues?from=2020-01-01&to=2020-12-31");
check("date range filter", ranged.status === 200 && ranged.json.total === 0);
const an = await admin.req("GET", "/api/analytics?heat=1");
check("admin analytics", an.status === 200 && an.json.kpis.total >= 100 && an.json.departments.length >= 5 && Array.isArray(an.json.heat));
const man = await manager.req("GET", "/api/analytics");
check("manager analytics scoped to own department", man.status === 200 && man.json.kpis.total < an.json.kpis.total);
const near = await citizen.req("GET", "/api/issues/nearby?lat=23.7806&lng=90.4167&radius=1000");
check("nearby issues sorted by distance", near.status === 200 && near.json.items.every((x, i, arr) => i === 0 || arr[i - 1].distance <= x.distance));
const rem = await admin.req("POST", "/api/cron/reminders");
check("maintenance reminders run", rem.status === 200 && typeof rem.json.reminded === "number");
check("cron endpoint needs secret or admin", (await citizen.req("POST", "/api/cron/reminders")).status === 403);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
