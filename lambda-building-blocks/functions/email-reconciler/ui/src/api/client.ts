/**
 * API Client for Email Reconciler
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface QueueEntry {
  id: number;
  queueType: 'link' | 'create_user' | 'update_user' | 'merge' | 'split';
  msgEmailId: number | null;
  sourceUserId: number | null;
  targetUserId: number | null;
  proposedData: Record<string, unknown>;
  currentData: Record<string, unknown>;
  confidence: number;
  llmReasoning: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
  msgEmailInput?: string;
  sourceUserName?: string;
  targetUserName?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ProcessingStats {
  totalMsgEmails: number;
  processedMsgEmails: number;
  pendingQueue: number;
  approvedQueue: number;
  rejectedQueue: number;
  appliedQueue: number;
  byClassification: {
    full: number;
    partial: number;
    unknown: number;
  };
  byConfidenceTier: {
    high: number;
    medium: number;
    low: number;
    veryLow: number;
  };
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Queue endpoints
  async getPendingQueue(params: {
    page?: number;
    pageSize?: number;
    minConfidence?: number;
    maxConfidence?: number;
    queueType?: string;
  } = {}): Promise<PaginatedResponse<QueueEntry>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params.minConfidence) searchParams.set('minConfidence', String(params.minConfidence));
    if (params.maxConfidence) searchParams.set('maxConfidence', String(params.maxConfidence));
    if (params.queueType) searchParams.set('queueType', params.queueType);

    const query = searchParams.toString();
    return fetchAPI(`/queue/pending${query ? `?${query}` : ''}`);
  },

  async getQueueEntry(id: number): Promise<QueueEntry> {
    return fetchAPI(`/queue/${id}`);
  },

  async approveEntry(id: number, reviewerId: number, modifications?: Record<string, unknown>): Promise<{ success: boolean }> {
    return fetchAPI(`/queue/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewerId, modifications }),
    });
  },

  async rejectEntry(id: number, reviewerId: number, reason?: string): Promise<{ success: boolean }> {
    return fetchAPI(`/queue/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reviewerId, reason }),
    });
  },

  async bulkApprove(reviewerId: number, minConfidence: number = 0.95, limit: number = 100): Promise<{
    approved: number;
    failed: number;
    errors: string[];
  }> {
    return fetchAPI('/queue/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ reviewerId, minConfidence, limit }),
    });
  },

  // Stats endpoints
  async getStats(): Promise<ProcessingStats> {
    return fetchAPI('/stats');
  },

  async getSummary(): Promise<{
    progress: { total: number; processed: number; remaining: number; percentComplete: number };
    queue: { pending: number; approved: number; rejected: number; applied: number; total: number };
    pendingByConfidence: { high: number; medium: number; low: number; veryLow: number };
    actionNeeded: { highConfidence: number; needsReview: number; lowConfidence: number };
  }> {
    return fetchAPI('/stats/summary');
  },

  // Process endpoints
  async processBatch(limit: number = 100, domain?: string): Promise<{
    processed: number;
    proposalsCreated: number;
    errors: number;
  }> {
    return fetchAPI('/process/batch', {
      method: 'POST',
      body: JSON.stringify({ limit, domain }),
    });
  },

  async processFullPipeline(emailLimit: number = 500): Promise<{
    emails: { processed: number; proposalsCreated: number; errors: number };
    duplicates: { detected: number; proposalsCreated: number };
    splits: { detected: number; proposalsCreated: number };
    totalProposals: number;
  }> {
    return fetchAPI('/process/full', {
      method: 'POST',
      body: JSON.stringify({ emailLimit }),
    });
  },
};
