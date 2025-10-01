import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ViewState, Account, Category, ReportData } from '../types';
import { accountsApi, categoriesApi, getFinancialReport } from '../services/api';
import { PageHeader } from './common/PageLayout';
import { DateField } from './common/FormControls';
import { useApp } from '../contexts/AppContext';

export const ReportFiltersPage: React.FC<{ viewState: ViewState }> = ({ viewState }) => {
    const { setView } = useApp();
    const { returnView } = viewState as { name: 'financial-report-form', returnView: ViewState };
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().setDate(1)).toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        type: '' as 'income' | 'expense' | '',
        accountId: '',
        categoryId: ''
    });
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    useEffect(() => {
        const load = async () => {
            const [accs, cats] = await Promise.all([accountsApi.getAll(), categoriesApi.getAll()]);
            setAccounts(accs);
            setCategories(cats);
        };
        load();
    }, []);

    const handleGenerate = async () => {
        const reportFilters = {
            startDate: filters.startDate,
            endDate: filters.endDate,
            type: filters.type || undefined,
            categoryId: filters.categoryId || undefined,
            accountIds: filters.accountId ? [filters.accountId] : accounts.map(a => a.id),
        };
        const transactions = await getFinancialReport(reportFilters);
        const allData = { categories, payees: [], accounts };
        const report: ReportData = {
            type: 'financial',
            data: { transactions, allData },
            generatedAt: new Date().toISOString(),
            title: `Relatório de ${new Date(filters.startDate+'T12:00:00Z').toLocaleDateString('pt-BR')} a ${new Date(filters.endDate+'T12:00:00Z').toLocaleDateString('pt-BR')}`
        };
        setView({ name: 'report-view', report });
    };

    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
    const inputClass = "w-full text-base p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Filtros do Relatório" onBack={() => setView(returnView)} />
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DateField id="startDate" label="Data de Início" value={filters.startDate} onChange={date => setFilters(f => ({ ...f, startDate: date }))} smallLabel />
                    <DateField id="endDate" label="Data de Fim" value={filters.endDate} onChange={date => setFilters(f => ({ ...f, endDate: date }))} smallLabel />
                </div>
                <div><label className={labelClass}>Conta</label><select value={filters.accountId} onChange={e => setFilters(f => ({...f, accountId: e.target.value}))} className={inputClass}><option value="">Todas</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                <div><label className={labelClass}>Tipo</label><select value={filters.type} onChange={e => setFilters(f => ({...f, type: e.target.value as any}))} className={inputClass}><option value="">Todos</option><option value="income">Receita</option><option value="expense">Despesa</option></select></div>
                <div><label className={labelClass}>Categoria</label><select value={filters.categoryId} onChange={e => setFilters(f => ({...f, categoryId: e.target.value}))} className={inputClass}><option value="">Todas</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            </div>
            <div className="flex justify-center">
                <motion.button 
                    type="button"
                    onClick={handleGenerate}
                    className="bg-primary text-primary-foreground font-bold py-3 px-6 rounded-full hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30 text-base"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                >
                    Gerar Relatório
                </motion.button>
            </div>
        </div>
    );
};