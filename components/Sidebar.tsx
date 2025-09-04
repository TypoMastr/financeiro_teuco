import React from 'react';
import { motion } from 'framer-motion';
import { ViewState } from '../types';
import { Dashboard, Users, ClubLogo, DollarSign, Settings, ClipboardList, FileText, History } from './Icons';

interface SidebarProps {
  currentViewName: ViewState['name'];
  setView: (view: ViewState) => void;
}

const navContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.2,
    },
  },
};

const navItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

const NavItem: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
  <motion.li variants={navItemVariants}>
    <a
      onClick={onClick}
      className={`
        flex items-center gap-3 px-4 py-2.5 mx-2 my-1 rounded-md cursor-pointer transition-all duration-200
        group font-semibold text-sm
        ${isActive 
          ? 'bg-primary text-primary-foreground' 
          : 'text-muted-foreground hover:bg-muted dark:text-dark-muted-foreground dark:hover:bg-dark-muted/50'}
      `}
    >
      {icon}
      <span>{label}</span>
    </a>
  </motion.li>
);

export const Sidebar: React.FC<SidebarProps> = ({ currentViewName, setView }) => {
  const sidebarClasses = `
    hidden lg:flex flex-col w-64 h-screen bg-card dark:bg-dark-background 
    border-r border-border dark:border-dark-border flex-shrink-0
  `;
  
  const isMembersSectionActive = ['members', 'member-profile', 'add-member', 'edit-member'].includes(currentViewName);

  return (
    <aside className={sidebarClasses}>
      <div className="flex items-center justify-between p-4 h-20 border-b border-border dark:border-dark-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <ClubLogo className="h-8 w-8 text-primary"/>
          <h1 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">Financeiro</h1>
        </div>
      </div>
      <motion.nav
        className="py-4 flex-1"
        initial="hidden"
        animate="visible"
      >
        <motion.ul variants={navContainerVariants}>
          <NavItem
            label="Mensalidades"
            icon={<Users className="h-5 w-5" />}
            isActive={isMembersSectionActive}
            onClick={() => setView({ name: 'members' })}
          />
          <NavItem
            label="Visão Geral"
            icon={<Dashboard className="h-5 w-5" />}
            isActive={currentViewName === 'overview'}
            onClick={() => setView({ name: 'overview' })}
          />

          <motion.div variants={navItemVariants} className="my-3 mx-4">
            <div className="h-px bg-border dark:bg-dark-border" />
          </motion.div>

          <NavItem
            label="Financeiro"
            icon={<DollarSign className="h-5 w-5" />}
            isActive={['financial', 'financial-detail', 'transaction-history'].includes(currentViewName)}
            onClick={() => setView({ name: 'financial' })}
          />
          <NavItem
            label="Contas a Pagar"
            icon={<ClipboardList className="h-5 w-5" />}
            isActive={currentViewName === 'accounts-payable'}
            onClick={() => setView({ name: 'accounts-payable' })}
          />
          <NavItem
            label="Relatórios"
            icon={<FileText className="h-5 w-5" />}
            isActive={['reports', 'report-view'].includes(currentViewName)}
            onClick={() => setView({ name: 'reports' })}
          />
           <NavItem
            label="Histórico"
            icon={<History className="h-5 w-5" />}
            isActive={currentViewName === 'log'}
            onClick={() => setView({ name: 'log' })}
          />
           <NavItem
            label="Ajustes"
            icon={<Settings className="h-5 w-5" />}
            isActive={currentViewName === 'settings'}
            onClick={() => setView({ name: 'settings' })}
          />
        </motion.ul>
      </motion.nav>
    </aside>
  );
};