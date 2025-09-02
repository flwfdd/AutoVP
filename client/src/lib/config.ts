const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
  llm: {
    baseURL: import.meta.env.VITE_LLM_BASE_URL || 'http://127.0.0.1:8000/openai',
    apiKey: import.meta.env.VITE_LLM_API_KEY || '',
    models: (import.meta.env.VITE_LLM_MODELS ? import.meta.env.VITE_LLM_MODELS.split(',').map((model: string) => model.trim()) : ['kimi-k2-instruct']) as string[],
  },
  codeEditorModel: import.meta.env.VITE_CODE_EDITOR_MODEL || 'kimi-k2-instruct',
};

export default config;
