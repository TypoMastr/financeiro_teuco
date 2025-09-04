import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ViewState, Account, Category } from '../types';
import { accountsApi, categoriesApi, transactionsApi } from '../services/api';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { useToast } from './Notifications';
import { UploadCloud } from './Icons';

export const BatchTransactionFormPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    // FIX: Cast viewState to the correct discriminated union type to access its properties.
    const { returnView = { name: 'financial' } } = viewState as { name: 'batch-transaction-form', returnView: ViewState };
    const toast = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [batchText, setBatchText] = useState('');

    useEffect(() => {
        const loadData = async () => {
            const [accs, cats] = await Promise.all([accountsApi.getAll(), categoriesApi.getAll()]);
            setAccounts(accs);
            setCategories(cats);
            if (accs.length > 0) setSelectedAccountId(accs[0].id);
            setLoading(false);
        };
        loadData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const lines = batchText.split('\n').filter(line => line.trim() !== '');
        const transactionsToAdd = [];
        const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c]));

        for (const line of lines) {
            try {
                const [date, description, amount, type, categoryName] = line.split(';').map(s => s.trim());
                if (!date || !description || !amount || !type || !categoryName) {
                    throw new Error('Linha mal formatada');
                }
                const [day, month, year] = date.split('/');
                const isoDate = new Date(`${year}-${month}-${day}T12:00:00Z`).toISOString();
                const numericAmount = parseFloat(amount.replace(',', '.'));
                const transactionType = type.toLowerCase() as 'income' | 'expense';
                const category = categoryMap.get(categoryName.toLowerCase());

                if (!category || category.type !== transactionType) {
                    throw new Error(`Categoria "${categoryName}" inválida ou com tipo incorreto.`);
                }
                
                transactionsToAdd.push({
                    description,
                    amount: numericAmount,
                    date: isoDate,
                    type: transactionType,
                    accountId: selectedAccountId,
                    categoryId: category.id,
                });

            } catch (err: any) {
                toast.error(`Erro na linha "${line}": ${err.message}`);
                setIsSubmitting(false);
                return;
            }
        }
        
        try {
            await Promise.all(transactionsToAdd.map(trx => transactionsApi.add(trx as any)));
            toast.success(`${transactionsToAdd.length} transações adicionadas com sucesso!`);
            setView(returnView);
        } catch (error) {
            toast.error("Ocorreu um erro ao salvar as transações.");
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
            <PageHeader title="Transações em Lote" onBack={() => setView(returnView)} />
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                <div>
                    <label className={labelClass}>Conta de Destino</label>
                    <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} required className={inputClass}>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Transações</label>
                    <textarea
                        value={batchText}
                        onChange={e => setBatchText(e.target.value)}
                        rows={10}
                        className={`${inputClass} font-mono text-xs`}
                        placeholder="Cole aqui. Formato por linha:&#10;dd/mm/aaaa; Descrição da transação; 150,00; expense; Nome da Categoria&#10;dd/mm/aaaa; Outra descrição; 50,25; income; Outra Categoria"
                    />
                </div>
            </div>
            <div className="flex justify-center">
                <SubmitButton isSubmitting={isSubmitting} text="Processar Lote" />
            </div>
        </form>
    );
};

export const OfxImportFormPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    // FIX: Cast viewState to the correct discriminated union type to access its properties.
    const { returnView = { name: 'financial' } } = viewState as { name: 'ofx-import-form', returnView: ViewState };
    const toast = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState('');

    useEffect(() => {
        const loadData = async () => {
            const [accs, cats] = await Promise.all([accountsApi.getAll(), categoriesApi.getAll()]);
            setAccounts(accs);
            setCategories(cats);
            if (accs.length > 0) setSelectedAccountId(accs[0].id);
            setLoading(false);
        };
        loadData();
    }, []);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            toast.info("Arquivo carregado. A funcionalidade de importação OFX está em desenvolvimento.");
        }
    };
    
    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <PageHeader title="Importar Extrato OFX" onBack={() => setView(returnView)} />
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                 <div>
                    <label className={labelClass}>Conta de Destino</label>
                    <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} required className={inputClass}>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </div>
                <div>
                     <label className={labelClass}>Arquivo OFX</label>
                     <input type="file" accept=".ofx" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                     <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-32 flex flex-col items-center justify-center border-2 border-dashed border-border dark:border-dark-border rounded-lg hover:bg-muted dark:hover:bg-dark-muted transition-colors">
                        <UploadCloud className="h-8 w-8 text-muted-foreground mb-2"/>
                        <span className="font-semibold">{fileName || 'Clique para selecionar o arquivo'}</span>
                        <span className="text-xs text-muted-foreground">Compatível com Caixa e PagBank</span>
                     </button>
                </div>
                <p className="text-center text-sm text-muted-foreground p-4">A funcionalidade de importação e conciliação de extratos OFX está em desenvolvimento.</p>
            </div>
            <div className="flex justify-center">
                <SubmitButton isSubmitting={isSubmitting} text="Importar" />
            </div>
        </div>
    );
};