import { createClient } from '@supabase/supabase-js';
import { Member, Payment, PaymentStatus, Stats, OverdueMonth, Account, Category, Tag, Payee, Transaction, Project, PayableBill, LogEntry, ActionType, EntityType } from '../types';

const SUPABASE_URL = "https://qoqubqskbzwcsvcwrxdm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvcXVicXNrYnp3Y3N2Y3dyeGRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NjAzMDUsImV4cCI6MjA3MjQzNjMwNX0.00KWOxdDd34DptwigNsMz3VAz5A1lTL13fBHcApPWSA";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- UTILS ---
const toCamelCase = (s: string) => s.replace(/(_\w)/g, k => k[1].toUpperCase());
const toSnakeCase = (s: string) => s.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const convertObjectKeys = (obj: any, converter: (s: string) => string): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => convertObjectKeys(v, converter));
    } else if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => {
            const newKey = converter(key);
            result[newKey] = convertObjectKeys(obj[key], converter);
            return result;
        }, {} as any);
    }
    return obj;
};

const sanitizeFilenameForSupabase = (filename: string): string => {
    // Decomposes accented characters into base characters and combining diacritical marks.
    const normalized = filename.normalize('NFD');
    // Removes the combining diacritical marks.
    const withoutAccents = normalized.replace(/[\u0300-\u036f]/g, '');
    // Replaces spaces and any remaining non-alphanumeric characters (except for dots, hyphens, and underscores) with underscores.
    // Also collapses multiple consecutive underscores into a single one.
    return withoutAccents
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/__+/g, '_');
};


// --- NEW HELPERS FOR DETAILED LOGGING ---
interface LookupData {
    accounts: Map<string, string>;
    categories: Map<string, string>;
    payees: Map<string, string>;
    projects: Map<string, string>;
    tags: Map<string, string>;
    members: Map<string, string>;
}

const getLookupData = async (): Promise<LookupData> => {
    const { data: membersData, error: membersError } = await supabase.from('members').select('id, name');
    if (membersError) throw membersError;
    
    const [accounts, categories, payees, projects, tags] = await Promise.all([
        accountsApi.getAll(),
        categoriesApi.getAll(),
        payeesApi.getAll(),
        projectsApi.getAll(),
        tagsApi.getAll(),
    ]);

    return {
        accounts: new Map(accounts.map(item => [item.id, item.name])),
        categories: new Map(categories.map(item => [item.id, item.name])),
        payees: new Map(payees.map(item => [item.id, item.name])),
        projects: new Map(projects.map(item => [item.id, item.name])),
        tags: new Map(tags.map(item => [item.id, item.name])),
        members: new Map(membersData.map(item => [item.id, item.name])),
    };
};


const FIELD_LABELS: Record<string, string> = {
    name: 'Nome',
    email: 'E-mail',
    phone: 'Telefone',
    joinDate: 'Data de Admissão',
    birthday: 'Aniversário',
    monthlyFee: 'Mensalidade',
    activityStatus: 'Status de Atividade',
    description: 'Descrição',
    amount: 'Valor',
    date: 'Data',
    type: 'Tipo',
    accountId: 'Conta',
    categoryId: 'Categoria',
    payeeId: 'Beneficiário/Pagador',
    tagIds: 'Tags',
    projectId: 'Projeto',
    comments: 'Observações',
    dueDate: 'Vencimento',
    status: 'Status',
    paidDate: 'Data de Pagamento',
    notes: 'Notas',
    isEstimate: 'Valor Estimado',
    initialBalance: 'Saldo Inicial',
    paymentDate: 'Data do Pagamento',
    referenceMonth: 'Mês de Referência',
    memberId: 'Membro'
};

const formatLogValue = (key: string, value: any, lookupData?: LookupData): string => {
    if (value === null || value === undefined || value === '') return '"vazio"';

    if (typeof value === 'boolean') {
        return value ? '"Sim"' : '"Não"';
    }
    
    if (lookupData) {
        switch (key) {
            case 'accountId':
                return `"${lookupData.accounts.get(value) || value}"`;
            case 'categoryId':
                return `"${lookupData.categories.get(value) || value}"`;
            case 'payeeId':
                return `"${lookupData.payees.get(value) || value}"`;
            case 'projectId':
                return `"${lookupData.projects.get(value) || value}"`;
            case 'memberId':
                return `"${lookupData.members.get(value) || value}"`;
            case 'tagIds':
                if (Array.isArray(value)) {
                    const names = value.map(id => lookupData.tags.get(id) || id);
                    return names.length > 0 ? `"${names.join(', ')}"` : '"vazio"';
                }
                return `"${String(value)}"`;
        }
    }


    switch (key) {
        case 'amount':
        case 'monthlyFee':
        case 'initialBalance':
        case 'paidAmount':
            return `"${(value as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}"`;
        case 'date':
        case 'joinDate':
        case 'dueDate':
        case 'paidDate':
        case 'paymentDate':
        case 'birthday':
            try {
                const date = new Date(value.includes('T') ? value : value + 'T12:00:00Z');
                return `"${date.toLocaleDateString('pt-BR')}"`;
            } catch (e) {
                return `"${value}"`;
            }
        case 'referenceMonth':
            try {
                const [year, month] = String(value).split('-');
                const date = new Date(Number(year), Number(month) - 1, 2);
                return `"${date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}"`;
            } catch (e) {
                 return `"${value}"`;
            }
        default:
            return `"${String(value)}"`;
    }
};

const generateDetailedUpdateMessage = (
    oldData: any, 
    newData: any, 
    entityLabel: string, 
    name: string,
    lookupData?: LookupData
): string => {
    const changes: string[] = [];
    const oldDataCamel = convertObjectKeys(oldData, toCamelCase);
    const newDataCamel = convertObjectKeys(newData, toCamelCase);

    const allKeys = new Set([...Object.keys(oldDataCamel), ...Object.keys(newDataCamel)]);

    const ignoreFields = ['id', 'created_at', 'updated_at', 'transactionId', 'payableBillId', 'recurringId', 'installmentGroupId', 'installmentInfo', 'attachmentUrl', 'attachmentFilename', 'overdueMonthsCount', 'overdueMonths', 'totalDue', 'paymentStatus', 'undoData', 'currentBalance', 'password'];

    for (const key of allKeys) {
        if (ignoreFields.includes(key)) {
            continue;
        }

        const oldValue = oldDataCamel[key];
        const newValue = newDataCamel[key];
        
        if (Array.isArray(oldValue) || Array.isArray(newValue)) {
            const oldArr = oldValue || [];
            const newArr = newValue || [];
            if (oldArr.length !== newArr.length || oldArr.some((item, i) => item !== newArr[i])) {
                 const fieldLabel = FIELD_LABELS[key] || key;
                 changes.push(`${fieldLabel} alterado de ${formatLogValue(key, oldValue, lookupData)} para ${formatLogValue(key, newValue, lookupData)}.`);
            }
        } else if (String(oldValue) !== String(newValue)) {
            const fieldLabel = FIELD_LABELS[key] || key;
            changes.push(`${fieldLabel} alterado de ${formatLogValue(key, oldValue, lookupData)} para ${formatLogValue(key, newValue, lookupData)}.`);
        }
    }

    if (changes.length === 0) {
        return `${entityLabel} "${name}" foi salvo sem alterações nos dados.`;
    }

    return `${entityLabel} "${name}" atualizado. ${changes.join(' ')}`;
};


