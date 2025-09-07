import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ViewState, Member, Leave } from '../types';
import { getMemberById, leavesApi } from '../services/api';
import { PageHeader, SubmitButton, DateField } from './common/PageLayout';
import { useToast } from './Notifications';

export const LeaveFormPage: React.FC<{ viewState: ViewState; setView: (view: ViewState) => void; }> = ({ viewState, setView }) => {
    const { memberId, leaveId, returnView } = viewState as { name: 'leave-form', memberId: string, leaveId?: string, returnView: ViewState };
    const isEditMode = !!leaveId;
    const [loading, setLoading] = useState(true);
    const [member, setMember] = useState<Member | null>(null);
    const toast = useToast();

    const [formState, setFormState] = useState({
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '',
        reason: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const memberData = await getMemberById(memberId);
                setMember(memberData || null);

                if (isEditMode && leaveId) {
                    const memberLeaves = await leavesApi.getByMember(memberId);
                    const currentLeave = memberLeaves.find(l => l.id === leaveId);
                    if (currentLeave) {
                        setFormState({
                            startDate: currentLeave.startDate.slice(0, 10),
                            endDate: currentLeave.endDate ? currentLeave.endDate.slice(0, 10) : '',
                            reason: currentLeave.reason || '',
                        });
                    }
                }
            } catch (error) {
                toast.error("Erro ao carregar dados.");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [memberId, leaveId, isEditMode, toast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (formState.endDate && new Date(formState.endDate) < new Date(formState.startDate)) {
            toast.error("A data final não pode ser anterior à data de início.");
            return;
        }

        setIsSubmitting(true);
        try {
            if (isEditMode && leaveId) {
                await leavesApi.update(leaveId, {
                    startDate: formState.startDate,
                    endDate: formState.endDate || undefined,
                    reason: formState.reason
                });
                toast.success("Licença atualizada com sucesso!");
            } else {
                await leavesApi.add({
                    memberId: memberId,
                    startDate: formState.startDate,
                    endDate: formState.endDate || undefined,
                    reason: formState.reason,
                });
                toast.success("Licença registrada com sucesso!");
            }
            setView(returnView);
        } catch (error: any) {
            toast.error(`Falha ao salvar licença: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!member) {
        toast.error("Membro não encontrado.");
        setView({ name: 'members' });
        return null;
    }

    const inputClass = "w-full text-base rounded-lg border-border dark:border-dark-border bg-card dark:bg-dark-input shadow-sm focus:border-primary focus:ring-2 focus:ring-ring focus:outline-none px-4 py-2.5 transition";
    const labelClass = "block text-sm font-medium text-muted-foreground mb-1.5";
    const title = isEditMode ? "Editar Licença" : "Registrar Nova Licença";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title={title} onBack={() => setView(returnView)} />
            <div className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4">
                <div className="text-center">
                    <p className="font-semibold text-lg">{member.name}</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <DateField
                            id="startDate"
                            label="Data de Início"
                            value={formState.startDate}
                            onChange={date => setFormState(s => ({ ...s, startDate: date }))}
                            required
                        />
                    </div>
                    <div>
                        <DateField
                            id="endDate"
                            label="Data Final (Opcional)"
                            value={formState.endDate}
                            onChange={date => setFormState(s => ({ ...s, endDate: date }))}
                        />
                    </div>
                </div>
                
                <div>
                    <label htmlFor="reason" className={labelClass}>Motivo (Opcional)</label>
                    <textarea 
                        id="reason" 
                        value={formState.reason} 
                        onChange={e => setFormState(s => ({ ...s, reason: e.target.value }))} 
                        rows={2} 
                        className={`${inputClass} leading-snug`} 
                        placeholder="Ex: Viagem, saúde, etc."
                    />
                </div>
            </div>
            <div className="flex justify-center">
                <SubmitButton isSubmitting={isSubmitting} text={isEditMode ? "Salvar Alterações" : "Registrar Licença"} />
            </div>
        </form>
    );
};