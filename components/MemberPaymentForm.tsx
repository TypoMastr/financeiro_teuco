import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Member, ViewState, Account } from '../types';
import { getMemberById, addIncomeTransactionAndPayment, accountsApi } from '../services/api';
import { motion } from 'framer-motion';
import { Paperclip, ClipboardPaste, AlertTriangle } from './Icons';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { DateField } from './common/FormControls';
import { useToast } from './Notifications';
import { useApp } from '../contexts/AppContext';

export const PaymentFormPage: React.FC<{ viewState: ViewState; }> = ({ viewState }) => {
    const { setView } = useApp();
    const { id: memberId, month, returnView } = viewState as { name: 'payment-form', id: string, month: string, returnView: ViewState };
    const [member, setMember] = useState<Member | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const [formState, setFormState] = useState({ 
        paymentDate: new Date().toISOString().slice(0, 10), 
        comments: '', 
        attachmentUrl: '', 
        attachmentFilename: '',
        accountId: '',
        amount: 0,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [amountStr, setAmountStr] = useState('');

    const [isHistoricalPayment, setIsHistoricalPayment] = useState(false);

    const shouldShowHistoricalOption = useMemo(() => {
        if (!formState.paymentDate) return false;
        // Adiciona a hora para garantir a comparação correta entre fusos horários.
        const paymentDateObj = new Date(formState.paymentDate + 'T12:00:00Z');
        const cutoffDate = new Date('2025-09-01T00:00:00Z');
        return paymentDateObj < cutoffDate;
    }, [formState.paymentDate]);

    useEffect(() => {
        // Marca/desmarca automaticamente a caixa com base na data de pagamento.
        setIsHistoricalPayment(shouldShowHistoricalOption);
    }, [shouldShowHistoricalOption]);
    
    const formatCurrencyForInput = (value: number): string => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };
    
    useEffect(() => {
        const loadData = async () => {
            if (memberId) {
                setLoading(true);
                const [memberData, accountsData] = await Promise.all([
                    getMemberById(memberId),
                    accountsApi.getAll()
                ]);
                
                if (memberData) {
                    setMember(memberData);
                    setFormState(s => ({ ...s, amount: memberData.monthlyFee }));
                    setAmountStr(formatCurrencyForInput(memberData.monthlyFee));
                }
                setAccounts(accountsData);
                if (accountsData.length > 0) {
                    setFormState(s => ({ ...s, accountId: accountsData[0].id }));
                }
                setLoading(false);
            } else {
                setLoading(false);
            }
        };
        loadData();
    }, [memberId]);

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
            if (err.name === 'NotAllowedError') {
                 toast.error('A permissão para ler a área de transferência foi negada.');
            } else {
                toast.error('Falha ao colar. A função pode exigir uma conexão segura (HTTPS).');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting || !member || !month || !returnView) return;

        if (!formState.accountId && !isHistoricalPayment) {
            toast.error("Nenhuma conta de destino selecionada. Por favor, crie uma conta em Ajustes.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { warning } = await addIncomeTransactionAndPayment(
              { 
                description: `Mensalidade ${member.name} - ${new Date(month + '-02').toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'})}`,
                amount: formState.amount,
                date: new Date(formState.paymentDate + 'T12:00:00Z').toISOString(),
                accountId: formState.accountId,
                comments: formState.comments,
              }, 
              {
                memberId: member.id,
                referenceMonth: month,
                attachmentUrl: formState.attachmentUrl,
                attachmentFilename: formState.attachmentFilename,
              },
              isHistoricalPayment
            );

            if (warning) {
                toast.success("Pagamento registrado, mas o anexo falhou.");
                toast.info(warning);
            } else {
                toast.success("Pagamento registrado com sucesso!");
            }
            setView(returnView);
        } catch (error: any) {
            console.error("Erro ao registrar pagamento:", error);
            toast.error(`Falha ao registrar pagamento: ${error.message}`);
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
    
    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!member || !month || !returnView) {
        if(returnView) setView(returnView); else setView({name: 'members'});
        return null;
    }

    const inputClass = "w-full text-base rounded-lg border-border dark:border-dark-border bg-card dark:bg-dark-input shadow-sm focus:border-primary focus:ring-2 focus:ring-ring focus:outline-none px-4 py-2.5 transition";
    const labelClass = "block text-sm font-medium text-muted-foreground mb-1.5";
    
    const monthName = new Date(month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
             <PageHeader title="Registrar Pagamento" onBack={() => setView(returnView)} />
            
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                 <div className="p-4 bg-primary/10 rounded-lg text-center">
                    <label htmlFor="paymentAmount" className="text-sm font-medium text-primary">Valor para {monthName}:</label>
                    <input
                        id="paymentAmount"
                        type="text"
                        value={amountStr}
                        onChange={handleAmountChange}
                        className="w-full text-3xl font-bold text-primary bg-transparent border-0 text-center focus:ring-0 p-0"
                        required
                    />
                </div>

                {shouldShowHistoricalOption && (
                    <div className="p-3 bg-yellow-100/70 dark:bg-yellow-900/30 rounded-lg flex items-center gap-3 border border-yellow-300/50 dark:border-yellow-500/30">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                        <div className="flex-1">
                             <label htmlFor="historicalPayment" className="text-sm text-yellow-900 dark:text-yellow-200 cursor-pointer">
                                Pagamento histórico <strong className="font-semibold">(não gera transação financeira)</strong>
                            </label>
                        </div>
                        <input
                            type="checkbox"
                            id="historicalPayment"
                            checked={isHistoricalPayment}
                            onChange={(e) => setIsHistoricalPayment(e.target.checked)}
                            className="h-5 w-5 rounded border-yellow-400 dark:border-yellow-600 text-primary focus:ring-primary bg-transparent flex-shrink-0"
                        />
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
                     <div>
                        <label htmlFor="accountId" className={labelClass}>Conta de Destino</label>
                        <select id="accountId" value={formState.accountId} onChange={e => setFormState(s => ({...s, accountId: e.target.value}))} required={!isHistoricalPayment} disabled={isHistoricalPayment} className={`${inputClass} !py-3 disabled:bg-muted/50 dark:disabled:bg-dark-muted/50 disabled:cursor-not-allowed`}>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                    </div>
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
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex justify-center"
            >
                <SubmitButton isSubmitting={isSubmitting} text="Confirmar Pagamento" />
            </motion.div>
        </form>
    );
};