// --- LOGGING ---
const addLogEntry = async (description: string, actionType: ActionType, entityType: EntityType, undoData: any) => {
    const { error } = await supabase.from('logs').insert({ description, action_type: actionType, entity_type: entityType, undo_data: undoData });
    if (error) console.error('Error adding log entry:', error);
};

// --- ATTACHMENT UPLOAD ---
const uploadAttachment = async (attachmentUrl: string, attachmentFilename: string): Promise<{ url?: string; error?: any }> => {
    try {
        const response = await fetch(attachmentUrl);
        const blob = await response.blob();
        
        const sanitizedFilename = sanitizeFilenameForSupabase(attachmentFilename);

        const file = new File([blob], sanitizedFilename, { type: blob.type });
        const filePath = `public/${Date.now()}-${sanitizedFilename}`;
        
        const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file);
        if (uploadError) {
            console.error("Supabase storage upload error:", uploadError);
            return { error: uploadError };
        }
    
        const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);
        return { url: data.publicUrl };
    } catch (err) {
        console.error("Generic upload error:", err);
        return { error: err };
    }
};


const cleanTransactionDataForSupabase = (transactionData: any) => {
    const cleanedData = { ...transactionData };
    if (cleanedData.payeeId === '') cleanedData.payeeId = undefined;
    if (cleanedData.projectId === '') cleanedData.projectId = undefined;
    if (cleanedData.payableBillId === '') cleanedData.payableBillId = undefined;
    if (cleanedData.tagIds && cleanedData.tagIds.length === 0) cleanedData.tagIds = undefined;
    return cleanedData;
};

