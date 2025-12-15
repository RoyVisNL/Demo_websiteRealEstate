import { GeminiResponse, GeminiToolCall, ToolCallData } from '../types';

// Mocked Gemini helpers for local development
export const initializeChat = (): void => {
  console.info('Chat initialized');
};

export const sendMessageToGemini = async (
  text: string,
  image?: string
): Promise<GeminiResponse> => {
  // Mock: echo text and propose a tool call to illustrate flow
  const toolCalls: GeminiToolCall[] = text.toLowerCase().includes('agenda')
    ? [
        {
          id: crypto.randomUUID(),
          name: 'list_calendar_events',
          args: { window: 'next_3_days' }
        }
      ]
    : [];

  return {
    textResponse:
      'Ik heb je bericht ontvangen en analyseer welke acties nuttig zijn. Wil je dat ik de voorgestelde stappen uitvoer?',
    toolCalls: toolCalls.length ? toolCalls : undefined
  };
};

export const sendToolResponseToGemini = async (
  results: ToolCallData[]
): Promise<string> => {
  const executedNames = results.map((r) => r.name).join(', ');
  return `Ik heb de resultaten verwerkt voor: ${executedNames}. Zal ik vervolgacties voorbereiden of iets toevoegen?`;
};
