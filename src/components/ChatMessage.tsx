import React from 'react';
import { Message, Sender, ToolCallData } from '../types';

interface ChatMessageProps {
  message: Message;
  onConfirmAction: (toolCall: ToolCallData) => void;
  onRejectAction: (toolCall: ToolCallData) => void;
}

const senderStyles: Record<Sender, string> = {
  [Sender.USER]: 'bg-primary-500/10 border border-primary-500/30 self-end',
  [Sender.ASSISTANT]: 'bg-slate-800/80 border border-slate-700',
  [Sender.SYSTEM]: 'bg-amber-500/10 border border-amber-500/40'
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onConfirmAction, onRejectAction }) => (
  <div className="mb-3">
    <div
      className={`rounded-2xl px-4 py-3 text-sm text-slate-100 max-w-3xl shadow-md ${senderStyles[message.sender]}`}
    >
      <div className="flex items-start gap-2">
        <div className="text-xs uppercase tracking-wider text-slate-400">
          {message.sender === Sender.USER ? 'Jij' : message.sender === Sender.ASSISTANT ? 'Assistent' : 'Systeem'}
        </div>
        <div className="flex-1 space-y-2">
          {message.text && <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>}
          {message.systemNote && <p className="text-amber-300 text-xs">{message.systemNote}</p>}

          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span className="px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-500/40">
                  Acties in afwachting
                </span>
                <span>Bevestig voor uitvoeren</span>
              </div>
              {message.toolCalls.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="font-semibold text-sm text-white">{tool.name}</p>
                    <p className="text-xs text-slate-400">{JSON.stringify(tool.args)}</p>
                    {tool.status === 'executed' && tool.result && (
                      <p className="text-xs text-emerald-300 mt-1">Resultaat: {tool.result}</p>
                    )}
                    {tool.status === 'rejected' && (
                      <p className="text-xs text-amber-300 mt-1">Afgewezen, geen actie uitgevoerd.</p>
                    )}
                  </div>
                  {tool.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs"
                        onClick={() => onConfirmAction(tool)}
                      >
                        Uitvoeren
                      </button>
                      <button
                        className="px-3 py-1 rounded-md bg-slate-600 text-white text-xs"
                        onClick={() => onRejectAction(tool)}
                      >
                        Annuleren
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default ChatMessage;
