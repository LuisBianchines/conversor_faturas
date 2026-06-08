import { ApiError } from '../utils/errors.js';

export interface OllamaGenerateOptions {
  prompt: string;
  model?: string;
  timeoutMs?: number;
}

export async function* streamTextWithOllama(
  options: OllamaGenerateOptions,
): AsyncGenerator<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const model = options.model ?? process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
  const timeoutMs = options.timeoutMs ?? 120_000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model, prompt: options.prompt, stream: true, format: 'json' }),
    });
  } catch {
    clearTimeout(timeout);
    throw new ApiError('OLLAMA_UNAVAILABLE', 'Ollama não está rodando. Inicie com: ollama serve');
  }

  if (!response.ok) {
    clearTimeout(timeout);
    throw new ApiError(
      'OLLAMA_UNAVAILABLE',
      `Ollama respondeu com status ${response.status}. Verifique se o modelo está disponível.`,
    );
  }

  if (!response.body) {
    clearTimeout(timeout);
    throw new ApiError('OLLAMA_UNAVAILABLE', 'Resposta sem body do Ollama.');
  }

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line) as { response?: string; done?: boolean };
          if (chunk.response) yield chunk.response;
          if (chunk.done) return;
        } catch {
          // ignora chunks malformados
        }
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateJsonWithOllama<T>(
  options: OllamaGenerateOptions,
): Promise<T> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const model = options.model ?? process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
  const timeoutMs = options.timeoutMs ?? 120_000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;

    try {
      response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt: options.prompt,
          stream: false,
          format: 'json',
        }),
      });
    } catch {
      throw new ApiError(
        'OLLAMA_UNAVAILABLE',
        'Ollama não está rodando. Inicie com: ollama serve',
      );
    }

    if (!response.ok) {
      throw new ApiError(
        'OLLAMA_UNAVAILABLE',
        `Ollama respondeu com status ${response.status}. Verifique se o modelo está disponível.`,
      );
    }

    const data = (await response.json()) as { response?: string };

    if (!data.response) {
      throw new ApiError('OLLAMA_INVALID_JSON', 'Resposta vazia do Ollama.');
    }

    try {
      return JSON.parse(data.response) as T;
    } catch {
      throw new ApiError(
        'OLLAMA_INVALID_JSON',
        'O modelo retornou JSON inválido. Tente novamente.',
        data.response,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}
