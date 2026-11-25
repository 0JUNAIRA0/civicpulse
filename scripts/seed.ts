/**
 * Seeds CivicPulse with realistic demo data.
 * Run: npm run db:seed   (destroys existing data in the target database)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import * as s from "../src/db/schema";
import type { IssueCategory, IssueStatus, Priority } from "../src/db/schema";

/* deterministic PRNG so every seed run produces the same dataset */
let seed = 20261125;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const chance = (p: number) => rand() < p;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

const AREAS: [string, string, string, number, number][] = [
  ["Gulshan 1", "North", "19", 23.7806, 90.4167],
  ["Gulshan 2", "North", "19", 23.7949, 90.4143],
  ["Banani", "North", "19", 23.7937, 90.4066],
  ["Baridhara", "North", "18", 23.8016, 90.4214],
  ["Uttara Sector 4", "North", "1", 23.8636, 90.4006],
  ["Uttara Sector 10", "North", "1", 23.8759, 90.3795],
  ["Mirpur 1", "West", "9", 23.7957, 90.3537],
  ["Mirpur 10", "West", "14", 23.8069, 90.3687],
  ["Mirpur 12", "West", "6", 23.8285, 90.3640],
  ["Pallabi", "West", "5", 23.8270, 90.3610],
  ["Mohammadpur", "West", "33", 23.7662, 90.3589],
  ["Shyamoli", "West", "29", 23.7740, 90.3657],
  ["Agargaon", "West", "28", 23.7781, 90.3800],
  ["Dhanmondi", "South", "15", 23.7461, 90.3742],
  ["Lalmatia", "South", "30", 23.7562, 90.3673],
  ["Kalabagan", "South", "16", 23.7505, 90.3820],
  ["New Market", "South", "18", 23.7334, 90.3847],
  ["Azimpur", "South", "26", 23.7275, 90.3870],
  ["Lalbagh", "South", "23", 23.7190, 90.3880],
  ["Old Dhaka - Chawkbazar", "South", "30", 23.7163, 90.3965],
  ["Sadarghat", "South", "37", 23.7055, 90.4096],
  ["Motijheel", "Central", "9", 23.7330, 90.4172],
  ["Paltan", "Central", "20", 23.7362, 90.4127],
  ["Shahbagh", "Central", "21", 23.7387, 90.3958],
  ["Kawran Bazar", "Central", "26", 23.7510, 90.3935],
  ["Farmgate", "Central", "27", 23.7586, 90.3897],
  ["Tejgaon", "Central", "24", 23.7642, 90.3930],
  ["Moghbazar", "Central", "35", 23.7487, 90.4061],
  ["Malibagh", "East", "22", 23.7495, 90.4170],
  ["Rampura", "East", "23", 23.7608, 90.4207],
  ["Badda", "East", "21", 23.7806, 90.4265],
  ["Bashundhara R/A", "East", "17", 23.8191, 90.4526],
  ["Khilgaon", "East", "2", 23.7517, 90.4310],
  ["Jatrabari", "East", "48", 23.7104, 90.4347],
  ["Mohakhali", "Central", "20", 23.7778, 90.4050],
  ["Wari", "South", "41", 23.7180, 90.4184],
];

const DEPARTMENTS: { name: string; code: string; description: string; categories: IssueCategory[]; slug: string }[] = [
  { name: "Roads & Highways", code: "RHD", slug: "roads", description: "Road surfaces, potholes, cracks and road markings.", categories: ["ROAD_DAMAGE"] },
  { name: "Street Lighting", code: "SLD", slug: "lighting", description: "Streetlights, poles and public lighting circuits.", categories: ["STREETLIGHT"] },
  { name: "Drainage & Sewerage", code: "DSD", slug: "drainage", description: "Storm drains, sewers, waterlogging and manholes.", categories: ["DRAINAGE"] },
  { name: "Waste Management", code: "WMD", slug: "waste", description: "Garbage collection, dumping and secondary transfer stations.", categories: ["WASTE_MANAGEMENT"] },
  { name: "Footpaths & Pedestrian Safety", code: "FPD", slug: "footpaths", description: "Footpaths, kerbs, footbridges and crossings.", categories: ["FOOTPATH"] },
  { name: "Public Works & Facilities", code: "PWD", slug: "publicworks", description: "Parks, public toilets, bus shelters, signage and other civic assets.", categories: ["PUBLIC_INFRASTRUCTURE"] },
];