// --- BUSINESS LOGIC ---
const calculateMemberDetails = (member: any, allPayments: Payment[]): Member => {
    const memberPayments = allPayments.filter(p => p.memberId === member.id);
    const paidMonths = new Set(memberPayments.map(p => p.referenceMonth));
    const overdueMonths: OverdueMonth[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let currentDate = new Date(member.joinDate);
    currentDate.setDate(1);

    while (currentDate < today) {
        const monthStr = currentDate.toISOString().slice(0, 7);
        if (!paidMonths.has(monthStr)) {
            overdueMonths.push({ month: monthStr, amount: member.monthlyFee });
        }
        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    const lastPaidMonth = memberPayments.length > 0 ? memberPayments.map(p => p.referenceMonth).sort().pop()! : '0';
    const currentMonthStr = today.toISOString().slice(0, 7);

    let paymentStatus: PaymentStatus;
    if (overdueMonths.length > 0) paymentStatus = PaymentStatus.Atrasado;
    else if (lastPaidMonth > currentMonthStr) paymentStatus = PaymentStatus.Adiantado;
    else paymentStatus = PaymentStatus.EmDia;
    
    return {
        ...member,
        paymentStatus,
        overdueMonthsCount: overdueMonths.length,
        overdueMonths,
        totalDue: overdueMonths.reduce((sum, item) => sum + item.amount, 0),
    };
};

const updateBillStatusBasedOnDate = (bill: PayableBill): PayableBill => {
    if (bill.status === 'paid') return bill;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(bill.dueDate + 'T12:00:00Z');
    return { ...bill, status: dueDate < today ? 'overdue' : 'pending' };
};

// --- API: GENERIC CRUD ---
const createCrudFunctions = <T extends { id: string, name: string }>(tableName: string, entityType: EntityType, entityLabel: string, nameAccessor: (item: T) => string) => ({
    getAll: async (): Promise<T[]> => {
        const { data, error } = await supabase.from(tableName).select('*').order('name');
        if (error) throw error;
        return convertObjectKeys(data, toCamelCase);
    },
    add: async (itemData: Omit<T, 'id'>): Promise<T> => {
        const payload: any = convertObjectKeys(itemData, toSnakeCase);
        const { data, error } = await supabase.from(tableName).insert(payload).select().single();
        if (error) throw error;
        const newItem = convertObjectKeys(data, toCamelCase);
        await addLogEntry(`Adicionado ${entityLabel}: "${nameAccessor(newItem)}"`, 'create', entityType, { id: newItem.id });
        return newItem;
    },
    update: async (itemId: string, itemData: Partial<Omit<T, 'id'>>): Promise<T> => {
        const { data: oldData, error: findError } = await supabase.from(tableName).select('*').eq('id', itemId).single();
        if (findError) throw findError;
        const payload: any = convertObjectKeys(itemData, toSnakeCase);
        const { data, error } = await supabase.from(tableName).update(payload).eq('id', itemId).select().single();
        if (error) throw error;
        const newItem = convertObjectKeys(data, toCamelCase);
        const description = generateDetailedUpdateMessage(oldData, data, entityLabel, nameAccessor(newItem));
        await addLogEntry(description, 'update', entityType, oldData);
        return convertObjectKeys(data, toCamelCase);
    },
    remove: async (itemId: string): Promise<void> => {
        const { data: oldData, error: findError } = await supabase.from(tableName).select('*').eq('id', itemId).single();
        if (findError) throw findError;
        const { error } = await supabase.from(tableName).delete().eq('id', itemId);
        if (error) throw error;
        await addLogEntry(`Removido ${entityLabel}: "${nameAccessor(convertObjectKeys(oldData, toCamelCase))}"`, 'delete', entityType, oldData);
    },
});

export const categoriesApi = createCrudFunctions<Category>('categories', 'category', 'Categoria', item => item.name);
export const tagsApi = createCrudFunctions<Tag>('tags', 'tag', 'Tag', item => item.name);
export const payeesApi = createCrudFunctions<Payee>('payees', 'payee', 'Beneficiário', item => item.name);
export const projectsApi = createCrudFunctions<Project>('projects', 'project', 'Projeto', item => item.name);

export const accountsApi = {
    getAll: async (): Promise<Account[]> => {
        const { data, error } = await supabase.from('accounts').select('*').order('name');
        if (error) throw error;
        return convertObjectKeys(data, toCamelCase);
    },
    add: async(itemData: Omit<Account, 'id' | 'currentBalance'>): Promise<Account> => {
        const { data, error } = await supabase.from('accounts').insert({ name: itemData.name, initial_balance: itemData.initialBalance }).select().single();
        if (error) throw error;
        const newItem = convertObjectKeys(data, toCamelCase);
        await addLogEntry(`Adicionada conta: "${newItem.name}"`, 'create', 'account', { id: newItem.id });
        return newItem;
    },
    update: async(itemId: string, itemData: Partial<Omit<Account, 'id' | 'currentBalance'>>): Promise<Account> => {
        const { data: oldData, error: findError } = await supabase.from('accounts').select('*').eq('id', itemId).single();
        if (findError) throw findError;
        const { data, error } = await supabase.from('accounts').update({ name: itemData.name, initial_balance: itemData.initialBalance }).eq('id', itemId).select().single();
        if (error) throw error;
        const description = generateDetailedUpdateMessage(oldData, data, 'Conta', data.name);
        await addLogEntry(description, 'update', 'account', oldData);
        return convertObjectKeys(data, toCamelCase);
    },
    remove: async(itemId: string): Promise<void> => {
        const { data: oldData, error: findError } = await supabase.from('accounts').select('*').eq('id', itemId).single();
        if (findError) throw findError;
        const { error } = await supabase.from('accounts').delete().eq('id', itemId);
        if (error) throw error;
        await addLogEntry(`Removida conta: "${oldData.name}"`, 'delete', 'account', oldData);
    }
};

// --- API: MEMBERS & PAYMENTS ---
export const getMembers = async (): Promise<Member[]> => {
    const { data: membersData, error: membersError } = await supabase.from('members').select('*');
    if (membersError) throw membersError;
    const { data: paymentsData, error: paymentsError } = await supabase.from('payments').select('*');
    if (paymentsError) throw paymentsError;

    const rawMembers = convertObjectKeys(membersData, toCamelCase);
    const rawPayments = convertObjectKeys(paymentsData, toCamelCase);

    return rawMembers.map((m: any) => calculateMemberDetails(m, rawPayments));
};

export const getMemberById = async (id: string): Promise<Member | undefined> => {
    const { data, error } = await supabase.from('members').select('*').eq('id', id).single();
    if (error) { if(error.code === 'PGRST116') return undefined; throw error; }
    
    const rawPayments = await getPaymentsByMember(id);
    const rawMember = convertObjectKeys(data, toCamelCase);
    
    return calculateMemberDetails(rawMember, rawPayments);
};

export const addMember = async (memberData: Omit<Member, 'id' | 'paymentStatus' | 'overdueMonthsCount' | 'overdueMonths' | 'totalDue'>): Promise<Member> => {
    const { data, error } = await supabase.from('members').insert(convertObjectKeys(memberData, toSnakeCase)).select().single();
    if (error) throw error;
    const newMember = convertObjectKeys(data, toCamelCase);
    await addLogEntry(`Adicionado novo membro: "${newMember.name}"`, 'create', 'member', { id: newMember.id });
    return calculateMemberDetails(newMember, []);
};

export const updateMember = async (memberId: string, memberData: Partial<Omit<Member, 'id'>>): Promise<Member> => {
    const { data: oldData, error: findError } = await supabase.from('members').select('*').eq('id', memberId).single();
    if (findError) throw findError;
    const { data, error } = await supabase.from('members').update(convertObjectKeys(memberData, toSnakeCase)).eq('id', memberId).select().single();
    if (error) throw error;
    
    const description = generateDetailedUpdateMessage(oldData, data, 'Membro', data.name);
    await addLogEntry(description, 'update', 'member', oldData);
    
    const rawPayments = await getPaymentsByMember(memberId);
    return calculateMemberDetails(convertObjectKeys(data, toCamelCase), rawPayments);
};

export const getPaymentsByMember = async (memberId: string): Promise<Payment[]> => {
    const { data, error } = await supabase.from('payments').select('*').eq('member_id', memberId).order('payment_date', { ascending: false });
    if (error) throw error;
    return convertObjectKeys(data, toCamelCase);
};

export const getPaymentByTransactionId = async (transactionId: string): Promise<Payment | undefined> => {
    const { data, error } = await supabase.from('payments').select('*').eq('transaction_id', transactionId).maybeSingle();
    if (error) throw error;
    return data ? convertObjectKeys(data, toCamelCase) : undefined;
};

export const getPaymentDetails = async (paymentId: string): Promise<{ payment: Payment, transaction: Transaction } | null> => {
    const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

    if (paymentError || !paymentData) {
        console.error('Error fetching payment for editing:', paymentError);
        return null;
    }

    if (!paymentData.transaction_id) {
        console.error('Payment has no associated transaction:', paymentData);
        return null;
    }

    const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', paymentData.transaction_id)
        .single();

    if (transactionError || !transactionData) {
        console.error('Error fetching transaction for payment:', transactionError);
        return null;
    }

    return {
        payment: convertObjectKeys(paymentData, toCamelCase),
        transaction: convertObjectKeys(transactionData, toCamelCase),
    };
};

export const updatePaymentAndTransaction = async (
    paymentId: string,
    transactionId: string,
    formData: {
        paymentDate: string;
        comments: string;
        attachmentUrl: string;
        attachmentFilename: string;
        accountId: string;
    }
): Promise<{ warning?: string }> => {
    let warning: string | undefined;
    let finalAttachmentUrl = formData.attachmentUrl;
    let finalAttachmentFilename = formData.attachmentFilename;
    const { data: oldPaymentData } = await supabase.from('payments').select('*').eq('id', paymentId).single();

    if (formData.attachmentUrl && formData.attachmentUrl.startsWith('blob:') && formData.attachmentFilename) {
        const { url, error } = await uploadAttachment(formData.attachmentUrl, formData.attachmentFilename);
        if (error) {
            if (error.message?.toLowerCase().includes('bucket not found')) {
                warning = 'O anexo não foi salvo. Erro de configuração de armazenamento (Bucket not found).';
                finalAttachmentUrl = oldPaymentData?.attachment_url || '';
                finalAttachmentFilename = oldPaymentData?.attachment_filename || '';
            } else {
                throw error;
            }
        } else {
            finalAttachmentUrl = url;
        }
    }
    
    const { data: oldTransactionData, error: findTransactionError } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
    if (findTransactionError) throw findTransactionError;

    const lookupData = await getLookupData();

    const { data: updatedTransaction, error: updateTrxErr } = await supabase.from('transactions').update({
        date: new Date(formData.paymentDate + 'T12:00:00Z').toISOString(),
        account_id: formData.accountId,
        comments: formData.comments,
        attachment_url: finalAttachmentUrl,
        attachment_filename: finalAttachmentFilename,
    }).eq('id', transactionId).select().single();
    if (updateTrxErr) throw updateTrxErr;
    
    const trxDescription = generateDetailedUpdateMessage(oldTransactionData, updatedTransaction, 'Transação de Pagamento', updatedTransaction.description, lookupData);
    await addLogEntry(trxDescription, 'update', 'transaction', oldTransactionData);

    const { data: updatedPayment, error: updatePayErr } = await supabase.from('payments').update({
        payment_date: new Date(formData.paymentDate + 'T12:00:00Z').toISOString(),
        comments: formData.comments,
        attachment_url: finalAttachmentUrl,
        attachment_filename: finalAttachmentFilename,
    }).eq('id', paymentId).select().single();
    if (updatePayErr) throw updatePayErr;

    const payDescription = generateDetailedUpdateMessage(oldPaymentData, updatedPayment, 'Pagamento', `ref. ${oldPaymentData.reference_month}`, lookupData);
    await addLogEntry(payDescription, 'update', 'payment', oldPaymentData);
    
    return { warning };
};


export const deletePayment = async (paymentId: string): Promise<void> => {
    const { data: paymentToDelete, error: findError } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if (findError) throw findError;

    await addLogEntry(`Excluído pagamento ref. ${paymentToDelete.reference_month}`, 'delete', 'payment', paymentToDelete);

    if (paymentToDelete.transaction_id) {
        const { data: trxToDelete, error: trxFindError } = await supabase.from('transactions').select('*').eq('id', paymentToDelete.transaction_id).single();
        if (!trxFindError && trxToDelete) {
             await addLogEntry(`Excluída transação de pagamento: "${trxToDelete.description}"`, 'delete', 'transaction', trxToDelete);
             const { error: trxDeleteError } = await supabase.from('transactions').delete().eq('id', paymentToDelete.transaction_id);
             if(trxDeleteError) throw trxDeleteError;
        }
    }
    
    const { error } = await supabase.from('payments').delete().eq('id', paymentId);
    if (error) throw error;
};

export const addIncomeTransactionAndPayment = async (
    transactionData: Pick<Transaction, 'description' | 'amount' | 'date' | 'accountId' | 'comments'>,
    paymentData: Pick<Payment, 'memberId' | 'referenceMonth' | 'attachmentUrl' | 'attachmentFilename'>
): Promise<{ warning?: string }> => {
    let warning: string | undefined;
    let finalAttachmentUrl = paymentData.attachmentUrl;
    let finalAttachmentFilename = paymentData.attachmentFilename;
    if (paymentData.attachmentUrl && paymentData.attachmentUrl.startsWith('blob:') && paymentData.attachmentFilename) {
        const { url, error } = await uploadAttachment(paymentData.attachmentUrl, paymentData.attachmentFilename);
        if (error) {
            if (error.message?.toLowerCase().includes('bucket not found')) {
                warning = 'O anexo não foi salvo. Erro de configuração de armazenamento (Bucket not found).';
                finalAttachmentUrl = undefined;
                finalAttachmentFilename = undefined;
            } else {
                throw error;
            }
        } else {
            finalAttachmentUrl = url;
        }
    }

    let mensalidadesCategoryId: string;
    const { data: existingCategories, error: catError } = await supabase.from('categories').select('id').eq('name', 'Mensalidades').eq('type', 'income').limit(1);
    if (catError) throw new Error('Erro ao buscar a categoria de mensalidades.');

    if (existingCategories && existingCategories.length > 0) {
        mensalidadesCategoryId = existingCategories[0].id;
    } else {
        const { data: newCategory, error: createCatError } = await supabase.from('categories').insert({ name: 'Mensalidades', type: 'income' }).select('id').single();
        if (createCatError) throw new Error('Não foi possível criar a categoria "Mensalidades".');
        mensalidadesCategoryId = newCategory.id;
        await addLogEntry('Criada categoria "Mensalidades" automaticamente', 'create', 'category', { id: newCategory.id });
    }

    const { data: trxData, error: trxError } = await supabase.from('transactions').insert({
        description: transactionData.description,
        amount: transactionData.amount,
        date: transactionData.date,
        type: 'income',
        account_id: transactionData.accountId,
        category_id: mensalidadesCategoryId,
        comments: transactionData.comments,
        attachment_url: finalAttachmentUrl,
        attachment_filename: finalAttachmentFilename
    }).select().single();
    if (trxError) throw trxError;
    await addLogEntry(`Criada transação: "${trxData.description}"`, 'create', 'transaction', { id: trxData.id });

    const { data: payData, error: payError } = await supabase.from('payments').insert({
        member_id: paymentData.memberId,
        amount: transactionData.amount,
        payment_date: transactionData.date,
        reference_month: paymentData.referenceMonth,
        comments: transactionData.comments,
        transaction_id: trxData.id,
        attachment_url: finalAttachmentUrl,
        attachment_filename: finalAttachmentFilename
    }).select().single();
    if (payError) throw payError;
    await addLogEntry(`Criado pagamento para ref. ${paymentData.referenceMonth}`, 'create', 'payment', { id: payData.id });
    
    return { warning };
};

export const updateTransactionAndPaymentLink = async (
    transactionId: string,
    transactionData: Partial<Transaction>,
    paymentLink: { memberId: string, referenceMonth: string }
): Promise<{ warning?: string }> => {
    const { warning } = await transactionsApi.update(transactionId, transactionData);

    const { data: oldPay, error: findPayErr } = await supabase.from('payments').select('*').eq('transaction_id', transactionId).single();
    if (findPayErr) throw findPayErr;

    const paymentUpdatePayload = {
        member_id: paymentLink.memberId,
        reference_month: paymentLink.referenceMonth,
        amount: transactionData.amount,
        payment_date: transactionData.date,
        comments: transactionData.comments,
    };

    const { data: updatedPay, error: updatePayErr } = await supabase.from('payments').update(paymentUpdatePayload).eq('id', oldPay.id).select().single();
    if (updatePayErr) throw updatePayErr;

    const lookupData = await getLookupData();
    const description = generateDetailedUpdateMessage(oldPay, updatedPay, 'Pagamento', `ref. ${oldPay.reference_month}`, lookupData);
    await addLogEntry(description, 'update', 'payment', oldPay);
    
    return { warning };
};


// --- API: FINANCIAL & TRANSACTIONS ---
export const getAccountsWithBalance = async (): Promise<Account[]> => {
    const { data: accounts, error: accError } = await supabase.from('accounts').select('*');
    if (accError) throw accError;

    const { data: transactions, error: trxError } = await supabase.from('transactions').select('account_id, type, amount');
    if (trxError) throw trxError;

    const balances = new Map<string, number>();
    accounts.forEach(acc => balances.set(acc.id, acc.initial_balance));

    transactions.forEach(trx => {
        const currentBalance = balances.get(trx.account_id) || 0;
        const newBalance = currentBalance + (trx.type === 'income' ? trx.amount : -trx.amount);
        balances.set(trx.account_id, newBalance);
    });

    return convertObjectKeys(accounts, toCamelCase).map((acc: Account) => ({
        ...acc,
        currentBalance: balances.get(acc.id) || acc.initialBalance,
    }));
};

export const transactionsApi = {
    getAll: async (): Promise<Transaction[]> => {
        const { data, error } = await supabase.from('transactions').select('*');
        if (error) throw error;
        return convertObjectKeys(data, toCamelCase);
    },
    add: async(transactionData: Omit<Transaction, 'id'>): Promise<{ data: Transaction, warning?: string }> => {
         const cleanedData = cleanTransactionDataForSupabase(transactionData);
         const finalTransactionData = { ...cleanedData };
         let warning: string | undefined;

         if (finalTransactionData.attachmentUrl && finalTransactionData.attachmentUrl.startsWith('blob:') && finalTransactionData.attachmentFilename) {
            const { url, error: uploadError } = await uploadAttachment(finalTransactionData.attachmentUrl, finalTransactionData.attachmentFilename);
            if (uploadError) {
                if (uploadError.message?.toLowerCase().includes('bucket not found')) {
                    warning = 'O anexo não foi salvo. Erro de configuração de armazenamento (Bucket not found).';
                    finalTransactionData.attachmentUrl = undefined;
                    finalTransactionData.attachmentFilename = undefined;
                } else {
                    throw uploadError;
                }
            } else {
                finalTransactionData.attachmentUrl = url;
            }
         }
         const { data, error } = await supabase.from('transactions').insert(convertObjectKeys(finalTransactionData, toSnakeCase)).select().single();
         if (error) throw error;
         await addLogEntry(`Adicionada transação: "${data.description}"`, 'create', 'transaction', { id: data.id });
         return { data: convertObjectKeys(data, toCamelCase), warning };
    },
    update: async(transactionId: string, transactionData: Partial<Omit<Transaction, 'id'>>): Promise<{ data: Transaction, warning?: string }> => {
        const { data: oldData, error: findError } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
        if(findError) throw findError;
        
        const cleanedData = cleanTransactionDataForSupabase(transactionData);
        delete (cleanedData as any).payableBillId;
        const finalTransactionData = { ...cleanedData };
        let warning: string | undefined;

        if (finalTransactionData.attachmentUrl && finalTransactionData.attachmentUrl.startsWith('blob:') && finalTransactionData.attachmentFilename) {
            const { url, error: uploadError } = await uploadAttachment(finalTransactionData.attachmentUrl, finalTransactionData.attachmentFilename);
            if (uploadError) {
                if (uploadError.message?.toLowerCase().includes('bucket not found')) {
                    warning = 'O anexo não foi salvo. Erro de configuração de armazenamento (Bucket not found).';
                    finalTransactionData.attachmentUrl = oldData.attachment_url || undefined;
                    finalTransactionData.attachmentFilename = oldData.attachment_filename || undefined;
                } else {
                    throw uploadError;
                }
            } else {
                finalTransactionData.attachmentUrl = url;
            }
        }

        const { data, error } = await supabase.from('transactions').update(convertObjectKeys(finalTransactionData, toSnakeCase)).eq('id', transactionId).select().single();
        if(error) throw error;
        
        const lookupData = await getLookupData();
        const description = generateDetailedUpdateMessage(oldData, data, 'Transação', data.description, lookupData);
        await addLogEntry(description, 'update', 'transaction', oldData);

        // --- SYNC TO BILL ---
        if (data.payable_bill_id) {
            const billUpdatePayload = {
                description: data.description,
                amount: data.amount,
                category_id: data.category_id,
                payee_id: data.payee_id,
                attachment_url: data.attachment_url,
                attachment_filename: data.attachment_filename,
                notes: data.comments,
                paid_date: data.date
            };
            const { error: billUpdateError } = await supabase.from('payable_bills').update(billUpdatePayload).eq('id', data.payable_bill_id);
            if (billUpdateError) throw new Error("Falha ao sincronizar alteração com a conta a pagar.");
        }
        // --- END SYNC ---

        return { data: convertObjectKeys(data, toCamelCase), warning };
    },
    remove: async(transactionId: string): Promise<void> => {
        const { data: oldData, error: findError } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
        if (findError) throw findError;
        const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
        if (error) throw error;
        await addLogEntry(`Removida transação: "${oldData.description}"`, 'delete', 'transaction', oldData);
    }
};

// --- API: ACCOUNTS PAYABLE ---
export const payableBillsApi = {
    getAll: async (): Promise<PayableBill[]> => {
        const { data, error } = await supabase.from('payable_bills').select('*').order('due_date');
        if (error) throw error;
        const bills = convertObjectKeys(data, toCamelCase) as Omit<PayableBill, 'isEstimate'>[];
        return bills.map(bill => {
            const notes = bill.notes || '';
            const isEstimate = notes.includes('[ESTIMATE]');
            const cleanedNotes = notes.replace(/\[ESTIMATE\]\s*/, '').trim();
            const updatedBill: PayableBill = {
                ...bill,
                notes: cleanedNotes,
                isEstimate: isEstimate,
            };
            return updateBillStatusBasedOnDate(updatedBill);
        });
    },
    add: async(billData: Omit<PayableBill, 'id'>): Promise<PayableBill> => {
        const { data, error } = await supabase.from('payable_bills').insert(convertObjectKeys(billData, toSnakeCase)).select().single();
        if(error) throw error;
        const formattedDueDate = new Date(data.due_date + 'T12:00:00Z').toLocaleDateString('pt-BR');
        await addLogEntry(`Adicionada conta a pagar: "${data.description}" (Venc.: ${formattedDueDate})`, 'create', 'bill', {id: data.id});
        return convertObjectKeys(data, toCamelCase);
    },
    update: async(billId: string, billData: Partial<Omit<PayableBill, 'id'>>): Promise<{ data: PayableBill, warning?: string }> => {
        const { data: oldData, error: findError } = await supabase.from('payable_bills').select('*').eq('id', billId).single();
        if (findError) throw findError;

        const finalBillData = { ...billData };
        let warning: string | undefined;

        if (finalBillData.attachmentUrl && finalBillData.attachmentUrl.startsWith('blob:') && finalBillData.attachmentFilename) {
            const { url, error: uploadError } = await uploadAttachment(finalBillData.attachmentUrl, finalBillData.attachmentFilename);
            if (uploadError) {
                if (uploadError.message?.toLowerCase().includes('bucket not found')) {
                    warning = 'O anexo não foi salvo. Erro de configuração de armazenamento (Bucket not found).';
                    finalBillData.attachmentUrl = oldData.attachment_url || undefined;
                    finalBillData.attachmentFilename = oldData.attachment_filename || undefined;
                } else {
                    throw uploadError;
                }
            } else {
                finalBillData.attachmentUrl = url;
            }
        }
        
        const { data, error } = await supabase.from('payable_bills').update(convertObjectKeys(finalBillData, toSnakeCase)).eq('id', billId).select().single();
        if(error) throw error;

        const lookupData = await getLookupData();
        const formattedDueDate = new Date(data.due_date + 'T12:00:00Z').toLocaleDateString('pt-BR');
        const entityName = `${data.description} (Venc.: ${formattedDueDate})`;
        const description = generateDetailedUpdateMessage(oldData, data, 'Conta a Pagar', entityName, lookupData);
        await addLogEntry(description, 'update', 'bill', oldData);
        
        // --- SYNC TO TRANSACTION ---
        if (data.transaction_id) {
            const transactionUpdatePayload = {
                description: data.description,
                amount: data.amount,
                category_id: data.category_id,
                payee_id: data.payee_id,
                attachment_url: data.attachment_url,
                attachment_filename: data.attachment_filename,
                comments: data.notes,
                date: data.paid_date 
            };
            const { error: trxUpdateError } = await supabase.from('transactions').update(transactionUpdatePayload).eq('id', data.transaction_id);
            if (trxUpdateError) throw new Error("Falha ao sincronizar alteração com a transação financeira.");
        }
        // --- END SYNC ---

        return { data: convertObjectKeys(data, toCamelCase), warning };
    },
    remove: async(billId: string): Promise<void> => {
        const { data: oldData, error: findError } = await supabase.from('payable_bills').select('*').eq('id', billId).single();
        if (findError) throw findError;
        const { error } = await supabase.from('payable_bills').delete().eq('id', billId);
        if (error) throw error;
        const formattedDueDate = new Date(oldData.due_date + 'T12:00:00Z').toLocaleDateString('pt-BR');
        await addLogEntry(`Removida conta a pagar: "${oldData.description}" (Venc.: ${formattedDueDate})`, 'delete', 'bill', oldData);
    },
    deleteInstallmentGroup: async(groupId: string): Promise<void> => {
        const { data: oldData, error: findError } = await supabase.from('payable_bills').select('*').eq('installment_group_id', groupId).order('due_date');
        if (findError) throw findError;

        if (!oldData || oldData.length === 0) {
            console.warn(`Attempted to delete non-existent or empty installment group: ${groupId}`);
            await addLogEntry(`Tentativa de remoção de grupo de parcelas (ID: ${groupId}) que já estava vazio ou não existe.`, 'delete', 'bill', []);
            return;
        }

        const { error } = await supabase.from('payable_bills').delete().eq('installment_group_id', groupId);
        if (error) throw error;
        
        const baseDescription = oldData[0].description.replace(/\s\(\d+\/\d+\)$/, '');
        await addLogEntry(`Removido grupo de parcelas "${baseDescription}" (${oldData.length} contas)`, 'delete', 'bill', oldData);
    }
};

export async function addPayableBill(billData: { description: string, payeeId: string, categoryId: string, amount: number, firstDueDate: string, notes: string, paymentType: 'single' | 'installments' | 'monthly', installments?: number, isEstimate?: boolean }) {
    const { paymentType, firstDueDate, installments, isEstimate, notes, ...restOfBillData } = billData;
    
    const finalNotes = isEstimate 
        ? `[ESTIMATE] ${notes || ''}`.trim() 
        : (notes || '').replace(/\[ESTIMATE\]\s*/, '').trim();

    const commonData = { ...restOfBillData, notes: finalNotes };
    
    if (paymentType === 'single') {
        await payableBillsApi.add({ ...commonData, dueDate: firstDueDate, status: 'pending' });
    } else if (paymentType === 'installments' && installments && installments > 1) {
        const groupId = crypto.randomUUID();
        for (let i = 0; i < installments; i++) {
            const dueDate = new Date(firstDueDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            await payableBillsApi.add({ ...commonData, description: `${commonData.description} (${i + 1}/${installments})`, dueDate: dueDate.toISOString().slice(0, 10), status: 'pending', installmentInfo: { current: i + 1, total: installments }, installmentGroupId: groupId });
        }
    } else if (paymentType === 'monthly') {
        const recurringId = crypto.randomUUID();
        for (let i = 0; i < 12; i++) { // Create for 1 year
            const dueDate = new Date(firstDueDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            await payableBillsApi.add({ ...commonData, dueDate: dueDate.toISOString().slice(0, 10), status: 'pending', recurringId });
        }
    }
}

export async function payBill(billId: string, paymentData: { accountId: string, paidAmount: number, paymentDate: string, attachmentUrl?: string, attachmentFilename?: string }): Promise<{ warning?: string }> {
    const { data: bill } = await supabase.from('payable_bills').select('*').eq('id', billId).single();
    if (!bill) throw new Error("Bill not found");

    const { data: transaction, warning } = await transactionsApi.add({ 
        description: `Pagamento: ${bill.description}`, 
        amount: paymentData.paidAmount, 
        date: new Date(paymentData.paymentDate+'T12:00:00Z').toISOString(), 
        type: 'expense', 
        accountId: paymentData.accountId, 
        categoryId: bill.category_id, 
        payeeId: bill.payee_id, 
        attachmentUrl: paymentData.attachmentUrl, 
        attachmentFilename: paymentData.attachmentFilename 
    });
    
    await payableBillsApi.update(billId, { status: 'paid', paidDate: transaction.date, transactionId: transaction.id, amount: transaction.amount, attachmentUrl: transaction.attachmentUrl, attachmentFilename: transaction.attachmentFilename });
    return { warning };
}

export const getPayableBillsForLinking = async (): Promise<PayableBill[]> => {
    // Fetches bills that are 'pending', 'overdue', OR 'paid' but not yet linked to a transaction.
    const { data, error } = await supabase
        .from('payable_bills')
        .select('*')
        .or('status.in.(pending,overdue),and(status.eq.paid,transaction_id.is.null)');

    if (error) throw error;
    return convertObjectKeys(data, toCamelCase);
};

export const linkExpenseToBill = async (billId: string, transactionId: string) => {
    const { data: trxData, error: trxFindError } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
    if (trxFindError || !trxData) throw new Error("Transaction not found");
    const trx = convertObjectKeys(trxData, toCamelCase);

    // Update the bill to be 'paid' and synced with the transaction's data
    await payableBillsApi.update(billId, { 
        status: 'paid', 
        paidDate: trx.date, 
        transactionId,
        amount: trx.amount,
        description: trx.description,
        categoryId: trx.categoryId,
        payeeId: trx.payeeId,
        notes: trx.comments,
        attachmentUrl: trx.attachmentUrl,
        attachmentFilename: trx.attachmentFilename
    });

    // Update the transaction to be linked to the bill
    await transactionsApi.update(transactionId, { payableBillId: billId });
};

export const getUnlinkedExpenses = async (): Promise<Transaction[]> => {
    const { data: linkedIdsData, error: linkedIdsError } = await supabase
        .from('payable_bills')
        .select('transaction_id')
        .not('transaction_id', 'is', null);

    if (linkedIdsError) throw linkedIdsError;
    const linkedTransactionIds = linkedIdsData.map(item => item.transaction_id);

    let query = supabase
        .from('transactions')
        .select('*')
        .eq('type', 'expense')
        .order('date', { ascending: false })
        .limit(50);
    
    if (linkedTransactionIds.length > 0) {
        query = query.not('id', 'in', `(${linkedTransactionIds.join(',')})`);
    }

    const { data, error } = await query;
    if(error) throw error;
    return convertObjectKeys(data, toCamelCase);
};

// --- API: REPORTS & STATS ---
export const getDashboardStats = async (): Promise<Stats> => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();

    const [members, payments, expenses, accountsWithBalance, futureIncome, pendingBills] = await Promise.all([
        getMembers(),
        supabase.from('payments').select('amount').gte('payment_date', startOfMonth).lte('payment_date', endOfMonth),
        supabase.from('transactions').select('amount').eq('type', 'expense').gte('date', startOfMonth).lte('date', endOfMonth),
        getAccountsWithBalance(),
        getFutureIncomeSummary(),
        supabase.from('payable_bills').select('amount').in('status', ['pending', 'overdue'])
    ]);

    if (payments.error) throw payments.error;
    if (expenses.error) throw expenses.error;
    if (pendingBills.error) throw pendingBills.error;
    
    return {
        totalMembers: members.filter(m => m.activityStatus === 'Ativo').length,
        onTime: members.filter(m => m.paymentStatus === PaymentStatus.EmDia || m.paymentStatus === PaymentStatus.Adiantado).length,
        overdue: members.filter(m => m.paymentStatus === PaymentStatus.Atrasado).length,
        monthlyRevenue: payments.data.reduce((sum, p) => sum + p.amount, 0),
        monthlyExpenses: expenses.data.reduce((sum, t) => sum + t.amount, 0),
        currentBalance: accountsWithBalance.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0),
        projectedIncome: futureIncome.totalAmount,
        projectedExpenses: pendingBills.data.reduce((sum, b) => sum + b.amount, 0),
    };
};

export const getHistoricalMonthlySummary = async (): Promise<{ month: string, income: number, expense: number }[]> => {
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), 1);

    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('date, type, amount')
        .gte('date', oneYearAgo.toISOString());

    if (error) throw error;

    const monthlySummary: Record<string, { income: number, expense: number }> = {};

    for (let i = 0; i < 12; i++) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlySummary[monthKey] = { income: 0, expense: 0 };
    }

    transactions.forEach(trx => {
        const date = new Date(trx.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlySummary[monthKey]) {
            if (trx.type === 'income') {
                monthlySummary[monthKey].income += trx.amount;
            } else {
                monthlySummary[monthKey].expense += trx.amount;
            }
        }
    });

    return Object.entries(monthlySummary)
        .map(([month, values]) => ({ month, ...values }))
        .sort((a, b) => a.month.localeCompare(b.month)); // Sort oldest to newest for the chart
};


