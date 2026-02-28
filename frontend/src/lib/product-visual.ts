/**
 * Warm, colorful gradients for product visuals.
 * Bright and fun on a light background.
 */

const STYLE_PALETTES: Record<string, [string, string]> = {
  minimalist: ["#F5F0E8", "#EDE8DD"],
  retro: ["#FDDCB5", "#FCB97D"],
  kawaii: ["#FDDDE6", "#F0C4D8"],
  cottagecore: ["#D8EBD2", "#C4D9B0"],
};

const SUBJECT_ACCENTS: Record<string, string> = {
  cat: "#FFD1B8",
  cats: "#FFD1B8",
  mushroom: "#C8E0B4",
  mushrooms: "#C8E0B4",
  mountain: "#BAD4F0",
  mountains: "#BAD4F0",
  floral: "#F5C6D0",
  florals: "#F5C6D0",
  celestial: "#D0C4F0",
  space: "#C0B8F0",
  ocean: "#B0E0E8",
  forest: "#A8D8A0",
  sunset: "#FFD0A0",
  botanical: "#C0E0B0",
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const FUN_GRADIENTS: [string, string][] = [
  ["#FFE8D0", "#FDD8B8"],
  ["#D8F0D0", "#C8E8C0"],
  ["#D8E8F8", "#C8D8F0"],
  ["#F8E0E8", "#F0D0D8"],
  ["#FFF0D8", "#FFE4C0"],
  ["#E0E8F8", "#D0D8F0"],
  ["#F0F0E0", "#E8E8D0"],
  ["#F0E0F8", "#E8D0F0"],
  ["#E0F8F0", "#D0F0E8"],
  ["#F8F0D0", "#F0E8C0"],
];

export function getProductGradient(tags: string[], type: string): string {
  const lowerTags = tags.map((t) => t.toLowerCase());

  let palette: [string, string] | undefined;
  for (const [style, colors] of Object.entries(STYLE_PALETTES)) {
    if (lowerTags.some((t) => t.includes(style))) {
      palette = colors;
      break;
    }
  }

  let accent: string | undefined;
  for (const [subject, color] of Object.entries(SUBJECT_ACCENTS)) {
    if (lowerTags.some((t) => t.includes(subject))) {
      accent = color;
      break;
    }
  }

  if (!palette) {
    const hash = hashStr(tags.join(",") + type);
    palette = FUN_GRADIENTS[hash % FUN_GRADIENTS.length];
  }

  const accentLayer = accent
    ? `, radial-gradient(ellipse at 70% 30%, ${accent} 0%, transparent 70%)`
    : "";

  return `linear-gradient(145deg, ${palette[0]}, ${palette[1]})${accentLayer}`;
}

export function getProductEmoji(tags: string[], type: string): string {
  const all = [...tags, type].join(" ").toLowerCase();
  if (all.includes("cat")) return "\u{1F431}";
  if (all.includes("mushroom")) return "\u{1F344}";
  if (all.includes("mountain")) return "\u{26F0}\u{FE0F}";
  if (all.includes("floral") || all.includes("flower")) return "\u{1F33A}";
  if (all.includes("celestial") || all.includes("space")) return "\u{2728}";
  if (all.includes("ocean") || all.includes("wave")) return "\u{1F30A}";
  if (all.includes("forest")) return "\u{1F332}";
  if (all.includes("sunset")) return "\u{1F305}";
  if (all.includes("sticker")) return "\u{1F4CB}";
  if (all.includes("planner")) return "\u{1F4D3}";
  if (all.includes("wallpaper")) return "\u{1F4F1}";
  if (all.includes("art") || all.includes("print")) return "\u{1F5BC}\u{FE0F}";
  return "\u{2726}";
}
