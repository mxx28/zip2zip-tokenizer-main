import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface CompressionConfig {
  /** Initial vocabulary size (e.g., 128000 for base tokens) */
  initialVocabSize: number;
  /** Maximum size of the codebook (how many new codes can be created) */
  maxCodebookSize: number;
  /** Maximum number of subtokens that can be merged into one code */
  maxSubtokens: number;
  /** Set of token IDs that should not be compressed (e.g., special tokens) */
  disabledIds?: Set<number>;
}

export interface CompressionResult {
  /** The compressed token IDs */
  compressedIds: number[];
  /** Codebook mapping: compressed ID -> original token sequence */
  codebook: Map<number, number[]>;
}

/**
 * Simplified LZW encoding function
 * 
 * @param ids - Array of token IDs to compress
 * @param config - Compression configuration
 * @returns Compressed IDs and the codebook
 */
export function lzwEncode(ids: number[], config: CompressionConfig): CompressionResult {
  const compressedIds: number[] = [];
  const codebook = new Map<number, number[]>();
  const reverseCodebook = new Map<string, number>(); // key: ids joined by comma
  
  let buffer: number[] = [];
  let nextId = config.initialVocabSize;
  const disabledIds = config.disabledIds || new Set<number>();

  const isInCodebook = (ids: number[]): boolean => {
    if (ids.length === 1) {
      return ids[0] < config.initialVocabSize;
    }
    return reverseCodebook.has(ids.join(','));
  };

  const getCodeForBuffer = (buffer: number[]): number => {
    if (buffer.length === 1) {
      return buffer[0];
    }
    const key = buffer.join(',');
    const code = reverseCodebook.get(key);
    if (code === undefined) {
      throw new Error(`Code not found for buffer: ${buffer}`);
    }
    return code;
  };

  const emitBuffer = () => {
    if (buffer.length > 0) {
      const code = getCodeForBuffer(buffer);
      compressedIds.push(code);
    }
  };

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];

    // Handle disabled IDs - emit them directly without compression
    if (disabledIds.has(id)) {
      if (buffer.length > 0) {
        emitBuffer();
        buffer = [];
      }
      compressedIds.push(id);
      continue;
    }

    // Add current ID to buffer
    buffer.push(id);

    // Check if the extended buffer is in the codebook
    const inCodebook = isInCodebook(buffer);

    if (!inCodebook) {
      // Buffer is not in codebook, so we need to:
      // 1. Add buffer to codebook if we have space
      // 2. Emit buffer without the last element
      // 3. Reset buffer to just the current ID

      if (nextId < config.initialVocabSize + config.maxCodebookSize) {
        const key = buffer.join(',');
        reverseCodebook.set(key, nextId);
        codebook.set(nextId, [...buffer]);
        nextId++;
      }

      // Remove last element and emit
      buffer.pop();
      emitBuffer();
      buffer = [id];
    }

    // If buffer reaches max subtokens, emit it without adding to codebook
    if (buffer.length === config.maxSubtokens) {
      emitBuffer();
      buffer = [];
    }
  }

  // Handle remaining buffer
  if (buffer.length > 0) {
    emitBuffer();
  }

  return {
    compressedIds,
    codebook,
  };
}
