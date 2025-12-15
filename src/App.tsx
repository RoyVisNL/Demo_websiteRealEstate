import React, { useEffect, useRef, useState } from 'react';
import { Sender, Message, ToolCallData, AnalysisState, GeminiToolCall } from './types';
import InputArea from './components/InputArea';
import ChatMessage from './components/ChatMessage';
import { initializeChat, sendMessageToGemini, sendToolResponseToGemini } from './services/geminiService';

interface ToolDefinition {
  name: string;
  description: string;
  autoExecute: boolean;
  handler: (args: Record<string, unknown>) => string;
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'list_calendar_events',
    description: 'Overzicht van komende afspraken in Google Agenda',
    autoExecute: true,
    handler: () =>
      JSON.stringify([
        {
          summary: 'Lunch met Jan',
          start: { dateTime: new Date(Date.now() + 86400000).toISOString() },
          description: 'Bespreking project X'
        },
        {
          summary: 'Tandartscontrole',
          start: { dateTime: new Date(Date.now() + 172800000).toISOString() }
        }
      ])
  },
  {
    name: 'read_gmail_inbox',
    description: 'Recente e-mails ophalen uit Gmail',
    autoExecute: true,
    handler: () =>
      JSON.stringify([
        {
          from: 'jan@bedrijf.nl',
          subject: 'Project update',
          snippet: 'Het gaat goed met de voortgang, kunnen we morgen even bellen?'
        },
        {
          from: 'nieuwsbrief@tech.com',
          subject: 'Wekelijkse update',
          snippet: 'De nieuwe AI trends van deze week...'
        }
      ])
  },
  {
    name: 'list_tasks',
    description: 'Takenlijst uit Google Tasks',
    autoExecute: true,
    handler: () =>
      JSON.stringify([
        { title: 'Rapport afmaken', status: 'needsAction' },
        { title: 'Bloemen bestellen', status: 'completed' }
      ])
  },
  {
    name: 'search_web',
    description: 'Snelle webzoekopdracht uitvoeren',
    autoExecute: true,
    handler: (args) => `Webzoekopdracht uitgevoerd voor ${JSON.stringify(args)}`
  },
  {
    name: 'draft_email',
    description: 'Concept e-mail voorbereiden in Gmail (met bevestiging)',
    autoExecute: false,
    handler: (args) => `Concept-e-mail voorbereid: ${JSON.stringify(args)}`
  }
];

const findToolDefinition = (name: string): ToolDefinition | undefined =>
  TOOL_DEFINITIONS.find((tool) => tool.name === name);

