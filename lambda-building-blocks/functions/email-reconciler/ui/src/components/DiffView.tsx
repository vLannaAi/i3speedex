/**
 * DiffView Component
 * Displays current or proposed data in a consistent format
 */


interface DiffViewProps {
  title: string;
  data: Record<string, unknown>;
  variant: 'current' | 'proposed';
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(empty)';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatKey(key: string): string {
  // Convert camelCase to Title Case
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

export default function DiffView({ title, data, variant }: DiffViewProps) {
  const entries = Object.entries(data).filter(
    ([key]) => !key.startsWith('_') && key !== 'id'
  );

  return (
    <div className={`data-section ${variant}`}>
      <h4>{title}</h4>
      {entries.map(([key, value]) => (
        <div className="data-row" key={key}>
          <span className="key">{formatKey(key)}</span>
          <span className="value">{formatValue(value)}</span>
        </div>
      ))}
      {entries.length === 0 && (
        <div className="data-row">
          <span className="value" style={{ fontStyle: 'italic' }}>No data</span>
        </div>
      )}
    </div>
  );
}
