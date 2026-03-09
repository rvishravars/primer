import { Boxes, Github, Menu } from 'lucide-react';
import GitHubAuth from './GitHubAuth';

const THEME_OPTIONS = [
  { value: 'studio', label: 'Studio Noir' },
  { value: 'light-theme', label: 'Light Theme' },
];

const VIEW_OPTIONS = [
  { value: 'components', label: 'Components' },
  { value: 'markdown', label: 'Markdown' },
];

export default function Header({ theme, onThemeChange, viewMode, onViewModeChange, onMenuToggle, onSidebarToggle, user, onUserChange, onGoHome }) {
  return (
    <header className="border-b theme-border theme-surface px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Mobile Menu Toggle */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg theme-muted-hover -ml-2"
            aria-label="Toggle menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Desktop Sidebar Toggle */}
          <button
            onClick={onSidebarToggle}
            className="hidden lg:flex p-2 rounded-lg theme-muted-hover -ml-2"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>

          <button
            onClick={onGoHome}
            className="flex items-center space-x-2 sm:space-x-3 text-left hover:opacity-80 transition-opacity focus:outline-none"
            title="Go to Home"
          >
            <Boxes className="h-6 w-6 sm:h-8 sm:w-8 text-design-500 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold font-mono truncate">
                Spark Assembly Lab
              </h1>
              <p className="text-xs sm:text-sm theme-muted hidden sm:block">
                Primer v2.0 | Build in LEGO-style
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="hidden md:flex items-center space-x-2">
            <label htmlFor="theme-select" className="text-xs uppercase tracking-wider theme-subtle whitespace-nowrap">
              Theme
            </label>
            <select
              id="theme-select"
              value={theme}
              onChange={(event) => onThemeChange(event.target.value)}
              className="rounded-lg border px-3 py-2 text-xs font-semibold theme-input"
              aria-label="Theme"
            >
              {THEME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop View Selector */}
          <div className="hidden md:flex items-center space-x-2">
            <label htmlFor="view-select" className="text-xs uppercase tracking-wider theme-subtle whitespace-nowrap">
              View
            </label>
            <select
              id="view-select"
              value={viewMode}
              onChange={(event) => onViewModeChange(event.target.value)}
              className="rounded-lg border px-3 py-2 text-xs font-semibold theme-input"
              aria-label="View"
            >
              {VIEW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Mobile Theme + View Selector */}
          <div className="md:hidden flex items-center space-x-2">
            <select
              value={theme}
              onChange={(event) => onThemeChange(event.target.value)}
              className="rounded-lg border px-2 py-1.5 text-xs font-semibold theme-input"
              aria-label="Theme"
            >
              {THEME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={viewMode}
              onChange={(event) => onViewModeChange(event.target.value)}
              className="rounded-lg border px-2 py-1.5 text-xs font-semibold theme-input"
              aria-label="View"
            >
              {VIEW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <GitHubAuth user={user} onUserChange={onUserChange} />

          <a
            href="https://github.com/rvishravars/primer-sparks"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg theme-button p-2 transition-colors"
            aria-label="GitHub Repository"
          >
            <Github className="h-4 w-4 sm:h-5 sm:w-5" />
          </a>
        </div>
      </div>
    </header>
  );
}