export const getOverdueReport = async (): Promise<Member[]> => {
    const members = await getMembers();
    return members.filter(m => m.paymentStatus === PaymentStatus.Atrasado && m.activityStatus === 'Ativo');
};

export const getRevenueReport = async (startDate: string, endDate: string) => {
    const { data, error } = await supabase.from('payments').select('*, members(name)').gte('payment_date', startDate).lte('payment_date', endDate + 'T23:59:59Z');
    if (error) throw error;
    const payments = data.map(p => ({ ...p, memberName: (p.members as any).name, members: undefined }));
    return {
        totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
        payments: convertObjectKeys(payments, toCamelCase),
    };
};

export const getFinancialReport = async (filters: any): Promise<Transaction[]> => {
    let query = supabase.from('transactions').select('*');
    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate) query = query.lte('date', filters.endDate + 'T23:59:59Z');
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
    if (filters.projectId) query = query.eq('project_id', filters.projectId);
    if (filters.accountIds?.length) query = query.in('account_id', filters.accountIds);
    if (filters.tagIds?.length) query = query.contains('tag_ids', filters.tagIds);
    
    const { data, error } = await query.order('date', { ascending: false });
    if(error) throw error;
    return convertObjectKeys(data, toCamelCase);
};

export const getAccountHistory = async (accountId: string, filters: any): Promise<{ transactions: Transaction[], openingBalance: number, closingBalance: number }> => {
    // 1. Get account initial balance
    const { data: account, error: accError } = await supabase.from('accounts').select('initial_balance').eq('id', accountId).single();
    if (accError) throw accError;
    const initialBalance = account.initial_balance;

    // 2. Calculate opening balance (transactions before start date)
    const { data: previousTransactions, error: prevTrxError } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('account_id', accountId)
        .lt('date', filters.startDate);

    if (prevTrxError) throw prevTrxError;

    const openingBalance = previousTransactions.reduce((balance, trx) => {
        return balance + (trx.type === 'income' ? trx.amount : -trx.amount);
    }, initialBalance);

    // 3. Fetch period transactions (sorted ascending)
    let periodQuery = supabase
        .from('transactions')
        .select('*')
        .eq('account_id', accountId);

    if (filters.startDate) periodQuery = periodQuery.gte('date', filters.startDate);
    if (filters.endDate) periodQuery = periodQuery.lte('date', filters.endDate + 'T23:59:59Z');
    if (filters.type) periodQuery = periodQuery.eq('type', filters.type);
    if (filters.categoryId) periodQuery = periodQuery.eq('category_id', filters.categoryId);

    const { data: periodTransactionsData, error: periodTrxError } = await periodQuery.order('date', { ascending: true });
    if (periodTrxError) throw periodTrxError;

    const periodTransactions = convertObjectKeys(periodTransactionsData, toCamelCase) as Transaction[];

    // 4. Calculate running balance
    let currentBalance = openingBalance;
    const transactionsWithBalance = periodTransactions.map(trx => {
        currentBalance += (trx.type === 'income' ? trx.amount : -trx.amount);
        return { ...trx, runningBalance: currentBalance };
    });

    const closingBalance = currentBalance;

    // 5. Return reversed for display
    return {
        transactions: transactionsWithBalance.reverse(), // Newest first
        openingBalance,
        closingBalance
    };
};

