import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
// FIX: Import types from the corrected types.ts file.
import { ViewState, ItemType, Account, Category, Payee, Tag, Project } from '../types';
import { accountsApi, categoriesApi, payeesApi, tagsApi, projectsApi, urlBase64ToUint8Array, VAPID_PUBLIC_KEY, savePushSubscription, deletePushSubscription } from '../services/api';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { useToast } from './Notifications';
import { Briefcase, Tag as TagIcon, DollarSign, Layers, ChevronRight, User, PlusCircle, Trash, Lock, Fingerprint, Bell } from './Icons';

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


// --- Main Settings Page ---
const settingsItems: { type: ItemType, label: string, icon: React.ReactNode, description: string }[] = [
    { type: 'account', label: 'Contas', icon: <DollarSign className="h-6 w-6 text-primary" />, description: "Gerencie suas contas bancárias e saldos" },
    { type: 'category', label: 'Categorias', icon: <Layers className="h-6 w-6 text-primary" />, description: "Organize suas receitas e despesas" },
    { type: 'payee', label: 'Beneficiários', icon: <User className="h-6 w-6 text-primary" />, description: "Cadastre quem recebe ou paga" },
    { type: 'tag', label: 'Tags', icon: <TagIcon className="h-6 w-6 text-primary" />, description: "Etiquetas para agrupar transações" },
    { type: 'project', label: 'Projetos', icon: <Briefcase className="h-6 w-6 text-primary" />, description: "Acompanhe gastos por projeto" },
];

