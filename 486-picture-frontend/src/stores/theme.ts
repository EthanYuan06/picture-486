import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  init: () => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'theme_preference';
const MANUAL_EXPIRY_KEY = 'theme_manual_expiry';

const getAutoTheme = (): Theme => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? 'light' : 'dark';
};

const getNextAutoSwitchTime = (): number => {
  const now = new Date();
  const hour = now.getHours();
  const nextSwitch = new Date(now);
  
  if (hour < 6) {
    nextSwitch.setHours(6, 0, 0, 0);
  } else if (hour < 18) {
    nextSwitch.setHours(18, 0, 0, 0);
  } else {
    nextSwitch.setDate(nextSwitch.getDate() + 1);
    nextSwitch.setHours(6, 0, 0, 0);
  }
  return nextSwitch.getTime();
};

let timeoutId: ReturnType<typeof setTimeout> | null = null;

const scheduleNextSwitch = (set: any, get: any) => {
    if (timeoutId) clearTimeout(timeoutId);
    
    const now = Date.now();
    const nextSwitchTime = getNextAutoSwitchTime();
    const delay = Math.max(0, nextSwitchTime - now);

    console.log(`[Theme] Scheduling next switch in ${delay}ms at ${new Date(nextSwitchTime).toLocaleString()}`);

    timeoutId = setTimeout(() => {
        console.log('[Theme] Auto-switching time reached');
        // Clear manual overrides
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(MANUAL_EXPIRY_KEY);
        
        const targetTheme = getAutoTheme();
        const currentTheme = get().theme;
        
        if (currentTheme !== targetTheme) {
            document.documentElement.setAttribute('data-theme', targetTheme);
            set({ theme: targetTheme });
        }
        
        // Schedule next one
        scheduleNextSwitch(set, get);
    }, delay);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getAutoTheme(), // Default initial

  init: () => {
    const now = Date.now();
    const storedTheme = localStorage.getItem(STORAGE_KEY) as Theme;
    const expiryStr = localStorage.getItem(MANUAL_EXPIRY_KEY);
    const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
    
    let currentTheme: Theme;

    // Check if manual override is valid
    if (storedTheme && expiry > now) {
      currentTheme = storedTheme;
      console.log('[Theme] Restoring manual override:', currentTheme);
    } else {
      // Expired or no override
      currentTheme = getAutoTheme();
      // Clean up expired storage
      if (expiryStr && expiry <= now) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(MANUAL_EXPIRY_KEY);
      }
      console.log('[Theme] Using auto theme:', currentTheme);
    }

    // Apply theme
    document.documentElement.setAttribute('data-theme', currentTheme);
    set({ theme: currentTheme });

    // Start scheduler
    scheduleNextSwitch(set, get);
  },

  setTheme: (theme) => {
     document.documentElement.setAttribute('data-theme', theme);
     set({ theme });
  },

  toggleTheme: () => {
    const { theme } = get();
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    // Set persistence with expiry
    const nextSwitchTime = getNextAutoSwitchTime();
    localStorage.setItem(STORAGE_KEY, newTheme);
    localStorage.setItem(MANUAL_EXPIRY_KEY, nextSwitchTime.toString());
    
    document.documentElement.setAttribute('data-theme', newTheme);
    set({ theme: newTheme });
    
    console.log('[Theme] Manual toggle to:', newTheme, 'Expires:', new Date(nextSwitchTime).toLocaleString());
  }
}));
