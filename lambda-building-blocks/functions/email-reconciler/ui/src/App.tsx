/**
 * Main App Component
 * Email Reconciliation Review Dashboard
 */

import { useState, useCallback, useEffect } from 'react';
import { useQueue, useStats, useApproval } from './hooks/useQueue';
import ProposalCard from './components/ProposalCard';
import FilterBar from './components/FilterBar';
import BulkActions from './components/BulkActions';

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export default function App() {
  // State
  const [page, setPage] = useState(1);
  const [minConfidence, setMinConfidence] = useState('');
  const [maxConfidence, setMaxConfidence] = useState('');
  const [queueType, setQueueType] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);

  // Default reviewer ID (in production, get from auth)
  const reviewerId = 1;

  // Hooks
  const {
    data: queueData,
    loading: queueLoading,
    error: queueError,
    refresh: refreshQueue,
  } = useQueue({
    page,
    pageSize: 20,
    minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
    maxConfidence: maxConfidence ? parseFloat(maxConfidence) : undefined,
    queueType: queueType || undefined,
  });

  const { stats, refresh: refreshStats } = useStats();

  const { approve, reject, bulkApprove, loading: approvalLoading } = useApproval();

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handlers
  const handleApprove = useCallback(async (id: number) => {
    const success = await approve(id, reviewerId);
    if (success) {
      setToast({ message: 'Proposal approved and applied', type: 'success' });
      refreshQueue();
      refreshStats();
    } else {
      setToast({ message: 'Failed to approve proposal', type: 'error' });
    }
  }, [approve, refreshQueue, refreshStats, reviewerId]);

  const handleReject = useCallback(async (id: number) => {
    const success = await reject(id, reviewerId);
    if (success) {
      setToast({ message: 'Proposal rejected', type: 'success' });
      refreshQueue();
      refreshStats();
    } else {
      setToast({ message: 'Failed to reject proposal', type: 'error' });
    }
  }, [reject, refreshQueue, refreshStats, reviewerId]);

  const handleEdit = useCallback((id: number) => {
    // In a full implementation, open a modal for editing
    alert(`Edit proposal ${id} - Not implemented yet`);
  }, []);

  const handleSkip = useCallback((id: number) => {
    // Just scroll to next
    const cards = document.querySelectorAll('.proposal-card');
    const currentIndex = Array.from(cards).findIndex(
      card => card.querySelector('.id')?.textContent === `#${id}`
    );
    if (currentIndex >= 0 && currentIndex < cards.length - 1) {
      cards[currentIndex + 1].scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleBulkApprove = useCallback(async (minConf: number, limit: number) => {
    const result = await bulkApprove(reviewerId, minConf, limit);
    if (result) {
      setToast({
        message: `Approved ${result.approved} proposals (${result.failed} failed)`,
        type: result.failed > 0 ? 'error' : 'success',
      });
      refreshQueue();
      refreshStats();
    } else {
      setToast({ message: 'Bulk approval failed', type: 'error' });
    }
  }, [bulkApprove, refreshQueue, refreshStats, reviewerId]);

  const handleRefresh = useCallback(() => {
    refreshQueue();
    refreshStats();
  }, [refreshQueue, refreshStats]);

  return (
    <div className="app">
      <header className="header">
        <h1>Email Reconciliation Review</h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>
            Reviewer ID: {reviewerId}
          </span>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="label">Pending</div>
          <div className="value">{stats?.pendingQueue ?? '-'}</div>
        </div>
        <div className="stat-card high">
          <div className="label">High Confidence (90%+)</div>
          <div className="value">{stats?.byConfidenceTier.high ?? '-'}</div>
        </div>
        <div className="stat-card medium">
          <div className="label">Needs Review (70-90%)</div>
          <div className="value">{stats?.byConfidenceTier.medium ?? '-'}</div>
        </div>
        <div className="stat-card low">
          <div className="label">Low Confidence (&lt;70%)</div>
          <div className="value">{(stats?.byConfidenceTier.low ?? 0) + (stats?.byConfidenceTier.veryLow ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Applied</div>
          <div className="value">{stats?.appliedQueue ?? '-'}</div>
        </div>
      </div>

      {/* Bulk Actions */}
      {stats && stats.byConfidenceTier.high > 0 && (
        <BulkActions
          highConfidenceCount={stats.byConfidenceTier.high}
          onBulkApprove={handleBulkApprove}
          loading={approvalLoading}
        />
      )}

      {/* Filters */}
      <FilterBar
        minConfidence={minConfidence}
        maxConfidence={maxConfidence}
        queueType={queueType}
        onMinConfidenceChange={setMinConfidence}
        onMaxConfidenceChange={setMaxConfidence}
        onQueueTypeChange={setQueueType}
        onRefresh={handleRefresh}
      />

      {/* Error State */}
      {queueError && (
        <div style={{ padding: '20px', color: '#dc2626', textAlign: 'center' }}>
          Error: {queueError}
        </div>
      )}

      {/* Loading State */}
      {queueLoading && (
        <div className="loading">Loading proposals...</div>
      )}

      {/* Empty State */}
      {!queueLoading && queueData?.items.length === 0 && (
        <div className="empty-state">
          <h3>No pending proposals</h3>
          <p>All reconciliation proposals have been reviewed.</p>
        </div>
      )}

      {/* Proposals List */}
      {!queueLoading && queueData && queueData.items.length > 0 && (
        <>
          <div className="proposals-list">
            {queueData.items.map(proposal => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onApprove={handleApprove}
                onReject={handleReject}
                onEdit={handleEdit}
                onSkip={handleSkip}
                loading={approvalLoading}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button className="active">
              Page {page} of {Math.ceil((queueData.total || 1) / 20)}
            </button>
            <button
              disabled={!queueData.hasMore}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
