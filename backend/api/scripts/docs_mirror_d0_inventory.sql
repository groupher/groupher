\set ON_ERROR_STOP on
-- Run against the intended database: psql -X -v ON_ERROR_STOP=1 -f scripts/docs_mirror_d0_inventory.sql
-- Read-only point-in-time inventory. Revision differences are candidates, not content diffs.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT current_database() AS database, transaction_timestamp() AS captured_at;
SELECT q.community_id, qa.queue_id, qa.article_id, qa.working_copy_id,
       w.revision AS work_revision, qa.source_snapshot_id, s.source_revision,
       s.source_working_copy_id,
       CASE WHEN s.source_working_copy_id = w.id AND s.source_revision = w.revision
            THEN 'same_work_and_revision_still_review_shared_state' ELSE 'requires_content_comparison' END AS comparison_status
FROM cms.docs_queue_articles qa
JOIN cms.docs_publish_queues q ON q.id = qa.queue_id
JOIN cms.article_working_copies w ON w.id = qa.working_copy_id AND w.article_id = qa.article_id
JOIN cms.article_snapshots s ON s.id = qa.source_snapshot_id AND s.article_id = qa.article_id
ORDER BY q.community_id, qa.article_id;
-- Compare source with Q and current shared default / Public independently.
-- Flags are evidence for review, not permission to discard; missing relations remain unknown.
SELECT qa.queue_id, qa.article_id, qa.working_copy_id, qa.source_snapshot_id,
       shared.id AS default_working_copy_id, pub.snapshot_id AS public_snapshot_id,
       (w.title, w.digest, w.slug) IS DISTINCT FROM (s.title, s.digest, s.slug) AS metadata_differs_from_source,
       wb.json IS DISTINCT FROM sb.json AS body_json_differs_from_source,
       (to_jsonb(wd) - ARRAY['working_copy_id','inserted_at','updated_at'])
         IS DISTINCT FROM (to_jsonb(sd) - ARRAY['snapshot_id','inserted_at']) AS doc_fields_differ_from_source,
       ARRAY(SELECT tag_id FROM cms.article_working_copy_tags WHERE working_copy_id=w.id ORDER BY tag_id)
         IS DISTINCT FROM ARRAY(SELECT tag_id FROM cms.article_snapshot_tags WHERE snapshot_id=s.id ORDER BY tag_id) AS tags_differ_from_source,
       (to_jsonb(wc) - ARRAY['id','inserted_at','updated_at'])
         IS DISTINCT FROM (to_jsonb(sc) - ARRAY['id','captured_at','inserted_at']) AS cover_differs_from_source,
       (SELECT coalesce(jsonb_agg(to_jsonb(r) - ARRAY['id','working_copy_id','snapshot_id','inserted_at','updated_at'] ORDER BY (to_jsonb(r) - ARRAY['id','working_copy_id','snapshot_id','inserted_at','updated_at'])::text), '[]'::jsonb) FROM cms.article_asset_refs r WHERE r.working_copy_id=w.id)
         IS DISTINCT FROM
       (SELECT coalesce(jsonb_agg(to_jsonb(r) - ARRAY['id','working_copy_id','snapshot_id','inserted_at','updated_at'] ORDER BY (to_jsonb(r) - ARRAY['id','working_copy_id','snapshot_id','inserted_at','updated_at'])::text), '[]'::jsonb) FROM cms.article_asset_refs r WHERE r.snapshot_id=s.id) AS asset_refs_differ_from_source,
       CASE WHEN shared.id IS NULL THEN NULL ELSE
         (w.title, w.digest, w.slug, wb.json) IS DISTINCT FROM (shared.title, shared.digest, shared.slug, db.json)
       END AS basic_content_differs_from_default,
       CASE WHEN ps.id IS NULL THEN NULL ELSE
         (w.title, w.digest, w.slug, wb.json) IS DISTINCT FROM (ps.title, ps.digest, ps.slug, pb.json)
       END AS basic_content_differs_from_public,
       CASE WHEN shared.id IS NULL THEN NULL ELSE
         (to_jsonb(wd) - ARRAY['working_copy_id','inserted_at','updated_at']) IS DISTINCT FROM
         (to_jsonb(dd) - ARRAY['working_copy_id','inserted_at','updated_at']) END AS doc_fields_differ_from_default,
       CASE WHEN shared.id IS NULL THEN NULL ELSE
         ARRAY(SELECT tag_id FROM cms.article_working_copy_tags WHERE working_copy_id=w.id ORDER BY tag_id) IS DISTINCT FROM
         ARRAY(SELECT tag_id FROM cms.article_working_copy_tags WHERE working_copy_id=shared.id ORDER BY tag_id) END AS tags_differ_from_default,
       CASE WHEN shared.id IS NULL THEN NULL ELSE
         (to_jsonb(wc) - ARRAY['id','inserted_at','updated_at']) IS DISTINCT FROM
         (to_jsonb(dc) - ARRAY['id','inserted_at','updated_at']) END AS cover_differs_from_default,
       CASE WHEN shared.id IS NULL THEN NULL ELSE
         (SELECT coalesce(jsonb_agg(to_jsonb(r) - ARRAY['id','working_copy_id','snapshot_id','inserted_at','updated_at'] ORDER BY (to_jsonb(r) - ARRAY['id','working_copy_id','snapshot_id','inserted_at','updated_at'])::text), '[]'::jsonb) FROM cms.article_asset_refs r WHERE r.working_copy_id=w.id) IS DISTINCT FROM
         (SELECT coalesce(jsonb_agg(to_jsonb(r) - ARRAY['id','working_copy_id','snapshot_id','inserted_at','updated_at'] ORDER BY (to_jsonb(r) - ARRAY['id','working_copy_id','snapshot_id','inserted_at','updated_at'])::text), '[]'::jsonb) FROM cms.article_asset_refs r WHERE r.working_copy_id=shared.id) END AS assets_differ_from_default,
       CASE WHEN ps.id IS NULL THEN NULL ELSE
         (to_jsonb(wd) - ARRAY['working_copy_id','inserted_at','updated_at']) IS DISTINCT FROM
         (to_jsonb(pd) - ARRAY['snapshot_id','inserted_at']) END AS doc_fields_differ_from_public,
       CASE WHEN ps.id IS NULL THEN NULL ELSE
         ARRAY(SELECT tag_id FROM cms.article_working_copy_tags WHERE working_copy_id=w.id ORDER BY tag_id) IS DISTINCT FROM
         ARRAY(SELECT tag_id FROM cms.article_snapshot_tags WHERE snapshot_id=ps.id ORDER BY tag_id) END AS tags_differ_from_public,
       CASE WHEN ps.id IS NULL THEN NULL ELSE
         (to_jsonb(wc) - ARRAY['id','inserted_at','updated_at']) IS DISTINCT FROM
         (to_jsonb(pc) - ARRAY['id','captured_at','inserted_at']) END AS cover_differs_from_public,
       CASE WHEN ps.id IS NULL THEN NULL ELSE
         (SELECT coalesce(jsonb_agg(to_jsonb(r) - ARRAY['id','working_copy_id','snapshot_id','inserted_at','updated_at'] ORDER BY (to_jsonb(r) - ARRAY['id','working_copy_id','snapshot_id','inserted_at','updated_at'])::text), '[]'::jsonb) FROM cms.article_asset_refs r WHERE r.working_copy_id=w.id) IS DISTINCT FROM
         (SELECT coalesce(jsonb_agg(to_jsonb(r) - ARRAY['id','working_copy_id','snapshot_id','inserted_at','updated_at'] ORDER BY (to_jsonb(r) - ARRAY['id','working_copy_id','snapshot_id','inserted_at','updated_at'])::text), '[]'::jsonb) FROM cms.article_asset_refs r WHERE r.snapshot_id=ps.id) END AS assets_differ_from_public,
       'manual_review_required' AS disposition
