export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  sources?: any[];
  pdfPages?: Array<{ page: number; text: string }>;
  verifiedAnswer?: string;
  contradictionFlags?: string[];
  suggestedFollowups?: string[];
  retrievalMetadata?: any;
  qualityMetrics?: any;
  verificationReport?: any;
  claimVerifications?: any[];
  performanceStats?: any;
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
}

export interface ManualSawitChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  analytics?: any;
  rawData?: any[];
  activePeringkat?: string;
  selectedMonth?: number;
  selectedYear?: number;
}
