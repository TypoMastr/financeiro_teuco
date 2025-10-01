import React, { createContext, useState, useContext, useRef, useLayoutEffect, useCallback } from 'react';
import { ViewState, SortOption } from '../types';

// Define the shape of the Members list state
export interface MembersListState {
  searchTerm: string;
  filters: { status: string; activity: string; sort: SortOption };
  expandedMemberId: string | null;
  scrollPosition: number;
}

interface AppContextType {
  view: ViewState;
  setView: (newView: ViewState) => void;
  mainRef: React.RefObject<HTMLElement>;
  membersListState: MembersListState;
  setMembersListState: React.Dispatch<React.SetStateAction<MembersListState>>;
  isLocked: boolean;
  lockApp: () => void;
  unlockApp: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [view, setView] = useState<ViewState>({ name: 'overview' });
  const [membersListState, setMembersListState] = useState<MembersListState>({
    searchTerm: '',
    filters: { status: 'all', activity: 'Ativo', sort: 'name_asc' },
    expandedMemberId: null,
    scrollPosition: 0
  });
  const mainRef = useRef<HTMLElement>(null);
  const [isLocked, setIsLocked] = useState(true);

  const handleSetView = useCallback((newView: ViewState) => {
    if (view.name === 'members' && mainRef.current) {
      // Save scroll position before navigating away from members list
      setMembersListState(s => ({ ...s, scrollPosition: mainRef.current!.scrollTop }));
    }
    setView(newView);
  }, [view.name]);

  // Restore scroll position when navigating back to members list
  useLayoutEffect(() => {
    if (view.name === 'members' && mainRef.current) {
        mainRef.current.scrollTop = membersListState.scrollPosition;
    } else if (mainRef.current) {
        mainRef.current.scrollTop = 0; // Reset scroll for other views
    }
  }, [view, membersListState.scrollPosition]);

  const lockApp = useCallback(() => {
    setView({ name: 'overview' });
    setIsLocked(true);
  }, []);

  const unlockApp = useCallback(() => {
    setIsLocked(false);
  }, []);

  return (
    <AppContext.Provider value={{
      view,
      setView: handleSetView,
      mainRef,
      membersListState,
      setMembersListState,
      isLocked,
      lockApp,
      unlockApp
    }}>
      {children}
    </AppContext.Provider>
  );
};