FROM cms.docs_queue_articles qa
JOIN cms.article_working_copies w ON w.id=qa.working_copy_id AND w.article_id=qa.article_id
JOIN cms.article_snapshots s ON s.id=qa.source_snapshot_id AND s.article_id=qa.article_id
LEFT JOIN cms.article_bodies wb ON wb.id=w.body_id AND wb.article_id=w.article_id
LEFT JOIN cms.article_bodies sb ON sb.id=s.body_id AND sb.article_id=s.article_id
LEFT JOIN cms.article_working_copy_docs wd ON wd.working_copy_id=w.id
LEFT JOIN cms.article_snapshot_docs sd ON sd.snapshot_id=s.id
LEFT JOIN cms.cover_edit_working_copies wc ON wc.id=w.cover_edit_working_copy_id
LEFT JOIN cms.cover_edit_snapshots sc ON sc.id=s.cover_edit_snapshot_id
LEFT JOIN cms.article_working_copies shared ON shared.article_id=qa.article_id AND shared.scope_type='default'
LEFT JOIN cms.article_bodies db ON db.id=shared.body_id AND db.article_id=shared.article_id
LEFT JOIN cms.article_working_copy_docs dd ON dd.working_copy_id=shared.id
LEFT JOIN cms.cover_edit_working_copies dc ON dc.id=shared.cover_edit_working_copy_id
LEFT JOIN cms.article_publics pub ON pub.article_id=qa.article_id
LEFT JOIN cms.article_snapshots ps ON ps.id=pub.snapshot_id AND ps.article_id=qa.article_id
LEFT JOIN cms.article_bodies pb ON pb.id=ps.body_id AND pb.article_id=ps.article_id
LEFT JOIN cms.article_snapshot_docs pd ON pd.snapshot_id=ps.id
LEFT JOIN cms.cover_edit_snapshots pc ON pc.id=ps.cover_edit_snapshot_id
ORDER BY qa.queue_id, qa.article_id;
SELECT qa.queue_id, qa.article_id,
       (SELECT count(*) FROM cms.article_asset_refs r WHERE r.working_copy_id = qa.working_copy_id) AS work_asset_refs,
       (SELECT count(*) FROM cms.article_asset_refs r WHERE r.snapshot_id = qa.source_snapshot_id) AS source_asset_refs
