-- ========================================
-- Phase 1.2: Performance Baseline Queries
-- ========================================

-- First, get a test user ID
SELECT user_id, COUNT(*) as email_count
FROM email_metadata
GROUP BY user_id
ORDER BY email_count DESC
LIMIT 5;

-- Use one of the user IDs above for the following queries
-- Replace 'YOUR_TEST_USER_ID' with an actual user ID

-- 1. Dashboard Email Load (first 50 emails)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, gmail_message_id, subject, snippet, from_email, from_name, 
       to_emails, received_at, is_read, labels
FROM email_metadata
WHERE user_id = 'YOUR_TEST_USER_ID'
ORDER BY received_at DESC
LIMIT 50;

-- 2. Email Search (by subject/from)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, gmail_message_id, subject, snippet, from_email, received_at
FROM email_metadata
WHERE user_id = 'YOUR_TEST_USER_ID' 
  AND (subject ILIKE '%important%' OR from_email ILIKE '%important%')
ORDER BY received_at DESC
LIMIT 20;

-- 3. Rule Evaluation with Actions
EXPLAIN (ANALYZE, BUFFERS)
SELECT r.id, r.name, r.conditions, r.enabled, r.priority,
       ra.id as action_id, ra.action_type, ra.parameters
FROM email_rules_v2 r
LEFT JOIN rule_actions ra ON r.id = ra.rule_id
WHERE r.user_id = 'YOUR_TEST_USER_ID' AND r.enabled = true
ORDER BY r.priority ASC;

-- 4. Bulk Email Update (mark as read)
-- First get some email IDs
SELECT id FROM email_metadata 
WHERE user_id = 'YOUR_TEST_USER_ID' 
LIMIT 10;

-- Then run the update (replace with actual IDs)
EXPLAIN (ANALYZE, BUFFERS)
UPDATE email_metadata
SET is_read = true, updated_at = NOW()
WHERE user_id = 'YOUR_TEST_USER_ID' 
  AND id IN ('id1', 'id2', 'id3')
RETURNING id;

-- 5. Email Count by Label (with date range)
EXPLAIN (ANALYZE, BUFFERS)
SELECT unnest(labels) as label, COUNT(*) as count
FROM email_metadata
WHERE user_id = 'YOUR_TEST_USER_ID' 
  AND received_at >= '2024-01-01'
  AND received_at <= '2024-12-31'
GROUP BY label
ORDER BY count DESC;

-- 6. Complex Join Query (emails with enhanced metadata)
EXPLAIN (ANALYZE, BUFFERS)
SELECT em.id, em.subject, em.from_email,
       eme.sentiment, eme.summary, eme.categories
FROM email_metadata em
INNER JOIN email_metadata_enhanced eme ON em.id = eme.email_id
WHERE em.user_id = 'YOUR_TEST_USER_ID' 
  AND eme.user_id = 'YOUR_TEST_USER_ID'
  AND em.received_at >= '2024-01-01'
LIMIT 100;


-- ========================================
-- Key Metrics to Record from EXPLAIN ANALYZE
-- ========================================
-- For each query above, record:
-- 1. Total Execution Time (ms)
-- 2. Planning Time (ms)
-- 3. Whether it uses Index Scan or Seq Scan
-- 4. Rows returned vs rows scanned
-- 5. Shared buffer hits/reads
--
-- Save these metrics as your baseline before enabling RLS
