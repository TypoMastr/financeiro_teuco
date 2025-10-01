import React, { useState, useEffect } from 'react';
import { ViewState, Transaction } from '../types';
import { getFutureIncomeTransactions } from '../services/api';
import { PageHeader } from './common/PageLayout';
import { useApp } from '../contexts/AppContext';

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T12:00:00Z');
    return date.toLocaleDateString('pt-BR');
};

export const FutureIncomePage: React.FC<{ viewState: ViewState }> = ({ viewState }) => {
    const { setView } = useApp();
    const { returnView } = viewState as { name: 'future-income-view', returnView: ViewState };
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getFutureIncomeTransactions().then(data => {
            setTransactions(data);
            setLoading(false);
        });
    }, []);

    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Receitas Futuras" onBack={() => setView(returnView)} />
             <div className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border text-center">
                <p className="text-sm font-medium text-muted-foreground">TOTAL A RECEBER</p>
                <p className="text-3xl font-bold font-display text-success">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="space-y-3">
                {transactions.length > 0 ? transactions.map(t => (
                    <div key={t.id} className="bg-card dark:bg-dark-card p-3 rounded-lg border border-border dark:border-dark-border flex justify-between items-center">
                        <div>
                            <p className="font-semibold">{t.description}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(t.date)}</p>
                        </div>
                        <p className="font-semibold text-success">{formatCurrency(t.amount)}</p>
                    </div>
                )) : (
                    <p className="text-center text-muted-foreground py-10">Nenhuma receita futura registrada.</p>
                )}
            </div>
        </div>
    );
};