const FIRST = ["Ayesha", "Rahim", "Karim", "Nusrat", "Tanvir", "Farhana", "Sabbir", "Mehjabin", "Imran", "Sadia", "Arif", "Tasnim", "Rafiq", "Nadia", "Shakil", "Maliha", "Fahim", "Jannat", "Hasan", "Ruma", "Zahid", "Lamia", "Rakib", "Sumaiya", "Mahmud", "Tahmina", "Nayeem", "Faria", "Sohel", "Anika", "Rezaul", "Priya", "Asif", "Shirin", "Kamal", "Mitu", "Junaid", "Rokeya", "Tarek", "Shanta", "Babul", "Nasima", "Omar", "Laila", "Sajid", "Moushumi"];
const LAST = ["Rahman", "Hossain", "Ahmed", "Islam", "Chowdhury", "Khan", "Akter", "Begum", "Uddin", "Haque", "Sarker", "Mia", "Karim", "Alam", "Sultana", "Talukder", "Bhuiyan", "Siddique", "Das", "Roy"];

const TEMPLATES: Record<IssueCategory, { t: string[]; d: string[] }> = {
  ROAD_DAMAGE: {
    t: ["Large pothole in the middle of the lane", "Road surface broken after rain", "Deep crack across the main road", "Sunken road section near junction", "Asphalt peeling off on busy road", "Speed breaker damaged and dangerous"],
    d: [
      "A deep pothole about one metre wide has formed and vehicles swerve to avoid it. Rickshaws have tipped over twice this week.",
      "After the recent heavy rain the asphalt has washed away leaving loose gravel. Motorbikes are skidding here every evening.",
      "There is a long crack running across the road which is getting wider every day. Water collects in it and it is becoming a hazard.",
      "The road has sunk near the intersection and buses scrape the bottom when passing. Traffic jams form during office hours.",
    ],
  },
  STREETLIGHT: {
    t: ["Streetlight not working for two weeks", "Several streetlights out on the block", "Flickering streetlight near school", "Streetlight pole leaning dangerously", "Lights stay on during the day", "Exposed wires at streetlight base"],
    d: [
      "The streetlight in front of the mosque has not worked for about two weeks. The lane is completely dark after 7 pm and people feel unsafe walking.",
      "Four consecutive lights on this stretch are not working. Women returning from work have complained about the darkness.",
      "The light keeps flickering all night and then goes out completely. Children walk past here to the coaching centre.",
      "The pole was hit by a truck and is now leaning towards the houses. It looks like it could fall during a storm.",
    ],
  },
  DRAINAGE: {
    t: ["Blocked drain causing waterlogging", "Open manhole without cover", "Sewage overflowing onto the road", "Drain clogged with plastic waste", "Water stagnant for days after rain", "Broken drain slab on footpath"],
    d: [
      "The drain is completely blocked and even light rain floods the lane knee-deep. Shops have had to close because of the water.",
      "The manhole cover is missing and the hole is hidden when it rains. It is extremely dangerous for pedestrians and children.",
      "Sewage water is overflowing from the drain onto the road and the smell is unbearable. Mosquitoes are breeding here.",
      "Plastic bottles and polythene have clogged the drain mouth. Water has been standing for three days after the last rain.",
    ],
  },
  FOOTPATH: {
    t: ["Footpath tiles broken and uneven", "Footpath blocked by construction material", "Missing kerb stones along footpath", "Footbridge stairs damaged", "Footpath collapsed into drain", "No ramp access at crossing"],
    d: [
      "Many tiles on the footpath are broken or missing, and elderly people trip here regularly. Pedestrians are forced to walk on the road.",
      "Bricks and sand from a construction site have covered the whole footpath for over a month.",
      "Kerb stones are missing for a long stretch and the edge of the footpath is crumbling into the road.",
      "Several steps on the footbridge are cracked and the railing is loose. It is risky especially at rush hour.",
    ],
  },
  WASTE_MANAGEMENT: {
    t: ["Garbage not collected for a week", "Illegal dumping on vacant plot", "Overflowing waste bin at market", "Waste burning causing smoke", "Dead animal not removed from roadside", "Secondary transfer station overflowing"],
    d: [
      "The garbage van has not come for a week and waste is piling up at the corner. Dogs and crows are spreading it across the road.",
      "People have started dumping household and construction waste on the empty plot. The pile is now very large and smells badly.",
      "The waste bin near the kitchen market overflows by noon every day and waste spills onto the footpath.",
      "Someone burns garbage here every evening and the smoke enters nearby homes. Several children have breathing problems.",
    ],
  },
  PUBLIC_INFRASTRUCTURE: {
    t: ["Bus shelter roof damaged", "Public toilet out of service", "Park benches and fence broken", "Road sign knocked down", "Public water point leaking", "Playground equipment unsafe"],
    d: [
      "The roof of the bus shelter is broken and commuters get soaked while waiting in the rain.",
      "The public toilet near the bus stand has been locked for weeks and there is no alternative nearby.",
      "Several benches in the park are broken and part of the boundary fence is missing, letting in stray animals.",
      "The direction sign at the junction was knocked down and drivers coming from outside get lost.",
    ],
  },
};

