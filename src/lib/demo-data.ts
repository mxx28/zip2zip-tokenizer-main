export type TokenKind = "base" | "zip" | "special" | "pad";
export type CompressionViewMode = "optimal" | "model";

export interface DemoTokenizerMetadata {
  name: string;
  base_vocab_size: number;
  zip_token_start: number;
  zip_vocab_size?: number | null;
  pad_token_id?: number | null;
  eos_token_id?: number | null;
  special_token_ids?: number[];
}

export interface DemoModelManifestEntry {
  slug: string;
  label: string;
  repo?: string;
  model_group?: string;
  ms?: string;
  tokenizer: DemoTokenizerMetadata;
  results_file: string;
  run_id?: string;
  run_label?: string;
  run_path?: string;
}

export interface DemoManifestExample {
  id: string;
  category?: string;
  display_label?: string;
  prompt: string;
}

export interface DemoManifest {
  schema_version: number;
  models: DemoModelManifestEntry[];
  examples: DemoManifestExample[];
}

export interface DemoRunIndexEntry {
  id: string;
  path: string;
  label?: string;
}

export interface DemoRunIndex {
  schema_version: number;
  runs: DemoRunIndexEntry[];
}

export interface DemoToken {
  index: number;
  id: number;
  text?: string;
  kind?: TokenKind;
  source_token_start?: number | null;
  source_token_end?: number | null;
  expands_to_token_ids?: number[];
}

export interface DemoCodebookEntry {
  id: number;
  base_token_ids: number[];
  base_token_texts?: string[];
  decoded_text?: string;
  length?: number;
}

export interface OriginalTokenData {
  token_ids?: number[];
  tokens?: DemoToken[];
  decoded_text?: string;
}

export interface CompressedTokenData {
  compressed_token_ids?: number[];
  tokens?: DemoToken[];
  codebook?: DemoCodebookEntry[];
  reconstructed_token_ids?: number[];
  reconstructed_text?: string;
}

export interface ModelResultTokenData extends CompressedTokenData {
  raw_generated_token_ids?: number[];
}

export interface DemoExampleStatus {
  valid_output?: boolean | number | null;
  empty_or_too_short?: boolean | number | null;
  degenerate_repetition?: boolean | number | null;
}

export type DemoMetricValue = number | boolean | string | null | undefined;

export interface DemoMetrics {
  prompt_bytes?: DemoMetricValue;
  response_bytes?: DemoMetricValue;
  base_new_tokens?: DemoMetricValue;
  theory_new_zip_tokens?: DemoMetricValue;
  actual_new_zip_tokens?: DemoMetricValue;
  actual_new_zip_tokens_raw?: DemoMetricValue;
  actual_bytes_per_zip_token?: DemoMetricValue;
  theory_bytes_per_zip_token?: DemoMetricValue;
  compression_efficiency?: DemoMetricValue;
  base_token_saving?: DemoMetricValue;
  gpt2_mean_nll?: DemoMetricValue;
  gpt2_bits_per_byte?: DemoMetricValue;
  valid_output?: DemoMetricValue;
  empty_or_too_short?: DemoMetricValue;
  repeat_4gram_rate?: DemoMetricValue;
  max_4gram_count?: DemoMetricValue;
  degenerate_repetition?: DemoMetricValue;
  [key: string]: DemoMetricValue;
}

export interface DemoExampleResult {
  example_id: string;
  category?: string;
  prompt: string;
  response: string;
  status?: DemoExampleStatus;
  original?: OriginalTokenData;
  optimal?: CompressedTokenData;
  model_result?: ModelResultTokenData;
  metrics?: DemoMetrics;
}

export interface DemoModelResults {
  model_slug: string;
  model?: string;
  model_group?: string;
  ms?: string;
  tokenizer?: DemoTokenizerMetadata;
  examples: DemoExampleResult[];
}

export const DEMO_RUNS_INDEX_PATH = "/demo-runs/index.json";

export async function fetchDemoJson<T>(path: string): Promise<T> {
  const cacheBuster = path.includes("?") ? "&" : "?";
  const response = await fetch(`${path}${cacheBuster}v=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function resolveDemoDataPath(resultsFile: string): string {
  if (resultsFile.startsWith("/")) return resultsFile;
  return `/demo-runs/${resultsFile}`;
}

export function resolveDemoRunPath(runPath: string): string {
  if (runPath.startsWith("/")) return runPath;
  return `/demo-runs/${runPath}`;
}

export function findExampleResult(
  modelResults: DemoModelResults | null,
  exampleId: string
): DemoExampleResult | null {
  return modelResults?.examples.find((example) => example.example_id === exampleId) ?? null;
}

export function formatCount(value: DemoMetricValue): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  if (typeof value === "string" && value.length > 0) return value;

  return "Missing";
}

export function formatMetricValue(value: DemoMetricValue, options?: { percent?: boolean }): string {
  if (value === null || value === undefined || value === "") return "Missing";

  if (typeof value === "boolean") return value ? "true" : "false";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "Missing";
    if (options?.percent) return `${(value * 100).toFixed(2)}%`;
    return value.toFixed(2);
  }

  return value;
}

export function metricAsNumber(value: DemoMetricValue): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function tokenLabel(token: DemoToken): string {
  if (token.text !== undefined && token.text.length > 0) {
    return token.text
      .replace(/\r\n/g, "\\n")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  }
  if (token.text === "") return `[space:${token.id}]`;
  return `[${token.id}]`;
}

export function tokenKind(token: DemoToken, tokenizer?: DemoTokenizerMetadata): TokenKind {
  if (token.kind) return token.kind;
  if (tokenizer && token.id >= tokenizer.zip_token_start) return "zip";
  return "base";
}

export function codebookForMode(
  result: DemoExampleResult | null,
  mode: CompressionViewMode
): DemoCodebookEntry[] {
  if (!result) return [];
  return mode === "optimal"
    ? result.optimal?.codebook ?? []
    : result.model_result?.codebook ?? [];
}

export function statusFlag(value: DemoMetricValue): boolean {
  return value === true || value === 1 || value === "true" || value === "1";
}
