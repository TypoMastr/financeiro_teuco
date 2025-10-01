import React from 'react';
import { Sidebar } from './components/Sidebar';
import { Members } from './components/Members';
import MemberProfile from './components/MemberProfile';
import { PaymentFormPage } from './components/MemberPaymentForm';
import { PaymentEditFormPage } from './components/MemberPaymentEditForm';
import MemberForm from './components/MemberForm';
import PrintableReport from './components/PrintableReport';
import { Financial } from './components/Financial';
import { TransactionFormPage } from './components/FinancialTransactionForm';
import { ReportFiltersPage } from './components/FinancialReportFilters';
import { FutureIncomePage } from './components/FinancialFutureIncome';
import { TransactionViewerPage } from './components/FinancialTransactionViewer';
import { TransferFormPage } from './components/FinancialTransferForm';
import { Settings } from './components/Settings';
import { SettingsItemFormPage } from './components/SettingsItemForm';
import { SettingsListPage } from './components/SettingsListPage';
import FinancialDetail from './components/FinancialDetail';
import { TransactionHistory } from './components/TransactionHistory';
import { motion, AnimatePresence, MotionProps } from 'framer-motion';
import { ViewState } from './types';
import { BottomNav } from './components/BottomNav';
import { Reports } from './components/Reports';
import { AccountsPayable } from './components/AccountsPayable';
import { BillFormPage } from './components/AccountsPayableBillForm';
import { PayBillPage } from './components/AccountsPayablePayBill';
import { DeleteBillConfirmationPage } from './components/AccountsPayableDeleteBillConfirmation';
import { Overview } from './components/Overview';
import { AttachmentViewer } from './components/AttachmentViewer';
import { ToastProvider, ToastContainer } from './components/Notifications';
import { BatchTransactionFormPage, OfxImportFormPage } from './components/BatchOperations';
import { LogPage } from './components/LogPage';
import { LockScreen } from './components/LockScreen';
import { Chatbot } from './components/Chatbot';
import { LeaveFormPage } from './components/LeaveFormPage';
import { AppProvider, useApp } from './contexts/AppContext';

const AppUI: React.FC = () => {
  const { view, mainRef, isLocked } = useApp();

  const renderView = () => {
    switch (view.name) {
      case 'overview':
        return <Overview />;
      case 'members':
        return <Members />;
      case 'member-profile':
        if (!view.id) return <Members />;
        return <MemberProfile viewState={view} />;
      case 'add-member':
        return <MemberForm />;
      case 'edit-member':
        if (!view.id) return <Members />;
        return <MemberForm memberId={view.id} />;
      case 'financial':
        return <Financial viewState={view} />;
      case 'accounts-payable':
        return <AccountsPayable viewState={view} />;
      case 'settings':
        return <Settings />;
      case 'reports':
        return <Reports />;
      case 'log':
        return <LogPage />;
      case 'report-view':
        if (!view.report) return <Reports />;
        return <PrintableReport report={view.report} />;
      case 'transaction-history':
        return <TransactionHistory viewState={view} />;
      case 'financial-detail':
        if (!view.filterType || !view.filterId || !view.filterName) return <Financial viewState={{ name: 'financial' }} />;
        return <FinancialDetail viewState={view} />;
      case 'payment-form':
        return <PaymentFormPage viewState={view} />;
      case 'edit-payment-form':
        return <PaymentEditFormPage viewState={view} />;
      case 'transaction-form':
        return <TransactionFormPage viewState={view} />;
      case 'transaction-view':
        return <TransactionViewerPage viewState={view} />;
      case 'financial-report-form':
        return <ReportFiltersPage viewState={view} />;
      case 'future-income-view':
        return <FutureIncomePage viewState={view} />;
      case 'setting-item-form':
        return <SettingsItemFormPage viewState={view} />;
      case 'setting-list':
        return <SettingsListPage viewState={view} />;
      case 'bill-form':
        return <BillFormPage viewState={view} />;
      case 'pay-bill-form':
        return <PayBillPage viewState={view} />;
      case 'delete-bill-confirmation':
        return <DeleteBillConfirmationPage viewState={view} />;
      case 'attachment-view':
          return <AttachmentViewer viewState={view} />;
      case 'batch-transaction-form':
          return <BatchTransactionFormPage viewState={view} />;
      case 'ofx-import-form':
          return <OfxImportFormPage viewState={view} />;
      case 'leave-form':
          return <LeaveFormPage viewState={view} />;
      case 'transfer-form':
          return <TransferFormPage viewState={view} />;
      case 'chatbot':
          return <Chatbot />;
      default:
        return <Overview />;
    }
  };
  
  const getAnimationKey = (v: ViewState) => {
    if ('id' in v || 'transactionId' in v || 'billId' in v || 'itemId' in v || 'itemType' in v || 'report' in v || 'accountId' in v || 'filterId' in v || 'paymentId' in v || 'leaveId' in v) {
        return v.name + (('id' in v) ? v.id : '') + (('transactionId' in v) ? v.transactionId : '') + (('billId' in v) ? v.billId : '') + (('itemId' in v) ? v.itemId : '') + (('itemType' in v) ? v.itemType : '') + (('report' in v) ? v.report?.type : '') + (('accountId' in v) ? v.accountId : '') + (('filterId' in v) ? v.filterId : '') + (('paymentId' in v) ? v.paymentId : '') + (('leaveId' in v) ? v.leaveId : '');
    }
    return v.name;
  }
  
  const noAnimation = view.name === 'transaction-history' || view.name === 'transaction-form';
  
  const animationProps: MotionProps = noAnimation
    ? {
        initial: { opacity: 1, y: 0 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 1, y: 0 },
        transition: { duration: 0 }
    }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { duration: 0.25, ease: 'easeInOut' }
    };
    
  const isChatbotView = view.name === 'chatbot';

  return (
      <AnimatePresence mode="wait">
        {isLocked ? (
          <LockScreen key="lockscreen" />
        ) : (
          <motion.div
            key="app-wrapper"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex h-full bg-background dark:bg-dark-background text-foreground dark:text-dark-foreground"
          >
            <Sidebar />
            
            <main ref={mainRef} className={`flex-1 custom-scrollbar p-4 sm:p-6 lg:p-8 pb-24 lg:pb-6 ${isChatbotView ? 'overflow-hidden' : 'overflow-y-auto'}`}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={getAnimationKey(view)}
                  className={`w-full ${isChatbotView ? 'h-full' : ''}`}
                  {...animationProps}
                >
                  {renderView()}
                </motion.div>
              </AnimatePresence>
            </main>

            <BottomNav />
          </motion.div>
        )}
      </AnimatePresence>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppProvider>
        <AppUI />
      </AppProvider>
      <ToastContainer />
    </ToastProvider>
  );
};

export default App;