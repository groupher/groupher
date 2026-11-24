-- D0 report-only inventory for the Docs Queue body cutover.
-- Run against an explicitly selected development or rehearsal database only.
-- This script must stay read-only and must not be used against production.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT current_database() AS database,
       current_setting('transaction_read_only') AS read_only;

SELECT q.community_id,
       c.slug AS community_slug,
       q.queue_revision,
       q.tree_lock_version,
       q.public_release_id,
       q.latest_approval_id,
       count(qa.article_id) AS queued_articles
FROM cms.docs_publish_queues AS q
JOIN cms.communities AS c ON c.id = q.community_id
LEFT JOIN cms.docs_queue_articles AS qa ON qa.queue_id = q.id
GROUP BY q.community_id, c.slug, q.queue_revision, q.tree_lock_version,
         q.public_release_id, q.latest_approval_id
ORDER BY q.community_id;

SELECT count(*) AS queue_article_rows,
       count(*) FILTER (WHERE a.thread <> 'doc') AS non_doc_queue_article_rows,
       count(*) FILTER (WHERE a.thread = 'doc' AND w.scope_type <> 'default')
         AS non_default_working_copy_rows,
       count(*) FILTER (WHERE a.thread = 'doc' AND w.revision > 1)
         AS working_copies_revision_gt_1,
       count(*) FILTER (WHERE a.thread = 'doc' AND w.updated_at > w.inserted_at)
         AS edited_after_create,
       count(*) FILTER (
         WHERE a.thread = 'doc'
           AND (w.title IS DISTINCT FROM s.title
            OR w.digest IS DISTINCT FROM s.digest
            OR w.slug IS DISTINCT FROM s.slug
            OR wb.json IS DISTINCT FROM sb.json
            OR wd.subtitle IS DISTINCT FROM sd.subtitle
            OR wd.link_addr IS DISTINCT FROM sd.link_addr
            OR wd.template_key IS DISTINCT FROM sd.template_key
            OR wd.cover_url IS DISTINCT FROM sd.cover_url
            OR wd.cover_url_dark IS DISTINCT FROM sd.cover_url_dark
            OR cewc.format_version IS DISTINCT FROM ces.format_version
            OR cewc.canvas_width IS DISTINCT FROM ces.canvas_width
            OR cewc.canvas_height IS DISTINCT FROM ces.canvas_height
            OR cewc.light IS DISTINCT FROM ces.light
            OR cewc.dark IS DISTINCT FROM ces.dark)
       ) AS copies_differ_from_source_snapshot
FROM cms.docs_queue_articles AS qa
JOIN cms.articles AS a ON a.id = qa.article_id
JOIN cms.article_working_copies AS w ON w.id = qa.working_copy_id
JOIN cms.article_bodies AS wb ON wb.id = w.body_id
JOIN cms.article_snapshots AS s
  ON s.id = qa.source_snapshot_id AND s.article_id = qa.article_id
JOIN cms.article_bodies AS sb ON sb.id = s.body_id
LEFT JOIN cms.article_working_copy_docs AS wd ON wd.working_copy_id = w.id
LEFT JOIN cms.article_snapshot_docs AS sd ON sd.snapshot_id = s.id
LEFT JOIN cms.cover_edit_working_copies AS cewc ON cewc.id = w.cover_edit_working_copy_id
LEFT JOIN cms.cover_edit_snapshots AS ces ON ces.id = s.cover_edit_snapshot_id;

SELECT 'approval' AS reference_type,
       count(*) AS total,
       count(*) FILTER (WHERE sealed) AS sealed
FROM cms.docs_publish_approvals
UNION ALL
SELECT 'release', count(*), count(*) FILTER (WHERE sealed)
FROM cms.doc_publish_releases;

SELECT count(*) AS approval_article_rows
FROM cms.docs_publish_approval_articles;

SELECT 'queue_article_contributors' AS contributor_type, count(*) AS total
FROM cms.docs_queue_article_contributors
UNION ALL
SELECT 'queue_tree_contributors', count(*)
FROM cms.docs_queue_tree_contributors
UNION ALL
SELECT 'approval_contributors', count(*)
FROM cms.docs_publish_approval_contributors;

SELECT count(*) AS queue_tree_change_rows
FROM cms.docs_queue_tree_changes;

SELECT count(*) AS release_article_rows
FROM cms.doc_publish_release_articles;

SELECT count(*) AS queue_working_copy_asset_refs
FROM cms.article_asset_refs AS refs
JOIN cms.docs_queue_articles AS queue_articles
  ON queue_articles.working_copy_id = refs.working_copy_id;

SELECT count(*) AS queue_source_snapshot_asset_refs
FROM cms.article_asset_refs AS refs
JOIN cms.docs_queue_articles AS queue_articles
  ON queue_articles.source_snapshot_id = refs.snapshot_id;

SELECT count(*) AS queue_working_copy_cover_refs
FROM cms.article_working_copies AS working_copies
JOIN cms.docs_queue_articles AS queue_articles
  ON queue_articles.working_copy_id = working_copies.id
WHERE working_copies.cover_edit_working_copy_id IS NOT NULL;

SELECT count(*) AS approval_snapshot_asset_refs
FROM cms.article_asset_refs AS refs
JOIN cms.docs_publish_approval_articles AS approval_articles
  ON approval_articles.snapshot_id = refs.snapshot_id;

SELECT count(*) AS release_snapshot_asset_refs
FROM cms.article_asset_refs AS refs
JOIN cms.doc_publish_release_articles AS release_articles
  ON release_articles.snapshot_id = refs.snapshot_id;

SELECT count(*) AS queue_conflict_rows
FROM cms.docs_post_publish_conflicts;

ROLLBACK;
