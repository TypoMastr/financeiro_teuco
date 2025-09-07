// types.ts

export enum PaymentStatus {
  EmDia = 'Em Dia',
  Atrasado = 'Atrasado',
  Adiantado = 'Adiantado',
  Desligado = 'Desligado',
  Isento = 'Isento',
}

export type ActivityStatus = 'Ativo' | 'Inativo' | 'Desligado';
export type SortOption = 'name_asc' | 'name_desc';
export type ItemType = 'account' | 'category' | 'payee' | 'tag' | 'project';

export interface OverdueMonth {
  month: string;
  amount: number;
}

export interface Leave {
  id: string;
  memberId: string;
  startDate: string;
  endDate?: string;
  reason?: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  birthday?: string;
  monthlyFee: number;
  activityStatus: ActivityStatus;
  isExempt: boolean;
  onLeave: boolean;
  paymentStatus: PaymentStatus;
  overdueMonthsCount: number;
  overdueMonths: OverdueMonth[];
  totalDue: number;
}

export interface Payment {
  id: string;
  memberId: string;
  amount: number;
  paymentDate: string;
  referenceMonth: string;
  comments?: string;
  transactionId?: string;
  attachmentUrl?: string;
  attachmentFilename?: string;
}

export interface Account {
  id: string;
  name: string;
  initialBalance: number;
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
  date: string;
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
  runningBalance?: number;
}

export interface PayableBill {
  id: string;
  description: string;
  payeeId: string;
  categoryId: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  paidDate?: string;
  transactionId?: string;
  notes?: string;
  recurringId?: string;
  installmentInfo?: {
    current: number;
    total: number;
  };
  installmentGroupId?: string;
  attachmentUrl?: string;
  attachmentFilename?: string;
  isEstimate?: boolean;
}

export type ActionType = 'create' | 'update' | 'delete';
export type EntityType = 'member' | 'payment' | 'transaction' | 'category' | 'tag' | 'payee' | 'project' | 'account' | 'bill' | 'leave';

export interface LogEntry {
  id: string;
  timestamp: string;
  description: string;
  actionType: ActionType;
  entityType: EntityType;
  undoData: any;
}

export interface Stats {
  totalMembers: number;
  onTime: number;
  overdue: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  currentBalance: number;
  projectedIncome: number;
  projectedExpenses: number;
}


export interface ReportData {
  type: 'overdue' | 'revenue' | 'financial' | 'dre';
  data: any;
  generatedAt: string;
  title?: string;
}

export type ViewState =
  | { name: 'overview' }
  | { name: 'members' }
  | { name: 'member-profile'; id: string; componentState?: any }
  | { name: 'add-member' }
  | { name: 'edit-member'; id: string }
  | { name: 'financial'; componentState?: any }
  | { name: 'financial-detail', filterType: 'category' | 'project' | 'tag', filterId: string, filterName: string, componentState?: any }
  | { name: 'transaction-history', accountId: string, componentState?: any }
  | { name: 'accounts-payable'; componentState?: any }
  | { name: 'settings' }
  | { name: 'reports' }
  | { name: 'log' }
  | { name: 'report-view', report: ReportData }
  | { name: 'payment-form', id: string, month: string, returnView: ViewState }
  | { name: 'edit-payment-form', id: string, paymentId: string, returnView: ViewState }
  | { name: 'transaction-form', transactionId?: string, returnView: ViewState }
  | { name: 'financial-report-form', returnView: ViewState }
  | { name: 'future-income-view', returnView: ViewState }
  | { name: 'setting-list', itemType: ItemType, returnView?: ViewState }
  | { name: 'setting-item-form', itemType: ItemType, itemId?: string, returnView?: ViewState }
  | { name: 'bill-form', billId?: string, returnView: ViewState }
  | { name: 'pay-bill-form', billId: string, returnView: ViewState }
  | { name: 'delete-bill-confirmation', billId: string, returnView: ViewState }
  | { name: 'attachment-view', attachmentUrl: string, returnView: ViewState }
  | { name: 'batch-transaction-form', returnView: ViewState }
  | { name: 'ofx-import-form', returnView: ViewState }
  | { name: 'leave-form', memberId: string, leaveId?: string, returnView: ViewState }
  | { name: 'chatbot' };