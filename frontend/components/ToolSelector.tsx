import { Tool } from '@/types';

interface ToolSelectorProps {
  tools: Tool[];
  selectedTool: string | null;
  onSelect: (toolName: string) => void;
}

export default function ToolSelector({ tools, selectedTool, onSelect }: ToolSelectorProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Available Tools</h3>
      <p className="text-gray-600 mb-6">Select a tool to query Azure DevOps data.</p>
      <div className="space-y-3">
        {tools.map((tool) => (
          <button
            key={tool.name}
            className={`w-full text-left p-4 rounded-lg border transition ${selectedTool === tool.name
                ? 'bg-primary-50 border-primary-300 text-primary-800'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            onClick={() => onSelect(tool.name)}
          >
            <div className="font-semibold">{tool.name}</div>
            <div className="text-sm text-gray-600 mt-1">{tool.description}</div>
            {tool.inputSchema?.properties && (
              <div className="mt-2 text-xs text-gray-500">
                Parameters: {Object.keys(tool.inputSchema.properties).join(', ')}
              </div>
            )}
          </button>
        ))}
        {tools.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-4"></div>
            Loading tools...
          </div>
        )}
      </div>
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h4 className="font-bold text-gray-700 mb-2">How to use</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>1. Select a tool from the list</li>
          <li>2. Provide required parameters in the chat input</li>
          <li>3. Click Send or press Enter</li>
          <li>4. View the results in the chat</li>
        </ul>
      </div>
    </div>
  );
}