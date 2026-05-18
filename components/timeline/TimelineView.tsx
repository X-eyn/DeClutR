"use client";

import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Calendar, CheckSquare, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { interpretTimeLeft, urgencyBadgeColor } from "@/lib/time";
import type { TemporalItemWithRelations } from "@/types";

interface TimelineViewProps {
  initialItems: TemporalItemWithRelations[];
}

const typeColors: Record<string, string> = {
  DEADLINE: "bg-red-500",
  EVENT: "bg-blue-500",
  TASK: "bg-green-500",
  REMINDER: "bg-yellow-500",
};

const typeIcon: Record<string, React.ElementType> = {
  DEADLINE: Clock,
  EVENT: Calendar,
  TASK: CheckSquare,
  REMINDER: Bell,
};

export default function TimelineView({ initialItems }: TimelineViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, TemporalItemWithRelations[]>();
    for (const item of initialItems.filter(i => i.status !== "ARCHIVED")) {
      const key = format(new Date(item.dueDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [initialItems]);

  const selectedItems = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return itemsByDay.get(key) ?? [];
  }, [selectedDay, itemsByDay]);

  // Upcoming items sorted by dueDate
  const upcomingItems = useMemo(() => {
    return [...initialItems]
      .filter((i) => i.status !== "COMPLETED" && i.status !== "ARCHIVED")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 20);
  }, [initialItems]);

  return (
    <div className="flex h-full">
      {/* Left: Calendar */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Timeline</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-white min-w-[120px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-800">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-slate-500">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Leading empty cells */}
            {Array.from({ length: (days[0].getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20 border-b border-r border-slate-800/50" />
            ))}

            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayItems = itemsByDay.get(key) ?? [];
              const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
              const today = isToday(day);

              return (
                <div
                  key={key}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={cn(
                    "h-20 border-b border-r border-slate-800/50 p-1 cursor-pointer transition-colors overflow-hidden",
                    today && "bg-indigo-500/5",
                    isSelected && "bg-indigo-500/10 border-indigo-500/30",
                    !isSelected && "hover:bg-slate-800/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                        today ? "bg-indigo-500 text-white" : "text-slate-400"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayItems.length > 3 && (
                      <span className="text-xs text-slate-600">+{dayItems.length - 3}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "text-xs px-1 py-0.5 rounded truncate",
                            typeColors[item.type] ?? "bg-slate-600",
                            "text-white opacity-90"
                          )}
                        >
                          {item.title}
                        </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Type legend */}
        <div className="flex items-center gap-4 mt-4">
          {Object.entries(typeColors).map(([type, color]) => {
            const Icon = typeIcon[type];
            return (
              <div key={type} className="flex items-center gap-1.5">
                <div className={cn("w-3 h-3 rounded-sm", color)} />
                <Icon className="w-3 h-3 text-slate-500" />
                <span className="text-xs text-slate-500">{type}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="w-72 border-l border-slate-800 flex flex-col">
        {selectedDay ? (
          <>
            <div className="px-4 py-4 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-white">{format(selectedDay, "EEEE, MMMM d")}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedItems.length === 0 ? (
                <p className="text-xs text-slate-600 text-center mt-8">Nothing scheduled</p>
              ) : (
                selectedItems.map((item) => {
                  const tl = interpretTimeLeft(new Date(item.dueDate));
                  const Icon = typeIcon[item.type];
                  return (
                    <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-sm font-medium text-white line-clamp-1">{item.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", urgencyBadgeColor(tl.urgency))}>
                          {tl.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          {item.allDay ? "All day" : format(new Date(item.dueDate), "h:mm a")}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            <div className="px-4 py-4 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-white">Upcoming</h2>
              <p className="text-xs text-slate-500 mt-0.5">Next {upcomingItems.length} items</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {upcomingItems.map((item) => {
                const tl = interpretTimeLeft(new Date(item.dueDate));
                const Icon = typeIcon[item.type];
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedDay(new Date(item.dueDate))}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-3 cursor-pointer hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-sm font-medium text-white line-clamp-1">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", urgencyBadgeColor(tl.urgency))}>
                        {tl.label}
                      </span>
                      <span className="text-xs text-slate-500">{format(new Date(item.dueDate), "MMM d")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
