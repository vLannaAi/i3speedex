-- Migration: Create reconciliation_queue table
-- This table stores all AI-proposed changes for human review

CREATE TABLE IF NOT EXISTS reconciliation_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Type of proposed change
  queue_type ENUM('link', 'create_user', 'update_user', 'merge', 'split') NOT NULL,

  -- Related record IDs (nullable depending on queue_type)
  msg_email_id INT,
  source_user_id INT,
  target_user_id INT,

  -- LLM's proposed changes (JSON)
  proposed_data JSON NOT NULL,

  -- Current DB values for comparison (JSON)
  current_data JSON NOT NULL,

  -- Confidence score (0.00 to 1.00)
  confidence DECIMAL(3,2) NOT NULL,

  -- LLM's explanation for this suggestion
  llm_reasoning TEXT,

  -- Review status
  status ENUM('pending', 'approved', 'rejected', 'applied') NOT NULL DEFAULT 'pending',

  -- Who reviewed and when
  reviewed_by INT,
  reviewed_at TIMESTAMP NULL,

  -- Creation timestamp
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for common queries
  INDEX idx_status (status),
  INDEX idx_queue_type (queue_type),
  INDEX idx_confidence (confidence),
  INDEX idx_msg_email (msg_email_id),
  INDEX idx_source_user (source_user_id),
  INDEX idx_target_user (target_user_id),
  INDEX idx_created_at (created_at),

  -- Composite index for common filter combinations
  INDEX idx_status_confidence (status, confidence DESC),
  INDEX idx_status_type_confidence (status, queue_type, confidence DESC)

  -- Foreign keys (optional - uncomment if referential integrity is required)
  -- CONSTRAINT fk_msg_email FOREIGN KEY (msg_email_id) REFERENCES msg_emails(id),
  -- CONSTRAINT fk_source_user FOREIGN KEY (source_user_id) REFERENCES users(id),
  -- CONSTRAINT fk_target_user FOREIGN KEY (target_user_id) REFERENCES users(id),
  -- CONSTRAINT fk_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='AI-proposed reconciliation changes awaiting human review';

-- Create a view for pending high-confidence items (easy bulk approval)
CREATE OR REPLACE VIEW v_reconciliation_high_confidence AS
SELECT
  q.*,
  me.input as msg_email_input,
  me.address as msg_email_address,
  su.name as source_user_name,
  tu.name as target_user_name
FROM reconciliation_queue q
LEFT JOIN msg_emails me ON q.msg_email_id = me.id
LEFT JOIN users su ON q.source_user_id = su.id
LEFT JOIN users tu ON q.target_user_id = tu.id
WHERE q.status = 'pending'
  AND q.confidence >= 0.90
ORDER BY q.confidence DESC, q.created_at ASC;

-- Create a view for the review dashboard
CREATE OR REPLACE VIEW v_reconciliation_dashboard AS
SELECT
  q.status,
  q.queue_type,
  COUNT(*) as count,
  AVG(q.confidence) as avg_confidence,
  MIN(q.created_at) as oldest_entry,
  MAX(q.created_at) as newest_entry
FROM reconciliation_queue q
GROUP BY q.status, q.queue_type
ORDER BY
  FIELD(q.status, 'pending', 'approved', 'rejected', 'applied'),
  q.queue_type;

-- Create audit log table for tracking applied changes
CREATE TABLE IF NOT EXISTS reconciliation_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Reference to the queue entry
  queue_id INT NOT NULL,

  -- What action was taken
  action ENUM('approved', 'rejected', 'applied', 'modified') NOT NULL,

  -- Who took the action
  actor_id INT,

  -- When
  action_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Any modifications made during approval
  modifications JSON,

  -- Result of applying the change (if applicable)
  apply_result JSON,

  -- Error message if apply failed
  error_message TEXT,

  INDEX idx_queue_id (queue_id),
  INDEX idx_action (action),
  INDEX idx_actor_id (actor_id),
  INDEX idx_action_at (action_at)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Domain patterns cache table (learned email conventions)
CREATE TABLE IF NOT EXISTS domain_patterns (
  domain VARCHAR(255) PRIMARY KEY,

  -- Detected email naming convention
  convention ENUM('firstname.lastname', 'f.lastname', 'flastname', 'firstname', 'lastname.firstname', 'unknown') NOT NULL DEFAULT 'unknown',

  -- Confidence in the detected pattern
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.00,

  -- Number of samples analyzed
  sample_size INT NOT NULL DEFAULT 0,

  -- Is this a shared/public domain (gmail, outlook, etc.)
  is_shared_domain BOOLEAN NOT NULL DEFAULT FALSE,

  -- Associated company name
  company_name VARCHAR(255),

  -- Associated buyer/producer
  buyer_id INT,
  producer_id INT,

  -- When the pattern was last analyzed
  analyzed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_convention (convention),
  INDEX idx_confidence (confidence),
  INDEX idx_is_shared (is_shared_domain)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pre-populate known shared domains
INSERT IGNORE INTO domain_patterns (domain, convention, confidence, is_shared_domain) VALUES
  ('gmail.com', 'unknown', 0.00, TRUE),
  ('googlemail.com', 'unknown', 0.00, TRUE),
  ('outlook.com', 'unknown', 0.00, TRUE),
  ('hotmail.com', 'unknown', 0.00, TRUE),
  ('live.com', 'unknown', 0.00, TRUE),
  ('yahoo.com', 'unknown', 0.00, TRUE),
  ('yahoo.it', 'unknown', 0.00, TRUE),
  ('yahoo.de', 'unknown', 0.00, TRUE),
  ('yahoo.fr', 'unknown', 0.00, TRUE),
  ('icloud.com', 'unknown', 0.00, TRUE),
  ('me.com', 'unknown', 0.00, TRUE),
  ('aol.com', 'unknown', 0.00, TRUE),
  ('libero.it', 'unknown', 0.00, TRUE),
  ('virgilio.it', 'unknown', 0.00, TRUE),
  ('alice.it', 'unknown', 0.00, TRUE),
  ('tin.it', 'unknown', 0.00, TRUE),
  ('tiscali.it', 'unknown', 0.00, TRUE),
  ('fastwebnet.it', 'unknown', 0.00, TRUE),
  ('web.de', 'unknown', 0.00, TRUE),
  ('gmx.de', 'unknown', 0.00, TRUE),
  ('gmx.net', 'unknown', 0.00, TRUE),
  ('t-online.de', 'unknown', 0.00, TRUE),
  ('orange.fr', 'unknown', 0.00, TRUE),
  ('free.fr', 'unknown', 0.00, TRUE),
  ('wanadoo.fr', 'unknown', 0.00, TRUE),
  ('pec.it', 'unknown', 0.00, TRUE),
  ('legalmail.it', 'unknown', 0.00, TRUE);
