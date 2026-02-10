-- Migration: Add name initial columns and extraction version to msg_emails
-- Stores computed initials (e.g., "M." for "Marco") for matching records by initial
-- Stores extraction pipeline version for selective re-processing

ALTER TABLE msg_emails
  ADD COLUMN ai_name1pre VARCHAR(10) DEFAULT NULL COMMENT 'Initial of ai_name1 (e.g., M.)',
  ADD COLUMN ai_name2pre VARCHAR(10) DEFAULT NULL COMMENT 'Initial of ai_name2 (e.g., R.)',
  ADD COLUMN ai_version SMALLINT UNSIGNED DEFAULT NULL COMMENT 'Extraction pipeline version';

CREATE INDEX idx_ai_name1pre ON msg_emails (ai_name1pre);
CREATE INDEX idx_ai_name2pre ON msg_emails (ai_name2pre);
CREATE INDEX idx_ai_version ON msg_emails (ai_version);

ALTER TABLE msg_emails
  ADD COLUMN ai_name3 VARCHAR(100) DEFAULT NULL COMMENT 'Functional/role label for non-personal addresses';

CREATE INDEX idx_ai_name3 ON msg_emails (ai_name3);
