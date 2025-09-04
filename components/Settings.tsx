import React, { useState, useEffect, useCallback } from 'react';
import { ViewState, Account, Category, Tag, Payee, Project, ItemType } from '../types';
import { accountsApi, categoriesApi, tagsApi, payeesApi, projectsApi } from '../services/api';
import { Edit, Trash, PlusCircle, Settings as SettingsIcon, Shield, LogOut } from './Icons';
import { motion } from 'framer-motion';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { useToast } from './Notifications';

// --- Utility Functions ---
const formatCurrencyForInput = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const parseCurrencyFromInput = (formattedValue: string): number => {
    const numericString = formattedValue.replace(/\D/g, '');
    return numericString ? parseInt(numericString, 10) / 100 : 0;
};

// --- Generic CRUD Hook ---
const useCrud = <T extends { id: string, name: string }>(api: any) => {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const fetchData = useCallback(async (isUpdate = false) => {
        if (!isUpdate) {
            setLoading(true);
        }
        try {
            const data = await api.getAll();
            setItems(data.sort((a: T, b: T) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Failed to fetch data:", error);
            toast.error("Falha ao carregar dados.");
        } finally {
            if (!isUpdate) {
                setLoading(false);
            }
        }
    }, [api, toast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const addItem = useCallback(async (itemData: Omit<T, 'id'>) => {
        await api.add(itemData);
        await fetchData(true);
    }, [api, fetchData]);

    const updateItem = useCallback(async (itemId: string, itemData: Partial<Omit<T, 'id'>>) => {
        await api.update(itemId, itemData);
        await fetchData(true);
    }, [api, fetchData]);

    const removeItem = useCallback(async (itemId: string) => {
        try {
            await api.remove(itemId);
            toast.success("Item removido com sucesso!");
            await fetchData(true);
        } catch(error) {
            toast.error("Não foi possível remover o item. Verifique se ele não está em uso.");
        }
    }, [api, fetchData, toast]);

    return { items, loading, addItem, updateItem, removeItem, refresh: fetchData };
};


// --- Sub Components ---
type Item = Account | Category | Tag | Payee | Project;

const SettingsSection: React.FC<{
    title: string;
    items: Item[];
    loading: boolean;
    onAdd: () => void;
    onEdit: (item: Item) => void;
    onDelete: (itemId: string) => Promise<void>;
}> = ({ title, items, loading, onAdd, onEdit, onDelete }) => {
    return (
        <motion.div 
          className="bg-card dark:bg-dark-card p-4 sm:p-6 rounded-lg border border-border dark:border-dark-border"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring' }}
        >
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground">{title}</h3>
                <motion.button whileTap={{scale:0.95}} onClick={onAdd} className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                    <PlusCircle className="h-5 w-5" /> Adicionar
                </motion.button>
            </div>
            {loading ? <div className="text-center p-8 text-muted-foreground">Carregando...</div> : (
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                    {items.length > 0 ? items.map(item => (
                        <motion.div 
                          key={item.id} 
                          className="flex items-center justify-between p-3 rounded-md bg-background dark:bg-dark-background hover:bg-muted dark:hover:bg-dark-muted"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                            <span className="font-medium text-foreground dark:text-dark-foreground">{item.name}</span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => onEdit(item)} className="text-muted-foreground hover:text-primary"><Edit className="h-4 w-4" /></button>
                                <button onClick={() => onDelete(item.id)} className="text-muted-foreground hover:text-danger"><Trash className="h-4 w-4" /></button>
                            </div>
                        </motion.div>
                    )) : <p className="text-center p-8 text-muted-foreground">Nenhum item encontrado.</p>}
                </div>
            )}
        </motion.div>
    );
};

const BIOMETRY_CREDENTIAL_KEY = 'biometry_credential_id_v1';

const SecuritySection: React.FC = () => {
    const toast = useToast();
    const [isAvailable, setIsAvailable] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const checkAvailability = async () => {
            if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
                const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                setIsAvailable(available);
            }
        };
        checkAvailability();
        setIsRegistered(!!localStorage.getItem(BIOMETRY_CREDENTIAL_KEY));
    }, []);
    
    const handleRegister = async () => {
        setIsProcessing(true);
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: { name: "Financeiro TEUCO" },
                    user: {
                        id: new Uint8Array(16), // Em um app real, seria o ID do usuário
                        name: "user@teuco.finance",
                        displayName: "Usuário",
                    },
                    pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
                    authenticatorSelection: {
                        authenticatorAttachment: "platform",
                        userVerification: "required",
                    },
                    timeout: 60000,
                },
            });

            if (credential) {
                // Em um app real, você enviaria `credential` para o servidor para verificação e armazenamento.
                // Aqui, armazenamos o ID no localStorage para simulação.
                localStorage.setItem(BIOMETRY_CREDENTIAL_KEY, btoa(String.fromCharCode(...new Uint8Array((credential as any).rawId))));
                setIsRegistered(true);
                toast.success("Login com biometria ativado!");
            }
        } catch (err) {
            console.error("Erro ao registrar biometria:", err);
            toast.error("Não foi possível ativar a biometria.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeregister = () => {
        localStorage.removeItem(BIOMETRY_CREDENTIAL_KEY);
        setIsRegistered(false);
        toast.info("Login com biometria desativado.");
    };

    return (
        <motion.div
            className="bg-card dark:bg-dark-card p-4 sm:p-6 rounded-lg border border-border dark:border-dark-border"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring' }}
        >
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground flex items-center gap-2">
                    <Shield className="h-5 w-5" /> Segurança
                </h3>
            </div>
            {isAvailable ? (
                <div>
                    <p className="text-sm text-muted-foreground mb-4">
                        Ative o login com Face ID ou Touch ID para um acesso mais rápido e seguro ao sistema.
                    </p>
                    {isRegistered ? (
                        <button
                            onClick={handleDeregister}
                            className="bg-destructive text-destructive-foreground font-semibold py-2 px-4 rounded-md text-sm hover:opacity-90 w-full"
                        >
                            Desativar Login com Biometria
                        </button>
                    ) : (
                        <button
                            onClick={handleRegister}
                            disabled={isProcessing}
                            className="bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-md text-sm hover:opacity-90 w-full disabled:opacity-50"
                        >
                            {isProcessing ? "Aguardando..." : "Ativar Login com Biometria"}
                        </button>
                    )}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Seu dispositivo ou navegador não é compatível com autenticação biométrica (Face ID / Touch ID).
                </p>
            )}
        </motion.div>
    );
};


