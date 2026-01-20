import { Message } from '@/types';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-3xl rounded-lg p-4 ${isUser
            ? 'bg-primary-100 border border-primary-300'
            : isSystem
              ? 'bg-red-50 border border-red-200'
              : 'bg-gray-100 border border-gray-300'
          }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${isUser ? 'bg-primary-500' : isSystem ? 'bg-red-500' : 'bg-gray-500'
                }`}
            ></div>
            <span className="font-semibold text-sm">
              {isUser ? 'You' : isSystem ? 'System' : 'Assistant'}
            </span>
            {message.tool && (
              <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                {message.tool}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {format(message.timestamp, 'HH:mm')}
          </span>
        </div>
        <div className="text-gray-800 prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {typeof message.content === 'string' ? message.content : JSON.stringify(message.content, null, 2)}
          </ReactMarkdown>
        </div>
        {typeof message.content === 'string' && message.content.length > 500 && (
          <div className="mt-2 text-xs text-gray-500">
            {message.content.length} characters
          </div>
        )}
      </div>
    </div>
  );
}