-- =============================================================================
-- v_msg_list2 - Simplified with direct JOIN on is_primary
-- =============================================================================
-- Uses is_primary=1 for BOTH inbound and outbound messages
-- No more CASE WHEN outbound checks - just direct JOIN to primary recipient
-- =============================================================================

CREATE OR REPLACE VIEW v_msg_list2 AS
SELECT
  msg.id AS id,
  CONVERT_TZ(msg.new_date, 'UTC', 'CET') AS new_date,
  CONVERT_TZ(msg.send_date, 'UTC', 'CET') AS send_date,
  LEAST((TO_DAYS(CURDATE()) - msg.rdays), 99) AS past_days,
  msg.rdays AS rdays,
  msg.status AS status,
  z1.active AS active,
  msg.klass AS klass,
  msg.outbound AS outbound,
  msg.op_ud AS op_ud,
  msg.tone AS tone,
  msg.bookmark AS bookmark,
  msg.first_id AS first_id,
  msg.prev_id AS prev_id,
  msg.from_ud AS from_ud,
  msg.to_ud AS to_ud,
  msg.sent_num AS sent_num,
  msg.user_info AS user_info,
  msg.subject AS subject,
  msg.abstract AS abstract,
  msg.comment AS comment,
  msg.files_num AS files_num,
  msg.fbody AS fbody,
  msg.fuser AS fuser,

  -- Direct from primary recipient
  COALESCE(me.display_name, me.address) AS user_name,
  me.address AS user_email,
  me.display_code AS user_code,
  IF(me.display_kind >= 0, me.display_kind, NULL) AS user_isbuyer,
  COALESCE(me.user_ud, me.buyer_id, me.producer_id) AS user_id,
  COALESCE(h.to_num, 1) AS recipients_count,
  me.display_classification AS user_classification,
  me.display_code AS company_code,
  me.display_name AS company_name,
  IF(me.display_kind >= 0, me.display_kind, NULL) AS company_isbuyer,
  me.display_kind AS display_kind,
  COALESCE(h.hops_num, 1) AS hops_num

FROM msg
LEFT JOIN z_msg_status z1 ON msg.status = z1.id
LEFT JOIN msg_hops h ON msg.id = h.msg_id AND h.outbound = msg.outbound AND h.is_primary = 1
LEFT JOIN msg_emails me ON h.email_ud = me.id;


-- =============================================================================
-- v_msgh_list2 - Same for archived messages
-- =============================================================================

CREATE OR REPLACE VIEW v_msgh_list2 AS
SELECT
  msg.id AS id,
  CONVERT_TZ(msg.new_date, 'UTC', 'CET') AS new_date,
  CONVERT_TZ(msg.send_date, 'UTC', 'CET') AS send_date,
  LEAST((TO_DAYS(CURDATE()) - msg.rdays), 99) AS past_days,
  msg.rdays AS rdays,
  msg.status AS status,
  msg.klass AS klass,
  msg.outbound AS outbound,
  msg.op_ud AS op_ud,
  msg.tone AS tone,
  msg.bookmark AS bookmark,
  msg.first_id AS first_id,
  msg.prev_id AS prev_id,
  msg.from_ud AS from_ud,
  msg.to_ud AS to_ud,
  msg.sent_num AS sent_num,
  msg.user_info AS user_info,
  msg.subject AS subject,
  msg.abstract AS abstract,
  msg.comment AS comment,
  msg.files_num AS files_num,
  msg.fbody AS fbody,
  msg.fuser AS fuser,

  -- Direct from primary recipient
  COALESCE(me.display_name, me.address) AS user_name,
  me.address AS user_email,
  me.display_code AS user_code,
  IF(me.display_kind >= 0, me.display_kind, NULL) AS user_isbuyer,
  COALESCE(me.user_ud, me.buyer_id, me.producer_id) AS user_id,
  COALESCE(h.to_num, 1) AS recipients_count,
  me.display_classification AS user_classification,
  me.display_code AS company_code,
  me.display_name AS company_name,
  IF(me.display_kind >= 0, me.display_kind, NULL) AS company_isbuyer,
  me.display_kind AS display_kind,
  COALESCE(h.hops_num, 1) AS hops_num

FROM msgh msg
LEFT JOIN msg_hops h ON msg.id = h.msg_id AND h.outbound = msg.outbound AND h.is_primary = 1
LEFT JOIN msg_emails me ON h.email_ud = me.id;
