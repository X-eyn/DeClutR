import {
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  isPast,
  isFuture,
  isToday,
  isTomorrow,
  isThisWeek,
  isThisMonth,
  format,
  formatDistanceToNow,
} from "date-fns";

export type UrgencyLevel = "overdue" | "critical" | "high" | "medium" | "low" | "future";

export interface TimeLeft {
  label: string;
  sublabel: string;
  urgency: UrgencyLevel;
  minutesUntil: number;
  hoursUntil: number;
  daysUntil: number;
  weeksUntil: number;
  percentComplete?: number; // if startDate given
}

export function interpretTimeLeft(dueDate: Date, startDate?: Date): TimeLeft {
  const now = new Date();
  const minutesUntil = differenceInMinutes(dueDate, now);
  const hoursUntil = differenceInHours(dueDate, now);
  const daysUntil = differenceInDays(dueDate, now);
  const weeksUntil = differenceInWeeks(dueDate, now);

  let percentComplete: number | undefined;
  if (startDate) {
    const totalMinutes = differenceInMinutes(dueDate, startDate);
    const elapsedMinutes = differenceInMinutes(now, startDate);
    percentComplete = totalMinutes > 0
      ? Math.min(100, Math.max(0, Math.round((elapsedMinutes / totalMinutes) * 100)))
      : 100;
  }

  if (isPast(dueDate)) {
    return {
      label: "Overdue",
      sublabel: `${formatDistanceToNow(dueDate)} ago`,
      urgency: "overdue",
      minutesUntil,
      hoursUntil,
      daysUntil,
      weeksUntil,
      percentComplete,
    };
  }

  if (minutesUntil < 60) {
    return {
      label: `${minutesUntil}m left`,
      sublabel: "Due very soon",
      urgency: "critical",
      minutesUntil,
      hoursUntil,
      daysUntil,
      weeksUntil,
      percentComplete,
    };
  }

  if (hoursUntil < 24) {
    return {
      label: `${hoursUntil}h left`,
      sublabel: isToday(dueDate) ? `Today at ${format(dueDate, "h:mm a")}` : "Due tomorrow",
      urgency: "critical",
      minutesUntil,
      hoursUntil,
      daysUntil,
      weeksUntil,
      percentComplete,
    };
  }

  if (isToday(dueDate)) {
    return {
      label: "Due Today",
      sublabel: format(dueDate, "h:mm a"),
      urgency: "critical",
      minutesUntil,
      hoursUntil,
      daysUntil,
      weeksUntil,
      percentComplete,
    };
  }

  if (isTomorrow(dueDate)) {
    return {
      label: "Tomorrow",
      sublabel: format(dueDate, "h:mm a"),
      urgency: "high",
      minutesUntil,
      hoursUntil,
      daysUntil,
      weeksUntil,
      percentComplete,
    };
  }

  if (daysUntil <= 3) {
    return {
      label: `${daysUntil} days`,
      sublabel: format(dueDate, "EEE, MMM d"),
      urgency: "high",
      minutesUntil,
      hoursUntil,
      daysUntil,
      weeksUntil,
      percentComplete,
    };
  }

  if (isThisWeek(dueDate, { weekStartsOn: 1 })) {
    return {
      label: format(dueDate, "EEEE"),
      sublabel: `${daysUntil} days left`,
      urgency: "medium",
      minutesUntil,
      hoursUntil,
      daysUntil,
      weeksUntil,
      percentComplete,
    };
  }

  if (daysUntil <= 14) {
    return {
      label: `${daysUntil} days`,
      sublabel: format(dueDate, "EEE, MMM d"),
      urgency: "medium",
      minutesUntil,
      hoursUntil,
      daysUntil,
      weeksUntil,
      percentComplete,
    };
  }

  if (isThisMonth(dueDate)) {
    return {
      label: `${weeksUntil}w left`,
      sublabel: format(dueDate, "MMM d"),
      urgency: "low",
      minutesUntil,
      hoursUntil,
      daysUntil,
      weeksUntil,
      percentComplete,
    };
  }

  return {
    label: format(dueDate, "MMM d, yyyy"),
    sublabel: formatDistanceToNow(dueDate, { addSuffix: true }),
    urgency: "future",
    minutesUntil,
    hoursUntil,
    daysUntil,
    weeksUntil,
    percentComplete,
  };
}

export function urgencyColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case "overdue":  return "text-red-600 bg-red-50 border-red-200";
    case "critical": return "text-orange-600 bg-orange-50 border-orange-200";
    case "high":     return "text-amber-600 bg-amber-50 border-amber-200";
    case "medium":   return "text-blue-600 bg-blue-50 border-blue-200";
    case "low":      return "text-green-600 bg-green-50 border-green-200";
    case "future":   return "text-slate-500 bg-slate-50 border-slate-200";
  }
}

export function urgencyBadgeColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case "overdue":  return "bg-red-100 text-red-700";
    case "critical": return "bg-orange-100 text-orange-700";
    case "high":     return "bg-amber-100 text-amber-700";
    case "medium":   return "bg-blue-100 text-blue-700";
    case "low":      return "bg-green-100 text-green-700";
    case "future":   return "bg-slate-100 text-slate-600";
  }
}

export function urgencyDot(urgency: UrgencyLevel): string {
  switch (urgency) {
    case "overdue":  return "#ef4444";
    case "critical": return "#f97316";
    case "high":     return "#f59e0b";
    case "medium":   return "#3b82f6";
    case "low":      return "#10b981";
    case "future":   return "#94a3b8";
  }
}
