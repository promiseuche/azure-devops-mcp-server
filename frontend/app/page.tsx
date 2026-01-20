'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Sidebar from '@/components/Sidebar';
import ChatHeader from '@/components/ChatHeader';
import WelcomeScreen from '@/components/WelcomeScreen';
import ChatMessages from '@/components/ChatMessages';
import ChatInput from '@/components/ChatInput';
import { Conversation, Message, Tool } from '@/types/chat';

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      title: 'Welcome',
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: 'Hello! I can help you query Azure DevOps. Select a tool from the sidebar or type a natural language request.',
          timestamp: new Date(),
        },
      ],
      timestamp: new Date(),
    },
  ]);
  const [activeConversationId, setActiveConversationId] = useState<string>('1');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    // Fetch available tools from server
    axios.get(`${apiUrl}/api/tools`)
      .then(response => {
        setTools(response.data.tools || []);
      })
      .catch(error => {
        console.error('Failed to fetch tools:', error);
      });
  }, [apiUrl]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      // Scroll to bottom smoothly
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [conversations, activeConversationId]);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const handleNewChat = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      timestamp: new Date(),
    };
    setConversations([newConversation, ...conversations]);
    setActiveConversationId(newConversation.id);
    setSelectedTool(null);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(conversations.filter(c => c.id !== id));
    if (activeConversationId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length > 0) {
        setActiveConversationId(remaining[0].id);
      } else {
        // Create a new empty conversation
        const newConv: Conversation = {
          id: 'empty',
          title: 'New Conversation',
          messages: [],
          timestamp: new Date(),
        };
        setConversations([newConv]);
        setActiveConversationId(newConv.id);
      }
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setSelectedTool(null);
  };

  const handleSelectTool = (toolName: string) => {
    setSelectedTool(toolName);
    // If there's an active conversation, we can optionally prefill input
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() && !selectedTool) return;

    let conversationId = activeConversationId;
    let conversation = activeConversation;

    // If no active conversation, create one
    if (!conversation) {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
        messages: [],
        timestamp: new Date(),
      };
      setConversations([newConversation, ...conversations]);
      conversationId = newConversation.id;
      setActiveConversationId(conversationId);
      conversation = newConversation;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content || `Use tool: ${selectedTool}`,
      timestamp: new Date(),
      tool: selectedTool || undefined,
    };

    // Update conversation with user message
    setConversations(prev => prev.map(conv => {
      if (conv.id === conversationId) {
        const updatedMessages = [...conv.messages, userMessage];
        const updatedTitle = conv.messages.length === 0 
          ? (content ? content.slice(0, 50) + (content.length > 50 ? '...' : '') : `Tool: ${selectedTool}`)
          : conv.title;
        return { ...conv, messages: updatedMessages, title: updatedTitle };
      }
      return conv;
    }));

    setLoading(true);

    try {
      let response;
      if (selectedTool) {
        // Call specific tool with input as argument
        const args = content ? { wiql: content } : {};
        response = await axios.post(`${apiUrl}/api/tools/${selectedTool}`, args);
      } else {
        // Use OpenAI chat completion
        response = await axios.post(`${apiUrl}/api/chat`, { message: content });
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: typeof response.data.result === 'string' ? response.data.result : JSON.stringify(response.data.result, null, 2),
        tool: selectedTool || response.data.tool_used || undefined,
        timestamp: new Date(),
      };

      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return { ...conv, messages: [...conv.messages, assistantMessage] };
        }
        return conv;
      }));
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'system',
        content: `Error: ${error.response?.data?.error || error.message}`,
        timestamp: new Date(),
      };
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return { ...conv, messages: [...conv.messages, errorMessage] };
        }
        return conv;
      }));
    } finally {
      setLoading(false);
      setSelectedTool(null);
    }
  };

  const handleExampleClick = (query: string) => {
    handleSendMessage(query);
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        conversations={conversations}
        tools={tools}
        activeConversationId={activeConversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onSelectTool={handleSelectTool}
        selectedTool={selectedTool}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatHeader 
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
          {!activeConversation || activeConversation.messages.length === 0 ? (
            <WelcomeScreen onExampleClick={handleExampleClick} />
          ) : (
            <ChatMessages
              messages={activeConversation.messages}
              isLoading={loading}
            />
          )}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput 
          onSendMessage={handleSendMessage}
          disabled={loading}
          placeholder={selectedTool ? `Provide parameters for ${selectedTool}...` : "Ask about Azure DevOps work items, builds, releases..."}
        />
      </div>
    </div>
  );
}