import React, { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { ViewState, ItemType } from '../types';
import { PageHeader } from './common/PageLayout';
import { useToast } from './Notifications';
import { Briefcase, Tag as TagIcon, DollarSign, Layers, ChevronRight, User, Lock, Fingerprint } from './Icons';
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

export const Settings: React.FC = () => {
    const { setView, lockApp } = useApp();
    const toast = useToast();
    const [isBiometryAvailable, setIsBiometryAvailable] = useState(false);
    const [isBiometryRegistered, setIsBiometryRegistered] = useState(false);

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
                            <button onClick={lockApp} className="bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-md">Bloquear Agora</button>
                         </div>
                    </motion.div>
                </motion.div>
            </div>

        </div>
    );
};