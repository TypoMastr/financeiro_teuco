import React, { useState, useEffect, useMemo } from 'react';
import { ViewState, ItemType, Account, Category, Payee, Tag, Project } from '../types';
import { accountsApi, categoriesApi, payeesApi, tagsApi, projectsApi } from '../services/api';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { TextInput } from './common/FormControls';
import { useToast } from './Notifications';
import { useApp } from '../contexts/AppContext';

type Item = Account | Category | Payee | Tag | Project;

export const SettingsItemFormPage: React.FC<{ viewState: ViewState }> = ({ viewState }) => {
    const { setView } = useApp();
    const { itemType, itemId, returnView } = viewState as { name: 'setting-item-form', itemType: ItemType, itemId?: string, returnView: ViewState };
    const isEdit = !!itemId;
    const [loading, setLoading] = useState(isEdit);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formState, setFormState] = useState<any>(() => {
        if (isEdit) return { name: '' }; // Will be populated by useEffect
        switch (itemType) {
            case 'account':
                return { name: '', initialBalance: 0 };
            case 'category':
                return { name: '', type: 'expense' };
            default:
                return { name: '' };
        }
    });
    const toast = useToast();

    const apiMap = useMemo(() => ({
        account: { api: accountsApi, label: 'Conta' },
        category: { api: categoriesApi, label: 'Categoria' },
        payee: { api: payeesApi, label: 'Beneficiário' },
        tag: { api: tagsApi, label: 'Tag' },
        project: { api: projectsApi, label: 'Projeto' },
    }), []);
    const { api, label } = apiMap[itemType];

    useEffect(() => {
        if (isEdit && itemId) {
            (api as any).getAll().then((items: Item[]) => {
                const item = items.find(i => i.id === itemId);
                if (item) setFormState(item);
                setLoading(false);
            });
        }
    }, [isEdit, itemId, api]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (isEdit && itemId) {
                await (api as any).update(itemId, formState);
            } else {
                await (api as any).add(formState);
            }
            toast.success(`${label} salv${label.endsWith('a') ? 'a' : 'o'} com sucesso!`);
            setView(returnView);
        } catch (error: any) {
            console.error(`Error saving ${label}:`, error);
            const message = error.message || 'Ocorreu um erro desconhecido.';
            if (message.includes('unique constraint')) {
                toast.error(`${label} com este nome já existe.`);
            } else {
                toast.error(`Erro ao salvar ${label.toLowerCase()}.`);
            }
            setIsSubmitting(false);
        }
    };
    
    if(loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const inputClass = "w-full text-base p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";
    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title={`${isEdit ? 'Editar' : 'Nov' + (label.endsWith('a') ? 'a' : 'o')} ${label}`} onBack={() => setView(returnView)} />
            <div className="space-y-4 bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border">
                <TextInput
                    id="name"
                    label="Nome"
                    value={formState.name}
                    onChange={e => setFormState(f => ({...f, name: e.target.value}))}
                    required
                />
                
                {itemType === 'account' && (
                    <div>
                        <label className="block text-base font-semibold text-foreground dark:text-dark-foreground">Saldo Inicial</label>
                        <input type="number" step="0.01" value={formState.initialBalance || 0} onChange={e => setFormState(f => ({...f, initialBalance: parseFloat(e.target.value)}))} required className={`${inputClass} mt-2`} />
                    </div>
                )}
                 {itemType === 'category' && (
                    <div>
                        <label className="block text-base font-semibold text-foreground dark:text-dark-foreground">Tipo</label>
                        <select value={formState.type || 'expense'} onChange={e => setFormState(f => ({...f, type: e.target.value}))} className={`${inputClass} mt-2`}>
                            <option value="expense">Despesa</option>
                            <option value="income">Receita</option>
                            <option value="both">Ambos</option>
                        </select>
                    </div>
                )}
            </div>
            <div className="flex justify-center"><SubmitButton isSubmitting={isSubmitting} text="Salvar" /></div>
        </form>
    );
};