export const getDREData = async (startDate: string, endDate: string) => {
    const allTransactions = await getFinancialReport({ startDate, endDate });
    const allCategories = await categoriesApi.getAll();
    const categoryMap = new Map(allCategories.map(c => [c.id, c]));

    const createSummary = (type: 'income' | 'expense') => {
        const details = allTransactions
            .filter(t => t.type === type && categoryMap.get(t.categoryId)?.name !== 'Mensalidades')
            .reduce((acc, t) => {
                const categoryName = categoryMap.get(t.categoryId)?.name || 'Sem Categoria';
                acc[categoryName] = (acc[categoryName] || 0) + t.amount;
                return acc;
            }, {} as Record<string, number>);

        return {
            total: Object.values(details).reduce((sum, amount) => sum + amount, 0),
            details: Object.entries(details).map(([categoryName, total]) => ({ categoryName, total })),
        };
    };

    const grossRevenueDetails = allTransactions
        .filter(t => t.type === 'income' && categoryMap.get(t.categoryId)?.name === 'Mensalidades')
        .reduce((acc, t) => {
            const categoryName = "Mensalidades";
            acc[categoryName] = (acc[categoryName] || 0) + t.amount;
            return acc;
        }, {} as Record<string, number>);
    
    const grossRevenue = {
        total: Object.values(grossRevenueDetails).reduce((sum, amount) => sum + amount, 0),
        details: Object.entries(grossRevenueDetails).map(([categoryName, total]) => ({ categoryName, total })),
    };

    const otherIncome = createSummary('income');
    const operatingExpenses = createSummary('expense');
    const netResult = grossRevenue.total + otherIncome.total - operatingExpenses.total;

    return { grossRevenue, otherIncome, operatingExpenses, netResult };
};

