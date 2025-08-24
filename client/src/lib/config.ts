const config = {
  apiUrl: 'http://127.0.0.1:8000',
  llm: {
    baseURL: 'http://127.0.0.1:8000/openai',
    apiKey: '',
    models: ['kimi-k2-instruct', 'gemini-2.5-pro', 'gpt-5-chat-latest', 'o4-mini', 'claude-sonnet-4-20250514'],
  },
  codeEditorModel: 'kimi-k2-instruct',
};

export default config;
