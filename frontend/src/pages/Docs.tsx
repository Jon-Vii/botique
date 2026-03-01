import {
  BookOpenText,
  CaretRight,
  FileText,
  ArrowLeft,
  ListBullets,
  GitBranch,
  Cpu,
  Gauge,
  GameController,
  Pulse,
  Wrench,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ── Raw markdown imports — explicit for each doc ──── */

import architectureMd from "@docs/architecture.md?raw";
import simulationModelMd from "@docs/simulation-model.md?raw";
import agentLoopMd from "@docs/agent-loop.md?raw";
import agentToolsMd from "@docs/agent-tools.md?raw";
import tournamentModeMd from "@docs/tournament-mode.md?raw";
import mvpScopeMd from "@docs/mvp-scope.md?raw";
import statusMd from "@docs/status.md?raw";

/* ── Document catalogue — controls order and metadata ─ */

interface DocEntry {
  slug: string;
  title: string;
  subtitle: string;
  icon: PhosphorIcon;
  accent: string;
}

const DOC_CATALOGUE: DocEntry[] = [
  {
    slug: "architecture",
    title: "Architecture",
    subtitle: "System boundaries, interfaces, and modularity",
    icon: GitBranch,
    accent: "text-violet",
  },
  {
    slug: "simulation-model",
    title: "Simulation Model",
    subtitle: "Marketplace mechanics, demand, and day resolution",
    icon: Gauge,
    accent: "text-teal",
  },
  {
    slug: "agent-loop",
    title: "Agent Loop",
    subtitle: "Workday structure, briefings, and memory",
    icon: Cpu,
    accent: "text-emerald",
  },
  {
    slug: "agent-tools",
    title: "Agent Tools",
    subtitle: "Seller surfaces, extensions, and portability",
    icon: Wrench,
    accent: "text-amber",
  },
  {
    slug: "tournament-mode",
    title: "Tournament Mode",
    subtitle: "Arena-style competitive runs and scoring",
    icon: GameController,
    accent: "text-rose",
  },
  {
    slug: "mvp-scope",
    title: "Initial Scope",
    subtitle: "Goals, priorities, and success criteria",
    icon: ListBullets,
    accent: "text-sky",
  },
  {
    slug: "status",
    title: "Status",
    subtitle: "Current build state and open questions",
    icon: Pulse,
    accent: "text-orange",
  },
];

/* slug→content map */
const docsBySlug: Record<string, string> = {
  architecture: architectureMd,
  "simulation-model": simulationModelMd,
  "agent-loop": agentLoopMd,
  "agent-tools": agentToolsMd,
  "tournament-mode": tournamentModeMd,
  "mvp-scope": mvpScopeMd,
  status: statusMd,
};

/* ── Markdown prose styles (Tailwind-compatible) ──── */

const PROSE_CLASSES = "docs-prose";

/* ── Component ─────────────────────────────────────── */

export function Docs() {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const activeDoc = useMemo(() => {
    if (!activeSlug) return null;
    const entry = DOC_CATALOGUE.find((d) => d.slug === activeSlug);
    const content = docsBySlug[activeSlug];
    if (!entry || !content) return null;
    return { ...entry, content };
  }, [activeSlug]);

  /* ── Index view ──────────────────────────────────── */
  if (!activeDoc) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <section className="tech-card relative overflow-hidden px-8 py-8">
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <BookOpenText
                size={14}
                weight="fill"
                className="text-orange"
              />
              <span className="font-pixel-grid text-[11px] text-orange tracking-wider">
                Reference
              </span>
            </div>
            <h1 className="text-3xl font-bold text-ink leading-tight tracking-tight">
              Documentation
            </h1>
            <p className="mt-3 text-secondary text-[14px] leading-relaxed max-w-xl">
              Architecture decisions, simulation mechanics, agent behaviour, and
              operational status — the living source of truth for Botique.
            </p>
            <div className="absolute top-0 right-0 opacity-[0.06]">
              <BookOpenText
                size={120}
                weight="thin"
                className="text-orange"
              />
            </div>
          </div>
        </section>

        {/* Doc cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DOC_CATALOGUE.map((doc, index) => {
            const Icon = doc.icon;
            const hasContent = !!docsBySlug[doc.slug];
            return (
              <button
                key={doc.slug}
                onClick={() => hasContent && setActiveSlug(doc.slug)}
                disabled={!hasContent}
                className="tech-card card-lift text-left p-5 animate-card-in group disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    <Icon
                      size={18}
                      weight="duotone"
                      className={doc.accent}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink transition-colors group-hover:text-orange">
                        {doc.title}
                      </span>
                      <CaretRight
                        size={12}
                        weight="bold"
                        className="text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                    <p className="mt-1 text-xs text-secondary leading-relaxed">
                      {doc.subtitle}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Source note */}
        <footer className="text-center py-6 border-t border-rule">
          <p className="text-xs text-muted font-mono">
            <span className="text-orange">docs://</span>botique-reference ·
            sourced from{" "}
            <span className="text-secondary font-medium">docs/*.md</span>
          </p>
        </footer>
      </div>
    );
  }

  /* ── Document view ───────────────────────────────── */
  const Icon = activeDoc.icon;

  return (
    <div className="space-y-6">
      {/* Back + title bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setActiveSlug(null)}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-orange transition-colors"
        >
          <ArrowLeft size={14} weight="bold" />
          <span>All docs</span>
        </button>
        <div className="w-px h-4 bg-rule" />
        <div className="flex items-center gap-2">
          <Icon size={16} weight="duotone" className={activeDoc.accent} />
          <h1 className="text-lg font-bold text-ink">{activeDoc.title}</h1>
        </div>
      </div>

      {/* Rendered markdown */}
      <article className="tech-card p-8 lg:p-10">
        <div className={PROSE_CLASSES}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {activeDoc.content}
          </ReactMarkdown>
        </div>
      </article>

      {/* Doc nav footer */}
      <nav className="flex flex-wrap gap-2">
        {DOC_CATALOGUE.filter((d) => d.slug !== activeSlug && docsBySlug[d.slug]).map(
          (doc) => {
            const NavIcon = doc.icon;
            return (
              <button
                key={doc.slug}
                onClick={() => {
                  setActiveSlug(doc.slug);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="flex items-center gap-2 border border-rule bg-white px-3 py-1.5 text-xs font-medium text-secondary transition-[background-color,border-color,color] hover:border-orange/20 hover:bg-orange-1 hover:text-orange"
              >
                <NavIcon size={12} weight="duotone" />
                {doc.title}
              </button>
            );
          },
        )}
      </nav>

      {/* Source */}
      <footer className="text-center py-4 border-t border-rule">
        <p className="text-xs text-muted font-mono">
          <FileText
            size={11}
            weight="duotone"
            className="inline-block mr-1 -mt-px text-secondary"
          />
          <span className="text-secondary">docs/{activeDoc.slug}.md</span>
        </p>
      </footer>
    </div>
  );
}
