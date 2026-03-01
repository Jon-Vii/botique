import { useState } from "react";
import { Key, Eye, EyeSlash, CheckCircle } from "@phosphor-icons/react";

export function ApiKeyPanel({
  apiKey,
  onChange,
}: {
  apiKey: string;
  onChange: (key: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="tech-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Key size={14} weight="duotone" className="text-orange" />
        <span className="font-pixel-grid text-[10px] text-orange uppercase tracking-widest">
          Mistral API Key
        </span>
        {apiKey && (
          <span className="ml-auto flex items-center gap-1 text-emerald text-[10px] font-mono">
            <CheckCircle size={10} weight="fill" />
            configured
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={visible ? "text" : "password"}
            value={apiKey}
            onChange={(e) => onChange(e.target.value)}
            placeholder="sk-..."
            spellCheck={false}
            autoComplete="off"
            className="w-full border border-rule bg-white px-3 py-2 pr-9 text-sm font-mono text-ink placeholder:text-muted/40 transition-[border-color,box-shadow] focus:outline-none focus:border-orange/40 focus:shadow-[0_0_0_2px_rgba(255,112,0,0.08)]"
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-secondary cursor-pointer transition-colors"
          >
            {visible ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {apiKey && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-muted hover:text-rose font-mono cursor-pointer transition-colors"
          >
            clear
          </button>
        )}
      </div>

      <p className="mt-2 text-[11px] text-muted leading-relaxed">
        Your key is stored in your browser's local storage and sent with each
        launch request. It is never persisted on the server.
      </p>
    </div>
  );
}
