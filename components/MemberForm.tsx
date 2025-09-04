import React, { useState, useEffect, useCallback } from 'react';
import { Member, ViewState } from '../types';
import { getMemberById, addMember, updateMember } from '../services/api';
import { motion, Variants } from 'framer-motion';
import { Save, User, Mail, Phone, Calendar, DollarSign } from './Icons';
import { PageHeader, SubmitButton, DateField } from './common/PageLayout';
import { useToast } from './Notifications';

// --- Utility Functions ---
const formatPhoneNumber = (value: string): string => {
    if (!value) return value;
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const formatCurrencyForInput = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const parseCurrencyFromInput = (formattedValue: string): number => {
    const numericString = formattedValue.replace(/[R$\s.]/g, '').replace(',', '.');
    return parseFloat(numericString) || 0;
};


// --- Global variants to avoid recreation on render ---
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
    exit: { opacity: 0, transition: { staggerChildren: 0.05, staggerDirection: -1 } }
};
const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
    exit: { y: 20, opacity: 0 }
};

// --- Input Component (Memoized for performance) ---
const InputField = React.memo<{
    id: string; name: string; label: string; type: string; value: any;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    icon: React.ReactNode; required?: boolean; step?: string; maxLength?: number;
}>(({ id, name, label, type, value, onChange, icon, required, step, maxLength }) => (
    <motion.div variants={itemVariants}>
        <label htmlFor={id} className="block text-base font-semibold text-foreground dark:text-dark-foreground">{label}</label>
        <div className="relative mt-2">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
            <input
                type={type} id={id} name={name} value={value}
                onChange={onChange} required={required} step={step} maxLength={maxLength}
                className="block w-full pl-12 pr-4 py-3 bg-card dark:bg-dark-input border border-border dark:border-dark-border focus:ring-2 focus:ring-ring focus:outline-none transition-all text-base rounded-lg shadow-sm"
            />
        </div>
    </motion.div>
));

// --- Main Form Component ---
interface MemberFormProps {
    memberId?: string;
    setView: (view: ViewState) => void;
}

