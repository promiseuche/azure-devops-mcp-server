import { Conversation, Tool } from '@/types/chat';

interface SidebarProps {
  isOpen: boolean;
  conversations: Conversation[];
  tools: Tool[];
  activeConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onSelectTool: (toolName: string) => void;
  selectedTool: string | null;
}

export default function Sidebar({
  isOpen,
  conversations,
  tools,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onSelectTool,
  selectedTool,
}: SidebarProps) {
  if (!isOpen) return null;

  return (
    <div className="w-64 bg-gray-900 flex flex-col h-full border-r border-gray-800">
      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 transition-colors duration-200 whitespace-nowrap"
        >
          <i className="ri-add-line text-lg"></i>
          <span className="text-sm font-medium">New chat</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="text-xs uppercase text-gray-500 font-semibold px-3 py-2">Conversations</div>
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelectConversation(conv.id)}
            className={`group relative flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg cursor-pointer transition-colors duration-200 ${
              activeConversationId === conv.id
                ? 'bg-gray-800 text-gray-100'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <i className="ri-chat-3-line text-base flex-shrink-0"></i>
            <span className="flex-1 text-sm truncate">{conv.title}</span>
            
            {activeConversationId === conv.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all duration-200"
              >
                <i className="ri-delete-bin-line text-sm"></i>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Tools Section */}
      <div className="border-t border-gray-800 flex flex-col flex-shrink-0" style={{ maxHeight: '40%' }}>
        <div className="text-xs uppercase text-gray-500 font-semibold px-3 py-2">Tools</div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="space-y-1">
            {tools.map((tool) => (
              <button
                key={tool.name}
                onClick={() => onSelectTool(tool.name)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 ${
                  selectedTool === tool.name
                    ? 'bg-blue-900 text-blue-100'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <i className="ri-tools-line text-base"></i>
                <span className="text-sm truncate">{tool.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User Section */}
      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors duration-200">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="ri-user-line text-white text-sm"></i>
          </div>
          <span className="text-sm text-gray-300">User</span>
        </div>
      </div>
    </div>
  );
}