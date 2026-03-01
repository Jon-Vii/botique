import { Notepad } from "@phosphor-icons/react";
import { Badge } from "../Badge";
import type { MemoryNote } from "../../types/runs";

export function MemoryPanel({ notes }: { notes: MemoryNote[] }) {
  return (
    <div className="tech-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted mb-3">
        <Notepad size={12} weight="duotone" className="text-violet" />
        Agent Notes
        <Badge variant="violet" subtle className="ml-2">
          {notes.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {notes.map((note) => (
          <div
            key={note.note_id}
            className="bg-gray-1 border border-rule p-3"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono font-semibold text-ink">
                {note.title}
              </span>
              <span className="text-[9px] font-mono text-muted">
                day {note.created_day}
              </span>
              {note.tags.length > 0 && (
                <div className="flex gap-1">
                  {note.tags.map((t) => (
                    <Badge key={t} variant="gray" subtle>
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              {note.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
