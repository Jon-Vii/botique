import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";

interface SnippetProps {
  text: string | string[];
  prompt?: boolean;
  dark?: boolean;
  copyable?: boolean;
  label?: string;
}

export function Snippet({
  text,
  prompt = true,
  dark = true,
  copyable = true,
  label,
}: SnippetProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lines = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);
  const isMultiLine = lines.length > 1;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = () => {
    const raw = lines.join("\n");
    void navigator.clipboard.writeText(raw);
    setCopied(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const containerClass = dark
    ? "bg-snippet-bg border-snippet-border text-snippet-text"
    : "bg-gray-1 border-rule text-gray-10";

  const promptColor = dark
    ? "text-snippet-muted"
    : "text-gray-7";

  const lineNumberColor = dark
    ? "text-snippet-muted"
    : "text-gray-7";

  const copyButtonClass = dark
    ? "text-snippet-muted hover:text-white"
    : "text-gray-7 hover:text-gray-10";

  return (
    <div className="inline-flex flex-col">
      {label && (
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted mb-1.5">
          {label}
        </span>
      )}
      <div className={`relative group border font-mono text-[13px] leading-relaxed ${containerClass}`}>
        <div className={`px-4 py-3 ${copyable ? "pr-11" : ""}`}>
          {isMultiLine ? (
            <table className="border-collapse">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td
                      className={`text-right pr-4 select-none align-top ${lineNumberColor}`}
                      style={{ minWidth: "2ch" }}
                    >
                      {i + 1}
                    </td>
                    <td className="whitespace-pre">{line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span className="whitespace-pre">
              {prompt && (
                <span className={`select-none ${promptColor}`}>$ </span>
              )}
              {lines[0]}
            </span>
          )}
        </div>

        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy to clipboard"}
            className={`absolute top-3 right-3 p-0.5 transition-colors duration-150 cursor-pointer ${copyButtonClass}`}
          >
            {copied ? (
              <Check size={14} weight="bold" />
            ) : (
              <Copy size={14} weight="regular" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
