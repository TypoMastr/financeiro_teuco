import React, { useState, useEffect, useRef } from 'react';
import { ViewState, Payment, Transaction, Account } from '../types';
import { accountsApi, getPaymentDetails, updatePaymentAndTransaction } from '../services/api';
import { motion } from 'framer-motion';
import { Paperclip, ClipboardPaste, Info } from './Icons';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { DateField } from './common/FormControls';
import { useToast } from './Notifications';
import { useApp } from '../contexts/AppContext';

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const PaymentEditFormPage: React.FC<{ viewState: ViewState; }> = ({ viewState }) => {
    const { setView } = useApp();
    const { paymentId, returnView } = viewState as { name: 'edit-payment-form', paymentId: string, returnView: ViewState };
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [paymentDetails, setPaymentDetails] = useState<{ payment: Payment, transaction: Transaction | null } | null>(null);
    const toast = useToast();

    const [formState, setFormState] = useState({ 
        paymentDate: '', 
        comments: '', 
        attachmentUrl: '', 
        attachmentFilename: '',
        accountId: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadData = async () => {
            if (paymentId) {
                setLoading(true);
                const [details, accountsData] = await Promise.all([
                    getPaymentDetails(paymentId),
                    accountsApi.getAll()
                ]);

                if (details) {
                    setPaymentDetails(details);
                    setFormState({
                        paymentDate: details.payment.paymentDate.slice(0, 10),
                        comments: details.payment.comments || '',
                        attachmentUrl: details.payment.attachmentUrl || '',
                        attachmentFilename: details.payment.attachmentFilename || '',
                        accountId: details.transaction?.accountId || '',
                    });
                }
                setAccounts(accountsData);
                setLoading(false);
            }
        };
        loadData();
    }, [paymentId]);

    const handlePasteAttachment = async () => {
        if (!navigator.clipboard?.read) {
            toast.error('Seu navegador não suporta esta funcionalidade.');
            return;
        }
        try {
            const clipboardItems = await navigator.clipboard.read();
            let found = false;
            for (const item of clipboardItems) {
                const supportedType = item.types.find(type => type.startsWith('image/') || type === 'application/pdf');
                
                if (supportedType) {
                    const blob = await item.getType(supportedType);
                    const fileExtension = supportedType.split('/')[1];
                    const fileName = `colado-${Date.now()}.${fileExtension}`;
                    const file = new File([blob], fileName, { type: supportedType });

                    setFormState(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
                    
                    toast.success('Anexo colado com sucesso!');
                    found = true;
                    break;
                }
            }
            if (!found) {
                toast.info('Nenhuma imagem ou PDF encontrado na área de transferência.');
            }
        } catch (err: any) {
            console.error('Paste error:', err);
            toast.error('Falha ao colar da área de transferência.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || !paymentDetails) return;
        setIsSubmitting(true);
        try {
            const { warning } = await updatePaymentAndTransaction(paymentId, paymentDetails.transaction?.id, formState);
            if (warning) {
                toast.success("Pagamento atualizado, mas o anexo falhou.");
                toast.info(warning);
            } else {
                toast.success("Pagamento atualizado com sucesso!");
            }
            setView(returnView);
        } catch (error: any) {
            console.error("Erro ao atualizar pagamento:", error);
            toast.error(`Falha ao atualizar pagamento: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormState(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
        }
    };

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!paymentDetails) {
        toast.error("Detalhes do pagamento não encontrados.");
        setView(returnView);
        return null;
    }

    const inputClass = "w-full text-base rounded-lg border-border dark:border-dark-border bg-card dark:bg-dark-input shadow-sm focus:border-primary focus:ring-2 focus:ring-ring focus:outline-none px-4 py-2.5 transition";
    const labelClass = "block text-sm font-medium text-muted-foreground mb-1.5";
    const monthName = new Date(paymentDetails.payment.referenceMonth + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Editar Pagamento" onBack={() => setView(returnView)} />
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                <div className="p-4 bg-primary/10 rounded-lg text-center">
                    <p className="text-sm font-medium text-primary">Editando pagamento de {monthName}:</p>
                    <p className="text-3xl font-bold text-primary">{formatCurrency(paymentDetails.payment.amount)}</p>
                </div>

                {!paymentDetails.transaction && (
                    <div className="p-3 bg-yellow-100/70 dark:bg-yellow-900/30 rounded-lg flex items-start gap-3 border border-yellow-300/50 dark:border-yellow-500/30">
                        <Info className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-900 dark:text-yellow-200">
                            Este é um <strong className="font-semibold">pagamento histórico</strong> e não possui uma transação financeira associada. A conta de destino não pode ser alterada.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <DateField
                          id="paymentDate"
                          label="Data do Pagamento"
                          value={formState.paymentDate}
                          onChange={date => setFormState(s => ({ ...s, paymentDate: date }))}
                          required
                          smallLabel
                        />
                    </div>
                    {paymentDetails.transaction && (
                        <div>
                            <label htmlFor="accountId" className={labelClass}>Conta de Destino</label>
                            <select id="accountId" value={formState.accountId} onChange={e => setFormState(s => ({...s, accountId: e.target.value}))} required className={`${inputClass} !py-3`}>
                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                            </select>
                        </div>
                    )}
                </div>
                <div>
                    <label htmlFor="comments" className={labelClass}>Observações (Opcional)</label>
                    <textarea id="comments" value={formState.comments} onChange={e => setFormState(s => ({ ...s, comments: e.target.value }))} rows={2} className={`${inputClass} leading-snug`} placeholder="Alguma nota sobre este pagamento..."></textarea>
                </div>
                <div>
                    <label htmlFor="attachment" className={labelClass}>Anexar Comprovante (Opcional)</label>
                    <input type="file" id="attachment" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                    <div className="flex gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className={`${inputClass} flex-1 text-left ${formState.attachmentFilename ? 'text-primary' : 'text-muted-foreground'} flex items-center gap-2`}>
                            <Paperclip className="h-4 w-4" />
                            {formState.attachmentFilename || 'Escolher arquivo...'}
                        </button>
                        <button type="button" onClick={handlePasteAttachment} className="p-3 rounded-lg bg-card dark:bg-dark-input border border-border dark:border-dark-border text-muted-foreground hover:text-primary transition-colors">
                            <ClipboardPaste className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex justify-center">
                <SubmitButton isSubmitting={isSubmitting} text="Salvar Alterações" />
            </div>
        </form>
    );
};