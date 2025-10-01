import React, { useState, useEffect } from 'react';
import { ViewState, PayableBill } from '../types';
import { payableBillsApi } from '../services/api';
import { PageHeader } from './common/PageLayout';
import { useToast } from './Notifications';
import { useApp } from '../contexts/AppContext';

export const DeleteBillConfirmationPage: React.FC<{ viewState: ViewState; }> = ({ viewState }) => {
    const { setView } = useApp();
    const { billId, returnView } = viewState as { name: 'delete-bill-confirmation', billId: string, returnView: ViewState };
    const [bill, setBill] = useState<PayableBill | null>(null);
    const toast = useToast();
    const [deleteOption, setDeleteOption] = useState<'single' | 'all'>('single');

    useEffect(() => {
        payableBillsApi.getAll().then(allBills => setBill(allBills.find(b => b.id === billId) || null));
    }, [billId]);

    const handleDelete = async () => {
        if (!bill) return;
        try {
            if (bill.installmentGroupId && deleteOption === 'all') {
                await payableBillsApi.deleteInstallmentGroup(bill.installmentGroupId);
                toast.success('Todas as parcelas foram excluídas.');
            } else if (bill.recurringId && deleteOption === 'all') {
                await (payableBillsApi as any).deleteFutureRecurring(bill.recurringId, bill.dueDate);
                toast.success('Esta e as futuras contas recorrentes foram excluídas.');
            } else {
                await payableBillsApi.remove(bill.id);
                toast.success('Conta excluída com sucesso.');
            }
            setView(returnView);
        } catch (error: any) {
            toast.error(error.message.includes('foreign key constraint') ? 'Não é possível excluir. A conta está vinculada a uma transação.' : 'Erro ao excluir conta.');
        }
    };
    
    if (!bill) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    return (
         <div className="space-y-6 max-w-lg mx-auto">
             <PageHeader title="Confirmar Exclusão" onBack={() => setView(returnView)} />
             <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border text-center space-y-4">
                 <p>Tem certeza que deseja excluir a conta a pagar <span className="font-bold">"{bill.description}"</span>?</p>
                 
                 {(bill.installmentGroupId || bill.recurringId) && (
                    <div className="p-3 bg-muted dark:bg-dark-muted rounded-lg space-y-2">
                        <p className="text-sm font-semibold">Esta é uma conta recorrente.</p>
                         <div className="flex justify-center gap-4">
                             <label className="flex items-center gap-2 text-sm"><input type="radio" name="deleteOption" value="single" checked={deleteOption === 'single'} onChange={() => setDeleteOption('single')} /> Apenas esta</label>
                             <label className="flex items-center gap-2 text-sm"><input type="radio" name="deleteOption" value="all" checked={deleteOption === 'all'} onChange={() => setDeleteOption('all')} /> Esta e as futuras</label>
                         </div>
                    </div>
                 )}
                 <div className="flex justify-center gap-4 pt-4">
                     <button onClick={() => setView(returnView)} className="bg-muted dark:bg-dark-muted text-foreground dark:text-dark-foreground font-semibold py-2 px-6 rounded-md">Cancelar</button>
                     <button onClick={handleDelete} className="bg-destructive text-destructive-foreground font-semibold py-2 px-6 rounded-md">Excluir</button>
                 </div>
             </div>
         </div>
    );
};
