import { createClient } from '@supabase/supabase-js';
import { Member, Payment, PaymentStatus, Stats, OverdueMonth, Account, Category, Tag, Payee, Transaction, Project, PayableBill, LogEntry, ActionType, EntityType, Leave, SortOption } from '../types';

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
    isExempt: 'Isenção',
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
    memberId: 'Membro',
    startDate: 'Data de Início',
    endDate: 'Data Final',
    reason: 'Motivo',
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
        case 'startDate':
        case 'endDate':
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
    const newDataCamel = convertObjectKeys(newData, toSnakeCase);

    const allKeys = new Set([...Object.keys(oldDataCamel), ...Object.keys(newDataCamel)]);

    const ignoreFields = ['id', 'created_at', 'updated_at', 'transactionId', 'payableBillId', 'recurringId', 'installmentGroupId', 'installmentInfo', 'attachmentUrl', 'attachmentFilename', 'overdueMonthsCount', 'overdueMonths', 'totalDue', 'paymentStatus', 'undoData', 'currentBalance', 'password', 'onLeave'];

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
const getUTCDateFromStr = (dateStr: string): Date => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr.slice(0, 10))) {
        return new Date(NaN); // Retorna uma data inválida
    }
    const datePart = dateStr.slice(0, 10);
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
};

const isDuringLeave = (date: Date, leaves: Leave[]): boolean => {
    return leaves.some(leave => {
        const startDate = getUTCDateFromStr(leave.startDate);
        const endDate = leave.endDate ? getUTCDateFromStr(leave.endDate) : null;

        if (isNaN(startDate.getTime())) return false;

        if (endDate) {
            if (isNaN(endDate.getTime())) return false;
            const endOfDay = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999));
            return date >= startDate && date <= endOfDay;
        }
        return date >= startDate;
    });
};

const isCurrentlyOnLeave = (leaves: Leave[]): boolean => {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    
    return leaves.some(leave => {
        const startDate = getUTCDateFromStr(leave.startDate);
        const endDate = leave.endDate ? getUTCDateFromStr(leave.endDate) : null;
        
        if (isNaN(startDate.getTime())) return false;

        if (endDate) {
            if (isNaN(endDate.getTime())) return false;
            const endOfDay = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate(), 23, 59, 59, 999));
            return todayUTC >= startDate && todayUTC <= endOfDay;
        }
        return todayUTC >= startDate;
    });
};


