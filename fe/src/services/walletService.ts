import { apiClient } from './apiClient';



// ─── Types ────────────────────────────────────────────────────────────────────

export interface WalletTransaction {
  id: string;
  amount: number;
  type: 'Deposit' | 'Withdrawal' | 'Payment' | 'Refund' | 'BookingPayment' | string;
  status: 'Success' | 'Pending' | 'Failed' | string;
  description: string | null;
  createdAt: string;
  referenceCode: string | null;
}

export interface WalletInfo {
  balance: number;
  transactions: WalletTransaction[];
}

export interface BankAccount {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}

export interface DepositRequest {
  amount: number;
}

export interface DepositResponse {
  checkoutUrl: string;
  orderCode: number;
  amount: number;
}

export interface WithdrawRequest {
  amount: number;
}

export interface WithdrawResponse {
  message: string;
  amount: number;
  bankAccount: string;
}

export interface CreateBankAccountRequest {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

// Backend trả PascalCase — normalize về camelCase
function normalizeTx(tx: Record<string, unknown>): WalletTransaction {
  return {
    id: (tx.id ?? tx.Id ?? '') as string,
    amount: (tx.amount ?? tx.Amount ?? 0) as number,
    type: (tx.type ?? tx.Type ?? '') as string,
    status: (tx.status ?? tx.Status ?? '') as string,
    description: (tx.description ?? tx.Description ?? null) as string | null,
    createdAt: (tx.createdAt ?? tx.CreatedAt ?? '') as string,
    referenceCode: (tx.referenceCode ?? tx.ReferenceId ?? tx.referenceId ?? null) as string | null,
  };
}

function normalizeBank(b: Record<string, unknown>): BankAccount {
  return {
    id: (b.id ?? b.Id ?? '') as string,
    bankCode: (b.bankCode ?? b.BankBin ?? b.bankBin ?? '') as string,
    bankName: (b.bankName ?? b.BankName ?? '') as string,
    accountNumber: (b.accountNumber ?? b.AccountNumber ?? '') as string,
    accountName: (b.accountHolderName ?? b.AccountHolderName ?? b.accountName ?? b.AccountName ?? '') as string,
    isDefault: Boolean(b.isDefault ?? b.IsDefault),
  };
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const getWallet = async (): Promise<WalletInfo> => {
  const raw = await authFetch<Record<string, unknown>>('/api/wallets/me');
  const balance = (raw.balance ?? raw.Balance ?? 0) as number;
  const rawTxs = ((raw.transactions ?? raw.Transactions ?? []) as Record<string, unknown>[]);
  return { balance, transactions: rawTxs.map(normalizeTx) };
};

export const depositWallet = async (payload: DepositRequest): Promise<DepositResponse> => {
  const raw = await authFetch<Record<string, unknown>>('/api/wallets/deposit', token, { method: 'POST', body: JSON.stringify(payload) });
  return {
    checkoutUrl: (raw.checkoutUrl ?? raw.CheckoutUrl ?? '') as string,
    orderCode: (raw.orderCode ?? raw.OrderCode ?? 0) as number,
    amount: (raw.amount ?? raw.Amount ?? payload.amount) as number,
  };
};

export const withdrawWallet = (payload: WithdrawRequest): Promise<WithdrawResponse> =>
  apiClient('/api/wallets/withdraw', { method: 'POST', body: JSON.stringify(payload) });

export const getBankAccounts = async (): Promise<BankAccount[]> => {
  const raw = await authFetch<Record<string, unknown>[]>('/api/wallets/bank-accounts');
  return (raw ?? []).map(normalizeBank);
};

export const createBankAccount = (payload: CreateBankAccountRequest): Promise<BankAccount> =>
  apiClient('/api/wallets/bank-account', { method: 'POST', body: JSON.stringify(payload) });

export const deleteBankAccount = (id: string): Promise<void> =>
  apiClient(`/api/wallets/bank-account/${id}`, { method: 'DELETE' });

export const setDefaultBankAccount = (id: string): Promise<void> =>
  apiClient(`/api/wallets/bank-account/${id}/set-default`, { method: 'PUT' });
