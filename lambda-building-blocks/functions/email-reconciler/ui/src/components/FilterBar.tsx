/**
 * FilterBar Component
 * Controls for filtering the queue
 */


interface FilterBarProps {
  minConfidence: string;
  maxConfidence: string;
  queueType: string;
  onMinConfidenceChange: (value: string) => void;
  onMaxConfidenceChange: (value: string) => void;
  onQueueTypeChange: (value: string) => void;
  onRefresh: () => void;
}

export default function FilterBar({
  minConfidence,
  maxConfidence,
  queueType,
  onMinConfidenceChange,
  onMaxConfidenceChange,
  onQueueTypeChange,
  onRefresh,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <select
        value={queueType}
        onChange={e => onQueueTypeChange(e.target.value)}
        aria-label="Queue type filter"
      >
        <option value="">All Types</option>
        <option value="link">Link to User</option>
        <option value="create_user">Create User</option>
        <option value="merge">Merge Users</option>
        <option value="split">Split User</option>
      </select>

      <select
        value={minConfidence}
        onChange={e => onMinConfidenceChange(e.target.value)}
        aria-label="Minimum confidence filter"
      >
        <option value="">Min Confidence</option>
        <option value="0.9">90%+</option>
        <option value="0.7">70%+</option>
        <option value="0.5">50%+</option>
        <option value="0">All</option>
      </select>

      <select
        value={maxConfidence}
        onChange={e => onMaxConfidenceChange(e.target.value)}
        aria-label="Maximum confidence filter"
      >
        <option value="">Max Confidence</option>
        <option value="0.5">&lt;50%</option>
        <option value="0.7">&lt;70%</option>
        <option value="0.9">&lt;90%</option>
        <option value="1">All</option>
      </select>

      <button className="primary" onClick={onRefresh}>
        Refresh
      </button>
    </div>
  );
}