FROM cms.docs_queue_articles qa ORDER BY qa.queue_id, qa.article_id;
-- Complete ref identities are needed to preserve assets, not just counts.
SELECT qa.queue_id, qa.article_id, r.working_copy_id, r.snapshot_id, r.asset_id,
       r.usage, r.block_id, r.position, r.title, r.alt
FROM cms.docs_queue_articles qa
JOIN cms.article_asset_refs r ON r.working_copy_id = qa.working_copy_id OR r.snapshot_id = qa.source_snapshot_id
ORDER BY qa.queue_id, qa.article_id, r.id;
SELECT community_id, article_id, base_snapshot_id, published_snapshot_id, default_revision
FROM cms.docs_post_publish_conflicts ORDER BY community_id, article_id;
SELECT community_id, id, queue_id, queue_revision, sealed, approved_at
FROM cms.docs_publish_approvals ORDER BY community_id, id;
SELECT a.community_id, aa.approval_id, aa.article_id, aa.snapshot_id,
       s.body_id, s.cover_edit_snapshot_id, r.asset_id, r.usage, r.block_id, r.position
FROM cms.docs_publish_approval_articles aa
JOIN cms.docs_publish_approvals a ON a.id = aa.approval_id
LEFT JOIN cms.article_snapshots s ON s.id = aa.snapshot_id AND s.article_id = aa.article_id
LEFT JOIN cms.article_asset_refs r ON r.snapshot_id = aa.snapshot_id
ORDER BY a.community_id, aa.approval_id, aa.article_id, r.id;
SELECT release_id, article_id, action, snapshot_id
FROM cms.doc_publish_release_articles ORDER BY release_id, article_id;
SELECT ra.release_id, ra.article_id, ra.snapshot_id, s.body_id, s.cover_edit_snapshot_id,
       r.asset_id, r.usage, r.block_id, r.position
