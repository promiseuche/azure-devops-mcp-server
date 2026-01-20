interface WelcomeScreenProps {
  onExampleClick: (query: string) => void;
}

export default function WelcomeScreen({ onExampleClick }: WelcomeScreenProps) {
  const examples = [
    {
      icon: 'ri-list-check',
      text: 'List all projects in my organization',
    },
    {
      icon: 'ri-task-line',
      text: 'Show me active work items in the "Development" project',
    },
    {
      icon: 'ri-building-line',
      text: 'Get the latest builds for project "MyProject"',
    },
    {
      icon: 'ri-rocket-line',
      text: 'What releases are currently deployed?',
    },
    {
      icon: 'ri-edit-line',
      text: 'Create a new bug work item',
    },
    {
      icon: 'ri-refresh-line',
      text: 'Update work item 123 with a new description',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12">
      <div className="max-w-3xl w-full">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
            <i className="ri-cloud-line text-white text-2xl"></i>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Azure DevOps MCP Chat
        </h1>
        <p className="text-gray-600 text-center mb-8">
          Query your Azure DevOps organization using natural language or select a tool from the sidebar.
        </p>

        {/* Example Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {examples.map((example, index) => (
            <button
              key={index}
              onClick={() => onExampleClick(example.text)}
              className="group text-left p-4 rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all duration-200 whitespace-nowrap"
            >
              <div className="flex items-start gap-3">
                <i className={`${example.icon} text-xl text-blue-600 mt-0.5`}></i>
                <span className="text-sm text-gray-700 leading-relaxed whitespace-normal">
                  {example.text}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="text-center text-gray-500 text-sm">
          <p>You can also type a natural language request or select a specific tool from the sidebar.</p>
        </div>
      </div>
    </div>
  );
}