const createId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ isAnalyzing: false, statusMessage: '' });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeChat();
    setMessages([
      {
        id: createId(),
        sender: Sender.ASSISTANT,
        text:
          'Hallo! Ik ben je proactieve assistent. Ik kan je Google Workspace-apps lezen en schrijven, maar voer acties pas uit na jouw akkoord. Waarmee kan ik helpen?',
        timestamp: Date.now()
      }
    ]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, analysisState.isAnalyzing]);

  const performToolExecution = (name: string, args: Record<string, unknown>): string => {
    const toolDefinition = findToolDefinition(name);
    if (!toolDefinition) {
      throw new Error(`Onbekende tool: ${name}`);
    }
    return toolDefinition.handler(args);
  };

  const showErrorMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: createId(),
        sender: Sender.SYSTEM,
        text,
        timestamp: Date.now()
      }
    ]);
  };

  const appendSystemNote = (note: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: createId(),
        sender: Sender.SYSTEM,
        text: 'Automatische gegevensverzameling uitgevoerd.',
        systemNote: note,
        timestamp: Date.now()
      }
    ]);
  };

  const enrichToolCalls = (toolCalls?: GeminiToolCall[]): ToolCallData[] | undefined =>
    toolCalls?.map((call) => {
      const definition = findToolDefinition(call.name);
      return {
        id: call.id,
        name: call.name,
        args: call.args,
        status: 'pending',
        userConfirmationRequired: !definition?.autoExecute
      };
    });

  const handleSendMessage = async (text: string, image: string | null) => {
    const userMsg: Message = {
      id: createId(),
      sender: Sender.USER,
      text: text || undefined,
      image: image || undefined,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, userMsg]);
    setAnalysisState({ isAnalyzing: true, statusMessage: 'Situatie analyseren...' });

    try {
      const response = await sendMessageToGemini(text, image || undefined);
      let assistantText = response.textResponse;
      let pendingToolCalls = enrichToolCalls(response.toolCalls);

      const autoTools = pendingToolCalls?.filter((t) => findToolDefinition(t.name)?.autoExecute);
      const manualTools = pendingToolCalls?.filter((t) => !findToolDefinition(t.name)?.autoExecute);

      if (autoTools && autoTools.length > 0) {
        setAnalysisState({ isAnalyzing: true, statusMessage: 'Gegevens ophalen...' });
        const executedResults = autoTools.map((t) => ({
          ...t,
          result: performToolExecution(t.name, t.args),
          status: 'executed' as const
        }));

        appendSystemNote(
          `Automatisch uitgevoerd: ${executedResults
            .map((t) => `${t.name} (${findToolDefinition(t.name)?.description || 'nvt'})`)
            .join(', ')}.`
        );

        const followUpText = await sendToolResponseToGemini(executedResults);
        assistantText = followUpText;
        pendingToolCalls = manualTools && manualTools.length > 0 ? manualTools : undefined;
      }

      const assistantMsg: Message = {
        id: createId(),
        sender: Sender.ASSISTANT,
        text: assistantText,
        toolCalls: pendingToolCalls,
        timestamp: Date.now()
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
      showErrorMessage('Er ging iets mis bij het verbinden met de assistent. Probeer het opnieuw.');
    } finally {
      setAnalysisState({ isAnalyzing: false, statusMessage: '' });
    }
  };

  const executeAction = async (toolCall: ToolCallData, messageId: string) => {
    try {
      const executionResult = performToolExecution(toolCall.name, toolCall.args);
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId && msg.toolCalls) {
            return {
              ...msg,
              toolCalls: msg.toolCalls.map((tc) =>
                tc.id === toolCall.id ? { ...tc, status: 'executed', result: executionResult } : tc
              )
            };
          }
          return msg;
        })
      );

      setAnalysisState({ isAnalyzing: true, statusMessage: 'Actie bevestigen aan assistent...' });
      const textResponse = await sendToolResponseToGemini([{ ...toolCall, result: executionResult }]);

      if (textResponse) {
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            sender: Sender.ASSISTANT,
            text: textResponse,
            timestamp: Date.now()
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to execute tool', error);
      showErrorMessage('Uitvoeren van de actie is mislukt. Controleer de parameters en probeer opnieuw.');
    } finally {
      setAnalysisState({ isAnalyzing: false, statusMessage: '' });
    }
  };

  const rejectAction = (toolCall: ToolCallData, messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.toolCalls) {
          return {
            ...msg,
            toolCalls: msg.toolCalls.map((tc) => (tc.id === toolCall.id ? { ...tc, status: 'rejected' } : tc))
          };
        }
        return msg;
      })
    );
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200 font-sans selection:bg-primary-500/30">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-tight">Proactieve Assistent</h1>
            <p className="text-xs text-slate-400">Analyse • Voorstel • Uitvoering</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto pb-4">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onConfirmAction={(toolCall) => executeAction(toolCall, msg.id)}
              onRejectAction={(toolCall) => rejectAction(toolCall, msg.id)}
            />
          ))}

          {analysisState.isAnalyzing && (
            <div className="flex items-center gap-3 text-slate-400 animate-pulse ml-2">
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <span className="text-sm font-medium">{analysisState.statusMessage}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <InputArea onSend={handleSendMessage} disabled={analysisState.isAnalyzing} />
    </div>
  );
};

export default App;
