const config = {
  apiUrl: 'http://127.0.0.1:8000',
  llm: {
    baseURL: 'http://127.0.0.1:8000/openai',
    apiKey: '',
    models: ['DeepSeek-V3', 'DeepSeek-R1', 'o4-mini', 'claude-3-7-sonnet-20250219'],
  },
  codeEditorModel: 'DeepSeek-V3',
};

export default config;
