import React, { useState, useEffect, useRef } from 'react';
import { ViewState, PayableBill, Account, Transaction } from '../types';
import { payableBillsApi, accountsApi, payBill, getUnlinkedExpenses, linkExpenseToBill } from '../services/api';
import { Paperclip, ClipboardPaste } from './Icons';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { DateField } from './common/FormControls';
import { useToast } from './Notifications';
import { useApp } from '../contexts/AppContext';

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Data inválida';
    const date = new Date(dateString.includes('T') ? dateString : dateString + 'T12:00:00Z');
    if (isNaN(date.getTime())) return 'Data inválida';
    return date.toLocaleDateString('pt-BR');
};

const formatCurrencyForInput = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const parseCurrencyFromInput = (formattedValue: string): number => {
    const numericString = formattedValue.replace(/\D/g, '');
    return numericString ? parseInt(numericString, 10) / 100 : 0;
};

export const PayBillPage: React.FC<{ viewState: ViewState; }> = ({ viewState }) => {
    const { setView } = useApp();
    const { billId, returnView } = viewState as { name: 'pay-bill-form', billId: string, returnView: ViewState };
    const [loading, setLoading] = useState(true);
    const [bill, setBill] = useState<PayableBill | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [unlinkedExpenses, setUnlinkedExpenses] = useState<Transaction[]>([]);
    const toast = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [paymentType, setPaymentType] = useState<'new' | 'link'>('new');
    const [linkedExpenseId, setLinkedExpenseId] = useState('');
    const [formState, setFormState] = useState({
        accountId: '', paidAmount: 0, paymentDate: new Date().toISOString().slice(0, 10), attachmentUrl: '', attachmentFilename: ''
    });
    const [amountStr, setAmountStr] = useState('R$ 0,00');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const [allBills, accs, expenses] = await Promise.all([payableBillsApi.getAll(), accountsApi.getAll(), getUnlinkedExpenses()]);
            const currentBill = allBills.find(b => b.id === billId);
            setBill(currentBill || null);
            setAccounts(accs);
            setUnlinkedExpenses(expenses);
            if (currentBill) {
                setFormState(f => ({...f, paidAmount: currentBill.amount}));
                setAmountStr(formatCurrencyForInput(currentBill.amount));
            }
            if (accs.length > 0) setFormState(f => ({...f, accountId: accs[0].id}));
            setLoading(false);
        };
        loadData();
    }, [billId]);
    
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numericValue = parseCurrencyFromInput(value);
        setFormState(prev => ({ ...prev, paidAmount: numericValue }));
        setAmountStr(formatCurrencyForInput(numericValue));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormState(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
        }
    };

    const handlePasteAttachment = async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const file = new File([blob], `colado-${Date.now()}.${imageType.split('/')[1]}`, { type: imageType });
                    setFormState(prev => ({ ...prev, attachmentUrl: URL.createObjectURL(file), attachmentFilename: file.name }));
                    toast.success('Anexo colado com sucesso!');
                    return;
                }
            }
            toast.info('Nenhuma imagem encontrada na área de transferência.');
        } catch (err) {
            toast.error('Falha ao colar da área de transferência.');
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            let warningMessage: string | undefined;
            if (paymentType === 'new') {
                const { warning } = await payBill(billId, formState);
                warningMessage = warning;
            } else {
                await linkExpenseToBill(billId, linkedExpenseId);
            }
            
            if (warningMessage) {
                toast.success("Conta paga, mas o anexo falhou ao ser enviado.");
                toast.info(warningMessage);
            } else {
                toast.success("Conta paga com sucesso!");
            }
            setView(returnView);
        } catch (error: any) {
            console.error("Failed to pay bill:", error);
            toast.error(`Falha ao pagar conta: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loading || !bill) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const inputClass = "w-full text-base p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";
    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title="Pagar Conta" onBack={() => setView(returnView)} />
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                 <div className="text-center border-b border-border dark:border-dark-border pb-4">
                    <p className="text-lg font-semibold text-foreground dark:text-dark-foreground">{bill.description}</p>
                    <p className="text-sm text-muted-foreground">Vencimento: {formatDate(bill.dueDate)}</p>
                 </div>

                <div className="flex bg-muted/50 dark:bg-dark-muted/50 p-1 rounded-lg">
                    <button type="button" onClick={() => setPaymentType('new')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${paymentType === 'new' ? 'bg-card dark:bg-dark-card shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Novo Pagamento</button>
                    <button type="button" onClick={() => setPaymentType('link')} className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-300 ${paymentType === 'link' ? 'bg-card dark:bg-dark-card shadow' : 'hover:bg-card/50 dark:hover:bg-dark-card/50'}`}>Vincular Despesa</button>
                </div>
                
                {paymentType === 'new' ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Valor a Pagar</label>
                                <input 
                                    type="text" 
                                    value={amountStr} 
                                    onChange={handleAmountChange} 
                                    required 
                                    className={`${inputClass} text-center text-lg font-bold`} 
                                />
                            </div>
                            <DateField id="paymentDate" label="Data do Pagamento" value={formState.paymentDate} onChange={date => setFormState(f => ({ ...f, paymentDate: date }))} required smallLabel />
                        </div>
                         <div><label className={labelClass}>Conta de Origem</label><select value={formState.accountId} onChange={e => setFormState(f => ({...f, accountId: e.target.value}))} required className={inputClass}><option value="">Selecione...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                        <div>
                            <label className={labelClass}>Anexo</label>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => fileInputRef.current?.click()} className={`${inputClass} flex-1 text-left ${formState.attachmentFilename ? 'text-primary' : 'text-muted-foreground'} flex items-center gap-2`}>
                                    <Paperclip className="h-4 w-4" />
                                    {formState.attachmentFilename || 'Escolher arquivo...'}
                                </button>
                                <button type="button" onClick={handlePasteAttachment} className="p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border text-muted-foreground hover:text-primary transition-colors">
                                    <ClipboardPaste className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <label className={labelClass}>Despesa a Vincular</label>
                        <select value={linkedExpenseId} onChange={e => setLinkedExpenseId(e.target.value)} required className={inputClass}>
                            <option value="">Selecione uma despesa...</option>
                            {unlinkedExpenses.map(t => <option key={t.id} value={t.id}>{formatDate(t.date)} - {t.description} - {formatCurrency(t.amount)}</option>)}
                        </select>
                    </div>
                )}
            </div>
             <div className="flex justify-center"><SubmitButton isSubmitting={isSubmitting} text="Confirmar Pagamento" /></div>
        </form>
    );
};