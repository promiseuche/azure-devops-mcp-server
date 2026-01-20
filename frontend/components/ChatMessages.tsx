import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/types/chat';

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
}

export default function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  return (
    <div className="w-full">
      {messages.map((message) => (
        <div key={message.id} className="w-full py-6 px-4">
          <div className={`max-w-3xl mx-auto flex gap-4 ${
            message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
          }`}>
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user'
                  ? 'bg-gray-800'
                  : message.role === 'system'
                    ? 'bg-red-600'
                    : 'bg-green-600'
              }`}>
                {message.role === 'user' ? (
                  <i className="ri-user-line text-white text-base"></i>
                ) : message.role === 'system' ? (
                  <i className="ri-error-warning-line text-white text-base"></i>
                ) : (
                  <i className="ri-robot-line text-white text-base"></i>
                )}
              </div>
            </div>

            {/* Message Content */}
            <div className={`flex-1 min-w-0 ${message.role === 'user' ? 'flex justify-end' : ''}`}>
              <div className={`inline-block max-w-[80%] ${
                message.role === 'user' 
                  ? 'bg-gray-100 rounded-2xl px-4 py-3' 
                  : ''
              }`}>
                <div className="text-sm text-gray-800 leading-7">
                  {/* Tool badge */}
                  {message.tool && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium">
                        <i className="ri-tools-line"></i>
                        {message.tool}
                      </span>
                    </div>
                  )}
                  {/* Message Text */}
                  {message.content && (
                    message.role === 'user' ? (
                      <div className="whitespace-pre-wrap">
                        {message.content}
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4 text-gray-900">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 mt-3 text-gray-900">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-base font-medium mb-2 mt-3 text-gray-900">{children}</h3>,
                            p: ({ children }) => <p className="mb-3 leading-relaxed text-gray-800">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 text-gray-800">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-800">{children}</ol>,
                            li: ({ children }) => <li className="ml-4 text-gray-800">{children}</li>,
                            code: ({ children, className }) => {
                              const isInline = !className;
                              if (isInline) {
                                return (
                                  <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
                                    {children}
                                  </code>
                                );
                              }
                              return (
                                <pre className="bg-gray-50 text-gray-800 p-3 rounded-lg overflow-x-auto my-3 border border-gray-200">
                                  <code className="font-mono text-sm">{children}</code>
                                </pre>
                              );
                            },
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-gray-300 pl-4 my-3 italic text-gray-600 bg-gray-50 py-2">
                                {children}
                              </blockquote>
                            ),
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-3">
                                <table className="min-w-full border-collapse border border-gray-200">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => <thead className="bg-gray-100">{children}</thead>,
                            tbody: ({ children }) => <tbody>{children}</tbody>,
                            tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
                            th: ({ children }) => (
                              <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-900">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-gray-200 px-3 py-2 text-gray-800">{children}</td>
                            ),
                            a: ({ children, href }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline transition-colors"
                              >
                                {children}
                              </a>
                            ),
                            strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                            em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Loading State */}
      {isLoading && (
        <div className="w-full py-6 px-4">
          <div className="max-w-3xl mx-auto flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                <i className="ri-robot-line text-white text-base"></i>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}