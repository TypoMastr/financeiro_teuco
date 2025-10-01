import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ViewState, Transaction, Account, Category, Payee, Project, Tag } from '../types';
import { transactionsApi, accountsApi, categoriesApi, payeesApi, projectsApi, tagsApi } from '../services/api';
import { PageHeader } from './common/PageLayout';
import { useToast } from './Notifications';
import { Paperclip } from './Icons';
import { useApp } from '../contexts/AppContext';

const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T12:00:00Z');
    return date.toLocaleDateString('pt-BR');
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const TransactionViewerPage: React.FC<{ viewState: ViewState }> = ({ viewState }) => {
    const { setView } = useApp();
    const { transactionId, returnView } = viewState as { name: 'transaction-view', transactionId: string, returnView: ViewState };
    const [loading, setLoading] = useState(true);
    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [lookupData, setLookupData] = useState<{
        accounts: Account[],
        categories: Category[],
        payees: Payee[],
        projects: Project[],
        tags: Tag[]
    }>({ accounts: [], categories: [], payees: [], projects: [], tags: [] });
    const toast = useToast();

    useEffect(() => {
        const loadData = async () => {
            if (!transactionId) {
                toast.error("ID da transação não encontrado.");
                setView(returnView);
                return;
            }
            setLoading(true);
            try {
                const [trx, accs, cats, pys, projs, tgs] = await Promise.all([
                    transactionsApi.getAll().then(all => all.find(t => t.id === transactionId)),
                    accountsApi.getAll(),
                    categoriesApi.getAll(),
                    payeesApi.getAll(),
                    projectsApi.getAll(),
                    tagsApi.getAll()
                ]);

                if (!trx) {
                    toast.error("Transação não encontrada.");
                    setView(returnView);
                    return;
                }

                setTransaction(trx);
                setLookupData({ accounts: accs, categories: cats, payees: pys, projects: projs, tags: tgs });

            } catch (error) {
                toast.error("Erro ao carregar dados da transação.");
                setView(returnView);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [transactionId, returnView, setView, toast]);

    const getLookupName = (type: 'account' | 'category' | 'payee' | 'project', id?: string): string => {
        if (!id) return 'N/A';
        const map: Map<string, string> = new Map(
            type === 'account' ? lookupData.accounts.map(i => [i.id, i.name]) :
            type === 'category' ? lookupData.categories.map(i => [i.id, i.name]) :
            type === 'payee' ? lookupData.payees.map(i => [i.id, i.name]) :
            lookupData.projects.map(i => [i.id, i.name])
        );
        return map.get(id) || 'Desconhecido';
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    }

    if (!transaction) {
        return null; // Should have been redirected by useEffect
    }

    const isIncome = transaction.type === 'income';

    const DetailItem: React.FC<{ label: string, value: string }> = ({ label, value }) => (
        <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-base font-semibold text-foreground dark:text-dark-foreground">{value}</p>
        </div>
    );

    return (
        <div className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Detalhes da Transação" onBack={() => setView(returnView)} />
            <motion.div 
                className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {/* Header with description and amount */}
                <div className="text-center pb-4 border-b border-border dark:border-dark-border">
                    <p className="text-lg font-bold text-foreground dark:text-dark-foreground">{transaction.description}</p>
                    <p className={`text-3xl font-bold font-display ${isIncome ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(transaction.amount)}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatDate(transaction.date)}</p>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <DetailItem label="Conta" value={getLookupName('account', transaction.accountId)} />
                    <DetailItem label="Categoria" value={getLookupName('category', transaction.categoryId)} />
                    <DetailItem label="Beneficiário/Pagador" value={getLookupName('payee', transaction.payeeId)} />
                    <DetailItem label="Projeto" value={getLookupName('project', transaction.projectId)} />
                </div>
                
                {/* Comments */}
                {transaction.comments && (
                    <div className="pt-4 border-t border-border dark:border-dark-border">
                        <p className="text-sm font-medium text-muted-foreground mb-1">Observações</p>
                        <p className="text-base text-foreground dark:text-dark-foreground whitespace-pre-wrap bg-background dark:bg-dark-background/60 p-3 rounded-md">
                            {transaction.comments}
                        </p>
                    </div>
                )}
                
                {/* Attachment */}
                {transaction.attachmentUrl && (
                     <div className="pt-4 border-t border-border dark:border-dark-border">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Anexo</p>
                         <motion.button
                            onClick={() => setView({ name: 'attachment-view', attachmentUrl: transaction.attachmentUrl!, returnView: viewState })}
                            className="inline-flex items-center gap-2 bg-secondary dark:bg-dark-secondary text-secondary-foreground dark:text-dark-secondary-foreground font-semibold py-2 px-3 rounded-md text-sm hover:bg-muted dark:hover:bg-dark-muted transition-colors"
                            whileTap={{ scale: 0.95 }}
                        >
                            <Paperclip className="h-4 w-4" />
                            Visualizar Comprovante
                        </motion.button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};
