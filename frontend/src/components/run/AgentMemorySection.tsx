import { useState } from "react";
import { Brain, Notepad, Bell, NotePencil } from "@phosphor-icons/react";
import { Badge } from "../Badge";
import { MemoryPanel } from "./MemoryPanel";
import { RemindersPanel } from "./RemindersPanel";
import { ScratchpadPanel } from "./ScratchpadPanel";
import type {
  MemoryNote,
  MemoryReminder,
  Workspace,
  WorkspaceRevision,
} from "../../types/runs";

type Tab = "scratchpad" | "journal" | "reminders";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "scratchpad",
    label: "Scratchpad",
    icon: <NotePencil size={11} weight="duotone" />,
  },
  {
    id: "journal",
    label: "Journal",
    icon: <Notepad size={11} weight="duotone" />,
  },
  {
    id: "reminders",
    label: "Reminders",
    icon: <Bell size={11} weight="duotone" />,
  },
];

export function AgentMemorySection({
  notes,
  reminders,
  workspace,
  workspaceRevisions,
  selectedDay,
}: {
  notes: MemoryNote[];
  reminders: MemoryReminder[];
  workspace: Workspace;
  workspaceRevisions: WorkspaceRevision[];
  selectedDay?: number;
}) {
  const hasContent =
    notes.length > 0 ||
    reminders.length > 0 ||
    workspace !== null ||
    workspaceRevisions.length > 0;

  const defaultTab: Tab =
    workspace !== null || workspaceRevisions.length > 0
      ? "scratchpad"
      : notes.length > 0
        ? "journal"
        : "reminders";

  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  // Filter to selected day
  const dayNotes =
    selectedDay != null
      ? notes.filter((n) => n.created_day === selectedDay)
      : notes;

  const dayReminders =
    selectedDay != null
      ? reminders.filter(
          (r) => r.due_day === selectedDay || (!r.completed && r.due_day <= selectedDay),
        )
      : reminders;

  const pendingDayReminders = dayReminders.filter((r) => !r.completed);

  if (!hasContent) {
    return null;
  }

  return (
    <div className="tech-card p-4">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted mb-3">
        <Brain size={12} weight="duotone" className="text-amber" />
        Agent Memory
        {selectedDay != null && (
          <span className="ml-2 text-[9px] text-muted font-normal">
            day {selectedDay}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 mb-3 border-b border-rule/50">
        {tabs.map((tab) => {
          const count =
            tab.id === "journal"
              ? dayNotes.length
              : tab.id === "reminders"
                ? dayReminders.length
                : workspaceRevisions.length;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-semibold transition-colors cursor-pointer border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-amber text-ink"
                  : "border-transparent text-muted hover:text-secondary"
              }`}
            >
              {tab.icon}
              {tab.label}
              {count > 0 && (
                <Badge
                  variant={
                    tab.id === "reminders" && pendingDayReminders.length > 0
                      ? "amber"
                      : "gray"
                  }
                  subtle
                >
                  {tab.id === "reminders" && pendingDayReminders.length > 0
                    ? `${pendingDayReminders.length}/${dayReminders.length}`
                    : count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "scratchpad" && (
        <ScratchpadPanel
          workspace={workspace}
          revisions={workspaceRevisions}
          selectedDay={selectedDay}
        />
      )}
      {activeTab === "journal" && <MemoryPanel notes={dayNotes} />}
      {activeTab === "reminders" && (
        <RemindersPanel reminders={dayReminders} selectedDay={selectedDay} />
      )}
    </div>
  );
}
