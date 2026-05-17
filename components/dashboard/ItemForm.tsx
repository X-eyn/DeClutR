"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { CreateItemInput } from "@/types";

interface ItemFormProps {
  onSubmit: (data: CreateItemInput) => Promise<void>;
  onCancel: () => void;
  googleConnected: boolean;
  initialData?: Partial<CreateItemInput>;
}

const REMINDER_PRESETS = [
  { label: "5 min", value: 5 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "2 hr", value: 120 },
  { label: "1 day", value: 1440 },
];

export default function ItemForm({ onSubmit, onCancel, googleConnected, initialData }: ItemFormProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    type: initialData?.type ?? ("DEADLINE" as CreateItemInput["type"]),
    priority: initialData?.priority ?? ("MEDIUM" as CreateItemInput["priority"]),
    dueDate: initialData?.dueDate ? format(new Date(initialData.dueDate), "yyyy-MM-dd'T'HH:mm") : "",
    startDate: initialData?.startDate ? format(new Date(initialData.startDate), "yyyy-MM-dd'T'HH:mm") : "",
    allDay: initialData?.allDay ?? false,
    reminderMinutes: initialData?.reminderMinutes ?? [15, 60],
    tags: initialData?.tags?.join(", ") ?? "",
    syncToCalendar: initialData ? !!initialData.syncToCalendar : googleConnected,
    syncToTasks: initialData?.syncToTasks ?? false,
  });

  function toggleReminder(minutes: number) {
    setForm(f => ({
      ...f,
      reminderMinutes: f.reminderMinutes.includes(minutes)
        ? f.reminderMinutes.filter(m => m !== minutes)
        : [...f.reminderMinutes, minutes],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.dueDate) return;
    setLoading(true);
    try {
      await onSubmit({
        title: form.title,
        description: form.description || undefined,
        type: form.type,
        priority: form.priority,
        dueDate: new Date(form.dueDate).toISOString(),
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        allDay: form.allDay,
        reminderMinutes: form.reminderMinutes,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        syncToCalendar: form.syncToCalendar,
        syncToTasks: form.syncToTasks,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        .if-label { display: block; font-size: 11.5px; font-weight: 600; color: var(--mut); margin-bottom: 5px; text-transform: uppercase; letter-spacing: .03em; }
        .if-input {
          width: 100%; background: var(--bg); border: 1.5px solid var(--line);
          border-radius: 10px; padding: 9px 12px;
          font-size: 13.5px; color: var(--ink); font-family: inherit;
          outline: none; transition: border-color .15s;
          box-sizing: border-box;
        }
        .if-input:focus { border-color: var(--indigo); }
        .if-input::placeholder { color: var(--mut-2); }
        .if-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .if-field { margin-bottom: 14px; }
        .if-check-row { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: var(--ink-2); }
        .if-check-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--indigo); cursor: pointer; }
        .if-rem-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .if-rem-btn {
          padding: 5px 11px; border-radius: 8px; font-size: 12px; font-weight: 500;
          border: 1.5px solid var(--line); background: var(--panel);
          color: var(--ink-2); cursor: pointer; font-family: inherit; transition: all .12s;
        }
        .if-rem-btn:hover { border-color: var(--indigo); color: var(--indigo); }
        .if-rem-btn.on { background: var(--indigo-soft); border-color: var(--indigo-soft-2); color: var(--indigo-deep); font-weight: 600; }
        .if-google-box {
          background: var(--indigo-soft); border: 1px solid var(--indigo-soft-2);
          border-radius: 12px; padding: 14px;
          display: flex; flex-direction: column; gap: 10px;
          margin-bottom: 14px;
        }
        .if-google-title { font-size: 11.5px; font-weight: 700; color: var(--indigo-deep); margin-bottom: 2px; }
        .if-google-sub { font-size: 11px; color: var(--mut); margin-top: 1px; }
        .if-actions { display: flex; gap: 10px; padding-top: 4px; }
        .if-cancel {
          flex: 1; padding: 10px; background: var(--bg); border: 1.5px solid var(--line);
          border-radius: 10px; font-size: 13.5px; font-weight: 600;
          color: var(--ink-2); cursor: pointer; font-family: inherit;
          transition: all .12s;
        }
        .if-cancel:hover { border-color: #d8d9e3; background: var(--line-2); }
        .if-save {
          flex: 1; padding: 10px; background: var(--indigo); border: none;
          border-radius: 10px; font-size: 13.5px; font-weight: 600;
          color: white; cursor: pointer; font-family: inherit;
          transition: background .12s;
        }
        .if-save:hover { background: var(--indigo-deep); }
        .if-save:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div className="if-field">
          <label className="if-label">Title *</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="if-input"
            placeholder="What needs to be done?"
          />
        </div>

        {/* Type + Priority */}
        <div className="if-grid if-field">
          <div>
            <label className="if-label">Type</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as CreateItemInput["type"] }))}
              className="if-input"
            >
              <option value="DEADLINE">Deadline</option>
              <option value="EVENT">Event</option>
              <option value="REMINDER">Reminder</option>
              <option value="TASK">Task</option>
            </select>
          </div>
          <div>
            <label className="if-label">Priority</label>
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value as CreateItemInput["priority"] }))}
              className="if-input"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="if-grid if-field">
          <div>
            <label className="if-label">Due Date *</label>
            <input
              type={form.allDay ? "date" : "datetime-local"}
              required
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              className="if-input"
            />
          </div>
          <div>
            <label className="if-label">Start Date</label>
            <input
              type={form.allDay ? "date" : "datetime-local"}
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              className="if-input"
            />
          </div>
        </div>

        <div className="if-field">
          <label className="if-check-row">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))}
            />
            All-day event
          </label>
        </div>

        {/* Description */}
        <div className="if-field">
          <label className="if-label">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="if-input"
            placeholder="Optional notes..."
            style={{ resize: "none" }}
          />
        </div>

        {/* Tags */}
        <div className="if-field">
          <label className="if-label">Tags</label>
          <input
            type="text"
            value={form.tags}
            onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            className="if-input"
            placeholder="work, personal, urgent (comma-separated)"
          />
        </div>

        {/* Reminders */}
        <div className="if-field">
          <label className="if-label">Reminders (popup)</label>
          <div className="if-rem-wrap">
            {REMINDER_PRESETS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleReminder(value)}
                className={`if-rem-btn${form.reminderMinutes.includes(value) ? " on" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Google Sync */}
        {googleConnected && (
          <div className="if-google-box">
            <div className="if-google-title">Google Sync</div>
            <label className="if-check-row">
              <input
                type="checkbox"
                checked={form.syncToCalendar}
                onChange={e => setForm(f => ({ ...f, syncToCalendar: e.target.checked }))}
              />
              <div>
                Add to Google Calendar
                <div className="if-google-sub">Creates event with popup reminders on your phone</div>
              </div>
            </label>
            <label className="if-check-row">
              <input
                type="checkbox"
                checked={form.syncToTasks}
                onChange={e => setForm(f => ({ ...f, syncToTasks: e.target.checked }))}
              />
              <div>
                Add to Google Tasks
                <div className="if-google-sub">Appears in Tasks sidebar</div>
              </div>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="if-actions">
          <button type="button" onClick={onCancel} className="if-cancel">Cancel</button>
          <button type="submit" disabled={loading} className="if-save">
            {loading ? "Saving…" : "Save Item"}
          </button>
        </div>
      </form>
    </>
  );
}
