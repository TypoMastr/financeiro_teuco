import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
// FIX: Import types from the corrected types.ts file.
import { ViewState, ItemType, Account, Category, Payee, Tag, Project } from '../types';
import { accountsApi, categoriesApi, payeesApi, tagsApi, projectsApi, urlBase64ToUint8Array, VAPID_PUBLIC_KEY, savePushSubscription, deletePushSubscription } from '../services/api';
import { PageHeader, SubmitButton } from './common/PageLayout';
import { useToast } from './Notifications';
// FIX: Import the 'Edit' icon from './Icons' to resolve the 'Cannot find name' error.
import { Briefcase, Tag as TagIcon, DollarSign, Layers, ChevronRight, User, PlusCircle, Trash, Lock, Fingerprint, Bell, Edit } from './Icons';

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

    // --- State for Notifications ---
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentSubscription, setCurrentSubscription] = useState<PushSubscription | null>(null);

    const updateNotificationStatus = useCallback(async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setNotificationPermission('denied');
            setCurrentSubscription(null);
            return;
        }

        try {
            const permission = Notification.permission;
            setNotificationPermission(permission);

            if (permission === 'granted') {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                setCurrentSubscription(sub);
            } else {
                setCurrentSubscription(null);
            }
        } catch (err) {
            console.error("Error updating notification status:", err);
            // In case of error, try to read the permission state again and clear subscription
            setNotificationPermission(Notification.permission);
            setCurrentSubscription(null);
        }
    }, []);

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
        
        updateNotificationStatus();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updateNotificationStatus();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [updateNotificationStatus]);
    
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
        if (isProcessing) return;
    
        setIsProcessing(true);
        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
    
            if (permission !== 'granted') {
                toast.info('Permissão para notificações não concedida.');
                return; // Finally will still run
            }
    
            const reg = await navigator.serviceWorker.ready;
            
            // Unsubscribe any existing subscription first to ensure a clean state
            const existingSub = await reg.pushManager.getSubscription();
            if (existingSub) {
                await existingSub.unsubscribe();
            }

            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            
            await savePushSubscription(sub);
            
            setCurrentSubscription(sub);
            toast.success('Notificações ativadas com sucesso!');
    
        } catch (error) {
            console.error('Falha ao ativar notificações:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error(`Erro ao ativar: ${errorMessage}`);
    
            // Cleanup: try to find and unsubscribe any new subscription that might have been created
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (sub) {
                    await sub.unsubscribe();
                }
            } catch (cleanupError) {
                console.error("Erro durante a limpeza da inscrição:", cleanupError);
            }
            setCurrentSubscription(null);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleUnsubscribe = async () => {
        if (!currentSubscription || isProcessing) return;
    
        setIsProcessing(true);
        try {
            // Unsubscribe from browser first. This is the critical part for the user.
            const unsubscribed = await currentSubscription.unsubscribe();
            if (!unsubscribed) {
                console.warn('Browser unsubscribe() returned false, might already be invalid.');
            }

            // After browser unsubscribe, update the server. We catch potential errors here
            // so that a server failure doesn't block the UI from updating.
            await deletePushSubscription(currentSubscription.endpoint).catch(serverError => {
                console.error('Falha ao remover inscrição do servidor, mas o navegador foi desinscrito:', serverError);
                // Don't re-throw. The user is effectively unsubscribed from receiving messages.
            });
            
            toast.info('Notificações desativadas.');
            setCurrentSubscription(null);
    
        } catch (error) {
            console.error('Falha ao desativar notificações:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error(`Erro ao desativar: ${errorMessage}`);
        } finally {
            setIsProcessing(false);
            // Do a final check to ensure state is synchronized.
            await updateNotificationStatus();
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
    
    const statusText = useMemo(() => {
        if (notificationPermission === 'denied') {
            return 'Bloqueado. Altere nas configurações do navegador.';
        }
        if (currentSubscription) {
            return 'Ativado';
        }
        if (notificationPermission === 'granted') {
            return 'Permitido, pronto para ativar';
        }
        return 'Desativado';
    }, [notificationPermission, currentSubscription]);


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
                    variants={listItemVariants}
                    className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center gap-4"
                 >
                    <div className="p-3 bg-primary/10 rounded-full"><Bell className="h-6 w-6 text-primary" /></div>
                    <div className="flex-1">
                        <h4 className="font-bold text-foreground dark:text-dark-foreground">Alertas de Vencimento</h4>
                        <p className="text-sm text-muted-foreground">{statusText}</p>
                    </div>
                    <div className="flex-shrink-0">
                        {currentSubscription ? (
                            <button
                                onClick={handleUnsubscribe}
                                disabled={isProcessing}
                                className="bg-destructive text-destructive-foreground font-semibold py-2 px-4 rounded-md min-w-[100px] text-center"
                            >
                                {isProcessing ? 'Aguarde...' : 'Desativar'}
                            </button>
                        ) : (
                            <button
                                onClick={handleSubscribe}
                                disabled={isProcessing || notificationPermission === 'denied'}
                                className="bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-md min-w-[100px] text-center disabled:opacity-50"
                            >
                                {isProcessing ? 'Aguarde...' : 'Ativar'}
                            </button>
                        )}
                    </div>
                 </motion.div>
                 {notificationPermission === 'granted' && currentSubscription && (
                     <motion.div variants={listItemVariants} className="mt-3">
                        <button onClick={handleTestNotification} className="w-full text-center text-primary font-semibold py-2.5 px-4 rounded-md transition-colors bg-primary/10 hover:bg-primary/20 text-sm">
                            Enviar notificação de teste
                        </button>
                    </motion.div>
                 )}
            </div>

            <div>
                <h3 className="text-xl font-bold mb-3 text-foreground dark:text-dark-foreground">Segurança</h3>
                <motion.div className="space-y-3" variants={listContainerVariants} initial="hidden" animate="visible">
                    {isBiometryAvailable && (
                        <motion.div variants={listItemVariants} className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center gap-4">
                             <div className="p-3 bg-primary/10 rounded-full"><Fingerprint className="h-6 w-6 text-primary" /></div>
                             <div className="flex-1">
                                <h4 className="font-bold text-foreground dark:text-dark-foreground">Acesso Biométrico</h4>
                                <p className="text-sm text-muted-foreground">{isBiometryRegistered ? 'Ativado' : 'Desativado'}</p>
                             </div>
                             <div className="flex-shrink-0">
                                {isBiometryRegistered ? (
                                    <button onClick={handleRemoveBiometry} className="bg-destructive text-destructive-foreground font-semibold py-2 px-4 rounded-md">Desativar</button>
                                ) : (
                                    <button onClick={handleRegisterBiometry} className="bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-md">Ativar</button>
                                )}
                             </div>
                        </motion.div>
                    )}
                     <motion.div variants={listItemVariants} className="bg-card dark:bg-dark-card p-4 rounded-lg border border-border dark:border-dark-border flex items-center gap-4">
                         <div className="p-3 bg-primary/10 rounded-full"><Lock className="h-6 w-6 text-primary" /></div>
                         <div className="flex-1">
                            <h4 className="font-bold text-foreground dark:text-dark-foreground">Bloquear App</h4>
                            <p className="text-sm text-muted-foreground">Requerer senha para reabrir</p>
                         </div>
                         <div className="flex-shrink-0">
                            <button onClick={onLock} className="bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-md">Bloquear Agora</button>
                         </div>
                    </motion.div>
                </motion.div>
            </div>

        </div>
    );
};


// --- List and Form pages for settings items (Account, Category, etc.) ---

type Item = Account | Category | Payee | Tag | Project;

export const SettingsListPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    // FIX: Correctly cast viewState to the specific discriminated union type to access its properties.
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
                 <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
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
                    <p>Nenhum{label.endsWith('a') ? 'a' : ''} {label.toLowerCase()} cadastrad{label.endsWith('a') ? 'a' : 'o'}.</p>
                </div>
            )}
        </div>
    );
};