export const getFutureIncomeSummary = async () => {
    const { data, error } = await supabase.from('transactions').select('amount').eq('type', 'income').gt('date', new Date().toISOString());
    if(error) throw error;
    return {
        count: data.length,
        totalAmount: data.reduce((sum, t) => sum + t.amount, 0),
    };
};

export const getFutureIncomeTransactions = async (): Promise<Transaction[]> => {
    const { data, error } = await supabase.from('transactions').select('*').eq('type', 'income').gt('date', new Date().toISOString()).order('date');
    if (error) throw error;
    return convertObjectKeys(data, toCamelCase);
};

// --- API: LOGS ---
export const getLogs = async (): Promise<LogEntry[]> => {
    const { data, error } = await supabase.from('logs').select('*').order('timestamp', { ascending: false }).limit(100);
    if(error) throw error;
    return convertObjectKeys(data, toCamelCase);
};

export const undoLogAction = async (logId: string) => {
    const { data: log, error: logError } = await supabase.from('logs').select('*').eq('id', logId).single();
    if (logError) throw logError;

    const { action_type: actionType, entity_type: entityType, undo_data: undoData } = log;
    const tableName = `${entityType}s`;

    if (actionType === 'create') {
        const { error } = await supabase.from(tableName).delete().eq('id', undoData.id);
        if (error) throw error;
    } else if (actionType === 'delete') {
        const { error } = await supabase.from(tableName).insert(undoData);
        if (error) throw error;
    } else if (actionType === 'update') {
        const { error } = await supabase.from(tableName).update(undoData).eq('id', undoData.id);
        if (error) throw error;
    } else {
        throw new Error('Unknown action type');
    }

    await supabase.from('logs').update({ description: `[DESFEITO] ${log.description}` }).eq('id', logId);
};

