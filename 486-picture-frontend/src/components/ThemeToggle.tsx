import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../stores/theme';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full hover:bg-white/10 transition-colors duration-200"
      title={theme === 'light' ? '切换到夜间模式' : '切换到日间模式'}
    >
      {theme === 'light' ? (
        <Sun className="w-5 h-5 text-yellow-500" />
      ) : (
        <Moon className="w-5 h-5 text-blue-400" />
      )}
    </button>
  );
};

export default ThemeToggle;
