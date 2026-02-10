-- Step 2: Backfill data (run AFTER step1_drop_triggers.sql)

-- Backfill msg_emails
-- Note: display_code is cleared if it equals display_name to avoid redundancy
UPDATE msg_emails me
LEFT JOIN users u ON me.user_ud = u.id
SET
  me.display_classification = CASE
    WHEN me.user_ud IS NOT NULL THEN 'full'
    WHEN me.buyer_id IS NOT NULL OR me.producer_id IS NOT NULL THEN 'partial'
    ELSE 'unknown'
  END,
  me.display_name = CASE
    WHEN me.user_ud IS NOT NULL THEN COALESCE(u.name, me.user_name)
    ELSE COALESCE(me.user_name, me.input)
  END,
  me.display_code = CASE
    -- If code = name, set to empty to avoid redundancy
    WHEN (CASE WHEN me.user_ud IS NOT NULL THEN COALESCE(u.user_code, me.user_code) ELSE me.address END)
         = (CASE WHEN me.user_ud IS NOT NULL THEN COALESCE(u.name, me.user_name) ELSE COALESCE(me.user_name, me.input) END)
    THEN ''
    ELSE CASE
      WHEN me.user_ud IS NOT NULL THEN COALESCE(u.user_code, me.user_code)
      ELSE me.address
    END
  END,
  me.display_kind = CASE
    WHEN me.user_ud IS NOT NULL THEN
      CASE
        WHEN COALESCE(u.buyer_id, me.buyer_id) IS NOT NULL THEN 1
        WHEN COALESCE(u.producer_id, me.producer_id) IS NOT NULL THEN 0
        ELSE -1
      END
    WHEN me.buyer_id IS NOT NULL THEN 1
    WHEN me.producer_id IS NOT NULL THEN 0
    ELSE -1
  END;

SELECT 'msg_emails backfill complete' as status;

-- Reset msg_hops
UPDATE msg_hops SET is_primary = 0, to_num = NULL, hops_num = NULL WHERE outbound = 1;

SELECT 'msg_hops reset complete' as status;

-- Backfill msg_hops counts
UPDATE msg_hops h
JOIN (
  SELECT
    h2.msg_id,
    COUNT(DISTINCT CASE WHEN h2.kind = 'to' THEN COALESCE(me.user_ud, me.address, h2.address) END) as to_num,
    COUNT(DISTINCT COALESCE(me.user_ud, me.address, h2.address)) as hops_num
  FROM msg_hops h2
  LEFT JOIN msg_emails me ON h2.email_ud = me.id
  WHERE h2.outbound = 1 AND h2.kind IN ('to', 'cc', 'bcc')
  GROUP BY h2.msg_id
) counts ON h.msg_id = counts.msg_id
SET h.to_num = counts.to_num, h.hops_num = counts.hops_num
WHERE h.outbound = 1;

SELECT 'msg_hops counts backfill complete' as status;

-- Set is_primary
UPDATE msg_hops h
JOIN (
  SELECT msg_id,
    CAST(SUBSTRING_INDEX(
      GROUP_CONCAT(h2.id ORDER BY
        FIELD(me.display_classification, 'full', 'partial', 'unknown', NULL),
        h2.pos
      ), ',', 1
    ) AS UNSIGNED) as best_id
  FROM msg_hops h2
  LEFT JOIN msg_emails me ON h2.email_ud = me.id
  WHERE h2.outbound = 1 AND h2.kind = 'to'
  GROUP BY h2.msg_id
) best ON h.id = best.best_id
SET h.is_primary = 1;

SELECT 'is_primary backfill complete. Run step3 next.' as status;
