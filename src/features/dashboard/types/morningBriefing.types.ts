import { Transaction } from '../../../types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sourceNodes?: Array<{ title: string; snippet: string; score?: number }>;
}

export interface MorningBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  analytics?: any;
  rawData?: Transaction[];
  allDeliveries?: Transaction[];
  activePeringkat?: string;
  selectedMonth?: number;
  selectedYear?: number;
  userName?: string;
  authRole?: string;
  backlogHistory?: Record<string, Record<string, any>>;
  initialTab?: 'briefing' | 'chat';
}

export interface StructuredBriefingData {
  summary?: string;
  keyHighlights?: string[];
  kpiStats?: {
    totalTan?: number;
    totalTrips?: number;
    avgOer?: number;
    abw?: number;
    ripeFruitPct?: number;
  };
  criticalAlerts?: string[];
  actionRecommendations?: string[];
}