const calculateMemberDetails = (member: any, memberPayments: Payment[], memberLeaves: Leave[]): Member => {
    const currentlyOnLeave = isCurrentlyOnLeave(memberLeaves);
    const memberWithDefaults = {
        ...member,
        onLeave: currentlyOnLeave,
    };

    if (memberWithDefaults.onLeave) {
        return {
            ...memberWithDefaults,
            paymentStatus: PaymentStatus.EmLicenca,
            overdueMonthsCount: 0,
            overdueMonths: [],
            totalDue: 0,
        };
    }

    if (memberWithDefaults.isExempt) {
        return {
            ...memberWithDefaults,
            paymentStatus: PaymentStatus.Isento,
            overdueMonthsCount: 0,
            overdueMonths: [],
            totalDue: 0,
        };
    }
    
    const paidMonths = new Set(memberPayments.map(p => p.referenceMonth));
    const overdueMonths: OverdueMonth[] = [];
    const today = new Date();
    const firstOfCurrentMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    let currentDate = getUTCDateFromStr(memberWithDefaults.joinDate);

    if (isNaN(currentDate.getTime())) {
        console.warn(`Member "${memberWithDefaults.name}" (ID: ${memberWithDefaults.id}) has an invalid joinDate: "${memberWithDefaults.joinDate}". Skipping overdue calculation.`);
        return {
            ...memberWithDefaults,
            paymentStatus: memberWithDefaults.isExempt ? PaymentStatus.Isento : PaymentStatus.EmDia,
            overdueMonthsCount: 0,
            overdueMonths: [],
            totalDue: 0,
        };
    }

    currentDate.setUTCDate(1); // Garante que a verificação comece no primeiro dia do mês de adesão.
    
    const finalStatuses = ['Desligado', 'Arquivado'];
    if (finalStatuses.includes(memberWithDefaults.activityStatus)) {
        while (currentDate < firstOfCurrentMonth) {
            const monthStr = currentDate.toISOString().slice(0, 7);
            if (!paidMonths.has(monthStr) && !isDuringLeave(currentDate, memberLeaves)) {
                overdueMonths.push({ month: monthStr, amount: memberWithDefaults.monthlyFee });
            }
            currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
        }
        
        let paymentStatus = PaymentStatus.Desligado;
        if (memberWithDefaults.activityStatus === 'Arquivado') {
            paymentStatus = PaymentStatus.Arquivado;
        }

        return {
            ...memberWithDefaults,
            paymentStatus,
            overdueMonthsCount: overdueMonths.length,
            overdueMonths,
            totalDue: overdueMonths.reduce((sum, item) => sum + item.amount, 0),
        };
    }
    
    while (currentDate <= firstOfCurrentMonth) {
        const monthStr = currentDate.toISOString().slice(0, 7);
        if (!paidMonths.has(monthStr) && !isDuringLeave(currentDate, memberLeaves)) {
            overdueMonths.push({ month: monthStr, amount: memberWithDefaults.monthlyFee });
        }
        currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
    }

    const lastPaidMonth = memberPayments.length > 0 ? memberPayments.map(p => p.referenceMonth).sort().pop()! : '0';
    const currentMonthStr = today.toISOString().slice(0, 7);

    let paymentStatus: PaymentStatus;
    if (overdueMonths.length > 0) {
        paymentStatus = PaymentStatus.Atrasado;
    } else if (lastPaidMonth > currentMonthStr) {
        paymentStatus = PaymentStatus.Adiantado;
    } else {
        paymentStatus = PaymentStatus.EmDia;
    }
    
    return {
        ...memberWithDefaults,
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
        const lookupData = await getLookupData();
        const description = generateDetailedUpdateMessage(oldData, data, entityLabel, nameAccessor(newItem), lookupData);
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
        const lookupData = await getLookupData();
        const description = generateDetailedUpdateMessage(oldData, data, 'Conta', data.name, lookupData);
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

interface MemberFilters {
  searchTerm?: string;
  status?: string;
  activity?: string;
  sort?: SortOption;
}

// --- API: MEMBERS & PAYMENTS ---
export const getMembers = async (filters?: MemberFilters): Promise<Member[]> => {
    // 1. Build members query
    let membersQuery = supabase.from('members').select('*');

    if (filters?.searchTerm) {
        membersQuery = membersQuery.ilike('name', `%${filters.searchTerm}%`);
    }

    // 'OnLeave' is calculated, so we handle it later.
    if (filters?.activity && filters.activity !== 'all' && filters.activity !== 'OnLeave') {
        membersQuery = membersQuery.eq('activity_status', filters.activity);
    } else {
        // Default to not showing archived unless explicitly requested by filter 'Arquivado'
        if (!filters?.activity || filters.activity !== 'Arquivado') {
             membersQuery = membersQuery.neq('activity_status', 'Arquivado');
        }
    }
    
    // Sorting
    if (filters?.sort) {
        const sortField = 'name';
        const ascending = filters.sort === 'name_asc';
        membersQuery = membersQuery.order(sortField, { ascending });
    } else {
        membersQuery = membersQuery.order('name', { ascending: true }); // Default sort
    }

    const { data: membersData, error: membersError } = await membersQuery;
    if (membersError) throw membersError;

    if (!membersData || membersData.length === 0) return [];

    // 2. Fetch related data only for the filtered members
    const memberIds = membersData.map(m => m.id);

    const paymentsPromise = supabase.from('payments').select('*').in('member_id', memberIds);
    // Gracefully handle leaves fetching so it doesn't crash the main members list if it fails.
    // FIX: Replaced .then().catch() with an async IIFE to correctly handle the PromiseLike type returned by Supabase, which was causing a TypeScript error.
    const leavesPromise = (async () => {
        try {
            const response = await supabase.from('leaves').select('*').in('member_id', memberIds);
            // Handle Supabase client errors that resolve (e.g., table not found)
            if (response.error && response.error.code === 'PGRST205') {
              console.warn('Supabase warning: "leaves" table not found. Proceeding without leave data.');
              return { data: [], error: null };
            }
            return response;
        } catch (error) {
            // Handle promise rejections (e.g., network error)
            console.error('Failed to fetch leaves, proceeding without leave data:', error);
            return { data: [], error }; // Return an object that won't crash destructuring
        }
    })();

    const [paymentsRes, leavesRes] = await Promise.all([paymentsPromise, leavesPromise]);

    const { data: paymentsData, error: paymentsError } = paymentsRes;
    if (paymentsError) throw paymentsError; // Payments are essential

    // leavesRes will always be an object with data and error properties
    const { data: leavesData, error: leavesError } = leavesRes;
    if (leavesError) {
        // Log the error but don't throw, allowing the app to function without leave data.
        console.error('Non-critical error fetching leaves:', leavesError.message);
    }

    // 3. Process data client-side (this part is unavoidable without DB functions)
    const rawMembers = convertObjectKeys(membersData, toCamelCase);
    const rawPayments = convertObjectKeys(paymentsData, toCamelCase);
    const rawLeaves = convertObjectKeys(leavesData || [], toCamelCase);

    const leavesByMember = new Map<string, Leave[]>();
    rawLeaves.forEach((leave: Leave) => {
        if (!leavesByMember.has(leave.memberId)) {
            leavesByMember.set(leave.memberId, []);
        }
        leavesByMember.get(leave.memberId)!.push(leave);
    });

    const detailedMembers = rawMembers.map((m: any) => {
        const memberPayments = rawPayments.filter((p: Payment) => p.memberId === m.id);
        const memberLeaves = leavesByMember.get(m.id) || [];
        return calculateMemberDetails(m, memberPayments, memberLeaves);
    });

    // 4. Final client-side filtering for calculated fields
    const filteredDetailedMembers = !filters
        ? detailedMembers
        : detailedMembers.filter(member => {
            if (filters.activity === 'OnLeave' && !member.onLeave) {
                return false;
            }
            if (filters.status && filters.status !== 'all' && member.paymentStatus !== filters.status) {
                return false;
            }
            return true;
        });
        
    // Return members without the heavy details for faster initial load
    return filteredDetailedMembers.map(member => {
      const { overdueMonths, totalDue, ...basicMemberData } = member;
      return basicMemberData as Member;
    });
};

export const getMemberOverdueDetails = async (memberId: string): Promise<{ overdueMonths: OverdueMonth[], totalDue: number }> => {
    const member = await getMemberById(memberId);
    if (!member) {
        throw new Error('Member not found');
    }
    return {
        overdueMonths: member.overdueMonths || [],
        totalDue: member.totalDue || 0,
    };
};


export const getMemberById = async (id: string): Promise<Member | undefined> => {
    const { data, error } = await supabase.from('members').select('*').eq('id', id).single();
    if (error) { if(error.code === 'PGRST116') return undefined; throw error; }
    
    const [rawPayments, rawLeaves] = await Promise.all([
        getPaymentsByMember(id),
        leavesApi.getByMember(id)
    ]);
    
    const rawMember = convertObjectKeys(data, toCamelCase);
    
    return calculateMemberDetails(rawMember, rawPayments, rawLeaves);
};

export const addMember = async (memberData: Omit<Member, 'id' | 'paymentStatus' | 'overdueMonthsCount' | 'overdueMonths' | 'totalDue' | 'onLeave'>): Promise<Member> => {
    const { data, error } = await supabase.from('members').insert(convertObjectKeys(memberData, toSnakeCase)).select().single();
    if (error) throw error;
    const newMember = convertObjectKeys(data, toCamelCase);
    await addLogEntry(`Adicionado novo membro: "${newMember.name}"`, 'create', 'member', { id: newMember.id });
    return calculateMemberDetails(newMember, [], []);
};

export const updateMember = async (memberId: string, memberData: Partial<Omit<Member, 'id'>>): Promise<Member> => {
    const { data: oldData, error: findError } = await supabase.from('members').select('*').eq('id', memberId).single();
    if (findError) throw findError;
    const { data, error } = await supabase.from('members').update(convertObjectKeys(memberData, toSnakeCase)).eq('id', memberId).select().single();
    if (error) throw error;
    
    const lookupData = await getLookupData();
    const description = generateDetailedUpdateMessage(oldData, data, 'Membro', data.name, lookupData);
    await addLogEntry(description, 'update', 'member', oldData);
    
    const [rawPayments, rawLeaves] = await Promise.all([
        getPaymentsByMember(memberId),
        leavesApi.getByMember(memberId)
    ]);
    return calculateMemberDetails(convertObjectKeys(data, toCamelCase), rawPayments, rawLeaves);
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

// FIX: Added a function to fetch multiple payments associated with a transaction ID.
export const getPaymentsByTransaction = async (transactionId: string): Promise<Payment[]> => {
    const { data, error } = await supabase.from('payments').select('*').eq('transaction_id', transactionId);
    if (error) throw error;
    return convertObjectKeys(data, toCamelCase);
};

export const getPaymentDetails = async (paymentId: string): Promise<{ payment: Payment, transaction: Transaction | null } | null> => {
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
        // This is a historical payment, return it without a transaction
        return {
            payment: convertObjectKeys(paymentData, toCamelCase),
            transaction: null,
        };
    }

    const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', paymentData.transaction_id)
        .single();

    // If transaction is not found for some reason, we can still allow editing the payment part.
    if (transactionError || !transactionData) {
        console.warn('Could not find transaction for payment:', transactionError);
        return {
            payment: convertObjectKeys(paymentData, toCamelCase),
            transaction: null,
        };
    }

    return {
        payment: convertObjectKeys(paymentData, toCamelCase),
        transaction: convertObjectKeys(transactionData, toCamelCase),
    };
};

export const updatePaymentAndTransaction = async (
    paymentId: string,
    transactionId: string | null | undefined,
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
    const { data: oldPaymentData, error: findPayErr } = await supabase.from('payments').select('*').eq('id', paymentId).single();
    if(findPayErr) throw findPayErr;

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
    
    const paymentUpdatePayload = {
        payment_date: new Date(formData.paymentDate + 'T12:00:00Z').toISOString(),
        comments: formData.comments,
        attachment_url: finalAttachmentUrl,
        attachment_filename: finalAttachmentFilename,
    };

    const { data: updatedPayment, error: updatePayErr } = await supabase.from('payments').update(paymentUpdatePayload).eq('id', paymentId).select().single();
    if (updatePayErr) throw updatePayErr;

    const lookupData = await getLookupData();

    if (transactionId) {
        const { data: oldTransactionData, error: findTransactionError } = await supabase.from('transactions').select('*').eq('id', transactionId).single();
        if (findTransactionError) throw findTransactionError;

        const transactionUpdatePayload = {
            date: new Date(formData.paymentDate + 'T12:00:00Z').toISOString(),
            account_id: formData.accountId,
            comments: formData.comments,
            attachment_url: finalAttachmentUrl,
            attachment_filename: finalAttachmentFilename,
        };
        const { data: updatedTransaction, error: updateTrxErr } = await supabase.from('transactions').update(transactionUpdatePayload).eq('id', transactionId).select().single();
        if (updateTrxErr) throw updateTrxErr;
        
        const trxDescription = generateDetailedUpdateMessage(oldTransactionData, updatedTransaction, 'Transação de Pagamento', updatedTransaction.description, lookupData);
        await addLogEntry(trxDescription, 'update', 'transaction', oldTransactionData);
    }
    
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
    paymentData: Pick<Payment, 'memberId' | 'referenceMonth' | 'attachmentUrl' | 'attachmentFilename'>,
    isHistoricalPayment: boolean = false
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

    if (isHistoricalPayment) {
        const { data: payData, error: payError } = await supabase.from('payments').insert({
            member_id: paymentData.memberId,
            amount: transactionData.amount,
            payment_date: transactionData.date,
            reference_month: paymentData.referenceMonth,
            comments: transactionData.comments,
            transaction_id: null,
            attachment_url: finalAttachmentUrl,
            attachment_filename: finalAttachmentFilename
        }).select().single();
        if (payError) throw payError;
        await addLogEntry(`Registrado pagamento histórico para ref. ${paymentData.referenceMonth}`, 'create', 'payment', { id: payData.id });
    } else {
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
    }
    
    return { warning };
};

const handleLeaveSchemaError = (error: any) => {
    // Supabase error for missing table is PGRST205
    // Postgres error for missing column is 42703
    if (error.code === 'PGRST205' || (error.code === '42703' && error.message.includes('on_leave'))) {
         console.error('Database schema is out of date. The "Leave of Absence" feature requires the "leaves" table and the "on_leave" column in the "members" table.', error);
         throw new Error('A funcionalidade de licenças não está configurada no banco de dados.');
    }
    throw error;
};

export const leavesApi = {
    getByMember: async (memberId: string): Promise<Leave[]> => {
        const { data, error } = await supabase
            .from('leaves')
            .select('*')
            .eq('member_id', memberId)
            .order('start_date', { ascending: false });
        if (error) {
            if (error.code === 'PGRST205') {
                console.warn('Supabase warning: "leaves" table not found. The "Leave of Absence" feature will be disabled.');
                return [];
            }
            throw error;
        }
        return convertObjectKeys(data, toCamelCase);
    },
    add: async (leaveData: Omit<Leave, 'id'>): Promise<Leave> => {
        try {
            const { error: memberUpdateError } = await supabase.from('members').update({ on_leave: true }).eq('id', leaveData.memberId);
            if (memberUpdateError) throw memberUpdateError;

            const payload = convertObjectKeys(leaveData, toSnakeCase);
            const { data, error } = await supabase.from('leaves').insert(payload).select().single();
            if (error) throw error;
            
            const newLeave = convertObjectKeys(data, toCamelCase);
            const lookupData = await getLookupData();
            const memberName = lookupData.members.get(newLeave.memberId) || 'desconhecido';
            const startDate = new Date(newLeave.startDate + 'T12:00:00Z').toLocaleDateString('pt-BR');
            await addLogEntry(`Registrada licença para "${memberName}" a partir de ${startDate}`, 'create', 'leave', { id: newLeave.id });
            return newLeave;
        } catch (error: any) {
            handleLeaveSchemaError(error);
            return null as never; // Should not be reached
        }
    },
    update: async (leaveId: string, leaveData: Partial<Omit<Leave, 'id' | 'memberId'>>): Promise<Leave> => {
        try {
            const { data: oldData, error: findError } = await supabase.from('leaves').select('*').eq('id', leaveId).single();
            if (findError) throw findError;
            
            const payload = convertObjectKeys(leaveData, toSnakeCase);
            const { data, error } = await supabase.from('leaves').update(payload).eq('id', leaveId).select().single();
            if (error) throw error;

            const updatedLeave = convertObjectKeys(data, toCamelCase) as Leave;

            if (updatedLeave.endDate) {
                const { data: otherLeaves, error: otherLeavesError } = await supabase.from('leaves').select('id').eq('member_id', updatedLeave.memberId).is('end_date', null);
                if (otherLeavesError) throw otherLeavesError;

                if (!otherLeaves || otherLeaves.length === 0) {
                    const { error: memberUpdateError } = await supabase.from('members').update({ on_leave: false }).eq('id', updatedLeave.memberId);
                    if (memberUpdateError) throw memberUpdateError;
                }
            } else {
                const { error: memberUpdateError } = await supabase.from('members').update({ on_leave: true }).eq('id', updatedLeave.memberId);
                if (memberUpdateError) throw memberUpdateError;
            }

            const lookupData = await getLookupData();
            const memberName = lookupData.members.get(updatedLeave.memberId) || 'desconhecido';
            const startDate = new Date(updatedLeave.startDate + 'T12:00:00Z').toLocaleDateString('pt-BR');
            const oldEndDate = oldData.end_date ? `"${new Date(oldData.end_date + 'T12:00:00Z').toLocaleDateString('pt-BR')}"` : '"ativa"';
            const newEndDate = updatedLeave.endDate ? `"${new Date(updatedLeave.endDate + 'T12:00:00Z').toLocaleDateString('pt-BR')}"` : '"ativa"';
            
            let description = `Licença de "${memberName}" (início em ${startDate}) foi atualizada.`;
            if (oldEndDate !== newEndDate) {
                description += ` Data Final alterada de ${oldEndDate} para ${newEndDate}.`;
            }
            await addLogEntry(description, 'update', 'leave', oldData);
            return updatedLeave;
        } catch (error: any) {
            handleLeaveSchemaError(error);
            return null as never; // Should not be reached
        }
    },
    remove: async (leaveId: string): Promise<void> => {
        try {
            const { data: oldData, error: findError } = await supabase.from('leaves').select('*').eq('id', leaveId).single();
            if (findError) throw findError;
            
            const { error } = await supabase.from('leaves').delete().eq('id', leaveId);
            if (error) throw error;
            
            const { data: otherLeaves, error: otherLeavesError } = await supabase.from('leaves').select('id').eq('member_id', oldData.member_id).is('end_date', null);
            if (otherLeavesError) throw otherLeavesError;

            if (!otherLeaves || otherLeaves.length === 0) {
                const { error: memberUpdateError } = await supabase.from('members').update({ on_leave: false }).eq('id', oldData.member_id);
                if (memberUpdateError) throw memberUpdateError;
            }

            const lookupData = await getLookupData();
            const memberName = lookupData.members.get(oldData.member_id) || 'desconhecido';
            const startDate = new Date(oldData.start_date + 'T12:00:00Z').toLocaleDateString('pt-BR');
            await addLogEntry(`Removida licença de "${memberName}" (início em ${startDate})`, 'delete', 'leave', oldData);
        } catch (error: any) {
            handleLeaveSchemaError(error);
        }
    },
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
    getRecent: async (limit: number = 30): Promise<Transaction[]> => {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false })
            .limit(limit);
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

        await supabase.from('payments').delete().eq('transaction_id', transactionId);
    
        if (oldData.payable_bill_id) {
            const { data: billToUpdate, error: billError } = await supabase.from('payable_bills').select('*').eq('id', oldData.payable_bill_id).single();
            if (billError) {
                console.error("Could not find linked bill to update:", billError);
            } else {
                const today = new Date(); 
                today.setHours(0,0,0,0);
                const dueDate = new Date(billToUpdate.due_date + 'T12:00:00Z');
                const newStatus = dueDate < today ? 'overdue' : 'pending';

                const { error: updateError } = await supabase.from('payable_bills').update({
                    status: newStatus,
                    paid_date: null,
                    transaction_id: null,
                    attachment_url: null, 
                    attachment_filename: null
                }).eq('id', oldData.payable_bill_id);

                if (updateError) {
                    console.error("Failed to revert linked bill status:", updateError);
                } else {
                    await addLogEntry(`Status da conta "${billToUpdate.description}" revertido para "${newStatus}" devido à exclusão da transação de pagamento.`, 'update', 'bill', { ...billToUpdate, status: newStatus, paid_date: null, transaction_id: null });
                }
            }
        }
        
        const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
        if (error) throw error;
        await addLogEntry(`Removida transação: "${oldData.description}"`, 'delete', 'transaction', oldData);
    },
    setMultiplePaymentLinks: async (
        transactionId: string,
        links: { memberId: string; referenceMonth: string; amount: number }[],
        paymentDate: string
    ): Promise<void> => {
        // 1. Unlink all previously associated payments
        const { data: oldLinks, error: findError } = await supabase.from('payments').select('*').eq('transaction_id', transactionId);
        if (findError) throw findError;
        
        const { error: unlinkError } = await supabase.from('payments').update({ transaction_id: null, paid_date: null }).eq('transaction_id', transactionId);
        if (unlinkError) throw unlinkError;
        if(oldLinks.length > 0) await addLogEntry(`Desvinculados ${oldLinks.length} pagamentos da transação.`, 'update', 'transaction', { id: transactionId });

        // 2. Link new payments
        if (links.length > 0) {
             const memberIds = links.map(l => l.memberId);
             const referenceMonths = links.map(l => l.referenceMonth);

            const { data: paymentsToUpdate, error: selectError } = await supabase
                .from('payments')
                .select('*')
                .in('member_id', memberIds)
                .in('reference_month', referenceMonths);

            if (selectError) throw selectError;

            const updates = links.map(link => {
                const existingPayment = paymentsToUpdate.find(p => p.member_id === link.memberId && p.reference_month === link.referenceMonth);
                
                if (existingPayment) { // Update existing historical payment
                    return supabase.from('payments').update({
                        transaction_id: transactionId,
                        paid_date: paymentDate,
                        amount: link.amount,
                        // Keep comments and attachments from historical payment
                    }).eq('id', existingPayment.id);
                } else { // Create a new payment record
                    return supabase.from('payments').insert({
                        member_id: link.memberId,
                        reference_month: link.referenceMonth,
                        amount: link.amount,
                        payment_date: paymentDate,
                        transaction_id: transactionId,
                    });
                }
            });

            const results = await Promise.all(updates);
            const errors = results.map(r => r.error).filter(Boolean);
            if (errors.length > 0) {
                console.error("Errors linking payments:", errors);
                throw new Error(`Falha ao vincular ${errors.length} pagamentos.`);
            }

            const lookup = await getLookupData();
            const linkDescriptions = links.map(l => `"${lookup.members.get(l.memberId) || l.memberId}" (ref. ${l.referenceMonth})`).join(', ');
            await addLogEntry(`Transação vinculada aos pagamentos de: ${linkDescriptions}.`, 'update', 'transaction', { id: transactionId });
        }
    }
};

