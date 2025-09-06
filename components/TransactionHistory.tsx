import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ViewState, Transaction, Category, Tag, Project, Account } from '../types';
import { getFinancialReport, categoriesApi, tagsApi, projectsApi, accountsApi, getAccountHistory } from '../services/api';
import { ArrowLeft, Paperclip, ChevronDown } from './Icons';
import { DateField } from './common/PageLayout';
import { useToast } from './Notifications';

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

const TransactionCard: React.FC<{ transaction: Transaction, categoryName: string, onViewAttachment: (url: string) => void, onSelect: () => void }> = ({ transaction, categoryName, onViewAttachment, onSelect }) => {
    const isIncome = transaction.type === 'income';
    return (
        <div
            onClick={onSelect}
            className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border cursor-pointer flex items-center justify-between gap-4 transition-colors hover:bg-muted/50 dark:hover:bg-dark-muted/50"
        >
            {/* Left side: Description, category, date */}
            <div className="flex-1 min-w-0 flex items-center gap-3">
                 {transaction.attachmentUrl && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onViewAttachment(transaction.attachmentUrl!); }} className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full transition-all bg-muted/50 dark:bg-dark-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary"><Paperclip className="h-5 w-5"/></button>
                )}
                <div>
                    <p className="font-bold text-foreground dark:text-dark-foreground break-words">{transaction.description}</p>
                    <div className={`flex items-center gap-x-3 text-sm text-muted-foreground mt-1`}>
                        <span>{categoryName}</span>
                        <span>{formatDate(transaction.date)}</span>
                    </div>
                </div>
            </div>

            {/* Right side: Amount and Running Balance */}
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
    );
};


// --- Main Component ---
export const TransactionHistory: React.FC<{
    viewState: ViewState;
    setView: (view: ViewState) => void;
}> = ({ viewState, setView }) => {
    const { accountId, componentState } = viewState as { name: 'transaction-history', accountId: string, componentState?: any };
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balanceInfo, setBalanceInfo] = useState<{ opening: number, closing: number } | null>(null);
    const [allAccounts, setAllAccounts] = useState<Account[]>([]);
    const [filterData, setFilterData] = useState<{ categories: Category[], tags: Tag[], projects: Project[] }>({ categories: [], tags: [], projects: [] });
    const [selectedAccountId, setSelectedAccountId] = useState(accountId || 'all');
    const toast = useToast();
    
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
                        <DateField id="startDate" label="Data Início" value={filters.startDate} onChange={date => setFilters(f => ({ ...f, startDate: date }))} />
                        <DateField id="endDate" label="Data Fim" value={filters.endDate} onChange={date => setFilters(f => ({ ...f, endDate: date }))} />
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