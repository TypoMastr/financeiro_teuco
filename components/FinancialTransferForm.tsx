import React, { useState, useEffect } from 'react';
import { ViewState, Account, Transaction } from '../types';
import { accountsApi, transactionsApi, categoriesApi } from '../services/api';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { DateField } from './common/FormControls';
import { useToast } from './Notifications';
import { useApp } from '../contexts/AppContext';

export const TransferFormPage: React.FC<{ viewState: ViewState }> = ({ viewState }) => {
    const { setView } = useApp();
    const { returnView = { name: 'financial' } } = viewState as { name: 'transfer-form', returnView: ViewState };
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();
    
    const [accounts, setAccounts] = useState<Account[]>([]);
    
    const [formState, setFormState] = useState({
        fromAccountId: '',
        toAccountId: '',
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        description: '',
    });
    
    const [amountStr, setAmountStr] = useState('R$ 0,00');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const accs = await accountsApi.getAll();
            setAccounts(accs);
            if (accs.length >= 2) {
                setFormState(s => ({ ...s, fromAccountId: accs[0].id, toAccountId: accs[1].id }));
            } else if (accs.length === 1) {
                setFormState(s => ({ ...s, fromAccountId: accs[0].id }));
            }
            setLoading(false);
        };
        loadData();
    }, []);
    
    const formatCurrencyForInput = (value: number): string => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const parseCurrencyFromInput = (formattedValue: string): number => {
        const numericString = formattedValue.replace(/\D/g, '');
        return numericString ? parseInt(numericString, 10) / 100 : 0;
    };
    
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numericValue = parseCurrencyFromInput(value);
        setFormState(prev => ({ ...prev, amount: numericValue }));
        setAmountStr(formatCurrencyForInput(numericValue));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formState.fromAccountId === formState.toAccountId) {
            toast.error('A conta de origem e destino não podem ser as mesmas.');
            return;
        }
        setIsSubmitting(true);
        try {
            const transferId = crypto.randomUUID();
            const date = new Date(formState.date + 'T12:00:00Z').toISOString();

            const categories = await categoriesApi.getAll();
            let transferCategory = categories.find(c => c.name.toLowerCase() === 'transferência');
            if (!transferCategory) {
                transferCategory = await categoriesApi.add({ name: 'Transferência', type: 'both' });
            }
            
            const fromAccountName = accounts.find(a => a.id === formState.fromAccountId)?.name || 'Conta desconhecida';
            const toAccountName = accounts.find(a => a.id === formState.toAccountId)?.name || 'Conta desconhecida';

            await transactionsApi.add({
                description: `Transferência para ${toAccountName}${formState.description ? ': ' + formState.description : ''}`,
                amount: formState.amount,
                date: date,
                type: 'expense',
                accountId: formState.fromAccountId,
                categoryId: transferCategory.id,
                transferId: transferId
            } as any);

            await transactionsApi.add({
                description: `Transferência de ${fromAccountName}${formState.description ? ': ' + formState.description : ''}`,
                amount: formState.amount,
                date: date,
                type: 'income',
                accountId: formState.toAccountId,
                categoryId: transferCategory.id,
                transferId: transferId
            } as any);

            toast.success("Transferência realizada com sucesso!");
            setView(returnView);
        } catch (error: any) {
            toast.error(`Falha ao realizar transferência: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const inputClass = "w-full text-base p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";
    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Nova Transferência" onBack={() => setView(returnView)} />
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                 <div>
                    <label className={labelClass}>Descrição (Opcional)</label>
                    <input type="text" value={formState.description} onChange={e => setFormState(f => ({...f, description: e.target.value}))} className={inputClass}/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Origem</label>
                        <select value={formState.fromAccountId} onChange={e => setFormState(f => ({...f, fromAccountId: e.target.value}))} required className={inputClass}>
                            <option value="">Selecione...</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className={labelClass}>Destino</label>
                        <select value={formState.toAccountId} onChange={e => setFormState(f => ({...f, toAccountId: e.target.value}))} required className={inputClass}>
                            <option value="">Selecione...</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Valor</label><input type="text" value={amountStr} onChange={handleAmountChange} required className={inputClass}/></div>
                    <DateField id="date" label="Data" value={formState.date} onChange={date => setFormState(f => ({ ...f, date }))} required smallLabel />
                </div>
            </div>
             <div className="flex justify-center"><SubmitButton isSubmitting={isSubmitting} text="Confirmar Transferência" /></div>
        </form>
    );
};