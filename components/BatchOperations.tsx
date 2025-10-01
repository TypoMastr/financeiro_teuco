import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ViewState, Account, Category, Payee } from '../types';
import { accountsApi, categoriesApi, transactionsApi, payeesApi } from '../services/api';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { useToast } from './Notifications';
import { UploadCloud } from './Icons';
import { useApp } from '../contexts/AppContext';

export const BatchTransactionFormPage: React.FC<{ viewState: ViewState }> = ({ viewState }) => {
    const { setView } = useApp();
    const { returnView = { name: 'financial' } } = viewState as { name: 'batch-transaction-form', returnView: ViewState };
    const toast = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [payees, setPayees] = useState<Payee[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [batchText, setBatchText] = useState('');

    useEffect(() => {
        const loadData = async () => {
            const [accs, cats, pys] = await Promise.all([accountsApi.getAll(), categoriesApi.getAll(), payeesApi.getAll()]);
            setAccounts(accs);
            setCategories(cats);
            setPayees(pys);
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
        
        // Use a mutable copy of categories, so we can add the default one if created
        let localCategories = [...categories];
        let categoryMap = new Map(localCategories.map(c => [c.name.toLowerCase(), c]));
        let uncategorizedCategory: Category | null = localCategories.find(c => c.name.toLowerCase() === 'sem categoria') || null;

        const payeeMap = new Map(payees.map(p => [p.name.toLowerCase(), p.id]));

        for (const line of lines) {
            try {
                const parts = line.split(';').map(s => s.trim());
                const [date, description, amount, type, categoryName = '', payeeName = ''] = parts;

                if (!date || !description || !amount || !type) {
                    throw new Error('Formato incorreto. Campos obrigatórios (data, descrição, valor, tipo) faltando.');
                }
                const [day, month, year] = date.split('/');
                if (!day || !month || !year || isNaN(parseInt(day)) || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
                    throw new Error(`Data "${date}" inválida. Use o formato dd/mm/aaaa.`);
                }
                const isoDate = new Date(`${year}-${month}-${day}T12:00:00Z`).toISOString();
                const numericAmount = parseFloat(amount.replace(',', '.'));
                
                const rawType = type.toLowerCase();
                let transactionType: 'income' | 'expense';

                if (rawType === 'receita' || rawType === 'income') {
                    transactionType = 'income';
                } else if (rawType === 'despesa' || rawType === 'expense') {
                    transactionType = 'expense';
                } else {
                    throw new Error(`Tipo "${type}" inválido. Use 'receita' ou 'despesa'.`);
                }
                
                let category: Category | undefined | null;
                if (!categoryName) {
                    if (!uncategorizedCategory) {
                        console.log("Creating 'Sem Categoria' category...");
                        uncategorizedCategory = await categoriesApi.add({ name: 'Sem Categoria', type: 'both' });
                        localCategories.push(uncategorizedCategory);
                        categoryMap.set('sem categoria', uncategorizedCategory);
                    }
                    category = uncategorizedCategory;
                } else {
                    category = categoryMap.get(categoryName.toLowerCase());
                }

                if (!category) {
                    throw new Error(`Categoria "${categoryName}" não encontrada.`);
                }
                
                if (category.type !== 'both' && category.type !== transactionType) {
                    throw new Error(`Categoria "${categoryName}" não é válida para o tipo "${type}".`);
                }

                let payeeId: string | undefined = undefined;
                if (payeeName && payeeName.trim().length > 0) {
                    payeeId = payeeMap.get(payeeName.toLowerCase());
                    if (!payeeId) {
                        throw new Error(`Beneficiário "${payeeName}" não encontrado.`);
                    }
                }
                
                transactionsToAdd.push({
                    description,
                    amount: numericAmount,
                    date: isoDate,
                    type: transactionType,
                    accountId: selectedAccountId,
                    categoryId: category.id,
                    payeeId: payeeId,
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
    const inputClass = "w-full text-base p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";

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
                        placeholder="Cole aqui. Formato por linha:&#10;dd/mm/aaaa; Descrição; Valor; tipo; [Categoria]; [Beneficiário]&#10;Ex: 25/12/2024; Presente; 50,25; despesa; Lazer; Loja de Brinquedos&#10;Ex: 26/12/2024; Salário; 2500,00; receita; Salário;&#10;Ex: 27/12/2024; Uber; 15,80; despesa; ; Uber App"
                    />
                </div>
            </div>
            <div className="flex justify-center">
                <SubmitButton isSubmitting={isSubmitting} text="Processar Lote" />
            </div>
        </form>
    );
};

export const OfxImportFormPage: React.FC<{ viewState: ViewState }> = ({ viewState }) => {
    const { setView } = useApp();
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
    const inputClass = "w-full text-base p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";

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
