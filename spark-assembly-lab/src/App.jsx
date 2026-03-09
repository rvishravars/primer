import { useEffect, useState } from 'react';
import SparkSelector from './components/SparkSelector';
import AssemblyCanvas from './components/AssemblyCanvas';
import Header from './components/Header';
import { Sparkles, X, Plus } from 'lucide-react';
import { generateSparkMarkdown } from './utils/sparkParser';
import { getStoredUserInfo, parseRepoUrl } from './utils/github';
import { parseSparkFile } from './utils/sparkParser';
import { ENHANCED_SPARK_TEMPLATE } from './utils/templates';

// Main application component
function AppMain() {
  console.log('🎯 App component rendering!');
  const [theme, setTheme] = useState(() => localStorage.getItem('sparkTheme') || 'studio');
  const [viewMode, setViewMode] = useState('components'); // 'components' | 'markdown'
  const [selectedSpark, setSelectedSpark] = useState(null);
  const [repoUrl, setRepoUrl] = useState(() => localStorage.getItem('sparkRepoUrl') || 'https://github.com/rvishravars/primer');
  const [branch, setBranch] = useState(() => localStorage.getItem('sparkBranch') || 'main');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [originalSparkData, setOriginalSparkData] = useState(null);
  const [sparkData, setSparkData] = useState(null);
  const [user, setUser] = useState(() => getStoredUserInfo());
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [prRefreshCallback, setPrRefreshCallback] = useState(null);
  const [canPush, setCanPush] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('sparkSidebarCollapsed');
    return stored === null ? true : stored === 'true';
  });

  const handlePermissionChange = (allowed) => {
    // Only allow push if user has repo permissions AND is the spark owner
    let repoOwner = '';
    try {
      repoOwner = parseRepoUrl(repoUrl).owner;
    } catch (e) {
      console.warn("Error parsing repo URL in handlePermissionChange:", e);
    }

    const userIsOwner = user && sparkData && (
      user.login?.toLowerCase() === sparkData.contributors?.scout?.toLowerCase() ||
      user.login?.toLowerCase() === repoOwner.toLowerCase()
    );
    setCanPush(allowed && userIsOwner);
  };

  const handleSparkSelect = (spark) => {
    setSelectedSpark(spark);
    if (spark) {
      // Load spark data from parsed file
      const loaded = {
        name: spark.name,
        markedForDeletion: spark.markedForDeletion || false,
        isEnhanced: true,
        // Load all section data but only show section 1 by default
        sections: spark.sections || {},
        activeSections: [1],
        contributors: spark.contributors,
        proposals: spark.proposals || { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '' },
        sourcePath: spark.sourcePath || spark.sourceFile || null,
      };
      setSparkData(loaded);
      setOriginalSparkData(JSON.parse(JSON.stringify(loaded)));

      // Check if current user is the owner of this spark
      let repoOwner = '';
      try {
        repoOwner = parseRepoUrl(repoUrl).owner;
      } catch (e) {
        console.warn("Error parsing repo URL in handleSparkSelect:", e);
      }

      const userIsOwner = user && (
        user.login?.toLowerCase() === loaded.contributors.scout?.toLowerCase() ||
        user.login?.toLowerCase() === repoOwner.toLowerCase()
      );
      setCanPush(userIsOwner);
    }
    // Close mobile menu after selection
    setIsMobileMenuOpen(false);
  };

  const handleSparkUpdate = (updatedData) => {
    setSparkData(updatedData);
    // Also update selectedSpark to keep it in sync
    if (selectedSpark) {
      setSelectedSpark({
        ...selectedSpark,
        name: updatedData.name,
        contributors: updatedData.contributors,
        proposals: updatedData.proposals,
        rawContent: generateSparkMarkdown(updatedData)
      });
    }
  };

  const handleRepoChange = (newRepoUrl) => {
    setRepoUrl(newRepoUrl);
    localStorage.setItem('sparkRepoUrl', newRepoUrl);
    // Clear selected spark when changing repos
    setSelectedSpark(null);
  };

  const handleBranchChange = (newBranch) => {
    setBranch(newBranch);
    localStorage.setItem('sparkBranch', newBranch);
    // Clear selected spark when changing branches
    setSelectedSpark(null);
  };

  const handleNewSpark = () => {
    setShowTemplateSelector(true);
  };

  const handleTemplateSelect = () => {
    setSelectedSpark(null);
    // Parse the enhanced template to get the structure
    const parsedTemplate = parseSparkFile(ENHANCED_SPARK_TEMPLATE);

    const initialData = {
      name: 'New Spark',
      markedForDeletion: false,
      isEnhanced: true,
      sections: parsedTemplate.sections, // All 8 sections from the template
      activeSections: [1], // Only Section 1 is active by default
      contributors: {},
      proposals: parsedTemplate.proposals || { 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '' },
      sourcePath: null,
      rawContent: ENHANCED_SPARK_TEMPLATE
    };

    setSparkData(initialData);
    setOriginalSparkData(JSON.parse(JSON.stringify(initialData)));
    setIsMobileMenuOpen(false);
    setShowTemplateSelector(false);
  };

  const handleResetSpark = () => {
    if (!originalSparkData) return;
    setSparkData(JSON.parse(JSON.stringify(originalSparkData)));
  };

  const handleGoHome = () => {
    setSelectedSpark(null);
    setSparkData(null);
    setOriginalSparkData(null);
    setIsMobileMenuOpen(false);
    setShowTemplateSelector(false);
  };

  useEffect(() => {
    localStorage.setItem('sparkTheme', theme);
  }, [theme]);

  return (
    <div className="flex h-screen flex-col theme-app" data-theme={theme}>
      <Header
        theme={theme}
        onThemeChange={setTheme}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
        user={user}
        onUserChange={setUser}
        onGoHome={handleGoHome}
        onSidebarToggle={() => {
          const newState = !isSidebarCollapsed;
          setIsSidebarCollapsed(newState);
          localStorage.setItem('sparkSidebarCollapsed', newState);
        }}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar: Spark Selector */}
        <aside className={`
            theme-border theme-surface overflow-y-auto
            fixed lg:static inset-y-0 left-0 z-50
            transform transition-all duration-300 ease-in-out
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            ${isSidebarCollapsed ? 'lg:-translate-x-full lg:w-0 lg:opacity-0' : 'lg:translate-x-0 w-80 border-r'}
            top-[73px] lg:top-0
          `}>
          {/* Mobile Close Button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden absolute top-4 right-4 p-2 rounded-lg theme-muted-hover"
          >
            <X className="h-5 w-5" />
          </button>

          <SparkSelector
            selectedSpark={selectedSpark}
            onSparkSelect={handleSparkSelect}
            onNewSpark={handleNewSpark}
            repoUrl={repoUrl}
            branch={branch}
            onRepoChange={handleRepoChange}
            onBranchChange={handleBranchChange}
            currentSparkData={sparkData}
            onPRRefresh={setPrRefreshCallback}
            onPermissionChange={handlePermissionChange}
            user={user}
          />
        </aside>

        {/* Main Canvas */}
        <main className="flex-1 overflow-y-auto w-full">
          {sparkData && sparkData.name ? (
            <AssemblyCanvas
              sparkData={sparkData}
              onSparkUpdate={handleSparkUpdate}
              repoUrl={repoUrl}
              originalSparkData={originalSparkData}
              onResetSpark={handleResetSpark}
              isReadOnly={!user}
              onPRCreated={() => prRefreshCallback?.()}
              canPush={canPush}
              onNewSpark={handleNewSpark}
              viewMode={viewMode}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4">
              <div className="text-center max-w-md">
                <Sparkles className="mx-auto h-12 w-12 sm:h-16 sm:w-16 theme-faint" />
                <h3 className="mt-4 text-lg sm:text-xl font-semibold theme-muted">
                  Select a Spark or Create a New One
                </h3>
                <p className="mt-2 text-sm sm:text-base theme-subtle">
                  Choose from existing sparks or start building from scratch
                </p>
                <button
                  onClick={handleNewSpark}
                  className="mt-4 px-6 py-3 bg-design-600 rounded-lg text-sm font-semibold hover:bg-design-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Plus className="h-4 w-4" />
                  New Spark
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg border border-design-500/30 max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Choose a Template</h2>
              <button
                onClick={() => setShowTemplateSelector(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto">
              {/* Generic Template */}
              <button
                onClick={handleTemplateSelect}
                className="p-4 rounded-lg border-2 border-design-500/30 hover:border-design-500 hover:bg-design-500/10 transition-all text-left"
              >
                <h3 className="font-semibold text-design-400 mb-2">Generic Spark</h3>
                <p className="text-sm text-gray-300">A structured template for any new idea or project</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppMain;
