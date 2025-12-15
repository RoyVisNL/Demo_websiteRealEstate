import React, { useState, useRef } from 'react';

interface InputAreaProps {
  onSend: (text: string, image: string | null) => void;
  disabled?: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() && !fileRef.current?.files?.length) return;

    const file = fileRef.current?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        onSend(text, reader.result as string);
        setText('');
        if (fileRef.current) fileRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } else {
      onSend(text, null);
      setText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800/80 border-t border-slate-700 p-4">
      <div className="max-w-4xl mx-auto flex items-end gap-3">
        <textarea
          className="flex-1 bg-slate-900 text-slate-50 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/60 border border-slate-700 resize-none"
          rows={3}
          placeholder="Beschrijf wat je wilt bereiken..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
        />
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="text-xs text-slate-400" disabled={disabled} />
          <button
            type="submit"
            disabled={disabled}
            className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Verstuur
          </button>
        </div>
      </div>
    </form>
  );
};

export default InputArea;
