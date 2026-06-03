"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect, useCallback } from "react";
import { lzwEncode, type CompressionConfig } from "@/lib/utils";
import { AutoTokenizer, PreTrainedTokenizer } from "@huggingface/transformers";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Base token colors
const BASE_COLORS = [
  "bg-sky-200",
  "bg-amber-200",
  "bg-blue-200",
  "bg-green-200",
  "bg-orange-200",
  "bg-cyan-200",
  "bg-gray-200",
  "bg-purple-200",
  "bg-indigo-200",
  "bg-lime-200",
  "bg-rose-200",
  "bg-violet-200",
  "bg-yellow-200",
  "bg-emerald-200",
  "bg-zinc-200",
  "bg-red-200",
  "bg-fuchsia-200",
  "bg-pink-200",
  "bg-teal-200",
];

// Hyper-token colors - Flashy versions
const HYPER_COLORS = [
  "bg-sky-700 text-white",
  "bg-amber-700 text-white",
  "bg-blue-700 text-white",
  "bg-green-700 text-white",
  "bg-orange-700 text-white",
  "bg-cyan-700 text-white",
  "bg-gray-700 text-white",
  "bg-purple-700 text-white",
  "bg-indigo-700 text-white",
  "bg-lime-700 text-white",
  "bg-rose-700 text-white",
  "bg-violet-700 text-white",
  "bg-yellow-700 text-white",
  "bg-emerald-700 text-white",
  "bg-zinc-700 text-white",
  "bg-red-700 text-white",
  "bg-fuchsia-700 text-white",
  "bg-pink-700 text-white",
  "bg-teal-700 text-white",
];

const MODELS = [
  { value: "mlx-community/Meta-Llama-3-8B-Instruct-4bit", label: "Llama-3.1", initialVocabSize: 128256 },
  { value: "microsoft/Phi-3-mini-4k-instruct", label: "Phi-3", initialVocabSize: 32064 },
  { value: "swiss-ai/Apertus-8B-2509", label: "Apertus", initialVocabSize: 131072 },
  { value: "Qwen/Qwen3-4B-Instruct-2507", label: "Qwen3", initialVocabSize: 151936 },
  { value: "openai/gpt-oss-20b", label: "GPT-OSS", initialVocabSize: 201088 },
];

const TEXT_EXAMPLES = [
  { 
    value: "quick-fox", 
    label: "Quick Fox",
    text: "The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog."
  },
  {
    value: "code",
    label: "Code Example",
    text: "function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconst result = fibonacci(10);\nconsole.log(result);"
  },
  {
    value: "repetitive",
    label: "Repetitive Pattern",
    text: "abc abc abc def def def abc abc def abc abc abc def def abc def abc abc abc abc def def def abc abc abc"
  }
];

