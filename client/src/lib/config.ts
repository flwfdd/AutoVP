const config = {
  apiUrl: 'http://127.0.0.1:8000',
  llm: {
    baseURL: 'http://127.0.0.1:8000/openai',
    apiKey: '',
    models: ['moonshot-v1-chat'],
  },
  codeEditorModel: 'moonshot-v1-chat',
};

export default config;