// --- API: CHATBOT ---
export const getChatbotContextData = async () => {
    const [
        members,
        transactions,
        accounts,
        categories,
        payees,
        projects,
        tags,
        bills,
        stats
    ] = await Promise.all([
        getMembers(),
        transactionsApi.getAll(),
        getAccountsWithBalance(),
        categoriesApi.getAll(),
        payeesApi.getAll(),
        projectsApi.getAll(),
        tagsApi.getAll(),
        payableBillsApi.getAll(),
        getDashboardStats()
    ]);

    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    const payeeMap = new Map(payees.map(p => [p.id, p.name]));
    const projectMap = new Map(projects.map(p => [p.id, p.name]));
    const tagMap = new Map(tags.map(t => [t.id, t.name]));

    return {
        resumoGeral: {
            ...stats,
            dataAtual: new Date().toLocaleDateString('pt-BR')
        },
        membros: members.map(({ name, email, phone, birthday, monthlyFee, activityStatus, paymentStatus, totalDue }) => ({ 
            name, 
            email, 
            phone, 
            birthday, 
            valorMensalidade: monthlyFee, 
            activityStatus, 
            paymentStatus, 
            totalDue 
        })),
        ultimasTransacoes: transactions.slice(0, 100).map(t => ({
            descricao: t.description,
            valor: t.amount,
            data: t.date,
            tipo: t.type,
            categoria: categoryMap.get(t.categoryId) || 'Não categorizado',
            beneficiario: t.payeeId ? payeeMap.get(t.payeeId) : undefined,
            projeto: t.projectId ? projectMap.get(t.projectId) : undefined,
            tags: t.tagIds ? t.tagIds.map(tagId => tagMap.get(tagId)).filter(Boolean) : undefined,
            comprovanteUrl: t.attachmentUrl || undefined,
        })),
        contasBancarias: accounts.map(({ name, currentBalance }) => ({ name, saldoAtual: currentBalance })),
        contasAPagarAbertas: bills.filter(b => b.status !== 'paid').map(({ description, amount, dueDate, status }) => ({ description, amount, dueDate, status })),
        listaDeCategorias: categories.map(c => ({ nome: c.name, tipo: c.type })),
        listaDeBeneficiarios: payees.map(p => p.name),
        listaDeProjetos: projects.map(p => p.name),
        listaDeTags: tags.map(t => t.name),
    };
};