const MemberForm: React.FC<MemberFormProps> = ({ memberId, setView }) => {
    const isEditMode = !!memberId;
    const [member, setMember] = useState<Partial<Member>>({
        name: '', email: '', phone: '', monthlyFee: 50,
        activityStatus: 'Ativo', joinDate: new Date().toISOString().slice(0, 10), birthday: ''
    });
    const [monthlyFeeStr, setMonthlyFeeStr] = useState('R$ 50,00');
    const [loading, setLoading] = useState(isEditMode);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (isEditMode && memberId) {
            setLoading(true);
            getMemberById(memberId).then(data => {
                if (data) {
                    setMember({
                        ...data,
                        phone: formatPhoneNumber(data.phone)
                    });
                    setMonthlyFeeStr(formatCurrencyForInput(data.monthlyFee));
                }
                setLoading(false);
            }).catch(() => setLoading(false));
        }
    }, [isEditMode, memberId]);

    const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
        setMember(prev => ({ ...prev, monthlyFee: numericValue }));
        setMonthlyFeeStr(formatCurrencyForInput(numericValue));
    };

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let formattedValue = value;

        switch (name) {
            case 'name':
                formattedValue = value.toUpperCase();
                break;
            case 'email':
                formattedValue = value.toLowerCase();
                break;
            case 'phone':
                formattedValue = formatPhoneNumber(value);
                break;
        }
        
        setMember(prev => ({ ...prev, [name]: formattedValue }));
    }, []);
    
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const joinDateValue = member.joinDate ? member.joinDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
            const joinDateISO = new Date(joinDateValue + 'T12:00:00Z').toISOString();

            const dataToSave = {
                name: member.name || '',
                email: member.email || '',
                phone: (member.phone || '').replace(/\D/g, ''), // Save only digits for phone
                monthlyFee: member.monthlyFee || 0,
                joinDate: joinDateISO,
                activityStatus: member.activityStatus || 'Ativo',
                birthday: member.birthday || undefined,
            };

            if (isEditMode && memberId) {
                const updatedMember = await updateMember(memberId, dataToSave);
                toast.success('Membro atualizado com sucesso!');
                setView({ name: 'member-profile', id: updatedMember.id });
            } else {
                const newMember = await addMember(dataToSave as any);
                toast.success('Membro adicionado com sucesso!');
                setView({ name: 'member-profile', id: newMember.id });
            }
        } catch (error) {
            console.error("Erro ao salvar membro", error);
            toast.error("Ocorreu um erro. Tente novamente.");
            setIsSubmitting(false);
        }
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
    }
    
    const goBack = () => isEditMode ? setView({ name: 'member-profile', id: memberId }) : setView({ name: 'members' });

    return (
        <form 
            onSubmit={handleSubmit} 
            className="space-y-6 max-w-3xl mx-auto"
        >
            <PageHeader
              title={isEditMode ? 'Editar Membro' : 'Novo Membro'}
              onBack={goBack}
            />
             <p className="text-muted-foreground dark:text-dark-muted-foreground -mt-4 text-base text-center">{isEditMode ? 'Altere as informações abaixo.' : 'Preencha os dados para adicionar um novo membro.'}</p>


            <motion.div 
              className="space-y-8"
              variants={containerVariants}
            >
                <motion.div 
                    variants={itemVariants} 
                    className="bg-card dark:bg-dark-card p-6 sm:p-8 rounded-xl border border-border dark:border-dark-border shadow-form-card dark:shadow-dark-form-card overflow-hidden"
                >
                    <div className="border-t-4 border-primary -mt-6 sm:-mt-8 -mx-6 sm:-mx-8 mb-6 sm:mb-8"></div>
                    <motion.h3 variants={itemVariants} className="text-xl md:text-2xl font-bold mb-6">Informações Pessoais</motion.h3>
                    <motion.div className="space-y-6" variants={containerVariants}>
                        <InputField id="name" name="name" label="Nome Completo" type="text" value={member.name} onChange={handleInputChange} required icon={<User className="h-5 w-5"/>} />
                        <InputField id="email" name="email" label="E-mail" type="email" value={member.email} onChange={handleInputChange} required icon={<Mail className="h-5 w-5"/>} />
                        <InputField id="phone" name="phone" label="Telefone" type="tel" value={member.phone} onChange={handleInputChange} required icon={<Phone className="h-5 w-5"/>} maxLength={15} />
                        <motion.div variants={itemVariants}>
                            <label className="block text-base font-semibold text-foreground dark:text-dark-foreground">Data de Nascimento</label>
                            <div className="relative mt-2">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"><Calendar className="h-5 w-5"/></span>
                                <DateField
                                  id="birthday"
                                  label=""
                                  value={member.birthday || ''}
                                  onChange={date => setMember(prev => ({...prev, birthday: date}))}
                                  className="block w-full pl-12 pr-4 py-3 bg-card dark:bg-dark-input border border-border dark:border-dark-border focus:ring-2 focus:ring-ring focus:outline-none transition-all text-base rounded-lg shadow-sm"
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                </motion.div>
                
                <motion.div 
                    variants={itemVariants} 
                    className="bg-card dark:bg-dark-card p-6 sm:p-8 rounded-xl border border-border dark:border-dark-border shadow-form-card dark:shadow-dark-form-card overflow-hidden"
                >
                     <div className="border-t-4 border-primary -mt-6 sm:-mt-8 -mx-6 sm:-mx-8 mb-6 sm:mb-8"></div>
                    <motion.h3 variants={itemVariants} className="text-xl md:text-2xl font-bold mb-6">Detalhes da Mensalidade</motion.h3>
                    <motion.div className="space-y-6" variants={containerVariants}>

                        <motion.div variants={itemVariants}>
                            <label htmlFor="monthlyFee" className="block text-base font-semibold text-foreground dark:text-dark-foreground">Valor Mensal (R$)</label>
                            <div className="relative mt-2">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"><DollarSign className="h-5 w-5"/></span>
                                <input
                                    type="text"
                                    id="monthlyFee"
                                    name="monthlyFee"
                                    value={monthlyFeeStr}
                                    onChange={handleCurrencyChange}
                                    required
                                    className="block w-full pl-12 pr-4 py-3 bg-card dark:bg-dark-input border border-border dark:border-dark-border focus:ring-2 focus:ring-ring focus:outline-none transition-all text-base rounded-lg shadow-sm"
                                />
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants}>
                             <label className="block text-base font-semibold text-foreground dark:text-dark-foreground">Início da Contribuição</label>
                             <div className="relative mt-2">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"><Calendar className="h-5 w-5"/></span>
                                <DateField
                                  id="joinDate"
                                  label=""
                                  value={(member.joinDate || '').slice(0,10)}
                                  onChange={date => setMember(prev => ({...prev, joinDate: date}))}
                                  className="block w-full pl-12 pr-4 py-3 bg-card dark:bg-dark-input border border-border dark:border-dark-border focus:ring-2 focus:ring-ring focus:outline-none transition-all text-base rounded-lg shadow-sm"
                                  required
                                />
                            </div>
                        </motion.div>

                        
                         <motion.div variants={itemVariants}>
                             <label htmlFor="activityStatus" className="block text-base font-semibold text-foreground dark:text-dark-foreground">Status do Membro</label>
                            <select id="activityStatus" name="activityStatus" value={member.activityStatus} onChange={handleInputChange} className="block w-full mt-2 px-4 py-3 bg-card dark:bg-dark-input border border-border dark:border-dark-border focus:ring-2 focus:ring-ring focus:outline-none transition-all text-base rounded-lg shadow-sm">
                                <option value="Ativo">Ativo</option>
                                <option value="Inativo">Inativo</option>
                            </select>
                        </motion.div>
                    </motion.div>
                </motion.div>

                <motion.div variants={itemVariants} className="flex justify-center pt-4">
                     <SubmitButton isSubmitting={isSubmitting} text="Salvar Alterações">
                        <Save className="h-5 w-5" />
                    </SubmitButton>
                </motion.div>
            </motion.div>
        </form>
    );
};

export default MemberForm;