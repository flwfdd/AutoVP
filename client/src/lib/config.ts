const config = {
  apiUrl: 'http://127.0.0.1:8000',
  llm: {
    baseURL: 'http://127.0.0.1:8000/openai',
    apiKey: '',
    models: ['DeepSeek-V3', 'DeepSeek-R1', 'o4-mini', 'aws-claude-sonnet-4-20250514'],
  },
  codeEditorModel: 'aws-claude-sonnet-4-20250514',
};

export default config;