const SettingCard: React.FC<{ item: typeof settingsItems[0], onClick: () => void }> = ({ item, onClick }) => (
    <motion.div
        onClick={onClick}
        className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center gap-4 cursor-pointer group"
        variants={listItemVariants}
        whileHover={{ y: -4, scale: 1.02, boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}
        transition={{ type: 'spring', stiffness: 250, damping: 15 }}
    >
        <div className="p-3 bg-primary/10 rounded-full">{item.icon}</div>
        <div>
            <h3 className="font-bold text-foreground dark:text-dark-foreground group-hover:text-primary transition-colors">{item.label}</h3>
            <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
    </motion.div>
);

const BIOMETRY_CREDENTIAL_KEY = 'biometry_credential_id_v1';

export const Settings: React.FC<{ setView: (view: ViewState) => void, onLock: () => void }> = ({ setView, onLock }) => {
    const toast = useToast();
    const [isBiometryAvailable, setIsBiometryAvailable] = useState(false);
    const [isBiometryRegistered, setIsBiometryRegistered] = useState(false);

    // --- New State for Notifications ---
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentSubscription, setCurrentSubscription] = useState<PushSubscription | null>(null);

    useEffect(() => {
        const checkBiometrySupport = async () => {
            if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
                const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                setIsBiometryAvailable(isAvailable);
                if (isAvailable) {
                    setIsBiometryRegistered(!!localStorage.getItem(BIOMETRY_CREDENTIAL_KEY));
                }
            }
        };
        checkBiometrySupport();
        
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(reg => {
                reg.pushManager.getSubscription().then(sub => {
                    setCurrentSubscription(sub);
                    setNotificationPermission(Notification.permission);
                });
            });
        }
    }, []);
    
    const handleRegisterBiometry = async () => {
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: { name: "Financeiro", id: window.location.hostname },
                    user: { id: new Uint8Array(16), name: "user@financeiro.app", displayName: "Usuário" },
                    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                    authenticatorSelection: { userVerification: "required", residentKey: "required" },
                    timeout: 60000,
                    attestation: "none",
                }
            });

            if (credential) {
                const credentialId = btoa(String.fromCharCode(...new Uint8Array((credential as any).rawId)));
                localStorage.setItem(BIOMETRY_CREDENTIAL_KEY, credentialId);
                setIsBiometryRegistered(true);
                toast.success("Biometria cadastrada com sucesso!");
            }
        } catch (err: any) {
            console.error("Erro no cadastro de biometria:", err);
            if (err.name === 'NotAllowedError') {
                 toast.error('Cadastro cancelado ou permissão negada.');
            } else if (!window.isSecureContext) {
                 toast.error('O cadastro de biometria requer uma conexão segura (HTTPS).');
            } else {
                 toast.error('Falha no cadastro. Seu dispositivo pode não ser compatível.');
            }
        }
    };
    
    const handleRemoveBiometry = () => {
        localStorage.removeItem(BIOMETRY_CREDENTIAL_KEY);
        setIsBiometryRegistered(false);
        toast.info("Cadastro de biometria removido.");
    };
    
    const handleSubscribe = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            toast.error('Notificações push não são suportadas neste navegador.');
            return;
        }

        setIsProcessing(true);
        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);

            if (permission === 'granted') {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });
                
                // Update UI optimistically
                setCurrentSubscription(sub);

                try {
                    await savePushSubscription(sub);
                    toast.success('Notificações ativadas com sucesso!');
                } catch (dbError) {
                    toast.error('Falha ao salvar no servidor. Tente desativar e reativar.');
                    console.error("Error saving subscription to DB", dbError);
                }
            } else {
                toast.info('Permissão para notificações não concedida.');
            }
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
            toast.error('Falha ao ativar notificações.');
            setCurrentSubscription(null); // Ensure state is clean on failure
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleUnsubscribe = async () => {
        if (!currentSubscription) return;
        setIsProcessing(true);
        try {
            await currentSubscription.unsubscribe();
            setCurrentSubscription(null); // Optimistic UI update

            try {
                 await deletePushSubscription(currentSubscription.endpoint);
                 toast.info('Notificações desativadas.');
            } catch (dbError) {
                toast.error('Falha ao remover do servidor.');
                console.error("Error deleting subscription from DB", dbError);
            }
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
            toast.error('Falha ao desativar notificações.');
            // Re-sync state on failure
            navigator.serviceWorker.ready.then(reg => {
                reg.pushManager.getSubscription().then(sub => {
                    setCurrentSubscription(sub);
                });
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTestNotification = () => {
        if (!currentSubscription || notificationPermission !== 'granted') {
            toast.error('É preciso ativar as notificações primeiro.');
            return;
        }
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification('Notificação de Teste 🚀', {
                body: 'Se você está vendo esta mensagem, as notificações estão funcionando!',
                icon: '/icon512_rounded.png'
            });
        });
    };

    return (
        <div className="space-y-6">
            <h2 className="hidden sm:block text-2xl md:text-3xl font-bold font-display text-foreground dark:text-dark-foreground">Ajustes</h2>
            
            <div>
                <h3 className="text-xl font-bold mb-3 text-foreground dark:text-dark-foreground">Cadastros</h3>
                <motion.div 
                    className="space-y-3"
                    variants={listContainerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {settingsItems.map(item => (
                        <SettingCard key={item.type} item={item} onClick={() => setView({ name: 'setting-list', itemType: item.type })} />
                    ))}
                </motion.div>
            </div>

            <div>
                <h3 className="text-xl font-bold mb-3 text-foreground dark:text-dark-foreground">Notificações</h3>
                 <motion.div 
                    className="space-y-3"
                    variants={listContainerVariants}
                    initial="hidden"
                    animate="visible"
                >
                     <motion.div variants={listItemVariants} className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center gap-4 group">
                         <div className="p-3 bg-primary/10 rounded-full"><Bell className="h-6 w-6 text-primary"/></div>
                         <div className="flex-1">
                             <h3 className="font-bold text-foreground dark:text-dark-foreground">Alertas de Vencimento</h3>
                             <p className="text-sm text-muted-foreground">
                                {notificationPermission === 'denied' ? 'Permissão bloqueada no navegador' : currentSubscription ? 'Ativado' : 'Desativado'}
                             </p>
                         </div>
                         {notificationPermission === 'granted' && currentSubscription ? (
                            <motion.button whileTap={{scale: 0.95}} onClick={handleUnsubscribe} disabled={isProcessing} className="text-sm font-semibold bg-destructive text-destructive-foreground py-2 px-4 rounded-md disabled:opacity-50">
                                {isProcessing ? 'Aguarde...' : 'Desativar'}
                            </motion.button>
                         ) : notificationPermission !== 'denied' ? (
                            <motion.button whileTap={{scale: 0.95}} onClick={handleSubscribe} disabled={isProcessing} className="text-sm font-semibold bg-primary text-primary-foreground py-2 px-4 rounded-md disabled:opacity-50">
                                {isProcessing ? 'Aguarde...' : 'Ativar'}
                            </motion.button>
                         ) : null}
                     </motion.div>

                     {notificationPermission === 'granted' && currentSubscription && (
                         <motion.div
                            variants={listItemVariants}
                            className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center justify-between gap-4 cursor-pointer group"
                            whileHover={{ y: -4, scale: 1.02, boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}
                            transition={{ type: 'spring', stiffness: 250, damping: 15 }}
                            onClick={handleTestNotification}
                        >
                            <div className="flex-1">
                                <h3 className="font-bold text-foreground dark:text-dark-foreground group-hover:text-primary transition-colors">Testar Notificações</h3>
                                <p className="text-sm text-muted-foreground">Enviar uma notificação de teste para este dispositivo</p>
                            </div>
                             <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
                        </motion.div>
                     )}
                </motion.div>
            </div>
            
             <div>
                <h3 className="text-xl font-bold mb-3 text-foreground dark:text-dark-foreground">Segurança</h3>
                <motion.div 
                    className="space-y-3"
                    variants={listContainerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    {isBiometryAvailable && (
                         <motion.div variants={listItemVariants} className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center gap-4 group">
                             <div className="p-3 bg-primary/10 rounded-full"><Fingerprint className="h-6 w-6 text-primary"/></div>
                             <div className="flex-1">
                                 <h3 className="font-bold text-foreground dark:text-dark-foreground">Acesso Biométrico</h3>
                                 <p className="text-sm text-muted-foreground">{isBiometryRegistered ? 'Ativado' : 'Desativado'}</p>
                             </div>
                             {isBiometryRegistered ? (
                                <motion.button whileTap={{scale: 0.95}} onClick={handleRemoveBiometry} className="text-sm font-semibold bg-destructive text-destructive-foreground py-2 px-4 rounded-md">Desativar</motion.button>
                             ) : (
                                <motion.button whileTap={{scale: 0.95}} onClick={handleRegisterBiometry} className="text-sm font-semibold bg-primary text-primary-foreground py-2 px-4 rounded-md">Ativar</motion.button>
                             )}
                         </motion.div>
                    )}
                    <motion.div
                        onClick={onLock}
                        className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center gap-4 cursor-pointer group"
                        variants={listItemVariants}
                        whileHover={{ y: -4, scale: 1.02, boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}
                        transition={{ type: 'spring', stiffness: 250, damping: 15 }}
                    >
                        <div className="p-3 bg-primary/10 rounded-full"><Lock className="h-6 w-6 text-primary"/></div>
                        <div className="flex-1">
                            <h3 className="font-bold text-foreground dark:text-dark-foreground group-hover:text-primary transition-colors">Bloquear App</h3>
                            <p className="text-sm text-muted-foreground">Requerer senha para reabrir</p>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
};


// --- Item List Page ---

const apiMap: Record<ItemType, any> = {
    account: accountsApi,
    category: categoriesApi,
    payee: payeesApi,
    tag: tagsApi,
    project: projectsApi,
};

const labelsMap: Record<ItemType, { singular: string, plural: string }> = {
    account: { singular: 'Conta', plural: 'Contas' },
    category: { singular: 'Categoria', plural: 'Categorias' },
    payee: { singular: 'Beneficiário', plural: 'Beneficiários' },
    tag: { singular: 'Tag', plural: 'Tags' },
    project: { singular: 'Projeto', plural: 'Projetos' },
};

export const SettingsListPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { itemType, returnView = { name: 'settings' } } = viewState as { name: 'setting-list', itemType: ItemType, returnView?: ViewState };
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const api = apiMap[itemType];
    const labels = labelsMap[itemType];
    
    useEffect(() => {
        let isCancelled = false;
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await api.getAll();
                if (!isCancelled) {
                    setItems(data);
                }
            } catch (error) {
                if (!isCancelled) {
                    toast.error(`Erro ao carregar ${labels.plural.toLowerCase()}.`);
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };
        fetchData();
        return () => {
            isCancelled = true;
        };
    }, [api, labels, toast]);

    const handleDelete = async (itemId: string) => {
        if (window.confirm('Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.')) {
            try {
                await api.remove(itemId);
                toast.success('Item excluído com sucesso.');
                setItems(prevItems => prevItems.filter(item => item.id !== itemId));
            } catch (error: any) {
                if(error.message.includes('foreign key constraint')) {
                     toast.error('Não é possível excluir. Este item está sendo usado em transações.');
                } else {
                     toast.error('Erro ao excluir item.');
                }
            }
        }
    };
    
    const currentView: ViewState = { name: 'setting-list', itemType };

    return (
        <div className="space-y-6">
            <PageHeader
                title={labels.plural}
                onBack={() => setView(returnView)}
                action={
                    <button onClick={() => setView({ name: 'setting-item-form', itemType, returnView: currentView })} className="bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-full flex items-center gap-2 active:scale-95 transition-transform">
                        <PlusCircle className="h-5 w-5"/> <span className="hidden sm:inline">Adicionar</span>
                    </button>
                }
            />
            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div
                        key="loader"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex justify-center items-center h-64"
                    >
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="list"
                        variants={listContainerVariants}
                        initial="hidden"
                        animate="visible"
                        className="space-y-3"
                    >
                        {items.length > 0 ? items.map(item => (
                            <motion.div
                                key={item.id}
                                variants={listItemVariants}
                                className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center justify-between"
                            >
                                <div
                                    className="flex-1 cursor-pointer group"
                                    onClick={() => setView({ name: 'setting-item-form', itemType, itemId: item.id, returnView: currentView })}
                                >
                                    <p className="font-semibold text-foreground dark:text-dark-foreground group-hover:text-primary transition-colors">{item.name}</p>
                                    {itemType === 'account' && <p className="text-sm text-muted-foreground">Saldo inicial: {item.initialBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
                                    {itemType === 'category' && <p className="text-sm text-muted-foreground capitalize">{item.type === 'income' ? 'Receita' : (item.type === 'expense' ? 'Despesa' : 'Ambos')}</p>}
                                </div>
                                <motion.button 
                                    onClick={() => handleDelete(item.id)} 
                                    className="p-2 text-muted-foreground hover:text-danger rounded-full transition-colors"
                                    whileTap={{ scale: 0.9 }}
                                    whileHover={{ backgroundColor: 'rgba(217, 83, 79, 0.1)' }}
                                >
                                    <Trash className="h-5 w-5"/>
                                </motion.button>
                            </motion.div>
                        )) : (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center py-20 text-muted-foreground"
                            >
                                <p className="font-semibold text-lg">Nenhum item encontrado.</p>
                                <p>Adicione um novo item para começar.</p>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Item Form Page ---

export const SettingsItemFormPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    const { itemType, itemId, returnView } = viewState as { name: 'setting-item-form', itemType: ItemType, itemId?: string, returnView?: ViewState };
    const isEdit = !!itemId;
    const api = apiMap[itemType];
    const labels = labelsMap[itemType];
    
    const [formData, setFormData] = useState<any>({ name: '' });
    const [loading, setLoading] = useState(isEdit);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();
    
    useEffect(() => {
        let isCancelled = false;
        const fetchItem = async () => {
            try {
                const allItems: any[] = await api.getAll();
                if (!isCancelled) {
                    const item = allItems.find(i => i.id === itemId);
                    if (item) {
                        setFormData(item);
                    }
                }
            } catch (error) {
                 if (!isCancelled) {
                    toast.error(`Erro ao carregar os dados para edição.`);
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        if (isEdit) {
            fetchItem();
        } else {
            setLoading(false);
        }

        return () => {
            isCancelled = true;
        };
    }, [isEdit, itemId, api, toast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { id, ...dataToSave } = formData;
            if (isEdit && itemId) {
                await api.update(itemId, dataToSave);
            } else {
                await api.add(dataToSave);
            }
            toast.success(`${labels.singular} ${isEdit ? 'atualizado(a)' : 'adicionado(a)'} com sucesso!`);
            setView(returnView || { name: 'settings' });
        } catch (error) {
            toast.error(`Erro ao salvar ${labels.singular.toLowerCase()}.`);
            setIsSubmitting(false);
        }
    };
    
    if (loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title={`${isEdit ? 'Editar' : 'Novo(a)'} ${labels.singular}`} onBack={() => setView(returnView || { name: 'settings' })} />
            <div className="space-y-4 bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border">
                <div>
                    <label htmlFor="name" className={labelClass}>Nome</label>
                    <input type="text" id="name" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required className={inputClass} />
                </div>
                {itemType === 'account' && (
                    <div>
                         <label htmlFor="initialBalance" className={labelClass}>Saldo Inicial</label>
                         <input type="number" step="0.01" id="initialBalance" value={formData.initialBalance || 0} onChange={e => setFormData(f => ({ ...f, initialBalance: parseFloat(e.target.value) }))} required className={inputClass} />
                    </div>
                )}
                {itemType === 'category' && (
                    <div>
                        <label htmlFor="type" className={labelClass}>Tipo</label>
                        <select id="type" value={formData.type || 'expense'} onChange={e => setFormData(f => ({...f, type: e.target.value}))} required className={inputClass}>
                            <option value="expense">Despesa</option>
                            <option value="income">Receita</option>
                            <option value="both">Ambos</option>
                        </select>
                    </div>
                )}
            </div>
            <div className="flex justify-center">
                <SubmitButton isSubmitting={isSubmitting} text="Salvar" />
            </div>
        </form>
    );
};