const ROADS = ["Road 2", "Road 5", "Road 7", "Road 11", "Road 13", "Road 27", "Lane 3", "Lane 8", "Main Road", "Link Road", "Avenue 4", "Bypass Road"];

const PROGRESS_NOTES = [
  "Site inspected, materials requisitioned.",
  "Team on site, work about half done.",
  "Waiting for traffic police support to close the lane.",
  "Main repair complete, finishing work remaining.",
  "Replaced damaged parts, testing now.",
  "Cleared debris and started repair.",
];
const FEEDBACK = [
  "Quick response, thank you!",
  "Fixed well, the road is much safer now.",
  "Took longer than expected but the job is done.",
  "Good work by the maintenance team.",
  "Problem solved but the area was left a bit messy.",
  "Very satisfied with how this was handled.",
  "The fix is temporary, the problem may return.",
];

function svgPhoto(label: string, color: string, sub: string) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#123B5D"/></linearGradient></defs>
<rect width="800" height="500" fill="url(#g)"/>
<g fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="2">${Array.from({ length: 12 }, (_, i) => `<path d="M${-100 + i * 80} 500 L${100 + i * 80} 0"/>`).join("")}</g>
<circle cx="400" cy="210" r="70" fill="#ffffff" fill-opacity=".15"/>
<text x="400" y="225" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" fill="#fff">📷</text>
<text x="400" y="330" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#fff">${label}</text>
<text x="400" y="372" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#fff" fill-opacity=".85">${sub}</text>
</svg>`);
}

const CAT_COLOR: Record<IssueCategory, string> = {
  ROAD_DAMAGE: "#D9480F",
  STREETLIGHT: "#E8A400",
  DRAINAGE: "#1C7ED6",
  FOOTPATH: "#7048E8",
  WASTE_MANAGEMENT: "#2F9E44",
  PUBLIC_INFRASTRUCTURE: "#00A6A6",
};
const CAT_LABEL: Record<IssueCategory, string> = {
  ROAD_DAMAGE: "Road Damage",
  STREETLIGHT: "Streetlight",
  DRAINAGE: "Drainage",
  FOOTPATH: "Footpath",
  WASTE_MANAGEMENT: "Waste Management",
  PUBLIC_INFRASTRUCTURE: "Public Infrastructure",
};

async function main() {
  const t0 = Date.now();
  console.log("Resetting database…");
  await db.execute(sql`TRUNCATE notifications, activity_logs, feedback, task_updates, issue_attachments, tasks, issue_status_history, issues, uploads, areas, system_settings, users, departments RESTART IDENTITY CASCADE`);

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const pw = { admin: hash("Admin@123"), manager: hash("Manager@123"), staff: hash("Staff@123"), citizen: hash("Citizen@123") };

  /* Areas */
  const areaRows = await db
    .insert(s.areas)
    .values(AREAS.map(([name, zone, ward, latitude, longitude]) => ({ name, zone, ward, latitude, longitude })))
    .returning();

  /* Departments */
  const deptRows = await db
    .insert(s.departments)
    .values(
      DEPARTMENTS.map((d) => ({
        name: d.name,
        code: d.code,
        description: d.description,
        categories: d.categories,
        email: `${d.slug}@civicpulse.gov`,
        phone: `+880 2 9${int(100000, 999999)}`,
      })),
    )
    .returning();
  const deptBySlug = Object.fromEntries(DEPARTMENTS.map((d, i) => [d.slug, deptRows[i]]));
  const deptForCat = (c: IssueCategory) => deptRows[DEPARTMENTS.findIndex((d) => d.categories.includes(c))];

  /* Users */
  const usedNames = new Set<string>();
  const personName = () => {
    for (;;) {
      const n = `${pick(FIRST)} ${pick(LAST)}`;
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
  };
  const phone = () => `+880 1${int(3, 9)}${int(10000000, 99999999)}`;
  const longAgo = new Date(Date.now() - 400 * DAY);

  const [admin] = await db
    .insert(s.users)
    .values({ name: "Nafisa Karim", email: "admin@civicpulse.gov", passwordHash: pw.admin, role: "ADMIN", phone: phone(), jobTitle: "City Systems Administrator", createdAt: longAgo, lastLoginAt: new Date() })
    .returning();
  await db.insert(s.users).values({ name: "Ashraf Uddin", email: "ops.admin@civicpulse.gov", passwordHash: pw.admin, role: "ADMIN", phone: phone(), jobTitle: "Operations Administrator", createdAt: longAgo });

  const managers: Record<string, s.User> = {};
  for (const d of DEPARTMENTS) {
    const [m] = await db
      .insert(s.users)
      .values({
        name: personName(),
        email: `manager.${d.slug}@civicpulse.gov`,
        passwordHash: pw.manager,
        role: "DEPT_MANAGER",
        departmentId: deptBySlug[d.slug].id,
        phone: phone(),
        jobTitle: `Head of ${d.name}`,
        createdAt: longAgo,
        lastLoginAt: new Date(Date.now() - int(1, 72) * HOUR),
      })
      .returning();
    managers[deptBySlug[d.slug].id] = m;
    await db.update(s.departments).set({ managerId: m.id }).where(sql`id = ${deptBySlug[d.slug].id}`);
  }

  const staffByDept: Record<string, s.User[]> = {};
  const titles = ["Field Technician", "Senior Technician", "Maintenance Supervisor", "Field Engineer", "Crew Lead"];
  for (const d of DEPARTMENTS) {
    const dept = deptBySlug[d.slug];
    staffByDept[dept.id] = [];
    for (let i = 1; i <= 4; i++) {
      const email = d.slug === "roads" && i === 1 ? "staff@civicpulse.gov" : `staff.${d.slug}${i}@civicpulse.gov`;
      const [u] = await db
        .insert(s.users)
        .values({
          name: personName(),
          email,
          passwordHash: pw.staff,
          role: "STAFF",
          departmentId: dept.id,
          phone: phone(),
          jobTitle: pick(titles),
          isActive: !(d.slug === "waste" && i === 4),
          createdAt: longAgo,
          lastLoginAt: new Date(Date.now() - int(1, 240) * HOUR),
        })
        .returning();
      staffByDept[dept.id].push(u);
    }
  }

  const citizenValues = [{ name: "Tanjim Hasan", email: "citizen@civicpulse.app" }];
  for (let i = 1; i <= 44; i++) citizenValues.push({ name: personName(), email: `citizen${i}@civicpulse.app` });
  const citizens = await db
    .insert(s.users)
    .values(
      citizenValues.map((c) => ({
        ...c,
        passwordHash: pw.citizen,
        role: "CITIZEN" as const,
        phone: phone(),
        address: `${pick(ROADS)}, ${pick(AREAS)[0]}, Dhaka`,
        createdAt: new Date(Date.now() - int(30, 400) * DAY),
      })),
    )
    .returning();
  const demoCitizen = citizens[0];

  /* Placeholder photos */
  const reportPhotos: Record<string, string[]> = {};
  const completionPhotos: Record<string, string> = {};
  for (const c of Object.keys(CAT_LABEL) as IssueCategory[]) {
    reportPhotos[c] = [];
    for (const sub of ["Reported by citizen", "Site photo", "Close-up"]) {
      const buf = svgPhoto(CAT_LABEL[c], CAT_COLOR[c], `Sample photo · ${sub}`);
      const [u] = await db.insert(s.uploads).values({ fileName: `${c.toLowerCase()}-${sub}.svg`, mimeType: "image/svg+xml", size: buf.length, data: buf, width: 800, height: 500 }).returning({ id: s.uploads.id });
      reportPhotos[c].push(u.id);
    }
    const buf = svgPhoto(`${CAT_LABEL[c]} · Fixed`, "#2F9E44", "Completion photo · after repair");
    const [u] = await db.insert(s.uploads).values({ fileName: `${c.toLowerCase()}-done.svg`, mimeType: "image/svg+xml", size: buf.length, data: buf, width: 800, height: 500 }).returning({ id: s.uploads.id });
    completionPhotos[c] = u.id;
  }

  /* Issues with full, consistent workflow history */
  const CAT_WEIGHTS: [IssueCategory, number][] = [
    ["ROAD_DAMAGE", 26],
    ["DRAINAGE", 20],
    ["WASTE_MANAGEMENT", 20],
    ["STREETLIGHT", 16],
    ["FOOTPATH", 10],
    ["PUBLIC_INFRASTRUCTURE", 8],
  ];
  const weighted = () => {
    const total = CAT_WEIGHTS.reduce((a, [, w]) => a + w, 0);
    let r = rand() * total;
    for (const [c, w] of CAT_WEIGHTS) if ((r -= w) <= 0) return c;
    return "ROAD_DAMAGE";
  };
  const SLA: Record<Priority, number> = { LOW: 21, MEDIUM: 10, HIGH: 4, CRITICAL: 1 };
  const hotAreas = areaRows.filter((a) => ["Mirpur 10", "Jatrabari", "Old Dhaka - Chawkbazar", "Mohammadpur", "Badda", "Farmgate", "Uttara Sector 10"].includes(a.name));

  const N = 168;
  const now = Date.now();
  let refNo = 1000;
  const created: { id: string; lat: number; lng: number; category: IssueCategory; status: IssueStatus; createdAt: Date; ref: string }[] = [];
  const historyRows: (typeof s.issueStatusHistory.$inferInsert)[] = [];
  const activityRows: (typeof s.activityLogs.$inferInsert)[] = [];
  const notificationRows: (typeof s.notifications.$inferInsert)[] = [];

  for (let i = 0; i < N; i++) {
    const category = weighted();
    const dept = deptForCat(category);
    const area = chance(0.35) ? pick(hotAreas) : pick(areaRows);
    const lat = +(area.latitude + between(-0.0055, 0.0055)).toFixed(6);
    const lng = +(area.longitude + between(-0.0055, 0.0055)).toFixed(6);
    // Skew towards recent months so trends look alive.
    const ageDays = Math.floor(Math.pow(rand(), 1.35) * 360);
    const createdAt = new Date(now - ageDays * DAY - int(0, 20) * HOUR);
    const reporter = i % 9 === 0 ? demoCitizen : pick(citizens);
    const tpl = TEMPLATES[category];
    const title = `${pick(tpl.t)}${chance(0.5) ? ` at ${area.name}` : ""}`.slice(0, 140);
    const description = `${pick(tpl.d)} Location: near ${pick(["the mosque", "the school gate", "the bus stop", "the pharmacy", "the bazar", "the community centre", "the petrol pump"])} on ${pick(ROADS)}.`;
    const address = `${pick(["House", "Plot", "Holding"])} ${int(1, 120)}, ${pick(ROADS)}, ${area.name}, Dhaka`;

    // Decide how far through the workflow this issue went based on its age.
    let target: IssueStatus;
    const r = rand();
    if (ageDays < 3) target = r < 0.55 ? "SUBMITTED" : r < 0.85 ? "UNDER_REVIEW" : "ASSIGNED";
    else if (ageDays < 15) target = r < 0.12 ? "SUBMITTED" : r < 0.3 ? "UNDER_REVIEW" : r < 0.5 ? "ASSIGNED" : r < 0.72 ? "IN_PROGRESS" : r < 0.86 ? "RESOLVED" : r < 0.95 ? "CLOSED" : "REJECTED";
    else if (ageDays < 60) target = r < 0.04 ? "UNDER_REVIEW" : r < 0.12 ? "ASSIGNED" : r < 0.26 ? "IN_PROGRESS" : r < 0.4 ? "RESOLVED" : r < 0.92 ? "CLOSED" : "REJECTED";
    else target = r < 0.03 ? "IN_PROGRESS" : r < 0.08 ? "RESOLVED" : r < 0.93 ? "CLOSED" : "REJECTED";

    const priority: Priority = pick(["LOW", "MEDIUM", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "CRITICAL"] as const);
    const manager = managers[dept.id];
    const deptStaff = staffByDept[dept.id].filter((u) => u.isActive);
    const assignee = dept.code === "RHD" && chance(0.45) ? staffByDept[dept.id][0] : pick(deptStaff);
    const ref = `CP-${createdAt.getFullYear()}-${String(++refNo).padStart(5, "0")}`;

    // Timeline
    const order: IssueStatus[] = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];
    const steps: { status: IssueStatus; at: Date; by: string; note: string }[] = [{ status: "SUBMITTED", at: createdAt, by: reporter.id, note: "Report submitted" }];
    const maxT = Math.min(now - 30 * 60_000, createdAt.getTime() + Math.max(ageDays, 0.5) * DAY);
    let cursor = createdAt.getTime();
    // Realistic step durations in hours (resolution scales with the priority's target).
    const advance = (hours: number) => {
      cursor = Math.min(maxT, cursor + Math.max(20 * 60_000, hours * HOUR));
      return new Date(cursor);
    };
    const slaH = SLA[priority] * 24;
    const durations: Record<string, () => number> = {
      UNDER_REVIEW: () => between(1, 30),
      ASSIGNED: () => between(1, 20),
      IN_PROGRESS: () => between(2, Math.max(4, slaH * 0.25)),
      RESOLVED: () => slaH * (chance(0.78) ? between(0.15, 0.7) : between(0.9, 2.2)),
      CLOSED: () => between(3, 48),
    };
    let verifiedAt: Date | null = null;
    let resolvedAt: Date | null = null;
    let closedAt: Date | null = null;
    let rejectionReason: string | null = null;
    if (target === "REJECTED") {
      const at = advance(between(4, 60));
      const reasons = ["Not within municipal jurisdiction (private property).", "Insufficient information; could not locate the problem.", "Already fixed before inspection."];
      rejectionReason = pick(reasons);
      steps.push({ status: "REJECTED", at, by: manager.id, note: rejectionReason });
    } else {
      for (const st of order.slice(1, order.indexOf(target) + 1)) {
        const at = advance(durations[st]());
        const by = st === "IN_PROGRESS" || st === "RESOLVED" ? assignee.id : manager.id;
        const note =
          st === "UNDER_REVIEW"
            ? `Verified with ${priority.toLowerCase()} priority`
            : st === "ASSIGNED"
              ? `Assigned to ${assignee.name}`
              : st === "IN_PROGRESS"
                ? "Maintenance work started"
                : st === "RESOLVED"
                  ? "Maintenance work completed"
                  : "Work reviewed and approved";
        steps.push({ status: st, at, by, note });
        if (st === "UNDER_REVIEW") verifiedAt = at;
        if (st === "RESOLVED") resolvedAt = at;
        if (st === "CLOSED") closedAt = at;
      }
    }
    const verified = verifiedAt as Date | null;
    const dueAt = verified ? new Date(verified.getTime() + SLA[priority] * DAY) : null;
    const updatedAt = steps[steps.length - 1].at;

    const [issue] = await db
      .insert(s.issues)
      .values({
        referenceCode: ref,
        title,
        description,
        category,
        priority: verified ? priority : null,
        status: target,
        address,
        latitude: lat,
        longitude: lng,
        areaId: area.id,
        reporterId: reporter.id,
        departmentId: dept.id,
        verifiedById: verified ? manager.id : null,
        verifiedAt: verified,
        resolvedAt,
        closedAt,
        dueAt,
        rejectionReason,
        createdAt,
        updatedAt,
      })
      .returning();
    created.push({ id: issue.id, lat, lng, category, status: target, createdAt, ref });

    // photos
    const nPhotos = int(1, 2);
    const photos = [...reportPhotos[category]].sort(() => rand() - 0.5).slice(0, nPhotos);
    // Each attachment needs its own upload row (uploads are single-use); clone the bytes cheaply via SQL.
    for (const pid of photos) {
      const [{ id: copyId }] = (
        await db.execute<{ id: string }>(sql`INSERT INTO uploads (owner_id, file_name, mime_type, size, width, height, data, created_at)
          SELECT ${reporter.id}, file_name, mime_type, size, width, height, data, ${createdAt.toISOString()} FROM uploads WHERE id = ${pid} RETURNING id`)
      ).rows;
      await db.insert(s.issueAttachments).values({ issueId: issue.id, uploadId: copyId, kind: "REPORT", uploadedById: reporter.id, createdAt });
    }

    let prev: IssueStatus | null = null;
    for (const st of steps) {
      historyRows.push({ issueId: issue.id, fromStatus: prev, toStatus: st.status, changedById: st.by, note: st.note, createdAt: st.at });
      activityRows.push({
        actorId: st.by,
        action: prev ? "issue.status" : "issue.create",
        entityType: "issue",
        entityId: issue.id,
        summary: prev ? `Status changed ${prev.replace("_", " ").toLowerCase()} → ${st.status.replace("_", " ").toLowerCase()}` : `Reported ${ref}`,
        createdAt: st.at,
      });
      prev = st.status;
    }

    // Task
    const assignedStep = steps.find((x) => x.status === "ASSIGNED");
    if (assignedStep) {
      const startedAt = steps.find((x) => x.status === "IN_PROGRESS")?.at ?? null;
      const completedAt = steps.find((x) => x.status === "RESOLVED")?.at ?? null;
      const taskStatus = target === "CLOSED" ? "APPROVED" : target === "RESOLVED" ? "COMPLETED" : target === "IN_PROGRESS" ? (chance(0.12) ? "REWORK" : "IN_PROGRESS") : "ASSIGNED";
      const [task] = await db
        .insert(s.tasks)
        .values({
          issueId: issue.id,
          assigneeId: assignee.id,
          assignedById: manager.id,
          status: taskStatus,
          instructions: pick(["Inspect and repair. Coordinate with traffic police if needed.", "Priority job: secure the area first.", "Use standard repair kit; report material usage.", "Take before/after photos for the audit."]),
          progress: taskStatus === "APPROVED" || taskStatus === "COMPLETED" ? 100 : taskStatus === "IN_PROGRESS" ? int(10, 80) : taskStatus === "REWORK" ? 50 : 0,
          dueDate: dueAt ?? new Date(assignedStep.at.getTime() + 7 * DAY),
          startedAt,
          completedAt,
          reviewedAt: closedAt,
          reviewedById: closedAt ? manager.id : null,
          reviewNote: closedAt ? "Verified on site." : taskStatus === "REWORK" ? "Patch is uneven, please redo the edges." : null,
          createdAt: assignedStep.at,
          updatedAt,
        })
        .returning();
      const updates: (typeof s.taskUpdates.$inferInsert)[] = [];
      if (startedAt) {
        updates.push({ taskId: task.id, authorId: assignee.id, type: "STATUS", message: "Work started", createdAt: startedAt });
        const mid = new Date(startedAt.getTime() + ((completedAt?.getTime() ?? Math.min(now, startedAt.getTime() + 2 * DAY)) - startedAt.getTime()) / 2);
        updates.push({ taskId: task.id, authorId: assignee.id, type: "PROGRESS", message: pick(PROGRESS_NOTES), progress: int(30, 70), createdAt: mid });
        if (chance(0.4)) updates.push({ taskId: task.id, authorId: assignee.id, type: "NOTE", message: pick(["Materials arrived late.", "Residents cooperated well.", "Needed an extra crew member.", "Underground cable found, worked around it."]), createdAt: new Date(mid.getTime() + HOUR) });
      }
      if (taskStatus === "REWORK") updates.push({ taskId: task.id, authorId: manager.id, type: "REVIEW", message: "Rework requested: Patch is uneven, please redo the edges.", createdAt: new Date(Math.min(now, (startedAt?.getTime() ?? now) + DAY)) });
      if (completedAt) {
        updates.push({ taskId: task.id, authorId: assignee.id, type: "STATUS", message: "Work completed", progress: 100, createdAt: completedAt });
        const [{ id: copyId }] = (
          await db.execute<{ id: string }>(sql`INSERT INTO uploads (owner_id, file_name, mime_type, size, width, height, data, created_at)
            SELECT ${assignee.id}, file_name, mime_type, size, width, height, data, ${completedAt.toISOString()} FROM uploads WHERE id = ${completionPhotos[category]} RETURNING id`)
        ).rows;
        await db.insert(s.issueAttachments).values({ issueId: issue.id, uploadId: copyId, taskId: task.id, kind: "COMPLETION", uploadedById: assignee.id, createdAt: completedAt });
      }
      if (closedAt) updates.push({ taskId: task.id, authorId: manager.id, type: "REVIEW", message: "Approved: Verified on site.", createdAt: closedAt });
      if (updates.length) await db.insert(s.taskUpdates).values(updates);

      if (["ASSIGNED", "IN_PROGRESS", "REWORK"].includes(taskStatus) && ageDays < 20) {
        notificationRows.push({ userId: assignee.id, type: "TASK_ASSIGNED", title: `New task: ${ref}`, message: title, link: `/issues/${issue.id}`, createdAt: assignedStep.at, isRead: chance(0.4) });
      }
    }

    // Feedback
    if ((target === "CLOSED" || target === "RESOLVED") && chance(target === "CLOSED" ? 0.72 : 0.3)) {
      const base = dept.code === "WMD" ? 3.2 : dept.code === "SLD" ? 4.3 : dept.code === "RHD" ? 3.6 : 3.9;
      const rating = Math.max(1, Math.min(5, Math.round(base + between(-1.6, 1.4))));
      await db.insert(s.feedback).values({ issueId: issue.id, citizenId: reporter.id, rating, comment: chance(0.75) ? pick(FEEDBACK) : null, createdAt: new Date((closedAt ?? resolvedAt ?? new Date()).getTime() + int(2, 48) * HOUR) });
    }

    if (reporter.id === demoCitizen.id && ageDays < 60) {
      notificationRows.push({ userId: demoCitizen.id, type: "ISSUE_STATUS", title: `${ref} is now ${target.replace("_", " ").toLowerCase()}`, message: title, link: `/issues/${issue.id}`, createdAt: updatedAt, isRead: ageDays > 10 });
    }
    if (target === "SUBMITTED") {
      notificationRows.push({ userId: manager.id, type: "ISSUE_STATUS", title: `New report ${ref}`, message: title, link: `/issues/${issue.id}`, createdAt, isRead: false });
    }
  }

  /* Duplicates: a few fresh reports right next to an open issue of the same category */
  const openOnes = created.filter((c) => ["UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS"].includes(c.status)).slice(0, 8);
  let dupCount = 0;
  for (const [idx, orig] of openOnes.entries()) {
    const confirmed = idx < 3;
    const reporter = pick(citizens);
    const dept = deptForCat(orig.category);
    const createdAt = new Date(Math.min(now - HOUR, orig.createdAt.getTime() + int(1, 4) * DAY));
    const ref = `CP-${createdAt.getFullYear()}-${String(++refNo).padStart(5, "0")}`;
    const area = areaRows.reduce((best, a) => (Math.hypot(a.latitude - orig.lat, a.longitude - orig.lng) < Math.hypot(best.latitude - orig.lat, best.longitude - orig.lng) ? a : best));
    const [dup] = await db
      .insert(s.issues)
      .values({
        referenceCode: ref,
        title: `${pick(TEMPLATES[orig.category].t)} (same spot)`,
        description: `${pick(TEMPLATES[orig.category].d)} I think this was reported before but nothing seems to have changed yet.`,
        category: orig.category,
        status: confirmed ? "REJECTED" : "SUBMITTED",
        address: `Near ${area.name}, Dhaka`,
        latitude: +(orig.lat + between(-0.0004, 0.0004)).toFixed(6),
        longitude: +(orig.lng + between(-0.0004, 0.0004)).toFixed(6),
        areaId: area.id,
        reporterId: reporter.id,
        departmentId: dept.id,
        duplicateOfId: confirmed ? orig.id : null,
        suspectedDuplicateOfId: confirmed ? null : orig.id,
        rejectionReason: confirmed ? `Duplicate of ${orig.ref}` : null,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    historyRows.push({ issueId: dup.id, fromStatus: null, toStatus: "SUBMITTED", changedById: reporter.id, note: "Report submitted", createdAt });
    if (confirmed) historyRows.push({ issueId: dup.id, fromStatus: "SUBMITTED", toStatus: "REJECTED", changedById: managers[dept.id].id, note: `Duplicate of ${orig.ref}`, createdAt: new Date(createdAt.getTime() + 5 * HOUR) });
    const [{ id: copyId }] = (
      await db.execute<{ id: string }>(sql`INSERT INTO uploads (owner_id, file_name, mime_type, size, width, height, data)
        SELECT ${reporter.id}, file_name, mime_type, size, width, height, data FROM uploads WHERE id = ${reportPhotos[orig.category][0]} RETURNING id`)
    ).rows;
    await db.insert(s.issueAttachments).values({ issueId: dup.id, uploadId: copyId, kind: "REPORT", uploadedById: reporter.id, createdAt });
    dupCount++;
  }

  for (let i = 0; i < historyRows.length; i += 500) await db.insert(s.issueStatusHistory).values(historyRows.slice(i, i + 500));
  for (let i = 0; i < activityRows.length; i += 500) await db.insert(s.activityLogs).values(activityRows.slice(i, i + 500));
  notificationRows.push(
    { userId: admin.id, type: "SYSTEM", title: "Welcome back", message: "Monthly performance report is ready in Analytics.", link: "/admin/analytics", isRead: false },
    { userId: demoCitizen.id, type: "SYSTEM", title: "Thanks for helping your city", message: "You can rate resolved issues from My Reports.", link: "/citizen/reports", isRead: false },
  );
  for (let i = 0; i < notificationRows.length; i += 500) await db.insert(s.notifications).values(notificationRows.slice(i, i + 500));

  // Remove the template photos that were only used for cloning.
  await db.execute(sql`DELETE FROM uploads u WHERE owner_id IS NULL AND NOT EXISTS (SELECT 1 FROM issue_attachments a WHERE a.upload_id = u.id)`);
  await db.execute(sql`SELECT setval('issue_ref_seq', ${refNo + 1}, false)`);
  await db.insert(s.systemSettings).values({
    key: "platform",
    value: {
      cityName: "Dhaka",
      mapCenter: { lat: 23.7808, lng: 90.4093, zoom: 12 },
      cityBounds: { north: 23.95, south: 23.66, east: 90.52, west: 90.3 },
      duplicateRadiusMeters: 150,
      allowCitizenRegistration: true,
      autoRouteToDepartment: true,
      reminderIntervalHours: 24,
      slaDays: SLA,
      supportEmail: "support@civicpulse.gov",
    },
    updatedById: admin.id,
  });

  const counts = await db.execute<{ t: string; n: string }>(sql`
    SELECT 'users' t, count(*)::text n FROM users UNION ALL
    SELECT 'staff', count(*)::text FROM users WHERE role = 'STAFF' UNION ALL
    SELECT 'departments', count(*)::text FROM departments UNION ALL
    SELECT 'areas', count(*)::text FROM areas UNION ALL
    SELECT 'issues', count(*)::text FROM issues UNION ALL
    SELECT 'tasks', count(*)::text FROM tasks UNION ALL
    SELECT 'history', count(*)::text FROM issue_status_history UNION ALL
    SELECT 'feedback', count(*)::text FROM feedback`);
  console.log(Object.fromEntries(counts.rows.map((r) => [r.t, Number(r.n)])), `duplicates: ${dupCount}`);
  console.log(`Seed finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
