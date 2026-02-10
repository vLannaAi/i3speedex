/**
 * BulkActions Component
 * Controls for bulk approval of high-confidence items
 */

import { useState } from 'react';

interface BulkActionsProps {
  highConfidenceCount: number;
  onBulkApprove: (minConfidence: number, limit: number) => Promise<void>;
  loading?: boolean;
}

export default function BulkActions({
  highConfidenceCount,
  onBulkApprove,
  loading,
}: BulkActionsProps) {
  const [minConfidence, setMinConfidence] = useState('0.95');
  const [limit, setLimit] = useState('100');

  const handleBulkApprove = async () => {
    await onBulkApprove(
      parseFloat(minConfidence),
      parseInt(limit, 10)
    );
  };

  return (
    <div className="bulk-actions">
      <div className="info">
        <strong>{highConfidenceCount}</strong> high-confidence proposals ready for bulk approval
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select
          value={minConfidence}
          onChange={e => setMinConfidence(e.target.value)}
          disabled={loading}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
        >
          <option value="0.95">95%+ confidence</option>
          <option value="0.9">90%+ confidence</option>
          <option value="0.85">85%+ confidence</option>
        </select>
        <select
          value={limit}
          onChange={e => setLimit(e.target.value)}
          disabled={loading}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
        >
          <option value="50">Up to 50</option>
          <option value="100">Up to 100</option>
          <option value="200">Up to 200</option>
        </select>
        <button onClick={handleBulkApprove} disabled={loading || highConfidenceCount === 0}>
          {loading ? 'Processing...' : 'Bulk Approve'}
        </button>
      </div>
    </div>
  );
}