export const SettingsItemFormPage: React.FC<{ viewState: ViewState, setView: (view: ViewState) => void }> = ({ viewState, setView }) => {
    // FIX: Correctly cast viewState to the specific discriminated union type to access its properties.
    const { itemType, itemId, returnView } = viewState as { name: 'setting-item-form', itemType: ItemType, itemId?: string, returnView: ViewState };
    const isEdit = !!itemId;
    const [loading, setLoading] = useState(isEdit);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formState, setFormState] = useState<any>({ name: '' });
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
        } catch (error) {
            toast.error(`Erro ao salvar ${label.toLowerCase()}.`);
            setIsSubmitting(false);
        }
    };
    
    if(loading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

    const inputClass = "w-full text-sm p-2.5 rounded-lg bg-background dark:bg-dark-background border border-border dark:border-dark-border focus:ring-2 focus:ring-primary focus:outline-none transition-all";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
            <PageHeader title={`${isEdit ? 'Editar' : 'Nov' + (label.endsWith('a') ? 'a' : 'o')} ${label}`} onBack={() => setView(returnView)} />
            <div className="space-y-4 bg-card dark:bg-dark-card p-6 rounded-lg border border-border dark:border-dark-border">
                <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nome</label>
                    <input type="text" value={formState.name} onChange={e => setFormState(f => ({...f, name: e.target.value}))} required className={inputClass}/>
                </div>
                {itemType === 'account' && (
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Saldo Inicial</label>
                        <input type="number" step="0.01" value={formState.initialBalance || 0} onChange={e => setFormState(f => ({...f, initialBalance: parseFloat(e.target.value)}))} required className={inputClass}/>
                    </div>
                )}
                 {itemType === 'category' && (
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo</label>
                        <select value={formState.type || 'expense'} onChange={e => setFormState(f => ({...f, type: e.target.value}))} className={inputClass}>
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