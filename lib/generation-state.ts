type GenerationStatus = {
  isGenerating: boolean;
  progress: number;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
};

const globalForGeneration = globalThis as unknown as {
  generationStatus?: GenerationStatus;
};

export function getGenerationStatus(): GenerationStatus {
  if (!globalForGeneration.generationStatus) {
    globalForGeneration.generationStatus = {
      isGenerating: false,
      progress: 0,
      message: "尚未開始",
      startedAt: null,
      finishedAt: null,
    };
  }

  return globalForGeneration.generationStatus;
}

export function setGenerationStatus(partial: Partial<GenerationStatus>) {
  const current = getGenerationStatus();

  globalForGeneration.generationStatus = {
    ...current,
    ...partial,
  };

  return globalForGeneration.generationStatus;
}

export function resetGenerationStatus() {
  globalForGeneration.generationStatus = {
    isGenerating: false,
    progress: 0,
    message: "尚未開始",
    startedAt: null,
    finishedAt: null,
  };

  return globalForGeneration.generationStatus;
}