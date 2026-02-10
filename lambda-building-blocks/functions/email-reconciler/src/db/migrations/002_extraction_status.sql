-- Migration: Add AI extraction columns to msg_emails
-- Stores LLM extraction output with ai_ prefix to distinguish from human-verified data

-- Add AI extraction output columns (prefixed with ai_)
ALTER TABLE msg_emails
  ADD COLUMN ai_name1 VARCHAR(100) DEFAULT NULL COMMENT 'AI extracted given name + middle names',
  ADD COLUMN ai_name2 VARCHAR(100) DEFAULT NULL COMMENT 'AI extracted family/surname',
  ADD COLUMN ai_genre ENUM('Mr.', 'Ms.') DEFAULT NULL COMMENT 'AI inferred gender from honorifics',
  ADD COLUMN ai_email VARCHAR(255) DEFAULT NULL COMMENT 'AI normalized email address',
  ADD COLUMN ai_confidence DECIMAL(3,2) DEFAULT NULL COMMENT 'AI extraction confidence 0.00-1.00',
  ADD COLUMN ai_status ENUM(
    'unprocessed',      -- Never sent to extraction pipeline
    'extracted_high',   -- Confidence >= 0.85, all fields populated
    'extracted_medium', -- Confidence 0.60-0.85, needs review
    'extracted_low',    -- Confidence < 0.60, flagged for Phase 2
    'reviewed',         -- Human verified/corrected
    'not_applicable'    -- Service address (info@, support@)
  ) DEFAULT 'unprocessed' COMMENT 'AI extraction status',
  ADD COLUMN ai_notes TEXT DEFAULT NULL COMMENT 'AI reasoning and processing notes',
  ADD COLUMN ai_processed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'When AI extraction was performed',
  ADD COLUMN ai_model VARCHAR(50) DEFAULT NULL COMMENT 'Model used for extraction',
  ADD COLUMN ai_is_personal BOOLEAN DEFAULT NULL COMMENT 'AI determined if personal vs service address',
  ADD COLUMN ai_domain_convention VARCHAR(50) DEFAULT NULL COMMENT 'Detected email pattern for domain';

-- Indexes for efficient querying by AI extraction status
CREATE INDEX idx_ai_status ON msg_emails (ai_status);
CREATE INDEX idx_ai_confidence ON msg_emails (ai_confidence);
CREATE INDEX idx_ai_processed_at ON msg_emails (ai_processed_at);

-- Composite index for finding unprocessed records (for batch processing)
CREATE INDEX idx_ai_unprocessed ON msg_emails (ai_status, user_ud, id);

-- Composite index for finding records needing review
CREATE INDEX idx_ai_review_needed ON msg_emails (ai_status, ai_confidence);

-- View for unprocessed records without user_ud (priority processing)
CREATE OR REPLACE VIEW v_ai_unprocessed AS
SELECT
  id, input, address, domain, user_name, user_genre,
  user_ud, buyer_id, producer_id, display_classification
FROM msg_emails
WHERE (ai_status = 'unprocessed' OR ai_status IS NULL)
  AND user_ud IS NULL
ORDER BY id DESC;

-- View for records needing human review
CREATE OR REPLACE VIEW v_ai_review_needed AS
SELECT
  id, input, address, domain,
  ai_name1, ai_name2, ai_genre, ai_email,
  ai_status, ai_confidence, ai_notes,
  ai_processed_at, ai_model
FROM msg_emails
WHERE ai_status IN ('extracted_medium', 'extracted_low')
ORDER BY ai_confidence ASC, id DESC;

-- View for AI extraction statistics
CREATE OR REPLACE VIEW v_ai_extraction_stats AS
SELECT
  COALESCE(ai_status, 'unprocessed') as status,
  COUNT(*) as count,
  AVG(ai_confidence) as avg_confidence,
  MIN(ai_processed_at) as oldest_extraction,
  MAX(ai_processed_at) as newest_extraction
FROM msg_emails
GROUP BY ai_status
ORDER BY
  FIELD(COALESCE(ai_status, 'unprocessed'),
    'unprocessed', 'extracted_low', 'extracted_medium',
    'extracted_high', 'reviewed', 'not_applicable');

-- View for AI extraction by domain (identify problematic domains)
CREATE OR REPLACE VIEW v_ai_extraction_by_domain AS
SELECT
  domain,
  COUNT(*) as total_count,
  SUM(CASE WHEN ai_status = 'extracted_high' THEN 1 ELSE 0 END) as high_confidence,
  SUM(CASE WHEN ai_status = 'extracted_medium' THEN 1 ELSE 0 END) as medium_confidence,
  SUM(CASE WHEN ai_status = 'extracted_low' THEN 1 ELSE 0 END) as low_confidence,
  SUM(CASE WHEN ai_status = 'unprocessed' OR ai_status IS NULL THEN 1 ELSE 0 END) as unprocessed,
  AVG(ai_confidence) as avg_confidence
FROM msg_emails
WHERE domain IS NOT NULL AND domain != ''
GROUP BY domain
HAVING total_count >= 3
ORDER BY low_confidence DESC, avg_confidence ASC;
