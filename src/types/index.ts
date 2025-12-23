export interface User {
  username: string;
  password: string;
  isAdmin: boolean;
}

export interface Session {
  username: string;
  loginTime: number;
  isActive: boolean;
}

export interface Contract {
  id: string;
  type: 'Terme' | 'Affaire';
  branch: 'Auto' | 'Vie' | 'Santé' | 'IRDS';
  contractNumber: string;
  premiumAmount: number;
  insuredName: string;
  paymentMode: 'Espece' | 'Cheque' | 'Carte Bancaire';
  paymentType: 'Au comptant' | 'Crédit';
  creditAmount?: number;
  paymentDate?: string;
  createdBy: string;
  createdAt: number;
  xmlData?: {
    contractNumber: string;
    premium: number;
    maturity: string;
    insured: string;
  };
}

export interface XMLContract {
  contractNumber: string;
  premium: number;
  maturity: string;
  insured: string;
  numTel?: string;
  numTel2?: string;
}