// --- API: ACCOUNTS PAYABLE ---
export const payableBillsApi = {
    getAll: async (filters: { searchTerm?: string; status?: 'all' | 'overdue' | 'pending' | 'paid' } = {}): Promise<PayableBill[]> => {
        let query = supabase.from('payable_bills').select('*');

        if (filters.searchTerm) {
            query = query.ilike('description', `%${filters.searchTerm}%`);
        }
        if (filters.status && filters.status !== 'all') {
            if (filters.status === 'pending') {
                query = query.in('status', ['pending', 'overdue']);
            } else {
                query = query.eq('status', filters.status);
            }
        }
        
        const { data, error } = await query.order('due_date', { ascending: false });
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
    },
    deleteFutureRecurring: async(recurringId: string, currentDueDate: string): Promise<void> => {
        const { data: oldData, error: findError } = await supabase
            .from('payable_bills')
            .select('*')
            .eq('recurring_id', recurringId)
            .gte('due_date', currentDueDate);
        
        if (findError) throw findError;
    
        if (!oldData || oldData.length === 0) {
            console.warn(`Attempted to delete future recurring bills with id: ${recurringId} from date ${currentDueDate}, but none were found.`);
            return;
        }
    
        const { error } = await supabase
            .from('payable_bills')
            .delete()
            .eq('recurring_id', recurringId)
            .gte('due_date', currentDueDate);
        
        if (error) throw error;
    
        const baseDescription = oldData[0].description;
        await addLogEntry(`Removidas contas recorrentes futuras para "${baseDescription}" (${oldData.length} contas)`, 'delete', 'bill', oldData);
    }
};

