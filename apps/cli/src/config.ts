import { TrelexaConfig } from './api';

export function getConfig(): TrelexaConfig {
  const apiKey = process.env.TRELEXA_API_KEY;
  const apiUrl = process.env.TRELEXA_API_URL;

  if (!apiKey) {
    console.error('❌ Error: TRELEXA_API_KEY environment variable is required');
    console.error('Please set it using: export TRELEXA_API_KEY=your_api_key');
    process.exit(1);
  }

  return {
    apiKey,
    apiUrl,
  };
}
