import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, Variants } from 'framer-motion';
import { ViewState, ItemType, Account, Category, Payee, Tag, Project } from '../types';
import { accountsApi, categoriesApi, payeesApi, tagsApi, projectsApi } from '../services/api';
import { PageHeader, Skeleton } from './common/PageLayout';
import { useToast } from './Notifications';
import { PlusCircle, Trash, Edit, Layers } from './Icons';
import { useApp } from '../contexts/AppContext';

// --- Animation Variants ---
const listContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const listItemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            type: 'spring',
            stiffness: 150,
            damping: 20
        }
    }
};

type Item = Account | Category | Payee | Tag | Project;

export const SettingsListPage: React.FC<{ viewState: ViewState }> = ({ viewState }) => {
    const { setView } = useApp();
    const { itemType, returnView = { name: 'settings' } } = viewState as { name: 'setting-list', itemType: ItemType, returnView: ViewState };
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const apiMap = useMemo(() => ({
        account: { api: accountsApi, label: 'Conta' },
        category: { api: categoriesApi, label: 'Categoria' },
        payee: { api: payeesApi, label: 'Beneficiário' },
        tag: { api: tagsApi, label: 'Tag' },
        project: { api: projectsApi, label: 'Projeto' },
    }), []);
    
    const { api, label } = apiMap[itemType];

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await (api as any).getAll();
            setItems(data);
        } catch (error) {
            toast.error(`Erro ao carregar ${label.toLowerCase()}s.`);
        } finally {
            setLoading(false);
        }
    }, [api, label, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDelete = async (itemId: string, itemName: string) => {
        if (window.confirm(`Tem certeza que deseja excluir "${itemName}"?`)) {
            try {
                await (api as any).remove(itemId);
                toast.success(`${label} removid${label.endsWith('a') ? 'a' : 'o'} com sucesso.`);
                fetchData();
            } catch (error: any) {
                toast.error(error.message.includes('foreign key constraint') 
                    ? `Não é possível excluir. Est${label.endsWith('a') ? 'a' : 'e'} ${label.toLowerCase()} está em uso.` 
                    : `Erro ao remover ${label.toLowerCase()}.`);
            }
        }
    };
    
    const currentView: ViewState = { name: 'setting-list', itemType, returnView };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <PageHeader 
                title={`${label}s`} 
                onBack={() => setView(returnView)} 
                action={
                    <motion.button 
                        onClick={() => setView({ name: 'setting-item-form', itemType, returnView: currentView })}
                        className="bg-primary text-primary-foreground font-semibold p-2.5 rounded-full"
                        whileTap={{ scale: 0.95 }}
                    >
                        <PlusCircle className="h-5 w-5"/>
                    </motion.button>
                }
            />

            {loading ? (
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="bg-card dark:bg-dark-card p-3 rounded-lg border border-border dark:border-dark-border flex items-center gap-4">
                            <Skeleton className="h-6 w-3/4" />
                            <div className="flex-1" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                    ))}
                </div>
            ) : items.length > 0 ? (
                <motion.div className="space-y-3" variants={listContainerVariants} initial="hidden" animate="visible">
                    {items.map(item => (
                        <motion.div key={item.id} variants={listItemVariants} className="bg-card dark:bg-dark-card p-3 rounded-lg border border-border dark:border-dark-border flex items-center gap-4">
                            <div className="flex-1 font-semibold">{item.name}</div>
                            <button onClick={() => setView({ name: 'setting-item-form', itemType, itemId: item.id, returnView: currentView })} className="p-2 text-muted-foreground hover:text-primary rounded-md"><Edit className="h-4 w-4"/></button>
                            <button onClick={() => handleDelete(item.id, item.name)} className="p-2 text-muted-foreground hover:text-danger rounded-md"><Trash className="h-4 w-4"/></button>
                        </motion.div>
                    ))}
                </motion.div>
            ) : (
                <div className="text-center py-20 text-muted-foreground">
                    <div className="inline-block p-4 bg-muted dark:bg-dark-muted rounded-full mb-4">
                        <Layers className="h-10 w-10 text-primary" />
                    </div>
                    <p className="font-semibold text-lg">Nenhum item encontrado.</p>
                    <p>Comece adicionando um{label.endsWith('a') ? 'a' : 'o'} nov{label.endsWith('a') ? 'a' : 'o'} {label.toLowerCase()} clicando no botão '+' acima.</p>
                </div>
            )}
        </div>
    );
};