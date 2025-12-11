export enum AppView {
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  GENERATING = 'GENERATING',
  RESULT = 'RESULT',
  PREMIUM = 'PREMIUM',
}

export interface ExcuseOption {
  id: string;
  label: string;
  emoji: string;
  prompt: string;
}

export interface HistoryItem {
  id: string;
  prompt: string;
  date: string;
  imageUrl: string; // Preview URL
}

export interface UserState {
  credits: number;
  isPremium: boolean;
  isGuest: boolean;
  history: HistoryItem[];
}