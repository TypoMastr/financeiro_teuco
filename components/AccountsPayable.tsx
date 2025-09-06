import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
// FIX: Import types from the corrected types.ts file.
import { ViewState, PayableBill, Payee, Category, Account, Transaction } from '../types';
// FIX: Added `addPayableBill` to the import list to resolve the module error.
import { payableBillsApi, payeesApi, categoriesApi, accountsApi, addPayableBill, payBill, getUnlinkedExpenses, linkExpenseToBill, transactionsApi } from '../services/api';
import { PlusCircle, Edit, Trash, DollarSign, Search, ClipboardList, Repeat, Paperclip, X as XIcon, ArrowLeft, ClipboardPaste, ChevronDown } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader, SubmitButton, DateField } from './common/PageLayout';
import { useToast } from './Notifications';

// --- Helper Functions ---
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Data inválida';
    // If it's a date-only string, append time to avoid timezone issues.
    // Otherwise, assume it's a full ISO string that Date can parse.
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T12:00:00Z');
    if (isNaN(date.getTime())) return 'Data inválida';
    return date.toLocaleDateString('pt-BR');
};

const formatCurrencyForInput = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const parseCurrencyFromInput = (formattedValue: string): number => {
    const numericString = formattedValue.replace(/\D/g, '');
    return numericString ? parseInt(numericString, 10) / 100 : 0;
};

