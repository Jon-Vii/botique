import { Badge } from "../Badge";
import type { MemoryNote } from "../../types/runs";

export function MemoryPanel({ notes }: { notes: MemoryNote[] }) {
  if (notes.length === 0) {
    return (
      <span className="text-xs text-muted">
        No journal entries recorded during this run.
      </span>
    );
  }

  return (
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
          <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap">
            {note.body}
          </p>
        </div>
      ))}
    </div>
  );
}