export const Settings: React.FC<{ setView: (view: ViewState) => void, onLock: () => void }> = ({ setView, onLock }) => {
    const accountsCrud = useCrud<Account>(accountsApi);
    const categoriesCrud = useCrud<Category>(categoriesApi);
    const tagsCrud = useCrud<Tag>(tagsApi);
    const payeesCrud = useCrud<Payee>(payeesApi);
    const projectsCrud = useCrud<Project>(projectsApi);

    const currentView: ViewState = { name: 'settings' };

    return (
        <motion.div className="space-y-6" initial="hidden" animate="visible" variants={{visible: {transition: {staggerChildren: 0.1}}}}>
            <motion.div className="flex items-center gap-3" variants={{hidden: {opacity:0, y:20}, visible: {opacity:1, y:0}}}>
                 <div className="p-2 bg-primary/10 rounded-lg"><SettingsIcon className="h-6 w-6 text-primary"/></div>
                 <h2 className="hidden sm:block text-2xl md:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">Ajustes</h2>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SettingsSection
                    title="Contas"
                    items={accountsCrud.items}
                    loading={accountsCrud.loading}
                    onAdd={() => setView({ name: 'setting-item-form', itemType: 'account', returnView: currentView })}
                    onEdit={(item) => setView({ name: 'setting-item-form', itemType: 'account', itemId: item.id, returnView: currentView })}
                    onDelete={accountsCrud.removeItem}
                />
                <SettingsSection
                    title="Categorias"
                    items={categoriesCrud.items}
                    loading={categoriesCrud.loading}
                    onAdd={() => setView({ name: 'setting-item-form', itemType: 'category', returnView: currentView })}
                    onEdit={(item) => setView({ name: 'setting-item-form', itemType: 'category', itemId: item.id, returnView: currentView })}
                    onDelete={categoriesCrud.removeItem}
                />
                <SettingsSection
                    title="Beneficiários / Pagadores"
                    items={payeesCrud.items}
                    loading={payeesCrud.loading}
                    onAdd={() => setView({ name: 'setting-item-form', itemType: 'payee', returnView: currentView })}
                    onEdit={(item) => setView({ name: 'setting-item-form', itemType: 'payee', itemId: item.id, returnView: currentView })}
                    onDelete={payeesCrud.removeItem}
                />
                 <SettingsSection
                    title="Projetos"
                    items={projectsCrud.items}
                    loading={projectsCrud.loading}
                    onAdd={() => setView({ name: 'setting-item-form', itemType: 'project', returnView: currentView })}
                    onEdit={(item) => setView({ name: 'setting-item-form', itemType: 'project', itemId: item.id, returnView: currentView })}
                    onDelete={projectsCrud.removeItem}
                />
                <SettingsSection
                    title="Tags"
                    items={tagsCrud.items}
                    loading={tagsCrud.loading}
                    onAdd={() => setView({ name: 'setting-item-form', itemType: 'tag', returnView: currentView })}
                    onEdit={(item) => setView({ name: 'setting-item-form', itemType: 'tag', itemId: item.id, returnView: currentView })}
                    onDelete={tagsCrud.removeItem}
                />
                 <SecuritySection />
                <motion.div 
                    className="lg:col-span-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring' }}
                >
                    <div className="bg-card dark:bg-dark-card p-4 sm:p-6 rounded-lg border border-border dark:border-dark-border">
                        <h3 className="text-xl font-bold font-display text-foreground dark:text-dark-foreground mb-4">Encerrar Sessão</h3>
                        <button
                            onClick={onLock}
                            className="w-full bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center justify-center gap-2 text-sm font-semibold text-danger hover:bg-danger/5 transition-colors"
                        >
                            <LogOut className="h-5 w-5" />
                            Sair
                        </button>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export const SettingsItemFormPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { itemType, itemId, returnView = { name: 'settings' } } = viewState;
    const isEdit = !!itemId;
    const [item, setItem] = useState<Item | undefined>(undefined);
    const [loading, setLoading] = useState(isEdit);
    const toast = useToast();
    
    const [name, setName] = useState('');
    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [initialBalance, setInitialBalance] = useState(0);
    const [balanceStr, setBalanceStr] = useState('R$ 0,00');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const apis: Record<ItemType, any> = {
        account: accountsApi, category: categoriesApi, tag: tagsApi, payee: payeesApi, project: projectsApi
    };
    
    useEffect(() => {
        if (isEdit && itemId && itemType) {
            const fetchItem = async () => {
                setLoading(true);
                const allItems = await apis[itemType].getAll();
                const foundItem = allItems.find((i: Item) => i.id === itemId);
                if (foundItem) {
                    setItem(foundItem);
                    setName(foundItem.name);
                    if ('type' in foundItem) setType(foundItem.type);
                    if ('initialBalance' in foundItem) {
                        setInitialBalance(foundItem.initialBalance);
                        setBalanceStr(formatCurrencyForInput(foundItem.initialBalance));
                    }
                }
                setLoading(false);
            };
            fetchItem();
        }
    }, [isEdit, itemId, itemType]);

    const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const numericValue = parseCurrencyFromInput(value);
        setInitialBalance(numericValue);
        setBalanceStr(formatCurrencyForInput(numericValue));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemType) return;

        setIsSubmitting(true);
        const commonData = { name };
        let itemData: any;
        switch (itemType) {
            case 'account': itemData = { ...commonData, initialBalance }; break;
            case 'category': itemData = { ...commonData, type }; break;
            default: itemData = commonData;
        }

        try {
            if (isEdit && itemId) {
                await apis[itemType].update(itemId, itemData);
            } else {
                await apis[itemType].add(itemData);
            }
            toast.success(`Item ${isEdit ? 'atualizado' : 'adicionado'} com sucesso!`);
            setView(returnView);
        } catch (error) {
            console.error(error);
            toast.error("Falha ao salvar item.");
            setIsSubmitting(false);
        }
    };
    
    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    if (!itemType) {
        setView({ name: 'settings' }); // Fallback
        return null;
    }

    const titles: Record<ItemType, string> = {
        account: 'Conta', category: 'Categoria', tag: 'Tag', payee: 'Beneficiário', project: 'Projeto'
    };
    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";
    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
             <PageHeader title={`${isEdit ? 'Editar' : 'Nova'} ${titles[itemType]}`} onBack={() => setView(returnView)} />
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border space-y-4"
            >
                 <div>
                    <label className={labelClass}>Nome</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
                </div>
                {itemType === 'account' && (
                    <div>
                        <label className={labelClass}>Saldo Inicial</label>
                        <input type="text" value={balanceStr} onChange={handleBalanceChange} required className={inputClass} />
                    </div>
                )}
                {itemType === 'category' && (
                    <div>
                        <label className={labelClass}>Tipo</label>
                        <select value={type} onChange={e => setType(e.target.value as 'income' | 'expense')} className={inputClass}>
                            <option value="expense">Despesa</option>
                            <option value="income">Receita</option>
                        </select>
                    </div>
                )}
            </motion.div>
            <div className="flex justify-center">
                <SubmitButton isSubmitting={isSubmitting} text="Salvar" />
            </div>
        </form>
    );
};