interface ChatHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function ChatHeader({ isSidebarOpen, onToggleSidebar }: ChatHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {!isSidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors duration-200 whitespace-nowrap"
          >
            <i className="ri-menu-line text-xl text-gray-700"></i>
          </button>
        )}
        {isSidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors duration-200 whitespace-nowrap"
          >
            <i className="ri-sidebar-fold-line text-xl text-gray-700"></i>
          </button>
        )}
        <h1 className="text-base font-semibold text-gray-800">Azure DevOps MCP</h1>
      </div>
      
      <div className="flex items-center gap-2">
        <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors duration-200 whitespace-nowrap">
          <i className="ri-settings-3-line text-xl text-gray-700"></i>
        </button>
      </div>
    </header>
  );
}