FROM cms.doc_publish_release_articles ra
LEFT JOIN cms.article_snapshots s ON s.id = ra.snapshot_id AND s.article_id = ra.article_id
LEFT JOIN cms.article_asset_refs r ON r.snapshot_id = ra.snapshot_id
ORDER BY ra.release_id, ra.article_id, r.id;
SELECT a.community_id, a.hash_id, a.root_ref,
       count(DISTINCT n.id) AS tree_members, count(DISTINCT d.id) AS article_members,
       count(DISTINCT n.id) FILTER (WHERE n.node_id = a.root_ref) AS matching_roots
FROM cms.trash_actions a
LEFT JOIN cms.trashed_doc_tree_nodes n ON n.trash_action_id = a.id AND n.community_id = a.community_id
LEFT JOIN cms.trashed_doc_articles d ON d.trash_action_id = a.id AND d.community_id = a.community_id
WHERE a.root_type = 'doc_tree_node'
GROUP BY a.id ORDER BY a.community_id, a.id;
-- Per-stage disconnected roots flag historical multi-root candidates for review.
-- Different stages can legitimately contain different members; this is not an automatic deletion decision.
WITH stage_members AS (
  SELECT n.trash_action_id, n.node_id, v.stage, v.snapshot
  FROM cms.trashed_doc_tree_nodes n
  CROSS JOIN LATERAL (VALUES ('draft',n.draft_snapshot),('public',n.public_snapshot),('queue',n.queue_snapshot)) v(stage,snapshot)
  WHERE v.snapshot IS NOT NULL
), roots AS (
  SELECT m.trash_action_id, m.stage, m.node_id, m.snapshot->>'parent_node_id' AS parent_node_id
  FROM stage_members m
  WHERE NOT EXISTS (SELECT 1 FROM stage_members parent
                    WHERE parent.trash_action_id=m.trash_action_id AND parent.stage=m.stage
                      AND parent.node_id=m.snapshot->>'parent_node_id')
)
SELECT a.community_id, a.hash_id, a.root_ref, r.stage,
       count(*) AS stage_root_count, array_agg(r.node_id ORDER BY r.node_id) AS stage_roots,
       count(*) > 1 AS multiple_root_candidate,
       bool_or(r.node_id=a.root_ref) AS includes_declared_root
FROM roots r JOIN cms.trash_actions a ON a.id=r.trash_action_id
WHERE a.root_type='doc_tree_node'
GROUP BY a.community_id,a.hash_id,a.root_ref,r.stage
ORDER BY a.community_id,a.hash_id,r.stage;
-- P2B introduces this table; report absence explicitly until its migration exists.
SELECT to_regclass('cms.article_binding_trash') IS NOT NULL AS binding_trash_table_exists \gset
\if :binding_trash_table_exists
SELECT bt.* FROM cms.article_binding_trash bt
JOIN cms.article_bindings b ON b.id = bt.binding_id
JOIN cms.articles a ON a.id = b.article_id
WHERE a.thread = 'doc';
\else
\echo 'article_binding_trash absent: Doc binding anomaly check unavailable'
\endif
SELECT conrelid::regclass AS source_table, conname, confrelid::regclass AS target_table,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'cms'::regnamespace
  AND (conrelid::regclass::text LIKE '%docs_%' OR conrelid::regclass::text LIKE '%doc_publish%'
       OR confrelid IN ('cms.article_snapshots'::regclass, 'cms.article_working_copies'::regclass))
ORDER BY conrelid::regclass::text, conname;
COMMIT;
