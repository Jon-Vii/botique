import { Bell, Check } from "@phosphor-icons/react";
import { Badge } from "../Badge";
import type { MemoryReminder } from "../../types/runs";

export function RemindersPanel({
  reminders,
  selectedDay,
}: {
  reminders: MemoryReminder[];
  selectedDay?: number;
}) {
  const pending = reminders.filter((r) => !r.completed);
  const completed = reminders.filter((r) => r.completed);

  // If a day is selected, highlight reminders due that day
  const isDueToday = (r: MemoryReminder) =>
    selectedDay != null && r.due_day <= selectedDay && !r.completed;

  return (
    <div className="space-y-2">
      {reminders.length === 0 ? (
        <span className="text-xs text-muted">No reminders set during this run.</span>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted">
                Pending
                <Badge variant="amber" subtle className="ml-2">
                  {pending.length}
                </Badge>
              </div>
              {pending.map((r) => (
                <ReminderCard key={r.reminder_id} reminder={r} overdue={isDueToday(r)} />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-muted">
                Completed
                <Badge variant="emerald" subtle className="ml-2">
                  {completed.length}
                </Badge>
              </div>
              {completed.map((r) => (
                <ReminderCard key={r.reminder_id} reminder={r} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReminderCard({
  reminder,
  overdue,
}: {
  reminder: MemoryReminder;
  overdue?: boolean;
}) {
  return (
    <div
      className={`bg-gray-1 border p-2.5 ${
        overdue
          ? "border-amber/40"
          : reminder.completed
            ? "border-rule/40 opacity-70"
            : "border-rule"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {reminder.completed ? (
          <Check size={10} weight="bold" className="text-emerald shrink-0" />
        ) : (
          <Bell
            size={10}
            weight="fill"
            className={`shrink-0 ${overdue ? "text-amber" : "text-muted"}`}
          />
        )}
        <span className="text-xs font-mono font-semibold text-ink truncate">
          {reminder.title}
        </span>
        <Badge
          variant={overdue ? "amber" : reminder.completed ? "emerald" : "gray"}
          subtle
          className="ml-auto shrink-0"
        >
          due day {reminder.due_day}
        </Badge>
      </div>
      {reminder.body !== reminder.title && (
        <p className="text-[11px] text-secondary leading-relaxed pl-4">
          {reminder.body}
        </p>
      )}
    </div>
  );
}
