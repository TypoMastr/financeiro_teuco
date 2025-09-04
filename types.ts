
export enum PaymentStatus {
  EmDia = 'Em Dia',
  Atrasado = 'Atrasado',
  Adiantado = 'Adiantado',
}

export type ActivityStatus = 'Ativo' | 'Inativo';
export type SortOption = 'name_asc' | 'name_desc';
export type ItemType = 'account' | 'category' | 'tag' | 'payee' | 'project';
export type ActionType = 'create' | 'update' | 'delete';
export type EntityType = 'member' | 'payment' | 'transaction' | 'bill' | 'account' | 'category' | 'tag' | 'payee' | 'project';


export type ViewName =
  | 'overview'
  | 'members'
  | 'member-profile'
  | 'add-member'
  | 'edit-member'
  | 'report-view'
  | 'financial'
  | 'settings'
  | 'financial-detail'
  | 'transaction-history'
  | 'reports'
  | 'accounts-payable'
  | 'log'
  // Page-based views that replace modals
  | 'payment-form'
  | 'transaction-form'
  | 'financial-report-form'
  | 'future-income-view'
  | 'setting-item-form'
  | 'setting-list'
  | 'bill-form'
  | 'pay-bill-form'
  | 'delete-bill-confirmation'
  | 'attachment-view'
  | 'batch-transaction-form'
  | 'ofx-import-form';

export type ReportData = {
    type: 'overdue' | 'revenue' | 'financial' | 'dre';
    data: any;
    generatedAt: string;
    title?: string;
};

export interface ViewState {
  name: ViewName;
  returnView?: ViewState; // Defines where the "back" button leads
  componentState?: any; // Stores UI state like filters, open tabs, etc.
  // Generic IDs
  id?: string | null; // Primary ID, often memberId
  transactionId?: string;
  billId?: string;
  itemId?: string; // For settings
  accountId?: string;
  filterId?: string;
  // Page specific props
  month?: string; // For payment-form
  itemType?: ItemType; // for setting-item-form
  attachmentUrl?: string;
  // For reports
  report?: ReportData;
  // Financial navigation params
  filterType?: 'category' | 'project' | 'tag';
  filterName?: string;
}

export interface OverdueMonth {
  month: string; // "YYYY-MM"
  amount: number;
}

export interface Payment {
  id: string;
  memberId: string;
  amount: number;
  paymentDate: string; // ISO string format
  referenceMonth: string; // YYYY-MM
  comments?: string;
  attachmentUrl?: string; // URL for the attachment
  attachmentFilename?: string; // Original filename
  transactionId?: string; // Link to the financial transaction
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string; // ISO string format
  monthlyFee: number;
  activityStatus: ActivityStatus;
  birthday?: string; // YYYY-MM-DD
  
  // Campos calculados pela API
  paymentStatus: PaymentStatus;
  overdueMonthsCount: number;
  overdueMonths: OverdueMonth[];
  totalDue: number;
}

export interface Stats {
  totalMembers: number;
  onTime: number;
  overdue: number;
  monthlyRevenue: number;
}

// --- Financial Module Types ---

export interface Account {
  id: string;
  name: string;
  initialBalance: number;
  // calculated
  currentBalance?: number;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
}

export interface Tag {
  id: string;
  name: string;
}

export interface Payee {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO String
  type: 'income' | 'expense';
  accountId: string;
  categoryId: string;
  payeeId?: string;
  tagIds?: string[];
  projectId?: string;
  comments?: string;
  payableBillId?: string;
  attachmentUrl?: string;
  attachmentFilename?: string;
}

export interface PayableBill {
  id: string;
  description: string;
  payeeId: string;
  categoryId: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'paid' | 'overdue';
  paidDate?: string; // ISO String
  transactionId?: string;
  notes?: string;
  installmentInfo?: {
    total: number;
    current: number;
  };
  installmentGroupId?: string;
  recurringId?: string;
  attachmentUrl?: string;
  attachmentFilename?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string; // ISO Date String
  description: string;
  actionType: ActionType;
  entityType: EntityType;
  undoData: any;
}
