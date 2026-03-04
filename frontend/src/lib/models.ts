/** Canonical list of supported Mistral model configurations. */
export const MISTRAL_MODELS = [
  { id: "mistral-large", label: "Mistral Large", model: "mistral-large-latest" },
  { id: "mistral-medium", label: "Mistral Medium", model: "mistral-medium-latest" },
  { id: "mistral-small", label: "Mistral Small", model: "mistral-small-latest" },
  { id: "magistral-medium", label: "Magistral Medium", model: "magistral-medium-latest" },
  { id: "magistral-small", label: "Magistral Small", model: "magistral-small-latest" },
  { id: "ministral-14b", label: "Ministral 14B", model: "ministral-14b-latest" },
  { id: "ministral-8b", label: "Ministral 8B", model: "ministral-8b-latest" },
  { id: "devstral-2", label: "Devstral 2", model: "devstral-2-25-12" },
  { id: "codestral", label: "Codestral", model: "codestral-latest" },
] as const;

export const DEFAULT_PROVIDER = "mistral" as const;
