
import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Members } from './components/Members';
import MemberProfile, { PaymentFormPage } from './components/MemberProfile';
import MemberForm from './components/MemberForm';
import PrintableReport from './components/PrintableReport';
import Financial, { TransactionFormPage, ReportFiltersPage, FutureIncomePage } from './components/Financial';
import { Settings, SettingsItemFormPage } from './components/Settings';
import FinancialDetail from './components/FinancialDetail';
import { TransactionHistory } from './components/TransactionHistory';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewState } from './types';
import { BottomNav } from './components/BottomNav';
import { Reports } from './components/Reports';
import AccountsPayable, { BillFormPage, PayBillPage, DeleteBillConfirmationPage } from './components/AccountsPayable';
import { Overview } from './components/Overview';
import { AttachmentViewer } from './components/AttachmentViewer';
// FIX: Added ToastContainer to the import as it is now correctly exported.
import { ToastProvider, ToastContainer } from './components/Notifications';
import { BatchTransactionFormPage, OfxImportFormPage } from './components/BatchOperations';
import { LogPage } from './components/LogPage';
import { LockScreen } from './components/LockScreen';

const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(true);
  const [view, setView] = useState<ViewState>({ name: 'overview' });

  const handleUnlock = () => {
    setIsLocked(false);
  };

  const handleLock = () => {
    setView({ name: 'overview' }); // Redefine a visualização ao bloquear
    setIsLocked(true);
  };

  const renderView = () => {
    switch (view.name) {
      case 'overview':
        return <Overview setView={setView} />;
      case 'members':
        return <Members setView={setView} />;
      case 'member-profile':
        if (!view.id) return <Members setView={setView} />;
        return <MemberProfile viewState={view} setView={setView} />;
      case 'add-member':
        return <MemberForm setView={setView} />;
      case 'edit-member':
        if (!view.id) return <Members setView={setView} />;
        return <MemberForm memberId={view.id} setView={setView} />;
      case 'financial':
        return <Financial viewState={view} setView={setView} />;
      case 'accounts-payable':
        return <AccountsPayable viewState={view} setView={setView} />;
      case 'settings':
        return <Settings setView={setView} onLock={handleLock} />;
      case 'reports':
        return <Reports setView={setView} />;
      case 'log':
        return <LogPage setView={setView} />;
      case 'report-view':
        if (!view.report) return <Reports setView={setView} />;
        return <PrintableReport report={view.report} setView={setView} />;
      case 'transaction-history':
        return <TransactionHistory viewState={view} setView={setView} />;
      case 'financial-detail':
        if (!view.filterType || !view.filterId || !view.filterName) return <Financial viewState={{ name: 'financial' }} setView={setView} />;
        return <FinancialDetail viewState={view} setView={setView} />;
      
      // New Page Views (replacing modals)
      case 'payment-form':
        return <PaymentFormPage viewState={view} setView={setView} />;
      case 'transaction-form':
        return <TransactionFormPage viewState={view} setView={setView} />;
      case 'financial-report-form':
        return <ReportFiltersPage viewState={view} setView={setView} />;
      case 'future-income-view':
        return <FutureIncomePage viewState={view} setView={setView} />;
      case 'setting-item-form':
        return <SettingsItemFormPage viewState={view} setView={setView} />;
      case 'bill-form':
        return <BillFormPage viewState={view} setView={setView} />;
      case 'pay-bill-form':
        return <PayBillPage viewState={view} setView={setView} />;
      case 'delete-bill-confirmation':
        return <DeleteBillConfirmationPage viewState={view} setView={setView} />;
      case 'attachment-view':
          return <AttachmentViewer viewState={view} setView={setView} />;
      case 'batch-transaction-form':
          return <BatchTransactionFormPage viewState={view} setView={setView} />;
      case 'ofx-import-form':
          return <OfxImportFormPage viewState={view} setView={setView} />;

      default:
        return <Overview setView={setView}/>;
    }
  };
  
  const getAnimationKey = (v: ViewState) => {
    return v.name + (v.id || '') + (v.transactionId || '') + (v.billId || '') + (v.itemId || '') + (v.itemType || '') + (v.report?.type || '') + (v.accountId || '') + (v.filterId || '');
  }

  return (
    <ToastProvider>
      <AnimatePresence mode="wait">
        {isLocked ? (
          <LockScreen key="lockscreen" onUnlock={handleUnlock} />
        ) : (
          <motion.div
            key="app-wrapper"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex h-screen bg-background dark:bg-dark-background text-foreground dark:text-dark-foreground"
          >
            <Sidebar 
              currentViewName={view.name}
              setView={setView} 
            />
            
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 lg:pb-6 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={getAnimationKey(view)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="w-full max-w-7xl mx-auto"
                >
                  {renderView()}
                </motion.div>
              </AnimatePresence>
            </main>

            <BottomNav 
              currentViewName={view.name}
              setView={setView}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <ToastContainer />
    </ToastProvider>
  );
};

export default App;
