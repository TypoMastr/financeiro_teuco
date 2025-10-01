import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ViewState, Transaction, Category } from '../types';
import { getFinancialReport, categoriesApi } from '../services/api';
import { ArrowLeft, Paperclip, MessageSquare, ChevronDown } from './Icons';
// FIX: Changed import for DateField from './common/PageLayout' to './common/FormControls'
import { DateField } from './common/FormControls';
import { useApp } from '../contexts/AppContext';

// --- Helper Functions ---
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR');

const getCurrentMonthDateRange = () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { startDate, endDate };
};

// --- Animation Variants ---
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
};

// --- Sub-components ---
const TransactionCard: React.FC<{
    transaction: Transaction,
    categoryName: string,
    onViewAttachment: (url: string) => void,
    onSelect: () => void,
    expandedDetailType: 'comments' | 'attachment' | undefined,
    onToggleDetail: (id: string, type: 'comments' | 'attachment') => void
}> = ({ transaction, categoryName, onViewAttachment, onSelect, expandedDetailType, onToggleDetail }) => {
    const isIncome = transaction.type === 'income';
    const isExpanded = !!expandedDetailType;

    return (
        <motion.div
            layout
            onClick={onSelect}
            className="bg-card dark:bg-dark-card rounded-lg border border-border dark:border-dark-border cursor-pointer transition-colors hover:bg-muted/50 dark:hover:bg-dark-muted/50"
        >
            <div className="p-4 flex items-start justify-between gap-4">
                {/* Left side */}
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground dark:text-dark-foreground break-words">{transaction.description}</p>
                    <div className="flex items-center gap-x-3 text-sm text-muted-foreground mt-1">
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
                                    className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${expandedDetailType === 'comments' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}
                                    aria-label="Ver observações"
                                >
                                    <MessageSquare className="h-5 w-5" />
                                </button>
                            )}
                            {transaction.attachmentUrl && (
                                <button 
                                    type="button" 
                                    onClick={(e) => { e.stopPropagation(); onToggleDetail(transaction.id, 'attachment'); }}
                                    className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${expandedDetailType === 'attachment' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'}`}
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
                            {expandedDetailType === 'comments' && (
                                <div className="text-sm text-foreground dark:text-dark-foreground/90 whitespace-pre-wrap">
                                    <h4 className="font-bold mb-1 text-muted-foreground">Observações:</h4>
                                    {transaction.comments}
                                </div>
                            )}
                             {expandedDetailType === 'attachment' && (
                                <div className="text-sm">
                                     <h4 className="font-bold mb-2 text-muted-foreground">Anexo:</h4>
                                     <button 
                                        onClick={(e) => { e.stopPropagation(); onViewAttachment(transaction.attachmentUrl!); }}
                                        className="inline-flex items-center gap-2 bg-secondary dark:bg-dark-secondary text-secondary-foreground dark:text-dark-secondary-foreground font-semibold py-2 px-3 rounded-md text-sm hover:bg-muted dark:hover:bg-dark-muted transition-colors"
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
const FinancialDetail: React.FC<{
    viewState: ViewState;
}> = ({ viewState }) => {
    const { setView } = useApp();
    // FIX: Correctly cast viewState to the specific discriminated union type to access its properties.
    const { filterType, filterId, filterName, componentState } = viewState as { name: 'financial-detail', filterType: 'category' | 'project' | 'tag', filterId: string, filterName: string, componentState?: any };
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [expandedDetails, setExpandedDetails] = useState<Map<string, 'comments' | 'attachment'>>(new Map());
    
    const { startDate: currentMonthStart, endDate: currentMonthEnd } = getCurrentMonthDateRange();
    const [filters, setFilters] = useState(componentState?.filters || { startDate: currentMonthStart, endDate: currentMonthEnd, type: '' as 'income' | 'expense' | '' });

    useEffect(() => { 
      const fetchData = async () => {
        setLoading(true);
        const baseFilter: any = {
            'category': { categoryId: filterId },
            'project': { projectId: filterId },
            'tag': { tagIds: [filterId] },
        }[filterType];

        const reportFilters = { 
            ...baseFilter, 
            startDate: filters.startDate, 
            endDate: filters.endDate,
            type: filters.type || undefined
        };

        const [reportData, cats] = await Promise.all([
            getFinancialReport(reportFilters),
            categoriesApi.getAll()
        ]);

        setTransactions(reportData);
        setCategories(cats);
        
        const initialExpanded = new Map<string, 'comments' | 'attachment'>();
        reportData.forEach(trx => {
            if (trx.comments) {
                initialExpanded.set(trx.id, 'comments');
            }
        });
        setExpandedDetails(initialExpanded);

        setLoading(false);
      };
        fetchData();
    }, [filterType, filterId, filters]);

    const handleToggleDetail = (id: string, type: 'comments' | 'attachment') => {
        setExpandedDetails(prev => {
            const newMap = new Map(prev);
            if (newMap.get(id) === type) {
                newMap.delete(id); // Collapse if clicking the same icon again
            } else {
                newMap.set(id, type); // Expand or switch view
            }
            return newMap;
        });
    };

    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
    
    const filterTypeLabels = { 'category': 'Categoria', 'project': 'Projeto', 'tag': 'Tag' };

    const currentView: ViewState = {
        name: 'financial-detail',
        filterType,
        filterId,
        filterName,
        componentState: { filters }
    };

    return (
        <div className="space-y-6">
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                 <motion.button
                    onClick={() => setView({ name: 'financial' })}
                    className="text-sm font-semibold transition-all duration-200 bg-card dark:bg-dark-card text-foreground dark:text-dark-foreground py-2 px-4 sm:py-2.5 sm:px-5 rounded-full border border-border dark:border-dark-border shadow-btn hover:-translate-y-0.5 hover:shadow-lg dark:shadow-dark-btn flex items-center gap-2 self-start"
                    whileTap={{ scale: 0.95 }}
                >
                    <ArrowLeft className="h-4 w-4"/> Voltar para Financeiro
                </motion.button>
                <div className="text-center sm:text-right">
                    <h2 className="text-2xl md:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">Detalhes: {filterName}</h2>
                    <p className="text-muted-foreground">{filterTypeLabels[filterType]}</p>
                </div>
            </motion.div>

             <motion.div variants={itemVariants} className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 font-semibold">Filtros Adicionais</div>
                 <DateField id="startDate" label="Data Início" value={filters.startDate} onChange={date => setFilters(f => ({ ...f, startDate: date }))} />
                 <DateField id="endDate" label="Data Fim" value={filters.endDate} onChange={date => setFilters(f => ({ ...f, endDate: date }))} />
                <div className="col-span-1 sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo</label>
                    <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value as 'income' | 'expense' | '' }))} className="w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all">
                        <option value="">Todos</option>
                        <option value="income">Receita</option>
                        <option value="expense">Despesa</option>
                    </select>
                </div>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex justify-around text-center">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">Receita Total</p>
                    <p className="text-xl font-bold text-success">{formatCurrency(totalIncome)}</p>
                </div>
                 <div>
                    <p className="text-sm font-medium text-muted-foreground">Despesa Total</p>
                    <p className="text-xl font-bold text-danger">{formatCurrency(totalExpense)}</p>
                </div>
            </motion.div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
            ) : (
                 <motion.div layout>
                    <AnimatePresence>
                        {transactions.length > 0 ? (
                            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
                                {transactions.map(t => <TransactionCard 
                                    key={t.id} 
                                    transaction={t} 
                                    categoryName={categoryMap.get(t.categoryId) || 'N/A'} 
                                    onSelect={() => setView({ name: 'transaction-form', transactionId: t.id, returnView: currentView })}
                                    onViewAttachment={(url) => setView({ name: 'attachment-view', attachmentUrl: url, returnView: currentView })}
                                    expandedDetailType={expandedDetails.get(t.id)}
                                    onToggleDetail={handleToggleDetail}
                                />)}
                            </motion.div>
                        ) : (
                            <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="text-center py-20 text-muted-foreground">
                                <p className="font-semibold text-lg">Nenhuma transação encontrada.</p>
                                <p>Tente ajustar os filtros para este período.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
};

export default FinancialDetail;