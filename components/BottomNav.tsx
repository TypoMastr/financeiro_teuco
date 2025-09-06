import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
// FIX: Import types from the corrected types.ts file.
import { ViewState } from '../types';
import { Dashboard, Users, DollarSign, Settings, ClipboardList, FileText, Plus, Folder, X, History, MessageSquare } from './Icons';

interface BottomNavProps {
  currentViewName: ViewState['name'];
  setView: (view: ViewState) => void;
}

const mainNavItems = {
  cadastros: {
    label: 'Cadastros',
    icon: Folder,
    items: [
      { view: 'members', label: 'Mensalidades', icon: Users },
      { view: 'financial', label: 'Financeiro', icon: DollarSign },
      { view: 'accounts-payable', label: 'Contas', icon: ClipboardList },
    ]
  },
  gestao: {
    label: 'Gestão',
    icon: Dashboard,
    items: [
      { view: 'overview', label: 'Visão Geral', icon: Dashboard },
      { view: 'reports', label: 'Relatórios', icon: FileText },
      { view: 'log', label: 'Histórico', icon: History },
      { view: 'settings', label: 'Ajustes', icon: Settings },
    ]
  }
};

type ActiveMenu = 'cadastros' | 'gestao' | null;

export const BottomNav: React.FC<BottomNavProps> = ({ currentViewName, setView }) => {
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);
  
  const handleMainMenuClick = (menu: ActiveMenu) => {
    setActiveMenu(prev => (prev === menu ? null : menu));
  };
  
  const handleSubMenuClick = (view: ViewState) => {
    setView(view);
    setActiveMenu(null);
  };

  const backdropVariants: Variants = {
    hidden: { opacity: 0, pointerEvents: 'none' as const },
    visible: { opacity: 1, pointerEvents: 'auto' as const },
  };

  const menuContainerVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
  };
  
  // FIX: Explicitly type `menuItemVariants` as `Variants` to fix the TypeScript error.
  // This helps TypeScript understand that `transition.type` is a specific literal type (e.g., 'spring') and not a generic string.
  const menuItemVariants: Variants = {
    hidden: { opacity: 0, scale: 0.8, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } }
  };

  const MainMenuButton: React.FC<{ menuKey: 'cadastros' | 'gestao'}> = ({ menuKey }) => {
    const menu = mainNavItems[menuKey];
    return (
       <div className="relative flex flex-col items-center justify-center">
        <AnimatePresence>
        {activeMenu === menuKey && (
          <motion.div
            variants={menuContainerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className={`absolute bottom-full mb-4 w-48 p-2 bg-card dark:bg-dark-popover rounded-xl shadow-lg border border-border dark:border-dark-border space-y-1`}
          >
            {menu.items.map(item => (
              <motion.button
                key={item.view}
                variants={menuItemVariants}
                onClick={() => handleSubMenuClick({ name: item.view as any })}
                className="w-full flex items-center gap-3 text-left p-3 text-sm font-semibold rounded-lg hover:bg-muted dark:hover:bg-dark-muted transition-colors"
              >
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <span>{item.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
        </AnimatePresence>
        
        <motion.button
          onClick={() => handleMainMenuClick(menuKey)}
          className="flex-1 w-full h-full flex flex-col items-center justify-center gap-1.5 transition-colors duration-200 relative text-muted-foreground hover:text-foreground focus:outline-none"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <div className="relative w-7 h-7">
            <AnimatePresence initial={false}>
              <motion.div
                key={activeMenu === menuKey ? 'x' : 'icon'}
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 45 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {activeMenu === menuKey ? <X className="h-7 w-7 text-primary" /> : <menu.icon className="h-6 w-6" />}
              </motion.div>
            </AnimatePresence>
          </div>
          <span className={`text-xs font-bold transition-colors ${activeMenu === menuKey ? 'text-primary' : ''}`}>{menu.label}</span>
        </motion.button>
      </div>
    )
  };


  return (
    <>
      <AnimatePresence>
        {activeMenu && (
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={() => setActiveMenu(null)}
            className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40 no-print"
          />
        )}
      </AnimatePresence>

      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 30, delay: 0.2 }}
        className="lg:hidden fixed bottom-4 left-4 right-4 h-16 bg-card/80 dark:bg-dark-card/80 backdrop-blur-xl border border-border dark:border-dark-border z-50 no-print rounded-2xl shadow-xl"
      >
        <div className="grid grid-cols-3 items-stretch h-full max-w-lg mx-auto">
          <MainMenuButton menuKey="cadastros" />
          
          <div className="flex flex-col items-center justify-center">
             <motion.button
                onClick={() => handleSubMenuClick({ name: 'chatbot' })}
                className="flex-1 w-full h-full flex flex-col items-center justify-center gap-1.5 transition-colors duration-200 relative text-muted-foreground hover:text-foreground focus:outline-none"
                style={{ WebkitTapHighlightColor: "transparent" }}
                aria-label="Abrir Chatbot"
            >
                <MessageSquare className={`h-6 w-6 transition-colors ${currentViewName === 'chatbot' ? 'text-primary' : ''}`} />
                <span className={`text-xs font-bold transition-colors ${currentViewName === 'chatbot' ? 'text-primary' : ''}`}>Chat</span>
            </motion.button>
          </div>

          <MainMenuButton menuKey="gestao" />
        </div>
      </motion.nav>
    </>
  );
};