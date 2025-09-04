import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ViewState, Transaction, Category } from '../types';
import { getFinancialReport, categoriesApi } from '../services/api';
import { ArrowLeft, Paperclip } from './Icons';
import { DateField } from './common/PageLayout';

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
const TransactionCard: React.FC<{ transaction: Transaction, categoryName: string, onViewAttachment: (url: string) => void, onSelect: () => void }> = ({ transaction, categoryName, onViewAttachment, onSelect }) => {
    const isIncome = transaction.type === 'income';
    return (
        <motion.div 
            variants={itemVariants} 
            onClick={onSelect}
            className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border cursor-pointer"
        >
            <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {transaction.attachmentUrl && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); onViewAttachment(transaction.attachmentUrl!); }} className="text-muted-foreground hover:text-primary"><Paperclip className="h-4 w-4"/></button>
                        )}
                        <p className="font-semibold text-foreground dark:text-dark-foreground truncate">{transaction.description}</p>
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">{categoryName}</p>
                </div>
                <p className={`text-lg font-bold ${isIncome ? 'text-success' : 'text-danger'}`}>{formatCurrency(transaction.amount)}</p>
            </div>
            <p className="text-right text-xs text-muted-foreground mt-2">{formatDate(transaction.date)}</p>
        </motion.div>
    );
};

// --- Main Component ---
const FinancialDetail: React.FC<{
    viewState: ViewState;
    setView: (view: ViewState) => void;
}> = ({ viewState, setView }) => {
    // FIX: Correctly cast viewState to the specific discriminated union type to access its properties.
    const { filterType, filterId, filterName, componentState } = viewState as { name: 'financial-detail', filterType: 'category' | 'project' | 'tag', filterId: string, filterName: string, componentState?: any };
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    
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
        setLoading(false);
      };
        fetchData();
    }, [filterType, filterId, filters]);

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

             <motion.div variants={itemVariants} className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="col-span-3 font-semibold">Filtros Adicionais</div>
                 <DateField id="startDate" label="Data Início" value={filters.startDate} onChange={date => setFilters(f => ({ ...f, startDate: date }))} />
                 <DateField id="endDate" label="Data Fim" value={filters.endDate} onChange={date => setFilters(f => ({ ...f, endDate: date }))} />
                <div>
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