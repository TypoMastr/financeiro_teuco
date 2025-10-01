import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ViewState, Transaction, Category, Tag, Project, Account } from '../types';
import { getFinancialReport, categoriesApi, tagsApi, projectsApi, accountsApi, getAccountHistory } from '../services/api';
import { ArrowLeft, Paperclip, ChevronDown, MessageSquare, ArrowRightLeft } from './Icons';
import { DateField } from './common/FormControls';
import { useToast } from './Notifications';
import { useApp } from '../contexts/AppContext';

// --- Helper Functions ---
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const getCurrentMonthDateRange = () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { startDate, endDate };
};

// --- Sub-components ---
const FilterInput: React.FC<{ label: string, children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
        {children}
    </div>
);

const TransactionCard: React.FC<{
    transaction: Transaction,
    categoryName: string,
    onViewAttachment: (url: string) => void,
    onSelect: () => void,
    expandedTransaction: { id: string; type: 'comments' | 'attachment' } | null,
    onToggleDetail: (id: string, type: 'comments' | 'attachment') => void
}> = ({ transaction, categoryName, onViewAttachment, onSelect, expandedTransaction, onToggleDetail }) => {
    const isIncome = transaction.type === 'income';
    const isExpanded = expandedTransaction?.id === transaction.id;

    return (
        <motion.div
            layout
            onClick={transaction.transferId ? undefined : onSelect}
            className={`bg-card dark:bg-dark-card rounded-lg border border-border dark:border-dark-border transition-colors ${transaction.transferId ? 'cursor-default' : 'cursor-pointer hover:bg-muted/50 dark:hover:bg-dark-muted/50'}`}
        >
            <div className="p-4 flex items-start justify-between gap-4">
                {/* Left side */}
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground dark:text-dark-foreground break-words">{transaction.description}</p>
                    <div className="flex items-center gap-x-3 text-sm text-muted-foreground mt-1">
                        {/* FIX: Removed the invalid 'title' prop from the icon component to fix the TypeScript error. The title is now handled within the SVG component itself for better accessibility. */}
                        {transaction.transferId && <ArrowRightLeft className="h-4 w-4 text-blue-500" />}
                        <span>{categoryName}</span>
                        <span>{formatDate(transaction.date)}</span>
                    </div>
                    
                    {/* Action Icons Section */}
                    {(transaction.comments || transaction.attachmentUrl) && (
                        <div className="mt-2 flex items-center justify-start gap-1">
                            {transaction.comments && (
                                <button 
                                    type="button" 
                                    onClick={(e) => { e.stopPropagation(); onToggleDetail(transaction.id, 'comments'); }}
                                    className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${expandedTransaction?.type === 'comments' && isExpanded ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}
                                    aria-label="Ver observações"
                                >
                                    <MessageSquare className="h-5 w-5" />
                                </button>
                            )}
                            {transaction.attachmentUrl && (
                                <button 
                                    type="button" 
                                    onClick={(e) => { e.stopPropagation(); onToggleDetail(transaction.id, 'attachment'); }}
                                    className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${expandedTransaction?.type === 'attachment' && isExpanded ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}
                                    aria-label="Ver anexo"
                                >
                                    <Paperclip className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Right side */}
                <div className="text-right flex-shrink-0 space-y-1">
                    <p className={`text-lg font-bold whitespace-nowrap ${isIncome ? 'text-success' : 'text-danger'}`}>
                        {isIncome ? '+' : ''}{formatCurrency(transaction.amount)}
                    </p>
                    {transaction.runningBalance !== undefined && (
                        <div className="inline-block bg-muted dark:bg-dark-muted px-2.5 py-1 rounded-md">
                            <p className="text-sm font-semibold text-muted-foreground dark:text-dark-muted-foreground font-mono">
                                {formatCurrency(transaction.runningBalance)}
                            </p>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                        onClick={(e) => e.stopPropagation()} 
                    >
                        <div className="px-4 pb-4 pt-2 border-t border-border/10 dark:border-dark-border/20">
                            {expandedTransaction.type === 'comments' && (
                                <div className="text-sm text-foreground dark:text-dark-foreground/90 whitespace-pre-wrap">
                                    <h4 className="font-bold mb-1 text-muted-foreground">Observações:</h4>
                                    {transaction.comments}
                                </div>
                            )}
                             {expandedTransaction.type === 'attachment' && (
                                <div className="text-sm">
                                     <h4 className="font-bold mb-2 text-muted-foreground">Anexo:</h4>
                                     <button 
                                        onClick={(e) => { e.stopPropagation(); onViewAttachment(transaction.attachmentUrl!); }}
                                        className="inline-flex items-center gap-2 bg-secondary dark:bg-dark-secondary text-secondary-foreground dark:text-dark-secondary-foreground font-semibold py-2 px-3 rounded-md text-sm hover:bg-muted dark:hover:bg-dark-muted"
                                     >
                                        <Paperclip className="h-4 w-4" />
                                        Ver Comprovante
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


// --- Main Component ---
export const TransactionHistory: React.FC<{ viewState: ViewState }> = ({ viewState }) => {
    const { setView } = useApp();
    const { accountId, componentState } = viewState as { name: 'transaction-history', accountId: string, componentState?: any };
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balanceInfo, setBalanceInfo] = useState<{ opening: number, closing: number } | null>(null);
    const [allAccounts, setAllAccounts] = useState<Account[]>([]);
    const [filterData, setFilterData] = useState<{ categories: Category[], tags: Tag[], projects: Project[] }>({ categories: [], tags: [], projects: [] });
    const [selectedAccountId, setSelectedAccountId] = useState(accountId || 'all');
    const toast = useToast();
    const [expandedTransaction, setExpandedTransaction] = useState<{ id: string; type: 'comments' | 'attachment' } | null>(null);
    
    const { startDate: currentMonthStart, endDate: currentMonthEnd } = getCurrentMonthDateRange();
    const [filters, setFilters] = useState(() => {
        return componentState?.filters || {
            startDate: currentMonthStart,
            endDate: currentMonthEnd,
            type: '' as 'income' | 'expense' | '',
            categoryId: '',
        };
    });
    
    const [isFiltersOpen, setIsFiltersOpen] = useState(window.matchMedia('(min-width: 768px)').matches);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 768px)');
        const handleResize = () => setIsFiltersOpen(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleResize);
        return () => mediaQuery.removeEventListener('change', handleResize);
    }, []);

    useEffect(() => {
        const fetchFilterData = async () => {
            const [cats, tgs, projs, accs] = await Promise.all([
                categoriesApi.getAll(),
                tagsApi.getAll(),
                projectsApi.getAll(),
                accountsApi.getAll(),
            ]);
            setFilterData({ categories: cats, tags: tgs, projects: projs });
            setAllAccounts(accs);
        };
        fetchFilterData();
    }, []);

    useEffect(() => {
      // Avoid fetching before allAccounts is populated if a specific account is selected.
      if (allAccounts.length === 0 && selectedAccountId !== 'all') return;

      const fetchTransactions = async () => {
        setLoading(true);
        setBalanceInfo(null);
        try {
            const reportFilters = {
                startDate: filters.startDate,
                endDate: filters.endDate,
                type: filters.type || undefined,
                categoryId: filters.categoryId || undefined,
            };
    
            if (selectedAccountId !== 'all') {
                const { transactions: reportData, openingBalance, closingBalance } = await getAccountHistory(selectedAccountId, reportFilters);
                setTransactions(reportData);
                setBalanceInfo({ opening: openingBalance, closing: closingBalance });
            } else {
                const reportData = await getFinancialReport({ ...reportFilters, accountIds: allAccounts.map(a => a.id) });
                setTransactions(reportData);
            }
        } catch (error) {
            console.error("Failed to fetch transaction history:", error);
            toast.error("Falha ao carregar histórico de transações.");
        } finally {
            setLoading(false);
        }
      };
      fetchTransactions();
    }, [selectedAccountId, filters, allAccounts, toast]);
    
    const handleToggleDetail = (id: string, type: 'comments' | 'attachment') => {
        setExpandedTransaction(prev => {
            if (prev?.id === id && prev?.type === type) {
                return null; // Collapse if clicking the same icon again
            }
            return { id, type }; // Expand or switch view
        });
    };

    const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0), [transactions]);
    const totalExpense = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0), [transactions]);

    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";
    const categoryMap = useMemo(() => new Map(filterData.categories.map(c => [c.id, c.name])), [filterData.categories]);
    
    const accountName = useMemo(() => {
        if (selectedAccountId === 'all') return 'Todas as Contas';
        return allAccounts.find(a => a.id === selectedAccountId)?.name || 'Histórico de Transações';
    }, [selectedAccountId, allAccounts]);

    const currentView: ViewState = { name: 'transaction-history', accountId: selectedAccountId, componentState: { filters } };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <button
                    onClick={() => setView({ name: 'financial' })}
                    className="text-sm font-semibold transition-all duration-200 bg-card dark:bg-dark-card text-foreground dark:text-dark-foreground py-2 px-4 sm:py-2.5 sm:px-5 rounded-full border border-border dark:border-dark-border shadow-btn hover:-translate-y-0.5 hover:shadow-lg dark:shadow-dark-btn flex items-center gap-2 self-start"
                >
                    <ArrowLeft className="h-4 w-4"/> Voltar para Financeiro
                </button>
                <div className="text-center sm:text-right">
                    <h2 className="text-2xl md:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">{accountName}</h2>
                    <p className="text-muted-foreground">Histórico de Transações</p>
                </div>
            </div>

            <div className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border">
                <button
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    className="w-full flex justify-between items-center font-semibold md:pointer-events-none"
                    aria-expanded={isFiltersOpen}
                >
                    Filtros
                    <div className={`transition-transform duration-200 md:hidden ${isFiltersOpen ? 'rotate-180' : ''}`}>
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    </div>
                </button>
                {isFiltersOpen && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t border-border dark:border-dark-border mt-4 md:pt-0 md:border-t-0 md:mt-0">
                        <FilterInput label="Conta">
                            <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className={inputClass}>
                                <option value="all">Todas as Contas</option>
                                {allAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                            </select>
                        </FilterInput>
                        <DateField id="startDate" label="Data Início" value={filters.startDate} onChange={date => setFilters(f => ({ ...f, startDate: date }))} smallLabel />
                        <DateField id="endDate" label="Data Fim" value={filters.endDate} onChange={date => setFilters(f => ({ ...f, endDate: date }))} smallLabel />
                        <FilterInput label="Tipo">
                            <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value as 'income' | 'expense' | '' }))} className={inputClass}>
                                <option value="">Todos</option>
                                <option value="income">Receita</option>
                                <option value="expense">Despesa</option>
                            </select>
                        </FilterInput>
                        <FilterInput label="Categoria">
                            <select value={filters.categoryId} onChange={e => setFilters(f => ({ ...f, categoryId: e.target.value }))} className={inputClass}>
                                <option value="">Todas</option>
                                {filterData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </FilterInput>
                    </div>
                )}
            </div>

            <div className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex justify-around text-center">
                {selectedAccountId !== 'all' && balanceInfo ? (
                    <>
                         <div>
                            <p className="text-sm font-medium text-muted-foreground">Saldo Anterior</p>
                            <p className="text-xl font-bold">{formatCurrency(balanceInfo.opening)}</p>
                        </div>
                         <div>
                            <p className="text-sm font-medium text-muted-foreground">Saldo Final</p>
                            <p className="text-xl font-bold">{formatCurrency(balanceInfo.closing)}</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Receita Total</p>
                            <p className="text-xl font-bold text-success">{formatCurrency(totalIncome)}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Despesa Total</p>
                            <p className="text-xl font-bold text-danger">{formatCurrency(totalExpense)}</p>
                        </div>
                    </>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
            ) : (
                <div>
                    {transactions.length > 0 ? (
                        <div className="space-y-3">
                            {transactions.map(t => (
                                <TransactionCard
                                    key={t.id}
                                    transaction={t}
                                    categoryName={categoryMap.get(t.categoryId) || 'N/A'}
                                    onSelect={() => setView({ name: 'transaction-form', transactionId: t.id, returnView: currentView })}
                                    onViewAttachment={(url) => setView({ name: 'attachment-view', attachmentUrl: url, returnView: currentView })}
                                    expandedTransaction={expandedTransaction}
                                    onToggleDetail={handleToggleDetail}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 text-muted-foreground">
                            <p className="font-semibold text-lg">Nenhuma transação encontrada.</p>
                            <p>Tente ajustar os filtros para este período.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};