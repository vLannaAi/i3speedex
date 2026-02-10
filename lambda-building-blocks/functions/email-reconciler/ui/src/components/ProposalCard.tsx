/**
 * ProposalCard Component
 * Displays a single reconciliation proposal for review
 */

import { QueueEntry } from '../api/client';
import DiffView from './DiffView';

interface ProposalCardProps {
  proposal: QueueEntry;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onEdit: (id: number) => void;
  onSkip: (id: number) => void;
  loading?: boolean;
}

function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

function formatQueueType(type: string): string {
  const labels: Record<string, string> = {
    link: 'Link to User',
    create_user: 'Create User',
    update_user: 'Update User',
    merge: 'Merge Users',
    split: 'Split User',
  };
  return labels[type] || type;
}

export default function ProposalCard({
  proposal,
  onApprove,
  onReject,
  onEdit,
  onSkip,
  loading,
}: ProposalCardProps) {
  const confidenceLevel = getConfidenceLevel(proposal.confidence);
  const confidencePercent = Math.round(proposal.confidence * 100);

  return (
    <div className="proposal-card">
      <div className="proposal-header">
        <div>
          <span className="id">#{proposal.id}</span>
          <span className="type">{formatQueueType(proposal.queueType)}</span>
        </div>
        <span className={`confidence-badge ${confidenceLevel}`}>
          {confidencePercent}%
        </span>
      </div>

      {proposal.msgEmailInput && (
        <div style={{ marginBottom: '16px', fontFamily: 'monospace', fontSize: '14px' }}>
          <strong>Input:</strong> {proposal.msgEmailInput}
        </div>
      )}

      <div className="proposal-content">
        <DiffView
          title="Current Data"
          data={proposal.currentData}
          variant="current"
        />
        <div className="arrow-section">
          <span>&rarr;</span>
        </div>
        <DiffView
          title="Proposed Changes"
          data={proposal.proposedData}
          variant="proposed"
        />
      </div>

      {proposal.targetUserName && (
        <div style={{ marginBottom: '12px', fontSize: '14px' }}>
          <strong>Matched User:</strong> {proposal.targetUserName}
          {proposal.targetUserId && ` (ID: ${proposal.targetUserId})`}
        </div>
      )}

      {proposal.llmReasoning && (
        <div className="reasoning">
          <strong>LLM Reasoning:</strong> {proposal.llmReasoning}
        </div>
      )}

      <div className="proposal-actions">
        <button
          className="skip"
          onClick={() => onSkip(proposal.id)}
          disabled={loading}
        >
          Skip
        </button>
        <button
          className="edit"
          onClick={() => onEdit(proposal.id)}
          disabled={loading}
        >
          Edit &amp; Approve
        </button>
        <button
          className="reject"
          onClick={() => onReject(proposal.id)}
          disabled={loading}
        >
          Reject
        </button>
        <button
          className="approve"
          onClick={() => onApprove(proposal.id)}
          disabled={loading}
        >
          Approve
        </button>
      </div>
    </div>
  );
}