export async function addPayableBill(billData: { description: string, payeeId: string, categoryId: string, amount: number, firstDueDate: string, notes: string, paymentType: 'single' | 'installments' | 'monthly', installments?: number, isEstimate?: boolean, attachmentUrl?: string, attachmentFilename?: string }) {
    const { paymentType, firstDueDate, installments, isEstimate, notes, ...restOfBillData } = billData;
    
    const finalNotes = isEstimate 
        ? `[ESTIMATE] ${notes || ''}`.trim() 
        : (notes || '').replace(/\[ESTIMATE\]\s*/, '').trim();

    const commonData = { ...restOfBillData, notes: finalNotes, isEstimate: isEstimate || false };
    
    if (paymentType === 'single') {
        await payableBillsApi.add({ ...commonData, dueDate: firstDueDate, status: 'pending' } as Omit<PayableBill, 'id'>);
    } else if (paymentType === 'installments' && installments && installments > 1) {
        const groupId = crypto.randomUUID();
        for (let i = 0; i < installments; i++) {
            const dueDate = new Date(firstDueDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            await payableBillsApi.add({ ...commonData, description: `${commonData.description} (${i + 1}/${installments})`, dueDate: dueDate.toISOString().slice(0, 10), status: 'pending', installmentInfo: { current: i + 1, total: installments }, installmentGroupId: groupId } as Omit<PayableBill, 'id'>);
        }
    } else if (paymentType === 'monthly') {
        const recurringId = crypto.randomUUID();
        for (let i = 0; i < 12; i++) { // Create for 1 year
            const dueDate = new Date(firstDueDate);
            dueDate.setMonth(dueDate.getMonth() + i);
            await payableBillsApi.add({ ...commonData, dueDate: dueDate.toISOString().slice(0, 10), status: 'pending', recurringId } as Omit<PayableBill, 'id'>);
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

export async function payBillWithTransactionData(billId: string, transactionData: Partial<Transaction>): Promise<{ warning?: string }> {
    const { data: bill } = await supabase.from('payable_bills').select('*').eq('id', billId).single();
    if (!bill) throw new Error("Bill not found");

    const transactionPayload = { ...transactionData, payableBillId: billId };
    const { data: newTransaction, warning } = await transactionsApi.add(transactionPayload as any);

    const billUpdatePayload: Partial<PayableBill> = {
        status: 'paid',
        paidDate: newTransaction.date,
        transactionId: newTransaction.id,
        amount: newTransaction.amount,
        description: newTransaction.description,
        notes: newTransaction.comments,
        attachmentUrl: newTransaction.attachmentUrl,
        attachmentFilename: newTransaction.attachmentFilename,
    };
    
    await payableBillsApi.update(billId, billUpdatePayload);
    
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
// FIX: Added the missing 'getPayableBillsSummary' function to be exported and used in the AccountsPayable component.
export const getPayableBillsSummary = async () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const endOfMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const endOfMonth = endOfMonthDate.toISOString().slice(0, 10);
    const endOfMonthWithTime = new Date(Date.UTC(endOfMonthDate.getFullYear(), endOfMonthDate.getMonth(), endOfMonthDate.getDate(), 23, 59, 59, 999)).toISOString();

    const { data: previousOverdueData, error: previousOverdueError } = await supabase
        .from('payable_bills')
        .select('amount')
        .in('status', ['pending', 'overdue'])
        .lt('due_date', startOfMonth);
    if (previousOverdueError) throw previousOverdueError;
    const previousOverdueAmount = previousOverdueData.reduce((sum, bill) => sum + bill.amount, 0);

    const { data: thisMonthOpenData, error: thisMonthOpenError } = await supabase
        .from('payable_bills')
        .select('amount')
        .in('status', ['pending', 'overdue'])
        .gte('due_date', startOfMonth)
        .lte('due_date', endOfMonth);
    if (thisMonthOpenError) throw thisMonthOpenError;
    const thisMonthOpenAmount = thisMonthOpenData.reduce((sum, bill) => sum + bill.amount, 0);

    const { data: thisMonthPaidData, error: thisMonthPaidError } = await supabase
        .from('payable_bills')
        .select('amount')
        .eq('status', 'paid')
        .gte('paid_date', startOfMonth)
        .lte('paid_date', endOfMonthWithTime);
    if (thisMonthPaidError) throw thisMonthPaidError;
    const thisMonthPaidAmount = thisMonthPaidData.reduce((sum, bill) => sum + bill.amount, 0);
    
    return {
        previousOverdue: {
            amount: previousOverdueAmount,
        },
        thisMonth: {
            openAmount: thisMonthOpenAmount,
            paidAmount: thisMonthPaidAmount,
        }
    };
};

export const getDashboardStats = async (): Promise<Stats> => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const endOfMonthWithTime = new Date(Date.UTC(endOfMonth.getFullYear(), endOfMonth.getMonth(), endOfMonth.getDate(), 23, 59, 59, 999)).toISOString();
    const currentMonthStr = today.toISOString().slice(0, 7);

    const [members, payments, expenses, accountsWithBalance, futureIncome, pendingBills] = await Promise.all([
        getMembers(),
        supabase.from('payments').select('amount').gte('payment_date', startOfMonth).lte('payment_date', endOfMonthWithTime),
        supabase.from('transactions').select('amount').eq('type', 'expense').gte('date', startOfMonth).lte('date', endOfMonthWithTime),
        getAccountsWithBalance(),
        supabase.from('transactions').select('amount').eq('type', 'income').gt('date', today.toISOString()).lte('date', endOfMonthWithTime),
        supabase.from('payable_bills').select('amount').in('status', ['pending', 'overdue']).gte('due_date', startOfMonth).lte('due_date', endOfMonth.toISOString().slice(0, 10))
    ]);

    if (payments.error) throw payments.error;
    if (expenses.error) throw expenses.error;
    if (futureIncome.error) throw futureIncome.error;
    if (pendingBills.error) throw pendingBills.error;
    
    const activeMembers = members.filter(m => m.activityStatus === 'Ativo');
    const contributingMembers = activeMembers.filter(m => !m.isExempt);
    const exemptMembersCount = activeMembers.filter(m => m.isExempt).length;
    const overdueMembersCount = contributingMembers.filter(m => m.paymentStatus === PaymentStatus.Atrasado).length;

    const totalOverdueAmount = members.reduce((sum, m) => {
        const previousMonthsDue = (m.overdueMonths || [])
            .filter(om => om.month < currentMonthStr)
            .reduce((monthSum, om) => monthSum + om.amount, 0);
        return sum + previousMonthsDue;
    }, 0);
    
    const currentMonthPendingAmount = contributingMembers
        .filter(m => (m.overdueMonths || []).some(om => om.month === currentMonthStr))
        .reduce((sum, m) => sum + m.monthlyFee, 0);

    const nextMonthProjectedRevenue = contributingMembers.reduce((sum, m) => sum + m.monthlyFee, 0);
    
    const overduePercentage = contributingMembers.length > 0 ? (overdueMembersCount / contributingMembers.length) * 100 : 0;
    
    const projectedIncome = futureIncome.data.reduce((sum, t) => sum + t.amount, 0);

    return {
        totalMembers: activeMembers.length,
        onTime: members.filter(m => m.paymentStatus === PaymentStatus.EmDia || m.paymentStatus === PaymentStatus.Adiantado).length,
        overdue: overdueMembersCount,
        monthlyRevenue: payments.data.reduce((sum, p) => sum + p.amount, 0),
        monthlyExpenses: expenses.data.reduce((sum, t) => sum + t.amount, 0),
        currentBalance: accountsWithBalance.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0),
        projectedIncome: projectedIncome,
        projectedExpenses: pendingBills.data.reduce((sum, b) => sum + b.amount, 0),
        totalOverdueAmount,
        currentMonthPendingAmount,
        nextMonthProjectedRevenue,
        contributingMembers: contributingMembers.length,
        exemptMembers: exemptMembersCount,
        overduePercentage,
    };
};

export const getHistoricalMonthlySummary = async (): Promise<{ month: string, income: number, expense: number }[]> => {
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('date, type, amount');

    if (error) throw error;

    const monthlySummary: Record<string, { income: number, expense: number }> = {};

    transactions.forEach(trx => {
        const date = new Date(trx.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlySummary[monthKey]) {
            monthlySummary[monthKey] = { income: 0, expense: 0 };
        }
        if (trx.type === 'income') {
            monthlySummary[monthKey].income += trx.amount;
        } else {
            monthlySummary[monthKey].expense += trx.amount;
        }
    });

    return Object.entries(monthlySummary)
        .map(([month, values]) => ({ month, ...values }))
        .sort((a, b) => a.month.localeCompare(b.month));
};


export const getOverdueReport = async (): Promise<Member[]> => {
    const members = await getMembers();
    return members
        .filter(m => m.paymentStatus === PaymentStatus.Atrasado && m.activityStatus === 'Ativo')
        .sort((a, b) => a.name.localeCompare(b.name));
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
        stats,
        allLeaves
    ] = await Promise.all([
        getMembers(),
        transactionsApi.getAll(),
        getAccountsWithBalance(),
        categoriesApi.getAll(),
        payeesApi.getAll(),
        projectsApi.getAll(),
        tagsApi.getAll(),
        payableBillsApi.getAll(),
        getDashboardStats(),
        supabase.from('leaves').select('*')
    ]);

    if (allLeaves.error) throw allLeaves.error;
    const leavesData = convertObjectKeys(allLeaves.data, toCamelCase) as Leave[];

    const leavesByMember = new Map<string, Leave[]>();
    leavesData.forEach(leave => {
        if (!leavesByMember.has(leave.memberId)) {
            leavesByMember.set(leave.memberId, []);
        }
        leavesByMember.get(leave.memberId)!.push(leave);
    });

    const categoryMap = new Map(categories.map(c => [c.id, c.name]));
    const payeeMap = new Map(payees.map(p => [p.id, p.name]));
    const projectMap = new Map(projects.map(p => [p.id, p.name]));
    const tagMap = new Map(tags.map(t => [t.id, t.name]));
    const accountMap = new Map(accounts.map(a => [a.id, a.name]));

    return {
        resumoGeral: {
            ...stats,
            dataHoraAtual: new Date().toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })
        },
        membros: members.map(({ id, name, email, phone, birthday, monthlyFee, activityStatus, paymentStatus, totalDue, onLeave, isExempt }) => {
            const memberLeaves = leavesByMember.get(id) || [];
            return {
                name, 
                email, 
                phone, 
                birthday, 
                valorMensalidade: monthlyFee, 
                activityStatus, 
                paymentStatus, 
                totalDue,
                onLeave,
                isExempt,
                historicoLicencas: memberLeaves.map(l => ({
                    dataInicio: l.startDate,
                    dataFim: l.endDate,
                    motivo: l.reason
                }))
            };
        }),
        ultimasTransacoes: transactions.slice(0, 100).map(t => ({
            descricao: t.description,
            valor: t.amount,
            data: t.date,
            tipo: t.type,
            conta: accountMap.get(t.accountId) || 'Conta não identificada',
            categoria: categoryMap.get(t.categoryId) || 'Não categorizado',
            beneficiario: t.payeeId ? payeeMap.get(t.payeeId) : undefined,
            projeto: t.projectId ? projectMap.get(t.projectId) : undefined,
            tags: t.tagIds ? t.tagIds.map(tagId => tagMap.get(tagId)).filter(Boolean) : undefined,
            comprovanteUrl: t.attachmentUrl || undefined,
        })),
        contasBancarias: accounts.map(({ name, currentBalance }) => ({ name, saldoAtual: currentBalance })),
        historicoDeContas: bills.map(({ description, amount, dueDate, status, paidDate }) => ({ 
            description, 
            amount, 
            dueDate, 
            status,
            pagoEm: paidDate
        })),
        listaDeCategorias: categories.map(c => ({ nome: c.name, tipo: c.type })),
        listaDeBeneficiarios: payees.map(p => p.name),
        listaDeProjetos: projects.map(p => p.name),
        listaDeTags: tags.map(t => t.name),
    };
};