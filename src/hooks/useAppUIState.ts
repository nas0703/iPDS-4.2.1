import { useState, useCallback } from 'react';

// Common App UI State
export function useAppUIState() {
  const [activeTab, setActiveTab] = useState<"scan" | "dashboard" | "sejarah" | "ai_executive">("dashboard");
  const [direction, setDirection] = useState(0);

  const handleTabChange = useCallback((newTab: "scan" | "dashboard" | "sejarah" | "ai_executive") => {
    const tabs: ("scan" | "dashboard" | "sejarah" | "ai_executive")[] = ["scan", "dashboard", "sejarah", "ai_executive"];
    setActiveTab(prev => {
      const currentIndex = tabs.indexOf(prev);
      const nextIndex = tabs.indexOf(newTab);
      if (nextIndex !== currentIndex) {
        setDirection(nextIndex > currentIndex ? 1 : -1);
      }
      return newTab;
    });
  }, []);

  const handleMainTabSwipe = useCallback((swipeDir: "left" | "right") => {
    const tabs: ("scan" | "dashboard" | "sejarah" | "ai_executive")[] = ["scan", "dashboard", "sejarah", "ai_executive"];
    setActiveTab(prev => {
      const currentIndex = tabs.indexOf(prev);
      if (swipeDir === "left" && currentIndex < tabs.length - 1) {
        setDirection(1);
        return tabs[currentIndex + 1];
      } else if (swipeDir === "right" && currentIndex > 0) {
        setDirection(-1);
        return tabs[currentIndex - 1];
      }
      return prev;
    });
  }, []);

  return {
    activeTab, setActiveTab,
    direction, setDirection,
    handleTabChange,
    handleMainTabSwipe,
  };
}
