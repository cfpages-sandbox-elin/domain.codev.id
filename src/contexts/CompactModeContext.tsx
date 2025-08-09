import React, { useState, useEffect, useContext, createContext, ReactNode } from 'react';

interface CompactModeContextType {
  isCompact: boolean;
  toggleCompactMode: () => void;
}

const CompactModeContext = createContext<CompactModeContextType>({
  isCompact: false,
  toggleCompactMode: () => {},
});

export const useCompactMode = () => useContext(CompactModeContext);

export const CompactModeProvider = ({ children }: { children: ReactNode }) => {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('compactMode');
    setIsCompact(stored === 'true');
  }, []);

  useEffect(() => {
    if (isCompact) {
      document.documentElement.classList.add('compact');
    } else {
      document.documentElement.classList.remove('compact');
    }
    localStorage.setItem('compactMode', isCompact.toString());
  }, [isCompact]);

  const toggleCompactMode = () => {
    setIsCompact(prev => !prev);
  };

  return (
    <CompactModeContext.Provider value={{ isCompact, toggleCompactMode }}>
      {children}
    </CompactModeContext.Provider>
  );
};
