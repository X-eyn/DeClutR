import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ItemType, Priority } from "@prisma/client";

// Only allowed in development
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated — sign in first, then call this endpoint" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  const d = (daysOffset: number, hour = 23, min = 59) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + daysOffset);
    dt.setHours(hour, min, 0, 0);
    return dt;
  };

  // Wipe existing items for this user so the seed is idempotent
  await prisma.checklistItem.deleteMany({ where: { temporalItem: { userId } } });
  await prisma.temporalItem.deleteMany({ where: { userId } });

  // ── Tags ──────────────────────────────────────────────────────────────────
  const tags = await Promise.all([
    prisma.tag.upsert({ where: { name: "university" },  update: {}, create: { name: "university",  color: "#6366f1" } }),
    prisma.tag.upsert({ where: { name: "work" },        update: {}, create: { name: "work",        color: "#10b981" } }),
    prisma.tag.upsert({ where: { name: "personal" },    update: {}, create: { name: "personal",    color: "#f59e0b" } }),
    prisma.tag.upsert({ where: { name: "health" },      update: {}, create: { name: "health",      color: "#ef4444" } }),
    prisma.tag.upsert({ where: { name: "finance" },     update: {}, create: { name: "finance",     color: "#8b5cf6" } }),
    prisma.tag.upsert({ where: { name: "research" },    update: {}, create: { name: "research",    color: "#3b82f6" } }),
  ]);

  const [tUni, tWork, tPersonal, tHealth, tFinance, tResearch] = tags;

  // ── DEADLINES ─────────────────────────────────────────────────────────────
  const deadline1 = await prisma.temporalItem.create({
    data: {
      userId, type: "DEADLINE", priority: "CRITICAL",
      title: "Machine Learning Final Project",
      description: "Complete the neural network implementation and submit via Canvas. Must include training plots, evaluation metrics, and a 2-page report.",
      dueDate: d(-1, 23, 59),  // overdue yesterday
      reminderMinutes: [60, 1440],
      tags: { connect: [{ id: tUni.id }, { id: tResearch.id }] },
    },
  });

  const deadline2 = await prisma.temporalItem.create({
    data: {
      userId, type: "DEADLINE", priority: "HIGH",
      title: "Q3 Financial Report",
      description: "Prepare and submit quarterly financial report to the board. Include revenue projections and cost breakdown.",
      dueDate: d(0, 17, 0),  // due today at 5 PM
      reminderMinutes: [30, 120],
      tags: { connect: [{ id: tWork.id }, { id: tFinance.id }] },
    },
  });

  const deadline3 = await prisma.temporalItem.create({
    data: {
      userId, type: "DEADLINE", priority: "HIGH",
      title: "Thesis Chapter 2 Draft",
      description: "Submit draft of literature review chapter to supervisor for feedback before end of week.",
      dueDate: d(2, 23, 59),
      reminderMinutes: [1440],
      tags: { connect: [{ id: tUni.id }, { id: tResearch.id }] },
    },
  });

  const deadline4 = await prisma.temporalItem.create({
    data: {
      userId, type: "DEADLINE", priority: "MEDIUM",
      title: "Tax Return Submission",
      description: "File annual tax return online. Have all receipts and bank statements ready.",
      dueDate: d(5, 23, 59),
      reminderMinutes: [1440, 2880],
      tags: { connect: [{ id: tFinance.id }, { id: tPersonal.id }] },
    },
  });

  const deadline5 = await prisma.temporalItem.create({
    data: {
      userId, type: "DEADLINE", priority: "MEDIUM",
      title: "Product Design Mockups",
      description: "Deliver high-fidelity Figma mockups for the mobile app redesign to the dev team.",
      dueDate: d(8, 18, 0),
      tags: { connect: [{ id: tWork.id }] },
    },
  });

  const deadline6 = await prisma.temporalItem.create({
    data: {
      userId, type: "DEADLINE", priority: "LOW",
      title: "Annual Performance Review Form",
      description: "Complete self-assessment section of the annual HR performance review.",
      dueDate: d(14, 23, 59),
      tags: { connect: [{ id: tWork.id }] },
    },
  });

  const deadline7 = await prisma.temporalItem.create({
    data: {
      userId, type: "DEADLINE", priority: "HIGH",
      title: "Research Grant Application",
      description: "Submit application for the National Science Foundation grant. Budget, proposal, and CV required.",
      dueDate: d(21, 23, 59),
      tags: { connect: [{ id: tUni.id }, { id: tResearch.id }, { id: tFinance.id }] },
    },
  });

  // ── EVENTS ────────────────────────────────────────────────────────────────
  await prisma.temporalItem.create({
    data: {
      userId, type: "EVENT", priority: "HIGH",
      title: "Team Sprint Planning Meeting",
      description: "Bi-weekly sprint planning. Review backlog, assign tasks, estimate story points.",
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0),
      dueDate:   new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30),
      allDay: false,
      tags: { connect: [{ id: tWork.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "EVENT", priority: "MEDIUM",
      title: "Dentist Appointment",
      description: "Regular check-up and cleaning. Bring insurance card.",
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0),
      dueDate:   new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0),
      allDay: false,
      tags: { connect: [{ id: tHealth.id }, { id: tPersonal.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "EVENT", priority: "HIGH",
      title: "Product Demo with Client",
      description: "Live demo of the new dashboard features to Acme Corp stakeholders. Prepare slides and rehearse flow.",
      startDate: d(1, 10, 0),
      dueDate:   d(1, 11, 30),
      allDay: false,
      tags: { connect: [{ id: tWork.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "EVENT", priority: "MEDIUM",
      title: "Deep Work Session — Research",
      description: "Dedicated 3-hour block for thesis writing. No meetings, no distractions.",
      startDate: d(1, 13, 0),
      dueDate:   d(1, 16, 0),
      allDay: false,
      tags: { connect: [{ id: tResearch.id }, { id: tUni.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "EVENT", priority: "MEDIUM",
      title: "Weekly Gym Session",
      description: "Chest + triceps. Remember to bring gym bag.",
      startDate: d(2, 7, 0),
      dueDate:   d(2, 8, 30),
      allDay: false,
      tags: { connect: [{ id: tHealth.id }, { id: tPersonal.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "EVENT", priority: "HIGH",
      title: "Supervisor Meeting — Thesis Review",
      description: "Monthly thesis progress review. Bring latest chapter draft and research notes.",
      startDate: d(3, 11, 0),
      dueDate:   d(3, 12, 0),
      allDay: false,
      tags: { connect: [{ id: tUni.id }, { id: tResearch.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "EVENT", priority: "LOW",
      title: "Coffee with Alex",
      description: "Catch up over coffee at The Workshop café. Discuss potential collaboration on side project.",
      startDate: d(4, 15, 30),
      dueDate:   d(4, 16, 30),
      allDay: false,
      tags: { connect: [{ id: tPersonal.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "EVENT", priority: "CRITICAL",
      title: "Conference Keynote Presentation",
      description: "Main stage presentation at TechConf 2025. Slides must be submitted 48h in advance.",
      startDate: d(7, 9, 0),
      dueDate:   d(7, 10, 0),
      allDay: false,
      tags: { connect: [{ id: tWork.id }, { id: tResearch.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "EVENT", priority: "MEDIUM",
      title: "Book Club Meeting",
      description: "Discussing \"Atomic Habits\" by James Clear. Prepare 3 key takeaways.",
      startDate: d(10, 19, 0),
      dueDate:   d(10, 21, 0),
      allDay: false,
      tags: { connect: [{ id: tPersonal.id }] },
    },
  });

  // ── TASKS ─────────────────────────────────────────────────────────────────
  const task1 = await prisma.temporalItem.create({
    data: {
      userId, type: "TASK", priority: "CRITICAL",
      title: "Fix Production Bug — Auth Token Expiry",
      description: "Users are being logged out after 30 minutes instead of 7 days. Root cause: JWT expiry misconfiguration in auth middleware.",
      dueDate: d(0, 14, 0),  // today at 2 PM
      tags: { connect: [{ id: tWork.id }] },
    },
  });

  await prisma.checklistItem.createMany({
    data: [
      { temporalItemId: task1.id, title: "Reproduce the issue locally", completed: true, completedAt: new Date(), sortOrder: 0 },
      { temporalItemId: task1.id, title: "Identify JWT config mismatch",  completed: true, completedAt: new Date(), sortOrder: 1 },
      { temporalItemId: task1.id, title: "Deploy fix to staging",         completed: false, sortOrder: 2 },
      { temporalItemId: task1.id, title: "Test with QA team",             completed: false, sortOrder: 3 },
      { temporalItemId: task1.id, title: "Deploy to production",          completed: false, sortOrder: 4 },
    ],
  });

  const task2 = await prisma.temporalItem.create({
    data: {
      userId, type: "TASK", priority: "HIGH",
      title: "Write API Documentation",
      description: "Document all REST endpoints for the new dashboard API. Use OpenAPI 3.0 spec format.",
      dueDate: d(1, 17, 0),
      tags: { connect: [{ id: tWork.id }] },
    },
  });

  await prisma.checklistItem.createMany({
    data: [
      { temporalItemId: task2.id, title: "Document /api/items endpoints",    completed: true, completedAt: new Date(), sortOrder: 0 },
      { temporalItemId: task2.id, title: "Document /api/sync endpoints",     completed: false, sortOrder: 1 },
      { temporalItemId: task2.id, title: "Document /api/google endpoints",   completed: false, sortOrder: 2 },
      { temporalItemId: task2.id, title: "Add request/response examples",    completed: false, sortOrder: 3 },
    ],
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "TASK", priority: "HIGH",
      title: "Review Pull Request #142",
      description: "Code review for the new notification system. Focus on edge cases and error handling.",
      dueDate: d(0, 16, 0),
      tags: { connect: [{ id: tWork.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "TASK", priority: "MEDIUM",
      title: "Update Resume & Portfolio",
      description: "Add recent projects and update tech stack. Tailor for ML/AI engineering roles.",
      dueDate: d(3, 23, 59),
      tags: { connect: [{ id: tPersonal.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "TASK", priority: "MEDIUM",
      title: "Read: \"Designing Data-Intensive Apps\"",
      description: "Finish chapters 7–9 on transactions, distributed systems consistency, and batch processing.",
      dueDate: d(5, 23, 59),
      tags: { connect: [{ id: tPersonal.id }, { id: tResearch.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "TASK", priority: "LOW",
      title: "Organise Home Office",
      description: "Cable management, new monitor stand, declutter desk. Goal: clean workspace = clean mind.",
      dueDate: d(7, 23, 59),
      tags: { connect: [{ id: tPersonal.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "TASK", priority: "HIGH",
      title: "Prepare Conference Slides",
      description: "Create presentation deck for TechConf keynote. Max 20 slides. Focus on live demo section.",
      dueDate: d(5, 18, 0),
      tags: { connect: [{ id: tWork.id }, { id: tResearch.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "TASK", priority: "MEDIUM",
      title: "Set Up Automated Backups",
      description: "Configure daily database backups to S3 with 30-day retention policy.",
      dueDate: d(6, 23, 59),
      tags: { connect: [{ id: tWork.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "TASK", priority: "LOW",
      title: "Plan Weekend Trip to the Mountains",
      description: "Book accommodation, check trail conditions, pack gear list.",
      dueDate: d(9, 23, 59),
      tags: { connect: [{ id: tPersonal.id }] },
    },
  });

  // ── REMINDERS ─────────────────────────────────────────────────────────────
  await prisma.temporalItem.create({
    data: {
      userId, type: "REMINDER", priority: "HIGH",
      title: "Take Medication",
      description: "Daily vitamin D + magnesium. Don't skip this week.",
      dueDate: d(0, 8, 0),  // today 8 AM — overdue
      reminderMinutes: [0],
      tags: { connect: [{ id: tHealth.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "REMINDER", priority: "CRITICAL",
      title: "Submit Scholarship Application",
      description: "Deadline is today! Upload transcript, personal statement, and two reference letters.",
      dueDate: d(0, 20, 0),
      reminderMinutes: [60, 180],
      tags: { connect: [{ id: tUni.id }, { id: tFinance.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "REMINDER", priority: "MEDIUM",
      title: "Call Mom — Birthday",
      description: "Don't forget to call this evening! She likes video calls.",
      dueDate: d(1, 19, 0),
      reminderMinutes: [30],
      tags: { connect: [{ id: tPersonal.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "REMINDER", priority: "MEDIUM",
      title: "Renew Library Books",
      description: "Renew 3 books online before they're due or incur a fine.",
      dueDate: d(2, 12, 0),
      reminderMinutes: [1440],
      tags: { connect: [{ id: tUni.id } ] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "REMINDER", priority: "HIGH",
      title: "Pay Rent",
      description: "Transfer this month's rent to landlord. Include utilities portion.",
      dueDate: d(4, 9, 0),
      reminderMinutes: [1440],
      tags: { connect: [{ id: tFinance.id }, { id: tPersonal.id }] },
    },
  });

  await prisma.temporalItem.create({
    data: {
      userId, type: "REMINDER", priority: "LOW",
      title: "Restock Coffee & Groceries",
      description: "Running low on coffee beans, oat milk, and spinach. Check if protein powder needs restocking too.",
      dueDate: d(3, 10, 0),
      tags: { connect: [{ id: tPersonal.id }] },
    },
  });

  // ── COMPLETED ITEMS (to populate completion rate & history) ───────────────
  const completedItems: Array<{ title: string; type: ItemType; priority: Priority; daysAgo: number }> = [
    { title: "Set up development environment",     type: "TASK",     priority: "HIGH",   daysAgo: -3 },
    { title: "Database schema design",             type: "TASK",     priority: "HIGH",   daysAgo: -2 },
    { title: "User authentication implementation", type: "TASK",     priority: "CRITICAL", daysAgo: -2 },
    { title: "Weekly team standup",                type: "EVENT",    priority: "MEDIUM", daysAgo: -1 },
    { title: "Code review session",                type: "EVENT",    priority: "MEDIUM", daysAgo: -1 },
    { title: "Deploy v1.0 to staging",             type: "DEADLINE", priority: "HIGH",   daysAgo: -1 },
    { title: "Morning run — 5K",                   type: "TASK",     priority: "LOW",    daysAgo: -4 },
    { title: "Read research paper: Attention Is All You Need", type: "TASK", priority: "MEDIUM", daysAgo: -5 },
    { title: "Monthly budget review",              type: "TASK",     priority: "MEDIUM", daysAgo: -6 },
    { title: "Submit assignment 3",                type: "DEADLINE", priority: "HIGH",   daysAgo: -7 },
  ];

  for (const item of completedItems) {
    await prisma.temporalItem.create({
      data: {
        userId,
        type: item.type,
        priority: item.priority,
        status: "COMPLETED",
        title: item.title,
        dueDate: d(item.daysAgo, 17, 0),
      },
    });
  }

  // Count what we created
  const counts = await prisma.temporalItem.groupBy({
    by: ["type", "status"],
    where: { userId },
    _count: true,
  });

  return NextResponse.json({
    success: true,
    message: "Database seeded successfully!",
    counts,
  });
}