const FilterChip: React.FC<{ label: string, selected: boolean, onClick: () => void, onRemove?: () => void }> = ({ label, selected, onClick, onRemove }) => (
    <motion.button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 border flex items-center gap-1.5
        ${selected
            ? 'bg-primary/10 text-primary border-primary/20'
            : 'bg-secondary dark:bg-dark-secondary hover:bg-muted dark:hover:bg-dark-muted border-border dark:border-dark-border'
        }`}
        whileTap={{ scale: 0.95 }}
    >
        {label}
        {onRemove && <XIcon onClick={(e) => { e.stopPropagation(); onRemove(); }} className="h-3 w-3 text-muted-foreground hover:text-foreground"/>}
    </motion.button>
);


// --- Main Component ---
// FIX: Export component to be used in App.tsx
export const AccountsPayable: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { componentState } = viewState as { name: 'accounts-payable', componentState?: any };
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{ bills: PayableBill[], payees: Payee[], categories: Category[], accounts: Account[], transactions: Transaction[] }>({ bills: [], payees: [], categories: [], accounts: [], transactions: [] });
    const isInitialLoad = useRef(true);
    const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

    const [filters, setFilters] = useState(componentState?.filters || {
        searchTerm: '',
        status: 'all' as 'all' | 'overdue' | 'pending' | 'paid',
    });
    
    const [expandedKeys, setExpandedKeys] = useState<string[]>(() => {
        const now = new Date();
        const yearKey = now.getFullYear().toString();
        const monthKey = `${yearKey}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        // Expand current year and month by default
        return [yearKey, monthKey];
    });

    const toggleExpand = (key: string) => {
        setExpandedKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const fetchData = useCallback(async (isUpdate = false) => {
        if (!isUpdate) {
            setLoading(true);
        }
        try {
            const [bills, payees, categories, accounts, transactions] = await Promise.all([
                payableBillsApi.getAll(), payeesApi.getAll(), categoriesApi.getAll(), accountsApi.getAll(), transactionsApi.getAll()
            ]);
            setData({ bills, payees, categories: categories.filter(c => c.type === 'expense' || c.type === 'both'), accounts, transactions });
        } catch (error) {
            console.error("Failed to fetch accounts payable data", error);
        } finally {
             if (!isUpdate || isInitialLoad.current) {
                setLoading(false);
                isInitialLoad.current = false;
            }
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const { summary, filteredBills } = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const summaryData = {
            previousOverdue: { count: 0, amount: 0 },
            thisMonth: { openCount: 0, openAmount: 0, paidCount: 0, paidAmount: 0 },
            nextMonth: { count: 0, amount: 0 },
        };

        const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
        const nextMonthYear = nextMonthDate.getFullYear();
        const nextMonthMonth = nextMonthDate.getMonth();

        for (const bill of data.bills) {
            const dueDate = new Date(bill.dueDate + 'T12:00:00Z');
            const dueYear = dueDate.getFullYear();
            const dueMonth = dueDate.getMonth();

            if ((dueYear < currentYear || (dueYear === currentYear && dueMonth < currentMonth)) && bill.status !== 'paid') {
                summaryData.previousOverdue.count++;
                summaryData.previousOverdue.amount += bill.amount;
            }
            else if (dueYear === currentYear && dueMonth === currentMonth) {
                if (bill.status === 'paid') {
                    summaryData.thisMonth.paidCount++;
                    summaryData.thisMonth.paidAmount += bill.amount;
                } else {
                    summaryData.thisMonth.openCount++;
                    summaryData.thisMonth.openAmount += bill.amount;
                }
            }
            else if (dueYear === nextMonthYear && dueMonth === nextMonthMonth && bill.status !== 'paid') {
                summaryData.nextMonth.count++;
                summaryData.nextMonth.amount += bill.amount;
            }
        }
        
        const bills = data.bills.filter(bill => {
            const searchMatch = filters.searchTerm === '' || bill.description.toLowerCase().includes(filters.searchTerm.toLowerCase());
            
            if(filters.status === 'pending') return searchMatch && (bill.status === 'pending' || bill.status === 'overdue');
            if(filters.status !== 'all') return searchMatch && bill.status === filters.status;
            
            return searchMatch;
        });
        return { summary: summaryData, filteredBills: bills };
    }, [data.bills, filters]);

    const groupedBillsByYear = useMemo(() => {
        const groups: Record<string, Record<string, {
            bills: PayableBill[];
            totalAmount: number;
            openAmount: number;
            paidAmount: number;
        }>> = {};

        const sortedBills = [...filteredBills].sort((a, b) => b.dueDate.localeCompare(a.dueDate));

        for (const bill of sortedBills) {
            const dueDate = new Date(bill.dueDate + 'T12:00:00Z');
            const year = dueDate.getFullYear().toString();
            const month = (dueDate.getMonth() + 1).toString().padStart(2, '0');
            const yearMonthKey = `${year}-${month}`;

            if (!groups[year]) {
                groups[year] = {};
            }
            if (!groups[year][yearMonthKey]) {
                groups[year][yearMonthKey] = {
                    bills: [],
                    totalAmount: 0,
                    openAmount: 0,
                    paidAmount: 0,
                };
            }
            const monthGroup = groups[year][yearMonthKey];
            monthGroup.bills.push(bill);
            monthGroup.totalAmount += bill.amount;
            if (bill.status === 'paid') {
                monthGroup.paidAmount += bill.amount;
            } else {
                monthGroup.openAmount += bill.amount;
            }
        }
        return groups;
    }, [filteredBills]);

    const payeeMap = useMemo(() => new Map(data.payees.map(p => [p.id, p.name])), [data.payees]);
    const categoryMap = useMemo(() => new Map(data.categories.map(c => [c.id, c.name])), [data.categories]);
    const transactionMap = useMemo(() => new Map(data.transactions.map(t => [t.id, t])), [data.transactions]);
    const accountMap = useMemo(() => new Map(data.accounts.map(a => [a.id, a.name])), [data.accounts]);

    const currentView: ViewState = { name: 'accounts-payable', componentState: { filters } };

    const BillRow: React.FC<{bill: PayableBill}> = ({bill}) => {
        const statusColors = {
            paid: { bg: 'bg-green-100 dark:bg-dark-success-strong', text: 'text-green-700 dark:text-green-300', border: 'border-green-500/10 dark:border-green-500/20' },
            pending: { bg: 'bg-yellow-100 dark:bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-500/20' },
            overdue: { bg: 'bg-red-100 dark:bg-dark-danger-strong', text: 'text-red-700 dark:text-red-300', border: 'border-red-500/10 dark:border-red-500/20' },
        }[bill.status];
        
        const isExpanded = expandedBillId === bill.id;
        const transaction = bill.transactionId ? transactionMap.get(bill.transactionId) : null;
        const accountName = transaction ? accountMap.get(transaction.accountId) : null;
        const categoryName = categoryMap.get(bill.categoryId);

        const handleActionClick = (e: React.MouseEvent, action: () => void) => {
            e.stopPropagation();
            action();
        };

        return (
            <motion.div
                layout
                key={bill.id}
                className={`rounded-xl border overflow-hidden transition-all duration-300 ${statusColors.bg} ${statusColors.border}`}
            >
                <div
                    className="p-3 cursor-pointer"
                    onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                >
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground dark:text-dark-foreground truncate">{bill.description}</p>
                            <p className="text-sm text-muted-foreground">{payeeMap.get(bill.payeeId) || 'N/A'}</p>
                        </div>
                        <div className="flex-shrink-0">
                            <p className={`text-xl font-bold font-mono text-right ${statusColors.text}`}>
                                {bill.isEstimate && <span className="font-normal text-xs" title="Valor estimado">(est.) </span>}
                                {formatCurrency(bill.amount)}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors.bg} ${statusColors.text} ring-1 ring-inset ring-current/20`}>{bill.status === 'overdue' ? 'Vencido' : bill.status === 'pending' ? 'Pendente' : 'Pago'}</span>
                            <span className="text-xs text-muted-foreground">{bill.status === 'paid' ? `em ${formatDate(bill.paidDate!)}` : `vence em ${formatDate(bill.dueDate)}`}</span>
                            {bill.recurringId && <span title="Conta recorrente"><Repeat className="h-3 w-3 text-muted-foreground"/></span>}
                        </div>
                        
                        <div className="flex items-center gap-1">
                            {bill.status !== 'paid' && 
                              <button onClick={(e) => handleActionClick(e, () => setView({ name: 'pay-bill-form', billId: bill.id, returnView: currentView }))} 
                              className="text-primary bg-primary/10 hover:bg-primary/20 font-semibold text-xs py-1.5 px-3 rounded-full transition-colors">
                                Pagar
                              </button>
                            }
                            <button title="Editar" onClick={(e) => handleActionClick(e, () => setView({ name: 'bill-form', billId: bill.id, returnView: currentView }))} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-dark-muted transition-colors"><Edit className="h-4 w-4"/></button>
                            <button title="Excluir" onClick={(e) => handleActionClick(e, () => setView({ name: 'delete-bill-confirmation', billId: bill.id, returnView: currentView }))} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-dark-muted transition-colors"><Trash className="h-4 w-4"/></button>
                            
                            <div className="h-7 w-7 flex items-center justify-center">
                              <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                                  <ChevronDown className="h-5 w-5 text-muted-foreground"/>
                              </motion.div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-4 border-t border-black/10 dark:border-white/10">
                                <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <div className="space-y-2">
                                        <p><strong className="text-muted-foreground">Categoria:</strong> {categoryName || 'N/A'}</p>
                                        {bill.installmentInfo && (
                                            <p><strong className="text-muted-foreground">Parcela:</strong> {bill.installmentInfo.current} de {bill.installmentInfo.total}</p>
                                        )}
                                        {bill.recurringId && !bill.installmentInfo && (
                                            <p><strong className="text-muted-foreground">Recorrência:</strong> Mensal</p>
                                        )}
                                        {bill.attachmentUrl && bill.status === 'paid' && 
                                          <button onClick={(e) => handleActionClick(e, () => setView({ name: 'attachment-view', attachmentUrl: bill.attachmentUrl!, returnView: currentView }))}
                                            className="flex items-center gap-1.5 text-primary font-semibold text-sm hover:underline">
                                            <Paperclip className="h-4 w-4" /> Ver Comprovante
                                          </button>
                                        }
                                    </div>
                                    <div className="space-y-2">
                                        {transaction && (
                                            <p><strong className="text-muted-foreground">Pago da Conta:</strong> {accountName || 'N/A'}</p>
                                        )}
                                        {bill.notes && <p><strong className="text-muted-foreground">Notas:</strong> {bill.notes}</p>}
                                    </div>
                                </div>
                                {transaction && (
                                    <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10">
                                        <button
                                            onClick={(e) => handleActionClick(e, () => setView({ name: 'transaction-form', transactionId: bill.transactionId, returnView: currentView }))}
                                            className="text-primary font-semibold text-sm hover:underline"
                                        >
                                            Ver Transação Vinculada
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    };

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><ClipboardList className="h-6 w-6 text-primary"/></div>
                    <h2 className="hidden sm:block text-2xl md:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">Contas a Pagar</h2>
                </div>
                 <motion.button onClick={() => setView({ name: 'bill-form', returnView: currentView })} className="bg-primary text-primary-foreground font-semibold py-2.5 px-5 rounded-full flex items-center gap-2 active:scale-95 transition-transform shadow-btn dark:shadow-dark-btn" whileTap={{scale:0.98}}>
                    <PlusCircle className="h-5 w-5"/> Nova Conta
                </motion.button>
            </div>
            
            <div className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border space-y-4">
                <h3 className="font-bold">Resumo</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-sm text-muted-foreground">Vencido Anterior</p>
                        <p className="text-lg font-bold text-danger">{formatCurrency(summary.previousOverdue.amount)}</p>
                    </div>
                     <div>
                        <p className="text-sm text-muted-foreground">Aberto no Mês</p>
                        <p className="text-lg font-bold text-warning">{formatCurrency(summary.thisMonth.openAmount)}</p>
                    </div>
                     <div>
                        <p className="text-sm text-muted-foreground">Pago no Mês</p>
                        <p className="text-lg font-bold text-success">{formatCurrency(summary.thisMonth.paidAmount)}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                        <input type="text" placeholder="Buscar por descrição..." value={filters.searchTerm} onChange={e => setFilters(f => ({...f, searchTerm: e.target.value}))}
                            className="w-full pl-9 pr-3 py-2 bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-lg"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <FilterChip label="Todos" selected={filters.status === 'all'} onClick={() => setFilters(f => ({...f, status: 'all'}))} />
                        <FilterChip label="Pendentes" selected={filters.status === 'pending'} onClick={() => setFilters(f => ({...f, status: 'pending'}))} />
                        <FilterChip label="Pagos" selected={filters.status === 'paid'} onClick={() => setFilters(f => ({...f, status: 'paid'}))} />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {Object.keys(groupedBillsByYear).length > 0 ? (
                    Object.keys(groupedBillsByYear).sort((a, b) => b.localeCompare(a)).map(year => {
                        const isYearExpanded = expandedKeys.includes(year);
                        const yearData = groupedBillsByYear[year];
                        const sortedMonths = Object.keys(yearData).sort((a, b) => b.localeCompare(a));

                        return (
                            <motion.div key={year} layout className="bg-card dark:bg-dark-card rounded-xl border border-border dark:border-dark-border">
                                <button onClick={() => toggleExpand(year)} className="w-full p-4 text-left">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">{year}</h3>
                                        <motion.div animate={{ rotate: isYearExpanded ? 180 : 0 }}>
                                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                        </motion.div>
                                    </div>
                                </button>
                                <AnimatePresence>
                                    {isYearExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-4 pb-4 space-y-3">
                                                {sortedMonths.map(monthKey => {
                                                    const isMonthExpanded = expandedKeys.includes(monthKey);
                                                    const monthData = yearData[monthKey];
                                                    const monthName = new Date(monthKey + '-02').toLocaleDateString('pt-BR', { month: 'long' });

                                                    return (
                                                        <motion.div key={monthKey} layout className="bg-background dark:bg-dark-background/60 rounded-lg border border-border dark:border-dark-border">
                                                            <button onClick={() => toggleExpand(monthKey)} className="w-full p-3 text-left">
                                                                <div className="flex justify-between items-center">
                                                                    <div className="font-semibold capitalize">{monthName} <span className="text-xs font-normal text-muted-foreground">({monthData.bills.length} contas)</span></div>
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="text-sm text-right">
                                                                            {monthData.openAmount > 0 && <div className="text-danger">Aberto: {formatCurrency(monthData.openAmount)}</div>}
                                                                            {monthData.paidAmount > 0 && <div className="text-success">Pago: {formatCurrency(monthData.paidAmount)}</div>}
                                                                        </div>
                                                                        <motion.div animate={{ rotate: isMonthExpanded ? 180 : 0 }}>
                                                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                                        </motion.div>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                            <AnimatePresence>
                                                                {isMonthExpanded && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                                        className="overflow-hidden"
                                                                    >
                                                                        <div className="p-2 space-y-2">
                                                                            {monthData.bills.map(bill => <BillRow key={bill.id} bill={bill} />)}
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })
                ) : (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-center py-16 text-muted-foreground bg-card dark:bg-dark-card rounded-lg">
                        <p className="font-semibold">Nenhuma conta encontrada.</p>
                        <p className="text-sm">Tente ajustar os filtros ou adicione uma nova conta.</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
};


// --- Form Page Component ---
// FIX: Export component to be used in App.tsx
export const BillFormPage: React.FC<{
    viewState: ViewState;
    setView: (view: ViewState) => void;
}> = ({ viewState, setView }) => {
    const { billId, returnView } = viewState as { name: 'bill-form', billId?: string, returnView: ViewState };
    const isEdit = !!billId;
    const [loading, setLoading] = useState(true);
    const [bill, setBill] = useState<PayableBill | null>(null);
    const [data, setData] = useState<{ payees: Payee[], categories: Category[], unlinkedExpenses: Transaction[] }>({ payees: [], categories: [], unlinkedExpenses: [] });
    const toast = useToast();
    const [formState, setFormState] = useState({
        description: '', payeeId: '', categoryId: '', amount: 0, firstDueDate: new Date().toISOString().slice(0, 10),
        notes: '', paymentType: 'single' as 'single' | 'installments' | 'monthly', installments: 2, isEstimate: false,
        attachmentUrl: '', attachmentFilename: ''
    });
    const [amountStr, setAmountStr] = useState('R$ 0,00');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [linkedExpenseId, setLinkedExpenseId] = useState('');

    useEffect(() => {
        const loadData = async () => {
            const [payees, categories, allBills, expenses] = await Promise.all([payeesApi.getAll(), categoriesApi.getAll(), isEdit ? payableBillsApi.getAll() : [], getUnlinkedExpenses()]);
            setData({ payees, categories: categories.filter(c => c.type === 'expense' || c.type === 'both'), unlinkedExpenses: expenses });
            if (isEdit && billId) {
                const currentBill = allBills.find(b => b.id === billId);
                if (currentBill) {
                    setBill(currentBill);
                    setFormState({
                        description: currentBill.description, payeeId: currentBill.payeeId, categoryId: currentBill.categoryId,
                        amount: currentBill.amount, firstDueDate: currentBill.dueDate.slice(0, 10), notes: currentBill.notes || '',
                        paymentType: currentBill.installmentInfo ? 'installments' : (currentBill.recurringId ? 'monthly' : 'single'),
                        installments: currentBill.installmentInfo?.total || 2, isEstimate: currentBill.isEstimate || false,
                        attachmentUrl: currentBill.attachmentUrl || '', attachmentFilename: currentBill.attachmentFilename || ''
                    });
                    setAmountStr(formatCurrencyForInput(currentBill.amount));
                }
            }
            setLoading(false);
        };
        loadData();
    }, [billId, isEdit]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numericValue = parseCurrencyFromInput(value);
        setFormState(prev => ({ ...prev, amount: numericValue }));
        setAmountStr(formatCurrencyForInput(numericValue));
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormState(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
             if (isEdit && billId && linkedExpenseId) {
                await linkExpenseToBill(billId, linkedExpenseId);
                toast.success('Conta vinculada com sucesso!');
                setView(returnView);
                return;
            }

            if (isEdit && billId) {
                const { isEstimate, notes, firstDueDate, paymentType, installments, ...restOfState } = formState;

                const finalNotes = isEstimate 
                    ? `[ESTIMATE] ${(notes || '').replace(/\[ESTIMATE\]\s*/, '').trim()}`.trim() 
                    : (notes || '').replace(/\[ESTIMATE\]\s*/, '').trim();

                const payload = {
                    ...restOfState,
                    dueDate: firstDueDate,
                    notes: finalNotes,
                    isEstimate: isEstimate
                };
                
                const { data: updatedBill, warning } = await payableBillsApi.update(billId, payload);
                if (warning) toast.info(warning);

            } else {
                await addPayableBill(formState);
            }
            toast.success(`Conta ${isEdit ? 'atualizada' : 'adicionada'} com sucesso!`);
            setView(returnView);
        } catch (error: any) {
            console.error("Failed to save bill:", error);
            toast.error(`Falha ao salvar conta: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";
    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
    
    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title={isEdit ? "Editar Conta" : "Nova Conta a Pagar"} onBack={() => setView(returnView)} />
            <div className="space-y-4 bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border">
                {isEdit && bill?.status === 'paid' && !bill.transactionId && (
                     <div className="p-4 bg-warning/10 rounded-lg space-y-2">
                        <p className="text-sm font-semibold text-warning/80">Esta conta está paga mas não foi vinculada a nenhuma despesa.</p>
                        <div><label className={labelClass}>Vincular à despesa existente</label>
                            <select value={linkedExpenseId} onChange={e => setLinkedExpenseId(e.target.value)} className={inputClass}>
                                <option value="">Selecione uma despesa...</option>
                                {data.unlinkedExpenses.map(t => <option key={t.id} value={t.id}>{formatDate(t.date)} - {t.description} - {formatCurrency(t.amount)}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                <div><label className={labelClass}>Descrição</label><input type="text" value={formState.description} onChange={e => setFormState(f => ({...f, description: e.target.value}))} required className={inputClass} disabled={!!linkedExpenseId}/></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Beneficiário</label><select value={formState.payeeId} onChange={e => setFormState(f => ({...f, payeeId: e.target.value}))} required className={inputClass} disabled={!!linkedExpenseId}><option value="">Selecione...</option>{data.payees.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                    <div><label className={labelClass}>Categoria</label><select value={formState.categoryId} onChange={e => setFormState(f => ({...f, categoryId: e.target.value}))} required className={inputClass} disabled={!!linkedExpenseId}><option value="">Selecione...</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Valor</label><input type="text" value={amountStr} onChange={handleAmountChange} required className={inputClass} disabled={!!linkedExpenseId}/></div>
                    <DateField id="firstDueDate" label={isEdit ? "Vencimento" : "1º Vencimento"} value={formState.firstDueDate} onChange={date => setFormState(f => ({ ...f, firstDueDate: date }))} required />
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <input type="checkbox" id="isEstimate" checked={formState.isEstimate} onChange={e => setFormState(f => ({ ...f, isEstimate: e.target.checked }))} className="h-4 w-4 rounded border-border dark:border-dark-border text-primary focus:ring-primary" disabled={!!linkedExpenseId}/>
                    <label htmlFor="isEstimate" className="text-sm font-medium text-muted-foreground">Este valor é uma estimativa</label>
                </div>

                {isEdit && bill?.status === 'paid' && (
                    <div><label className={labelClass}>Anexo</label>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className={`${inputClass} text-left ${formState.attachmentFilename ? 'text-primary' : 'text-muted-foreground'} flex items-center gap-2`}>
                            <Paperclip className="h-4 w-4" />{formState.attachmentFilename || 'Escolher arquivo...'}
                        </button>
                    </div>
                )}

                {!isEdit && (
                    <div>
                        <label className={labelClass}>Tipo de Pagamento</label>
                        <div className="flex bg-muted/50 dark:bg-dark-muted/50 p-1 rounded-lg">
                            <button type="button" onClick={() => setFormState(f => ({ ...f, paymentType: 'single' }))} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${formState.paymentType === 'single' ? 'bg-card dark:bg-dark-card shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Único</button>
                            <button type="button" onClick={() => setFormState(f => ({ ...f, paymentType: 'installments' }))} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${formState.paymentType === 'installments' ? 'bg-card dark:bg-dark-card shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Parcelado</button>
                            <button type="button" onClick={() => setFormState(f => ({ ...f, paymentType: 'monthly' }))} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${formState.paymentType === 'monthly' ? 'bg-card dark:bg-dark-card shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Mensal</button>
                        </div>
                    </div>
                )}
                {formState.paymentType === 'installments' && !isEdit && (
                    <div><label className={labelClass}>Número de Parcelas</label><input type="number" value={formState.installments} min="2" onChange={e => setFormState(f => ({...f, installments: parseInt(e.target.value)}))} className={inputClass}/></div>
                )}

                <div><label className={labelClass}>Notas</label><textarea value={formState.notes} onChange={e => setFormState(f => ({...f, notes: e.target.value}))} className={inputClass} rows={2} disabled={!!linkedExpenseId}/></div>
            </div>
            <div className="flex justify-center"><SubmitButton isSubmitting={isSubmitting} text={linkedExpenseId ? 'Salvar e Vincular' : 'Salvar'} /></div>
        </form>
    );
};

// FIX: Export component to be used in App.tsx
export const PayBillPage: React.FC<{ viewState: ViewState; setView: (view: ViewState) => void; }> = ({ viewState, setView }) => {
    const { billId, returnView } = viewState as { name: 'pay-bill-form', billId: string, returnView: ViewState };
    const [loading, setLoading] = useState(true);
    const [bill, setBill] = useState<PayableBill | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [unlinkedExpenses, setUnlinkedExpenses] = useState<Transaction[]>([]);
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [paymentType, setPaymentType] = useState<'new' | 'link'>('new');
    const [linkedExpenseId, setLinkedExpenseId] = useState('');
    const [formState, setFormState] = useState({
        accountId: '', paidAmount: 0, paymentDate: new Date().toISOString().slice(0, 10), attachmentUrl: '', attachmentFilename: ''
    });
    const [amountStr, setAmountStr] = useState('R$ 0,00');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const [allBills, accs, expenses] = await Promise.all([payableBillsApi.getAll(), accountsApi.getAll(), getUnlinkedExpenses()]);
            const currentBill = allBills.find(b => b.id === billId);
            setBill(currentBill || null);
            setAccounts(accs);
            setUnlinkedExpenses(expenses);
            if (currentBill) {
                setFormState(f => ({...f, paidAmount: currentBill.amount}));
                setAmountStr(formatCurrencyForInput(currentBill.amount));
            }
            if (accs.length > 0) setFormState(f => ({...f, accountId: accs[0].id}));
            setLoading(false);
        };
        loadData();
    }, [billId]);
    
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numericValue = parseCurrencyFromInput(value);
        setFormState(prev => ({ ...prev, paidAmount: numericValue }));
        setAmountStr(formatCurrencyForInput(numericValue));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormState(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
        }
    };

    const handlePasteAttachment = async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const file = new File([blob], `colado-${Date.now()}.${imageType.split('/')[1]}`, { type: imageType });
                    setFormState(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
                    toast.success('Anexo colado com sucesso!');
                    return;
                }
            }
            toast.info('Nenhuma imagem encontrada na área de transferência.');
        } catch (err) {
            toast.error('Falha ao colar da área de transferência.');
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            let warningMessage: string | undefined;
            if (paymentType === 'new') {
                const { warning } = await payBill(billId, formState);
                warningMessage = warning;
            } else {
                await linkExpenseToBill(billId, linkedExpenseId);
            }
            
            if (warningMessage) {
                toast.success("Conta paga, mas o anexo falhou ao ser enviado.");
                toast.info(warningMessage);
            } else {
                toast.success("Conta paga com sucesso!");
            }
            setView(returnView);
        } catch (error: any) {
            console.error("Failed to pay bill:", error);
            toast.error(`Falha ao pagar conta: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loading || !bill) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";
    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Pagar Conta" onBack={() => setView(returnView)} />
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                 <div className="text-center border-b border-border dark:border-dark-border pb-4">
                    <p className="text-lg font-semibold text-foreground dark:text-dark-foreground">{bill.description}</p>
                    <p className="text-sm text-muted-foreground">Vencimento: {formatDate(bill.dueDate)}</p>
                 </div>

                <div className="flex bg-muted/50 dark:bg-dark-muted/50 p-1 rounded-lg">
                    <button type="button" onClick={() => setPaymentType('new')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${paymentType === 'new' ? 'bg-card dark:bg-dark-card shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Novo Pagamento</button>
                    <button type="button" onClick={() => setPaymentType('link')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${paymentType === 'link' ? 'bg-card dark:bg-dark-card shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Vincular Despesa</button>
                </div>
                
                {paymentType === 'new' ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Valor a Pagar</label>
                                <input 
                                    type="text" 
                                    value={amountStr} 
                                    onChange={handleAmountChange} 
                                    required 
                                    className={`${inputClass} text-center text-lg font-bold`} 
                                />
                            </div>
                            <DateField id="paymentDate" label="Data do Pagamento" value={formState.paymentDate} onChange={date => setFormState(f => ({ ...f, paymentDate: date }))} required />
                        </div>
                         <div><label className={labelClass}>Conta de Origem</label><select value={formState.accountId} onChange={e => setFormState(f => ({...f, accountId: e.target.value}))} required className={inputClass}><option value="">Selecione...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                        <div>
                            <label className={labelClass}>Anexo</label>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className={`${inputClass} flex-1 text-left ${formState.attachmentFilename ? 'text-primary' : 'text-muted-foreground'} flex items-center gap-2`}>
                                    <Paperclip className="h-4 w-4" />
                                    {formState.attachmentFilename || 'Escolher arquivo...'}
                                </button>
                                <button type="button" onClick={handlePasteAttachment} className="p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border text-muted-foreground hover:text-primary transition-colors">
                                    <ClipboardPaste className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <label className={labelClass}>Despesa a Vincular</label>
                        <select value={linkedExpenseId} onChange={e => setLinkedExpenseId(e.target.value)} required className={inputClass}>
                            <option value="">Selecione uma despesa...</option>
                            {unlinkedExpenses.map(t => <option key={t.id} value={t.id}>{formatDate(t.date)} - {t.description} - {formatCurrency(t.amount)}</option>)}
                        </select>
                    </div>
                )}
            </div>
             <div className="flex justify-center"><SubmitButton isSubmitting={isSubmitting} text="Confirmar Pagamento" /></div>
        </form>
    );
};

export const DeleteBillConfirmationPage: React.FC<{ viewState: ViewState; setView: (view: ViewState) => void; }> = ({ viewState, setView }) => {
    const { billId, returnView } = viewState as { name: 'delete-bill-confirmation', billId: string, returnView: ViewState };
    const [bill, setBill] = useState<PayableBill | null>(null);
    const toast = useToast();
    const [deleteOption, setDeleteOption] = useState<'single' | 'all'>('single');

    useEffect(() => {
        payableBillsApi.getAll().then(allBills => setBill(allBills.find(b => b.id === billId) || null));
    }, [billId]);

    const handleDelete = async () => {
        if (!bill) return;
        try {
            if (bill.installmentGroupId && deleteOption === 'all') {
                await payableBillsApi.deleteInstallmentGroup(bill.installmentGroupId);
                toast.success('Todas as parcelas foram excluídas.');
            } else if (bill.recurringId && deleteOption === 'all') {
                await (payableBillsApi as any).deleteFutureRecurring(bill.recurringId, bill.dueDate);
                toast.success('Esta e as futuras contas recorrentes foram excluídas.');
            } else {
                await payableBillsApi.remove(bill.id);
                toast.success('Conta excluída com sucesso.');
            }
            setView(returnView);
        } catch (error: any) {
            toast.error(error.message.includes('foreign key constraint') ? 'Não é possível excluir. A conta está vinculada a uma transação.' : 'Erro ao excluir conta.');
        }
    };
    
    if (!bill) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    return (
         <div className="space-y-6 max-w-lg mx-auto">
             <PageHeader title="Confirmar Exclusão" onBack={() => setView(returnView)} />
             <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border text-center space-y-4">
                 <p>Tem certeza que deseja excluir a conta a pagar <span className="font-bold">"{bill.description}"</span>?</p>
                 
                 {(bill.installmentGroupId || bill.recurringId) && (
                    <div className="p-3 bg-muted dark:bg-dark-muted rounded-lg space-y-2">
                        <p className="text-sm font-semibold">Esta é uma conta recorrente.</p>
                         <div className="flex justify-center gap-4">
                             <label className="flex items-center gap-2 text-sm"><input type="radio" name="deleteOption" value="single" checked={deleteOption === 'single'} onChange={() => setDeleteOption('single')} /> Apenas esta</label>
                             <label className="flex items-center gap-2 text-sm"><input type="radio" name="deleteOption" value="all" checked={deleteOption === 'all'} onChange={() => setDeleteOption('all')} /> Esta e as futuras</label>
                         </div>
                    </div>
                 )}
                 <div className="flex justify-center gap-4 pt-4">
                     <button onClick={() => setView(returnView)} className="bg-muted dark:bg-dark-muted text-foreground dark:text-dark-foreground font-semibold py-2 px-6 rounded-md">Cancelar</button>
                     <button onClick={handleDelete} className="bg-destructive text-destructive-foreground font-semibold py-2 px-6 rounded-md">Excluir</button>
                 </div>
             </div>
         </div>
    );
};