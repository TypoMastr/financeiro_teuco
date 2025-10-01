import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, LoadingSpinner } from '../Icons';

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, onBack, action }) => (
  <motion.div 
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: 'spring', stiffness: 100 }}
    className="relative flex items-center justify-center mb-2 sm:mb-6 h-10"
  >
    <div className="absolute left-0">
        <motion.button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold transition-all duration-200 bg-card dark:bg-dark-card text-foreground dark:text-dark-foreground py-2 px-4 sm:py-2.5 sm:px-5 rounded-full border border-border dark:border-dark-border shadow-btn hover:-translate-y-0.5 hover:shadow-lg dark:shadow-dark-btn flex items-center gap-2"
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Voltar</span>
        </motion.button>
    </div>
    
    <h2 className="text-xl sm:text-2xl font-bold font-display text-center px-16 sm:px-24 truncate">{title}</h2>
    
    {action && (
        <div className="absolute right-0">
            {action}
        </div>
    )}
  </motion.div>
);

interface SubmitButtonProps {
  isSubmitting: boolean;
  text: string;
  submittingText?: string;
  className?: string;
  children?: React.ReactNode;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({ isSubmitting, text, submittingText = 'Salvando...', className = '', children }) => (
  <motion.button
    type="submit"
    disabled={isSubmitting}
    className={`bg-primary text-primary-foreground font-bold py-3 px-6 rounded-full hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30 text-base disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    whileHover={{ scale: 1.05, y: -2 }}
    whileTap={{ scale: 0.98 }}
  >
    {isSubmitting ? (
      <>
        <LoadingSpinner className="h-5 w-5" />
        {submittingText}
      </>
    ) : (
      <>
        {children}
        {text}
      </>
    )}
  </motion.button>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`bg-muted dark:bg-dark-muted rounded-md animate-pulse ${className}`} />
);