import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ViewState, PayableBill, Payee, Category, Account, Transaction } from '../types';
import { payableBillsApi, payeesApi, categoriesApi, accountsApi, addPayableBill, payBill, getUnlinkedExpenses, linkExpenseToBill, transactionsApi, getPayableBillsSummary } from '../services/api';
import { PlusCircle, Edit, Trash, DollarSign, Search, ClipboardList, Repeat, Paperclip, X as XIcon, ArrowLeft, ClipboardPaste, ChevronDown } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from './Notifications';
import { AISummary } from './AISummary';
import { useApp } from '../contexts/AppContext';

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
export const AccountsPayable: React.FC<{ viewState: ViewState }> = ({ viewState }) => {
    const { setView } = useApp();
    const { componentState } = viewState as { name: 'accounts-payable', componentState?: any };
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{ bills: PayableBill[], payees: Payee[], categories: Category[], accounts: Account[], transactions: Transaction[] }>({ bills: [], payees: [], categories: [], accounts: [], transactions: [] });
    const isInitialLoad = useRef(true);
    const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
    const [summary, setSummary] = useState<any>(null);

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
            const [bills, payees, categories, accounts, transactions, summaryData] = await Promise.all([
                payableBillsApi.getAll(filters), payeesApi.getAll(), categoriesApi.getAll(), accountsApi.getAll(), transactionsApi.getAll(), getPayableBillsSummary()
            ]);
            setData({ bills, payees, categories: categories.filter(c => c.type === 'expense' || c.type === 'both'), accounts, transactions });
            setSummary(summaryData);
        } catch (error) {
            console.error("Failed to fetch accounts payable data", error);
        } finally {
             if (!isUpdate || isInitialLoad.current) {
                setLoading(false);
                isInitialLoad.current = false;
            }
        }
    }, [filters]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const groupedBillsByYear = useMemo(() => {
        const groups: Record<string, Record<string, {
            bills: PayableBill[];
            totalAmount: number;
            openAmount: number;
            paidAmount: number;
        }>> = {};

        for (const bill of data.bills) {
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
    }, [data.bills]);

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
                            <p className="font-bold text-foreground dark:text-dark-foreground break-words">{bill.description}</p>
                            <p className="text-sm text-muted-foreground">{payeeMap.get(bill.payeeId) || 'N/A'}</p>
                        </div>
                        <div className="flex-shrink-0">
                            <p className={`text-xl font-bold font-mono text-right ${statusColors.text}`}>
                                {bill.isEstimate && <span className="font-normal text-xs" title="Valor estimado">(est.) </span>}
                                {formatCurrency(bill.amount)}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-end mt-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors.bg} ${statusColors.text} ring-1 ring-inset ring-current/20`}>{bill.status === 'overdue' ? 'Vencido' : bill.status === 'pending' ? 'Pendente' : 'Pago'}</span>
                            <span className="text-xs text-muted-foreground">{bill.status === 'paid' ? `em ${formatDate(bill.paidDate!)}` : `vence em ${formatDate(bill.dueDate)}`}</span>
                            {bill.recurringId && <span title="Conta recorrente"><Repeat className="h-3 w-3 text-muted-foreground"/></span>}
                        </div>
                        
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            {bill.status !== 'paid' && 
                                <button 
                                    onClick={(e) => handleActionClick(e, () => setView({ name: 'pay-bill-form', billId: bill.id, returnView: currentView }))} 
                                    className="text-primary bg-primary/10 hover:bg-primary/20 font-semibold text-xs py-1.5 px-3 rounded-full transition-colors w-full"
                                >
                                    Pagar
                                </button>
                            }
                            <div className="flex items-center gap-2">
                                <button title="Editar" onClick={(e) => handleActionClick(e, () => setView({ name: 'bill-form', billId: bill.id, returnView: currentView }))} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-dark-muted transition-colors">
                                    <Edit className="h-4 w-4"/>
                                </button>
                                <button title="Excluir" onClick={(e) => handleActionClick(e, () => setView({ name: 'delete-bill-confirmation', billId: bill.id, returnView: currentView }))} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-dark-muted transition-colors">
                                    <Trash className="h-4 w-4"/>
                                </button>
                                <div className="h-7 w-7 flex items-center justify-center">
                                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                                        <ChevronDown className="h-5 w-5 text-muted-foreground"/>
                                    </motion.div>
                                </div>
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

    const aiSummaryPrompt = `
        Você é um assistente financeiro. Analise o JSON de contas a pagar e o resumo.
        Forneça um resumo conciso sobre a situação das contas a pagar.
        Destaque:
        1. O valor total de contas já vencidas (previousOverdue.amount).
        2. O valor total de contas que ainda precisam ser pagas este mês (thisMonth.openAmount).
        3. Mencione as 2 contas mais caras que estão pendentes ou vencidas na lista 'filteredBills'.
        Seja direto e use negrito para valores.
    `;


    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-center sm:justify-between gap-4">
                <div className="hidden sm:flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><ClipboardList className="h-6 w-6 text-primary"/></div>
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground dark:text-dark-foreground">Contas a Pagar</h2>
                </div>
                 <motion.button onClick={() => setView({ name: 'bill-form', returnView: currentView })} className="bg-primary text-primary-foreground font-semibold py-2.5 px-5 rounded-full flex items-center gap-2 active:scale-95 transition-transform shadow-btn dark:shadow-dark-btn flex-shrink-0" whileTap={{scale:0.98}}>
                    <PlusCircle className="h-5 w-5"/>
                    <span>Nova Conta</span>
                </motion.button>
            </div>

            <AISummary
                data={{ summary, filteredBills: data.bills.filter(b => b.status !== 'paid').slice(0, 20) }}
                prompt={aiSummaryPrompt}
            />
            
            {summary && <div className="bg-card dark:bg-dark-card p-3 rounded-lg border border-border dark:border-dark-border">
                 <div className="flex justify-between items-center text-center gap-2">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Vencido Anterior</p>
                        <p className="text-base sm:text-lg font-bold text-danger">{formatCurrency(summary.previousOverdue.amount)}</p>
                    </div>
                    <div className="w-px h-10 bg-border dark:bg-dark-border"></div>
                     <div>
                        <p className="text-xs font-medium text-muted-foreground">Aberto no Mês</p>
                        <p className="text-base sm:text-lg font-bold text-warning">{formatCurrency(summary.thisMonth.openAmount)}</p>
                    </div>
                    <div className="w-px h-10 bg-border dark:bg-dark-border"></div>
                     <div>
                        <p className="text-xs font-medium text-muted-foreground">Pago no Mês</p>
                        <p className="text-base sm:text-lg font-bold text-success">{formatCurrency(summary.thisMonth.paidAmount)}</p>
                    </div>
                </div>
            </div>}

            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                        <input type="text" placeholder="Buscar por descrição..." value={filters.searchTerm} onChange={e => setFilters(f => ({...f, searchTerm: e.target.value}))}
                            className="w-full pl-9 pr-3 py-2 bg-card dark:bg-dark-card border border-border dark:border-dark-border rounded-lg"
                        />
                    </div>
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
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
                                                            <button onClick={() => toggleExpand(monthKey)} className="w-full p-3 text-left transition-colors hover:bg-muted/50 dark:hover:bg-dark-muted/50">
                                                                <div className="flex justify-between items-center gap-3">
                                                                    <div className="flex flex-col items-center text-center sm:items-start sm:text-left min-w-0 flex-1">
                                                                        <span className="font-semibold capitalize">{monthName}</span>
                                                                        <span className="text-xs font-normal text-muted-foreground whitespace-nowrap">
                                                                            ({monthData.bills.length} {monthData.bills.length === 1 ? 'conta' : 'contas'})
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                                        <div className="flex flex-col text-sm font-mono items-end">
                                                                            {monthData.openAmount > 0 && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-muted-foreground font-sans text-xs">Aberto:</span>
                                                                                    <span className="font-semibold text-danger">{formatCurrency(monthData.openAmount)}</span>
                                                                                </div>
                                                                            )}
                                                                            {monthData.paidAmount > 0 && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-muted-foreground font-sans text-xs">Pago:</span>
                                                                                    <span className="font-semibold text-success">{formatCurrency(monthData.paidAmount)}</span>
                                                                                </div>
                                                                            )}
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