// Default LZW Compression Configuration
const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  initialVocabSize: 128256,
  maxCodebookSize: 1024,
  maxSubtokens: 4,
  disabledIds: new Set([0]),
};

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [tokens, setTokens] = useState<string[]>([]);
  const [tokenIds, setTokenIds] = useState<number[]>([]);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [codebookDialogOpen, setCodebookDialogOpen] = useState(false);
  const [compressedIds, setCompressedIds] = useState<number[]>([]);
  const [selectedExample, setSelectedExample] = useState("quick-fox");
  const [selectedModel, setSelectedModel] = useState(MODELS[0].value);
  const [compressedTokens, setCompressedTokens] = useState<string[]>([]);
  const [tokenizers, setTokenizers] = useState<Record<string, PreTrainedTokenizer>>({});
  const [text, setText] = useState(TEXT_EXAMPLES.find(ex => ex.value === selectedExample)?.text || "");
  const [compressionConfig, setCompressionConfig] = useState<CompressionConfig>(DEFAULT_COMPRESSION_CONFIG);
  const [codebook, setCodebook] = useState<Map<number, number[]>>(new Map());
  const [tokenCardsLayout, setTokenCardsLayout] = useState<"vertical" | "horizontal">("vertical");
  
  // Streaming simulation states
  const [isStreaming, setIsStreaming] = useState(false);
  const [originalGenerationTime, setOriginalGenerationTime] = useState<number | null>(null);
  const [compressedGenerationTime, setCompressedGenerationTime] = useState<number | null>(null);
  
  // Hover states for bidirectional highlighting
  const [hoveredCompressedIndex, setHoveredCompressedIndex] = useState<number | null>(null);
  
  // Mapping from compressed token index to original token indices
  const [compressionMapping, setCompressionMapping] = useState<Map<number, number[]>>(new Map());
  
  // Form state for editing config
  const [formConfig, setFormConfig] = useState({
    maxCodebookSize: DEFAULT_COMPRESSION_CONFIG.maxCodebookSize.toString(),
    maxSubtokens: DEFAULT_COMPRESSION_CONFIG.maxSubtokens.toString(),
  });

  const loadTokenizer = useCallback(async (modelName: string) => {
    if (tokenizers[modelName]) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const newTokenizer = await AutoTokenizer.from_pretrained(modelName);

      setTokenizers((prev) => ({
        ...prev,
        [modelName]: newTokenizer,
      }));
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading tokenizer:", error);
      setIsLoading(false);
    }
  }, [tokenizers]);

  const handleModelChange = (modelName: string) => {
    setSelectedModel(modelName);
    loadTokenizer(modelName);
  };

  const handleExampleChange = (exampleValue: string) => {
    setSelectedExample(exampleValue);
    const example = TEXT_EXAMPLES.find(ex => ex.value === exampleValue);
    if (example) {
      setText(example.text);
    }
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    // If text is manually changed, switch to custom
    const currentExample = TEXT_EXAMPLES.find(ex => ex.value === selectedExample);
    if (currentExample && newText !== currentExample.text) {
      setSelectedExample("custom");
    }
  };

  useEffect(() => {
    loadTokenizer(selectedModel);
  }, [loadTokenizer, selectedModel]);

  // Update compression config when tokenizer changes
  useEffect(() => {
    const currentTokenizer = tokenizers[selectedModel];
    
    if (!currentTokenizer) return;

    // Get vocab size from tokenizer
    const vocabSize = currentTokenizer.model?.vocab?.length || 
                      Object.keys(currentTokenizer.model?.vocab || {}).length ||
                      DEFAULT_COMPRESSION_CONFIG.initialVocabSize;

    // Get special token IDs
    const specialTokenIds = new Set<number>();
    
    // Access special_tokens object from tokenizer config
    if (currentTokenizer.special_tokens) {
      const specialTokens = currentTokenizer.special_tokens;
      
      // Iterate through all special token types
      for (const tokenValue of Object.values(specialTokens)) {
        if (tokenValue && typeof tokenValue === "object" && "id" in tokenValue) {
          specialTokenIds.add((tokenValue as any).id);
        } else if (typeof tokenValue === "number") {
          specialTokenIds.add(tokenValue);
        }
      }
    }

    // If no special tokens found, default to [0] (common padding token)
    if (specialTokenIds.size === 0) {
      specialTokenIds.add(0);
    }

    // Update compression config
    setCompressionConfig(prev => ({
      ...prev,
      initialVocabSize: vocabSize,
      disabledIds: specialTokenIds,
    }));
  }, [tokenizers, selectedModel]);

  useEffect(() => {
    const currentTokenizer = tokenizers[selectedModel];
    
    if (!text || isLoading || !currentTokenizer) {
      setTokens([]);
      setTokenIds([]);
      setCompressedIds([]);
      setOriginalGenerationTime(null);
      setCompressedGenerationTime(null);
      return;
    }

    try {
      const ids = currentTokenizer.encode(text);
      
      const tokenStrings = ids.map((id: number) => {
        const decoded = currentTokenizer.decode([id], { skip_special_tokens: false });
        return decoded;
      })
      
      setTokenIds(ids);
      setTokens(tokenStrings);
      setOriginalGenerationTime(null);
      setCompressedGenerationTime(null);
    } catch {
      setTokens([]);
      setTokenIds([]);
      setCompressedIds([]);
      setOriginalGenerationTime(null);
      setCompressedGenerationTime(null);
    }
  }, [text, tokenizers, selectedModel, isLoading]);

  // Compress token IDs using LZW (skip during streaming)
  useEffect(() => {
    const currentTokenizer = tokenizers[selectedModel];
    
    // Skip automatic compression during streaming
    if (isStreaming) return;
    
    if (tokenIds.length === 0 || !currentTokenizer) {
      setCompressedIds([]);
      setCompressedTokens([]);
      setCompressionMapping(new Map());
      setCodebook(new Map());
      return;
    }

    try {
      const { compressedIds, codebook } = lzwEncode(tokenIds, compressionConfig);
      setCompressedIds(compressedIds);
      setCodebook(codebook);

      // Build mapping from compressed token index to original token indices
      const mapping = new Map<number, number[]>();
      let originalIndex = 0;
      
      compressedIds.forEach((compressedId, compressedIndex) => {
        if (compressedId < compressionConfig.initialVocabSize) {
          // Base token - maps to single original token
          mapping.set(compressedIndex, [originalIndex]);
          originalIndex++;
        } else {
          // Compressed token - get subtokens from codebook
          const subtokens = codebook.get(compressedId);
          if (subtokens) {
            const indices: number[] = [];
            for (let i = 0; i < subtokens.length; i++) {
              indices.push(originalIndex + i);
            }
            mapping.set(compressedIndex, indices);
            originalIndex += subtokens.length;
          }
        }
      });
      
      setCompressionMapping(mapping);

      // Decode compressed IDs to strings
      const compressedStrings = compressedIds.map((id) => {
        if (id < compressionConfig.initialVocabSize) {
          // Base token - decode normally
          return currentTokenizer.decode([id], { skip_special_tokens: false });
        } else {
          // Compressed token - get subtokens from codebook and decode
          const subtokens = codebook.get(id);
          if (subtokens) {
            return currentTokenizer.decode(subtokens, { skip_special_tokens: false });
          }
          return `[Unknown:${id}]`;
        }
      });
      
      setCompressedTokens(compressedStrings);
    } catch (error) {
      console.error("Compression error:", error);
      setCompressedIds([]);
      setCompressedTokens([]);
      setCompressionMapping(new Map());
    }
  }, [tokenIds, tokenizers, selectedModel, compressionConfig, isStreaming]);

  const handleConfigSave = () => {
    const newConfig: CompressionConfig = {
      initialVocabSize: compressionConfig.initialVocabSize, // Keep existing vocab size
      maxCodebookSize: parseInt(formConfig.maxCodebookSize) || DEFAULT_COMPRESSION_CONFIG.maxCodebookSize,
      maxSubtokens: parseInt(formConfig.maxSubtokens) || DEFAULT_COMPRESSION_CONFIG.maxSubtokens,
      disabledIds: compressionConfig.disabledIds,
    };
    setCompressionConfig(newConfig);
    setConfigDialogOpen(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      // Reset form to current config when opening
      setFormConfig({
        maxCodebookSize: compressionConfig.maxCodebookSize.toString(),
        maxSubtokens: compressionConfig.maxSubtokens.toString(),
      });
    }
    setConfigDialogOpen(open);
  };

  const simulateLLMGeneration = useCallback(async () => {
    const currentTokenizer = tokenizers[selectedModel];
    if (!currentTokenizer || isStreaming || !text) return;

    setIsStreaming(true);
    setOriginalGenerationTime(0);
    setCompressedGenerationTime(0);
    
    let shouldContinue = true;
    const startTime = Date.now();
    
    try {
      // Tokenize and compress the full text upfront
      const ids = currentTokenizer.encode(text);
      const tokenStrings = ids.map((id: number) => 
        currentTokenizer.decode([id], { skip_special_tokens: false })
      );
      
      // Compress the tokens
      const { compressedIds: fullCompressedIds, codebook } = lzwEncode(ids, compressionConfig);
      
      // Build mapping from compressed token index to original token indices
      const mapping = new Map<number, number[]>();
      let originalIndex = 0;
      
      fullCompressedIds.forEach((compressedId, compressedIndex) => {
        if (compressedId < compressionConfig.initialVocabSize) {
          mapping.set(compressedIndex, [originalIndex]);
          originalIndex++;
        } else {
          const subtokens = codebook.get(compressedId);
          if (subtokens) {
            const indices: number[] = [];
            for (let i = 0; i < subtokens.length; i++) {
              indices.push(originalIndex + i);
            }
            mapping.set(compressedIndex, indices);
            originalIndex += subtokens.length;
          }
        }
      });
      
      // Decode compressed tokens to strings
      const fullCompressedStrings = fullCompressedIds.map((id) => {
        if (id < compressionConfig.initialVocabSize) {
          return currentTokenizer.decode([id], { skip_special_tokens: false });
        } else {
          const subtokens = codebook.get(id);
          if (subtokens) {
            return currentTokenizer.decode(subtokens, { skip_special_tokens: false });
          }
          return `[Unknown:${id}]`;
        }
      });
      
      // Set the full token counts and mapping immediately (before streaming)
      setTokenIds(ids);
      setCompressedIds(fullCompressedIds);
      setCompressionMapping(new Map(mapping));
      
      // Clear the display tokens (these will stream in)
      setTokens([]);
      setCompressedTokens([]);
      
      // Arrays to accumulate streamed tokens for display
      const streamedTokens: string[] = [];
      const streamedCompressedTokens: string[] = [];
      
      // Track if each stream has finished
      let compressedFinished = false;
      let originalFinished = false;
      
      // Find the maximum number of iterations needed
      const maxIterations = Math.max(ids.length, fullCompressedIds.length);
      
      // Stream both original and compressed tokens in parallel
      for (let i = 0; i < maxIterations && shouldContinue; i++) {
        // Add original token if available
        if (i < ids.length) {
          streamedTokens.push(tokenStrings[i]);
        }
        
        // Add compressed token if available
        if (i < fullCompressedIds.length) {
          streamedCompressedTokens.push(fullCompressedStrings[i]);
        }
        
        // Update display tokens
        setTokens([...streamedTokens]);
        setCompressedTokens([...streamedCompressedTokens]);
        
        // Wait 0.1 seconds before next token
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Update generation times after the delay
        const elapsed = (Date.now() - startTime) / 1000;
        
        // Update compressed time and check if finished
        if (!compressedFinished) {
          setCompressedGenerationTime(elapsed);
          if (streamedCompressedTokens.length >= fullCompressedIds.length) {
            compressedFinished = true;
          }
        }
        
        // Update original time and check if finished
        if (!originalFinished) {
          setOriginalGenerationTime(elapsed);
          if (streamedTokens.length >= ids.length) {
            originalFinished = true;
          }
        }
        
        // Check if we should continue
        setIsStreaming(current => {
          shouldContinue = current;
          return current;
        });
      }
    } catch (error) {
      console.error("Error during streaming simulation:", error);
    } finally {
      setIsStreaming(false);
    }
  }, [tokenizers, selectedModel, isStreaming, text, compressionConfig]);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-4xl font-bold">Zip2Zip Tokenizer</h1>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Dialog open={configDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button variant="outline">Zip2Zip Config</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Compression Configuration</DialogTitle>
                  <DialogDescription>
                    Adjust the LZW compression parameters.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="maxCodebookSize">
                      Max Codebook Size
                    </Label>
                    <Input
                      id="maxCodebookSize"
                      type="number"
                      value={formConfig.maxCodebookSize}
                      onChange={(e) => setFormConfig({ ...formConfig, maxCodebookSize: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of new tokens
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="maxSubtokens">
                      Max Subtokens
                    </Label>
                    <Input
                      id="maxSubtokens"
                      type="number"
                      value={formConfig.maxSubtokens}
                      onChange={(e) => setFormConfig({ ...formConfig, maxSubtokens: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum tokens that can be merged into one new token
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleConfigSave}>Save Changes</Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="example-select">Text Example</Label>
              </div>
              <Select value={selectedExample} onValueChange={handleExampleChange} disabled={isLoading || isStreaming}>
                <SelectTrigger id="example-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEXT_EXAMPLES.map((example) => (
                    <SelectItem key={example.value} value={example.value}>
                      {example.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Textarea
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                className="min-h-[300px] font-mono"
                placeholder="Enter text to tokenize..."
                disabled={isLoading || isStreaming}
              />
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={simulateLLMGeneration}
                disabled={isLoading || isStreaming || !text}
                variant="default"
              >
                {isStreaming ? "Streaming..." : "Simulate LLM Generation"}
              </Button>
              {isStreaming && (
                <Button 
                  onClick={() => setIsStreaming(false)}
                  variant="outline"
                >
                  Stop
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6">
                <div className="text-sm text-muted-foreground mb-1">Original tokens</div>
                <div className="text-3xl font-bold">{tokenIds.length}</div>
              </Card>
              <Card className="p-6">
                <div className="text-sm text-muted-foreground mb-1">Compressed tokens</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold">{compressedIds.length}</div>
                  {tokenIds.length > 0 && compressedIds.length > 0 && (
                    <div className={`text-lg font-semibold ${
                      compressedIds.length / tokenIds.length < 1 
                        ? "text-green-700" 
                        : compressedIds.length / tokenIds.length === 1
                        ? "text-orange-700"
                        : "text-red-700"
                    }`}>
                      ({((compressedIds.length / tokenIds.length - 1) * 100).toFixed(1)}%)
                    </div>
                  )}
                </div>
              </Card>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setCodebookDialogOpen(true)}
                disabled={codebook.size === 0}
                variant="outline"
                className="flex-1"
              >
                Show Codebook ({codebook.size} entries)
              </Button>
              <Button
                onClick={() => setTokenCardsLayout(tokenCardsLayout === "vertical" ? "horizontal" : "vertical")}
                variant="outline"
                className="flex items-center gap-2"
              >
                {tokenCardsLayout === "horizontal" ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="12" y1="3" x2="12" y2="21"></line>
                    </svg>
                    <span>Side by Side</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="3" y1="12" x2="21" y2="12"></line>
                    </svg>
                    <span>Stacked</span>
                  </>
                )}
              </Button>
            </div>
            <div className={`grid gap-6 ${tokenCardsLayout === "horizontal" ? "grid-cols-2" : "grid-cols-1"}`}>
              <Card className="p-6">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm text-muted-foreground">Original Tokens</div>
                  {(originalGenerationTime !== null || isStreaming) && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {(originalGenerationTime || 0).toFixed(2)}s
                    </div>
                  )}
                </div>
                <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all m-0">
                  {isLoading ? (
                    <div className="text-muted-foreground">Loading tokenizer...</div>
                  ) : tokens.length === 0 ? (
                    <div className="text-muted-foreground">Enter text to see tokens...</div>
                  ) : (
                    <TooltipProvider>
                      {tokens.map((token, index) => {
                        // Determine if this token should be highlighted
                        const isHighlighted = 
                          hoveredCompressedIndex !== null && 
                          compressionMapping.get(hoveredCompressedIndex)?.includes(index);
                        
                        // Use base colors for original tokens
                        const colorClass = BASE_COLORS[index % BASE_COLORS.length];
                        const opacityClass = hoveredCompressedIndex === null || isHighlighted ? "" : "opacity-30";
                        
                        return (
                          <Tooltip key={index} delayDuration={100}>
                            <TooltipTrigger asChild>
                            <span
                              className={`${colorClass} ${opacityClass} cursor-default transition-all`}
                            >
                              {token}
                            </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">ID: {tokenIds[index]}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  )}
                </pre>
              </Card>
              <Card className="p-6">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm text-muted-foreground">Compressed Tokens</div>
                  {(compressedGenerationTime !== null || isStreaming) && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {(compressedGenerationTime || 0).toFixed(2)}s
                    </div>
                  )}
                </div>
                <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all m-0">
                  {compressedTokens.length > 0 ? (
                    <TooltipProvider>
                      {compressedTokens.map((token, index) => {
                        const originalIndices = compressionMapping.get(index) || [];
                        const isMultiToken = originalIndices.length > 1;
                        const isHyperToken = compressedIds[index] >= compressionConfig.initialVocabSize;
                        const opacityClass = hoveredCompressedIndex === null || hoveredCompressedIndex === index ? "" : "opacity-30";
                        
                        // Use hyper colors for compressed tokens, base colors for regular tokens
                        const colorPalette = isHyperToken ? HYPER_COLORS : BASE_COLORS;
                        const colorClass = colorPalette[index % colorPalette.length];
                        
                        return (
                          <Tooltip key={index} delayDuration={100}>
                            <TooltipTrigger asChild>
                              <span
                                className={`${colorClass} ${opacityClass} cursor-default transition-all`}
                                onMouseEnter={() => setHoveredCompressedIndex(index)}
                                onMouseLeave={() => setHoveredCompressedIndex(null)}
                              >
                                {token}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">ID: {compressedIds[index]}</p>
                              {isMultiToken && (
                                <p className="text-xs text-muted-foreground">
                                  Compressed {originalIndices.length} tokens
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  ) : (
                    <div className="text-muted-foreground">No compressed tokens yet...</div>
                  )}
                </pre>
              </Card>
            </div>
          </div>
        </div>
        
        <Dialog open={codebookDialogOpen} onOpenChange={setCodebookDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Codebook</DialogTitle>
              <DialogDescription>
                Mapping of compressed token IDs to their original token sequences. Codebook size: {codebook.size} entries.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              {Array.from(codebook.entries()).map(([compressedId, originalIds]) => {
                const currentTokenizer = tokenizers[selectedModel];
                if (!currentTokenizer) return null;
                
                // Decode the original tokens
                const originalTokenStrings = originalIds.map(id => 
                  currentTokenizer.decode([id], { skip_special_tokens: false })
                );
                const fullText = currentTokenizer.decode(originalIds, { skip_special_tokens: false });
                
                return (
                  <div key={compressedId} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-muted-foreground">
                        ID {compressedId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        → {originalIds.length} token{originalIds.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Original IDs:</div>
                        <div className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {originalIds.join(", ")}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Text:</div>
                        <div className="font-mono text-sm bg-muted px-2 py-1 rounded break-all">
                          &quot;{fullText}&quot;
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Tokens:</div>
                      <div className="flex flex-wrap gap-1">
                        {originalTokenStrings.map((token, idx) => (
                          <span 
                            key={idx} 
                            className={`${BASE_COLORS[idx % BASE_COLORS.length]} px-2 py-0.5 rounded text-xs font-mono`}
                          >
                            {token}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
