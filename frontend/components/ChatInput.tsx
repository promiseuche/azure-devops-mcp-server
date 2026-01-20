import { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSendMessage, disabled, placeholder }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="max-w-3xl mx-auto">
        <div className="relative bg-white rounded-xl p-3 border border-gray-300 transition-all duration-300 shadow-sm">
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || "Ask about Azure DevOps work items, builds, releases..."}
              disabled={disabled}
              className="flex-1 bg-transparent text-gray-900 placeholder-gray-500 resize-none outline-none max-h-32 min-h-[24px] py-2 px-2"
              rows={1}
              style={{ maxHeight: '120px' }}
            />
            
            <button
              onClick={handleSubmit}
              disabled={disabled || !message.trim()}
              className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer disabled:cursor-not-allowed flex-shrink-0 shadow-sm hover:shadow-md"
            >
              <i className={`ri-send-plane-fill text-white ${disabled ? 'animate-pulse' : ''}`}></i>
            </button>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 text-center mt-3">
          Press <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-300 text-gray-600">Enter</kbd> to send,
          <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-300 text-gray-600 ml-1">Shift + Enter</kbd> for new line
        </p>
      </div>
    </div>
  );
}