# This exercise creates fixture rows and must only run in the disposable B0 database.
[[database]] = GroupherServer.Repo.query!("SELECT current_database()").rows
expected = System.get_env("DOCS_B0_DISPOSABLE_DATABASE")

unless Mix.env() == :test and is_binary(expected) and expected == database and
         String.starts_with?(database, "groupher_docs_b0_") do
  raise "B0 constraint exercise requires an explicitly named disposable test database"
end

alias GroupherServer.{Repo, CMS}
alias CMS.Model.{Article, ArticleBinding, ArticleSnapshot, ArticleWorkingCopy, Author}

{:ok, user} = GroupherServer.Support.Factory.db_insert(:user)
{:ok, community} = GroupherServer.Support.Factory.db_insert(:community)
author = Repo.insert!(%Author{user_id: user.id})

{:ok, [doc, other]} =
  Repo.transaction(fn ->
    for thread <- [:doc, :post] do
      article =
        %Article{} |> Article.changeset(%{thread: thread, author_id: author.id}) |> Repo.insert!()

      %ArticleBinding{}
      |> ArticleBinding.changeset(%{
        article_id: article.id,
        community_id: community.id,
        thread: thread
      })
      |> Repo.insert!()

      article
    end
  end)

queue_id = Ecto.UUID.generate()
uuid = &Ecto.UUID.dump!/1

Repo.query!(
  "INSERT INTO cms.docs_publish_queues(id,community_id,inserted_at,updated_at) VALUES ($1,$2,now(),now())",
  [uuid.(queue_id), community.id]
)

[[0, 0, 0, 0, false, false, nil]] =
  Repo.query!(
    "SELECT tree_lock_version,queue_revision,public_presentation_revision,approval_policy_revision,approval_required,allow_self_approval,public_release_id FROM cms.docs_publish_queues WHERE id=$1",
    [uuid.(queue_id)]
  ).rows

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query("UPDATE cms.docs_publish_queues SET approval_policy_revision=-1 WHERE id=$1", [
    uuid.(queue_id)
  ])

body = %{
  title: "Title",
  digest: "Digest",
  body: %{
    json: "[]",
    schema_version: 1,
    markdown: "",
    html: "",
    markdown_toc: %{},
    plain_text: "",
    thumbnail: %{}
  }
}

work =
  %ArticleWorkingCopy{}
  |> ArticleWorkingCopy.changeset(
    Map.merge(body, %{
      body: Map.merge(body.body, %{article_id: doc.id, type: :working_copy}),
      article_id: doc.id,
      scope_kind: :workspace,
      scope_id: queue_id,
      revision: 1,
      created_by_id: user.id,
      updated_by_id: user.id
    })
  )
  |> Repo.insert!()

snapshot =
  %ArticleSnapshot{}
  |> ArticleSnapshot.changeset(
    Map.merge(body, %{
      body: Map.merge(body.body, %{article_id: doc.id, type: :snapshot}),
      article_id: doc.id,
      source_working_copy_id: work.id,
      source_revision: 1,
      captured_by_id: user.id,
      captured_at: DateTime.utc_now(:second),
      causation_command_id: Ecto.UUID.generate()
    })
  )
  |> Repo.insert!()

other_work =
  %ArticleWorkingCopy{}
  |> ArticleWorkingCopy.changeset(
    Map.merge(body, %{
      body: Map.merge(body.body, %{article_id: other.id, type: :working_copy}),
      article_id: other.id,
      scope_kind: :workspace,
      scope_id: queue_id,
      revision: 1,
      created_by_id: user.id,
      updated_by_id: user.id
    })
  )
  |> Repo.insert!()

other_snapshot =
  %ArticleSnapshot{}
  |> ArticleSnapshot.changeset(
    Map.merge(body, %{
      body: Map.merge(body.body, %{article_id: other.id, type: :snapshot}),
      article_id: other.id,
      source_working_copy_id: other_work.id,
      source_revision: 1,
      captured_by_id: user.id,
      captured_at: DateTime.utc_now(:second),
      causation_command_id: Ecto.UUID.generate()
    })
  )
  |> Repo.insert!()

default_work =
  %ArticleWorkingCopy{}
  |> ArticleWorkingCopy.changeset(
    Map.merge(body, %{
      body: Map.merge(body.body, %{article_id: doc.id, type: :working_copy}),
      article_id: doc.id,
      scope_kind: :default,
      scope_id: doc.id,
      revision: 1,
      created_by_id: user.id,
      updated_by_id: user.id
    })
  )
  |> Repo.insert!()

Repo.query!(
  "INSERT INTO cms.docs_b0_lifecycles(community_id,article_id,default_working_copy_id,state,changed_at,inserted_at,updated_at) VALUES ($1,$2,$3,'draft',now(),now(),now())",
  [community.id, uuid.(doc.id), uuid.(default_work.id)]
)

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("DELETE FROM cms.article_working_copies WHERE id=$1", [uuid.(default_work.id)])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("UPDATE cms.docs_b0_lifecycles SET default_working_copy_id=$1 WHERE article_id=$2", [
    uuid.(other_work.id),
    uuid.(doc.id)
  ])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("UPDATE cms.docs_b0_lifecycles SET default_working_copy_id=$1 WHERE article_id=$2", [
    uuid.(work.id),
    uuid.(doc.id)
  ])

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query(
    "UPDATE cms.docs_b0_lifecycles SET default_working_copy_scope='workspace' WHERE article_id=$1",
    [
      uuid.(doc.id)
    ]
  )

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query(
    "UPDATE cms.article_working_copies SET scope_kind='workspace', scope_id=$1 WHERE id=$2",
    [
      uuid.(Ecto.UUID.generate()),
      uuid.(default_work.id)
    ]
  )

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query("UPDATE cms.docs_b0_lifecycles SET state='published' WHERE article_id=$1", [
    uuid.(doc.id)
  ])

node_insert =
  "INSERT INTO cms.docs_b0_tree_nodes(community_id,node_id,stage,type,parent_node_id,doc_id,title,index,href,inserted_at,updated_at) VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8,now(),now())"

Repo.query!(node_insert, [community.id, "tab-1", "tab", nil, nil, "Tab", 0, nil])
Repo.query!(node_insert, [community.id, "group-1", "group", "tab-1", nil, "Group", 0, nil])
Repo.query!(node_insert, [community.id, "group-2", "group", "tab-1", nil, "Group 2", 1, nil])

Repo.query!(node_insert, [
  community.id,
  "page-1",
  "page",
  "group-1",
  uuid.(doc.id),
  "Page",
  0,
  nil
])

Repo.query!(node_insert, [
  community.id,
  "pin-1",
  "pin",
  "tab-1",
  nil,
  "Pin",
  0,
  "https://example.test"
])

Repo.query!(node_insert, [
  community.id,
  "moving-link",
  "link",
  "group-1",
  nil,
  "Moving",
  1,
  "https://example.test/moving"
])

Repo.query!(node_insert, [
  community.id,
  "target-link",
  "link",
  "group-2",
  nil,
  "Target",
  0,
  "https://example.test/target"
])

{:ok, :pass} =
  Repo.transaction(fn ->
    # All affected rows vacate their nonnegative slots before the parent and
    # final positions change. Negative row IDs are unique inside this fixture.
    Repo.query!(
      "UPDATE cms.docs_b0_tree_nodes SET index = -id WHERE community_id = $1 AND node_id = ANY($2::text[])",
      [community.id, ["page-1", "moving-link", "target-link"]]
    )

    Repo.query!(
      "UPDATE cms.docs_b0_tree_nodes SET parent_node_id = 'group-2' WHERE community_id = $1 AND node_id = 'moving-link'",
      [community.id]
    )

    Repo.query!(
      "UPDATE cms.docs_b0_tree_nodes SET index = CASE node_id WHEN 'page-1' THEN 0 WHEN 'moving-link' THEN 0 WHEN 'target-link' THEN 1 END WHERE community_id = $1 AND node_id = ANY($2::text[])",
      [community.id, ["page-1", "moving-link", "target-link"]]
    )

    :pass
  end)

[["group-2", 0], ["group-1", 0], ["group-2", 1]] =
  Repo.query!(
    "SELECT parent_node_id,index FROM cms.docs_b0_tree_nodes WHERE community_id = $1 AND node_id = ANY($2::text[]) ORDER BY node_id",
    [community.id, ["moving-link", "page-1", "target-link"]]
  ).rows

{:error, %Postgrex.Error{postgres: %{code: :unique_violation}}} =
  Repo.transaction(fn ->
    Repo.query!(
      "UPDATE cms.docs_b0_tree_nodes SET index = -id WHERE community_id = $1 AND node_id = ANY($2::text[])",
      [community.id, ["moving-link", "target-link"]]
    )

    {:error, error} =
      Repo.query(
        "UPDATE cms.docs_b0_tree_nodes SET index = 0 WHERE community_id = $1 AND node_id = ANY($2::text[])",
        [community.id, ["moving-link", "target-link"]],
        mode: :savepoint
      )

    Repo.rollback(error)
  end)

[[0], [1]] =
  Repo.query!(
    "SELECT index FROM cms.docs_b0_tree_nodes WHERE community_id = $1 AND node_id = ANY($2::text[]) ORDER BY node_id",
    [community.id, ["moving-link", "target-link"]]
  ).rows

{:error, %Postgrex.Error{postgres: %{code: :unique_violation}}} =
  Repo.query(
    "UPDATE cms.docs_b0_tree_nodes SET title = CASE node_id WHEN 'moving-link' THEN 'Target' WHEN 'target-link' THEN 'Moving' END WHERE community_id = $1 AND node_id = ANY($2::text[])",
    [community.id, ["moving-link", "target-link"]]
  )

{:ok, :pass} =
  Repo.transaction(fn ->
    Repo.query!(
      "UPDATE cms.docs_b0_tree_nodes SET title = '__b0_temporary_' || id::text WHERE community_id = $1 AND node_id = ANY($2::text[])",
      [community.id, ["moving-link", "target-link"]]
    )

    Repo.query!(
      "UPDATE cms.docs_b0_tree_nodes SET title = CASE node_id WHEN 'moving-link' THEN 'Target' WHEN 'target-link' THEN 'Moving' END WHERE community_id = $1 AND node_id = ANY($2::text[])",
      [community.id, ["moving-link", "target-link"]]
    )

    :pass
  end)

[["Target"], ["Moving"]] =
  Repo.query!(
    "SELECT title FROM cms.docs_b0_tree_nodes WHERE community_id = $1 AND node_id = ANY($2::text[]) ORDER BY node_id",
    [community.id, ["moving-link", "target-link"]]
  ).rows

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.transaction(fn ->
    Repo.query!(node_insert, [community.id, "orphan", "group", "absent", nil, "Orphan", 1, nil])

    {:error, error} =
      Repo.query("SET CONSTRAINTS cms.docs_b0_node_parent_fkey IMMEDIATE", [], mode: :savepoint)

    Repo.rollback(error)
  end)

{:error, %Postgrex.Error{postgres: %{code: :unique_violation}}} =
  Repo.query(node_insert, [
    community.id,
    "link-1",
    "link",
    "group-1",
    nil,
    "Link",
    0,
    "https://example.test"
  ])

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query(node_insert, [community.id, "bad-page", "page", "group-1", nil, "Bad", 2, nil])

insert =
  "INSERT INTO cms.docs_queue_articles(queue_id,article_id,working_copy_id,source_snapshot_id,enqueued_by_id,inserted_at,updated_at) VALUES ($1,$2,$3,$4,$5,now(),now())"

params = [uuid.(queue_id), uuid.(doc.id), uuid.(work.id), uuid.(snapshot.id), user.id]
Repo.query!(insert, params)

{:error, %Postgrex.Error{postgres: %{code: :unique_violation}}} =
  Repo.query(
    "INSERT INTO cms.docs_publish_queues(id,community_id,inserted_at,updated_at) VALUES ($1,$2,now(),now())",
    [uuid.(Ecto.UUID.generate()), community.id]
  )

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("DELETE FROM cms.article_working_copies WHERE id=$1", [uuid.(work.id)])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("DELETE FROM cms.article_snapshots WHERE id=$1", [uuid.(snapshot.id)])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("UPDATE cms.docs_queue_articles SET article_id=$1 WHERE queue_id=$2", [
    uuid.(other.id),
    uuid.(queue_id)
  ])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("UPDATE cms.docs_queue_articles SET working_copy_id=$1 WHERE queue_id=$2", [
    uuid.(other_work.id),
    uuid.(queue_id)
  ])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("UPDATE cms.docs_queue_articles SET source_snapshot_id=$1 WHERE queue_id=$2", [
    uuid.(other_snapshot.id),
    uuid.(queue_id)
  ])

[[1]] =
  Repo.query!("SELECT count(*) FROM cms.docs_queue_articles WHERE queue_id=$1", [uuid.(queue_id)]).rows

{:ok, other_community} = GroupherServer.Support.Factory.db_insert(:community)

[[trash_action_id]] =
  Repo.query!(
    "INSERT INTO cms.trash_actions(community_id,actor_id,root_type,root_ref,deleted_at,scheduled_permanent_deletion_at,inserted_at,updated_at) VALUES ($1,$2,'doc','node',now(),now(),now(),now()) RETURNING id",
    [community.id, user.id]
  ).rows

trash_doc_insert =
  "INSERT INTO cms.docs_b0_trashed_docs(hash_id,trash_action_id,community_id,article_id,restore_state,deleted_at,inserted_at,updated_at) VALUES ($1,$2,$3,$4,'draft',now(),now(),now())"

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query(trash_doc_insert, [
    uuid.(Ecto.UUID.generate()),
    trash_action_id,
    other_community.id,
    uuid.(doc.id)
  ])

Repo.query!(trash_doc_insert, [
  uuid.(Ecto.UUID.generate()),
  trash_action_id,
  community.id,
  uuid.(doc.id)
])

trash_node_insert =
  "INSERT INTO cms.docs_b0_trashed_nodes(hash_id,trash_action_id,community_id,node_id,doc_id,type,draft_snapshot,deleted_at,inserted_at,updated_at) VALUES ($1,$2,$3,'page-1',$4,'page','{}',now(),now(),now())"

Repo.query!(trash_node_insert, [
  uuid.(Ecto.UUID.generate()),
  trash_action_id,
  community.id,
  uuid.(doc.id)
])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("DELETE FROM cms.trash_actions WHERE id=$1", [trash_action_id])

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query(
    "UPDATE cms.docs_b0_trashed_nodes SET draft_snapshot=NULL WHERE trash_action_id=$1",
    [trash_action_id]
  )

event_insert =
  "INSERT INTO cms.docs_b0_tree_events(community_id,tree_lock_version,ordinal,event_type,node_id,node_type,payload,inverse_payload,actor_id,command_id,inserted_at) VALUES ($1,1,0,'group.create','group-1','group','{}','{}',$2,$3,now()) RETURNING id"

[[event_id]] =
  Repo.query!(event_insert, [community.id, user.id, uuid.(Ecto.UUID.generate())]).rows

[[other_event_id]] =
  Repo.query!(event_insert, [other_community.id, user.id, uuid.(Ecto.UUID.generate())]).rows

tree_insert =
  "INSERT INTO cms.docs_queue_tree_changes(queue_id,node_id,community_id,change_kind,target,source_event_id,inserted_at,updated_at) VALUES ($1,$2,$3,'upsert',$5,$4,now(),now())"

group_target = %{
  "type" => "group",
  "parent_node_id" => "tab-1",
  "index" => 0,
  "title" => "Group",
  "href" => nil,
  "doc_id" => nil,
  "marker" => nil,
  "badge" => nil,
  "hidden" => false
}

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query(tree_insert, [
    uuid.(queue_id),
    "wrong-event",
    community.id,
    other_event_id,
    group_target
  ])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query(tree_insert, [
    uuid.(queue_id),
    "wrong-site",
    other_community.id,
    other_event_id,
    group_target
  ])

Repo.query!(tree_insert, [uuid.(queue_id), "group-1", community.id, event_id, group_target])

[[stored_target]] =
  Repo.query!(
    "SELECT target FROM cms.docs_queue_tree_changes WHERE queue_id=$1 AND node_id='group-1'",
    [
      uuid.(queue_id)
    ]
  ).rows

{:ok, [%{node_id: "group-1", target: %{type: :group, parent_node_id: "tab-1"}}]} =
  CMS.DocTree.Publish.TreeCodec.decode_changes([
    %{node_id: "group-1", change_kind: :upsert, target: stored_target}
  ])

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query("UPDATE cms.docs_queue_tree_changes SET change_kind='delete' WHERE queue_id=$1", [
    uuid.(queue_id)
  ])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("DELETE FROM cms.docs_b0_tree_events WHERE id=$1", [event_id])

Repo.query!(
  "INSERT INTO cms.docs_queue_tree_contributors(queue_id,node_id,field_name,user_id) VALUES ($1,'group-1','title',$2)",
  [uuid.(queue_id), user.id]
)

{:ok, second_contributor} = GroupherServer.Support.Factory.db_insert(:user)

Repo.query!(
  "INSERT INTO cms.docs_queue_tree_contributors(queue_id,node_id,field_name,user_id) VALUES ($1,'group-1','index',$2)",
  [uuid.(queue_id), second_contributor.id]
)

{:error, %Postgrex.Error{postgres: %{code: :unique_violation}}} =
  Repo.query(
    "INSERT INTO cms.docs_queue_tree_contributors(queue_id,node_id,field_name,user_id) VALUES ($1,'group-1','title',$2)",
    [uuid.(queue_id), second_contributor.id]
  )

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query(
    "INSERT INTO cms.docs_queue_tree_contributors(queue_id,node_id,field_name,user_id) VALUES ($1,'group-1','unknown',$2)",
    [uuid.(queue_id), second_contributor.id]
  )

Repo.query!(
  "DELETE FROM cms.docs_queue_tree_contributors WHERE queue_id=$1 AND node_id='group-1' AND field_name='index'",
  [uuid.(queue_id)]
)

[[remaining_user]] =
  Repo.query!(
    "SELECT user_id FROM cms.docs_queue_tree_contributors WHERE queue_id=$1 AND node_id='group-1'",
    [uuid.(queue_id)]
  ).rows

true = remaining_user == user.id

Repo.query!(
  "INSERT INTO cms.docs_queue_article_contributors(queue_id,article_id,user_id) VALUES ($1,$2,$3)",
  [uuid.(queue_id), uuid.(doc.id), user.id]
)

Repo.query!("DELETE FROM cms.docs_queue_tree_changes WHERE queue_id=$1", [uuid.(queue_id)])

[[0]] =
  Repo.query!("SELECT count(*) FROM cms.docs_queue_tree_contributors WHERE queue_id=$1", [
    uuid.(queue_id)
  ]).rows

tree_snapshot_insert =
  "INSERT INTO cms.docs_b0_tree_snapshots(community_id,tree_json,created_at) VALUES ($1,$2,now()) RETURNING id"

for invalid <- [
      %{},
      %{"version" => 2, "nodes" => []},
      %{"version" => 1.0, "nodes" => []},
      %{"version" => "1", "nodes" => []},
      %{"version" => 1, "nodes" => %{}},
      %{"version" => 1}
    ] do
  {:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
    Repo.query(tree_snapshot_insert, [community.id, invalid])
end

empty_tree = %{"version" => 1, "nodes" => []}

[[tree_id]] = Repo.query!(tree_snapshot_insert, [community.id, empty_tree]).rows

[[stored_tree]] =
  Repo.query!("SELECT tree_json FROM cms.docs_b0_tree_snapshots WHERE id=$1", [tree_id]).rows

{:ok, []} = CMS.DocTree.Publish.TreeCodec.decode(stored_tree)

[[other_tree_id]] =
  Repo.query!(tree_snapshot_insert, [other_community.id, empty_tree]).rows

approval_id = Ecto.UUID.generate()
{:ok, contributor} = GroupherServer.Support.Factory.db_insert(:user)

approval_insert =
  "INSERT INTO cms.docs_publish_approvals(id,community_id,queue_id,queue_revision,plan_format_version,hash_algorithm,plan_hash,tree_plan,approved_by_id,approved_at) VALUES ($1,$2,$3,0,1,'sha256-jcs-v1','hash','{}',$4,now())"

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query(approval_insert, [uuid.(approval_id), other_community.id, uuid.(queue_id), user.id])

{:ok, :pass} =
  Repo.transaction(fn ->
    Repo.query!(approval_insert, [uuid.(approval_id), community.id, uuid.(queue_id), user.id])

    {:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
      Repo.query(
        "INSERT INTO cms.docs_publish_approval_articles(approval_id,article_id,snapshot_id) VALUES ($1,$2,$3)",
        [uuid.(approval_id), uuid.(doc.id), uuid.(other_snapshot.id)],
        mode: :savepoint
      )

    Repo.query!(
      "INSERT INTO cms.docs_publish_approval_articles(approval_id,article_id,snapshot_id) VALUES ($1,$2,$3)",
      [uuid.(approval_id), uuid.(doc.id), uuid.(snapshot.id)]
    )

    Repo.query!(
      "INSERT INTO cms.docs_publish_approval_contributors(approval_id,user_id) VALUES ($1,$2)",
      [uuid.(approval_id), contributor.id]
    )

    Repo.query!("UPDATE cms.docs_publish_approvals SET sealed=true WHERE id=$1", [
      uuid.(approval_id)
    ])

    :pass
  end)

other_queue_id = Ecto.UUID.generate()

Repo.query!(
  "INSERT INTO cms.docs_publish_queues(id,community_id,inserted_at,updated_at) VALUES ($1,$2,now(),now())",
  [uuid.(other_queue_id), other_community.id]
)

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("UPDATE cms.docs_publish_queues SET latest_approval_id=$1 WHERE id=$2", [
    uuid.(approval_id),
    uuid.(other_queue_id)
  ])

Repo.query!("UPDATE cms.docs_publish_queues SET latest_approval_id=$1 WHERE id=$2", [
  uuid.(approval_id),
  uuid.(queue_id)
])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("DELETE FROM cms.docs_publish_approvals WHERE id=$1", [uuid.(approval_id)])

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query("UPDATE cms.docs_publish_approvals SET plan_hash='changed' WHERE id=$1", [
    uuid.(approval_id)
  ])

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query(
    "INSERT INTO cms.docs_publish_approval_articles(approval_id,article_id,snapshot_id) VALUES ($1,$2,$3)",
    [uuid.(approval_id), uuid.(other.id), uuid.(other_snapshot.id)]
  )

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query("DELETE FROM cms.docs_publish_approval_articles WHERE approval_id=$1", [
    uuid.(approval_id)
  ])

{:ok, :pass} =
  Repo.transaction(fn ->
    Repo.query!("CREATE TEMP TABLE docs_b0_nested_delete_probe(approval_id uuid) ON COMMIT DROP")

    Repo.query!("""
    CREATE FUNCTION pg_temp.docs_b0_nested_delete_probe() RETURNS trigger AS $$
    BEGIN
      DELETE FROM cms.docs_publish_approval_articles WHERE approval_id = OLD.approval_id;
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql
    """)

    Repo.query!(
      "CREATE TRIGGER nested_delete BEFORE DELETE ON docs_b0_nested_delete_probe FOR EACH ROW EXECUTE FUNCTION pg_temp.docs_b0_nested_delete_probe()"
    )

    Repo.query!("INSERT INTO docs_b0_nested_delete_probe(approval_id) VALUES ($1)", [
      uuid.(approval_id)
    ])

    {:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
      Repo.query("DELETE FROM docs_b0_nested_delete_probe", [], mode: :savepoint)

    [[1]] =
      Repo.query!(
        "SELECT count(*) FROM cms.docs_publish_approval_articles WHERE approval_id=$1",
        [uuid.(approval_id)]
      ).rows

    :pass
  end)

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query("DELETE FROM cms.docs_publish_approval_contributors WHERE approval_id=$1", [
    uuid.(approval_id)
  ])

[["r"]] =
  Repo.query!(
    "SELECT confdeltype::text FROM pg_constraint WHERE conrelid='cms.docs_publish_approval_contributors'::regclass AND conname='docs_publish_approval_contributors_user_id_fkey'"
  ).rows

{:error,
 %Postgrex.Error{
   postgres: %{
     code: :check_violation,
     constraint: "account_users_physical_delete_forbidden"
   }
 }} = Repo.query("DELETE FROM account.users WHERE id=$1", [contributor.id])

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query("UPDATE cms.docs_b0_tree_snapshots SET tree_json=$1 WHERE id=$2", [
    %{"version" => 1, "nodes" => [%{"node_id" => "changed"}]},
    tree_id
  ])

concurrent_approval_id = Ecto.UUID.generate()
coordinator = self()

creator =
  Task.async(fn ->
    Repo.transaction(fn ->
      Repo.query!(approval_insert, [
        uuid.(concurrent_approval_id),
        community.id,
        uuid.(queue_id),
        user.id
      ])

      [[backend_pid]] = Repo.query!("SELECT pg_backend_pid()").rows
      send(coordinator, {:b0_approval_created, backend_pid})

      receive do
        :seal -> :ok
      after
        10_000 -> raise "approval sealing coordination timed out"
      end

      Repo.query!("UPDATE cms.docs_publish_approvals SET sealed=true WHERE id=$1", [
        uuid.(concurrent_approval_id)
      ])

      :pass
    end)
  end)

creator_backend =
  receive do
    {:b0_approval_created, backend_pid} -> backend_pid
  after
    10_000 -> raise "approval creation coordination timed out"
  end

inserter =
  Task.async(fn ->
    Repo.checkout(fn ->
      [[backend_pid]] = Repo.query!("SELECT pg_backend_pid()").rows
      send(coordinator, {:b0_member_insert_started, backend_pid})

      Repo.query(
        "INSERT INTO cms.docs_publish_approval_articles(approval_id,article_id,snapshot_id) VALUES ($1,$2,$3)",
        [uuid.(concurrent_approval_id), uuid.(doc.id), uuid.(snapshot.id)]
      )
    end)
  end)

inserter_backend =
  receive do
    {:b0_member_insert_started, backend_pid} -> backend_pid
  after
    10_000 -> raise "approval member coordination timed out"
  end

true = creator_backend != inserter_backend

early_insert = Task.yield(inserter, 250)
send(creator.pid, :seal)
{:ok, :pass} = Task.await(creator, 10_000)

insert_result =
  case early_insert do
    {:ok, result} -> result
    nil -> Task.await(inserter, 10_000)
  end

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} = insert_result

[[0]] =
  Repo.query!(
    "SELECT count(*) FROM cms.docs_publish_approval_articles WHERE approval_id=$1",
    [uuid.(concurrent_approval_id)]
  ).rows

release_insert =
  "INSERT INTO cms.docs_b0_publish_releases(community_id,tree_snapshot_id,queue_revision,plan_format_version,hash_algorithm,plan_hash,published_by_id,published_at,approval_id) VALUES ($1,$2,0,1,'sha256-jcs-v1','hash',$3,now(),$4) RETURNING id"

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query(release_insert, [community.id, other_tree_id, user.id, nil])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query(release_insert, [other_community.id, other_tree_id, user.id, uuid.(approval_id)])

{:ok, release_id} =
  Repo.transaction(fn ->
    [[id]] =
      Repo.query!(release_insert, [community.id, tree_id, user.id, uuid.(approval_id)]).rows

    {:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
      Repo.query(
        "INSERT INTO cms.docs_b0_release_articles(release_id,article_id,action,snapshot_id) VALUES ($1,$2,'publish',NULL)",
        [id, uuid.(doc.id)],
        mode: :savepoint
      )

    {:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
      Repo.query(
        "INSERT INTO cms.docs_b0_release_articles(release_id,article_id,action,snapshot_id) VALUES ($1,$2,'publish',$3)",
        [id, uuid.(doc.id), uuid.(other_snapshot.id)],
        mode: :savepoint
      )

    Repo.query!(
      "INSERT INTO cms.docs_b0_release_articles(release_id,article_id,action,snapshot_id) VALUES ($1,$2,'publish',$3)",
      [id, uuid.(doc.id), uuid.(snapshot.id)]
    )

    Repo.query!("UPDATE cms.docs_b0_publish_releases SET sealed=true WHERE id=$1", [id])
    id
  end)

{:ok, other_release_id} =
  Repo.transaction(fn ->
    [[id]] = Repo.query!(release_insert, [other_community.id, other_tree_id, user.id, nil]).rows
    Repo.query!("UPDATE cms.docs_b0_publish_releases SET sealed=true WHERE id=$1", [id])
    id
  end)

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query("UPDATE cms.docs_b0_publish_releases SET plan_hash='changed' WHERE id=$1", [
    release_id
  ])

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query("DELETE FROM cms.docs_b0_release_articles WHERE release_id=$1", [release_id])

{:ok, disposable_release_id} =
  Repo.transaction(fn ->
    [[id]] = Repo.query!(release_insert, [community.id, tree_id, user.id, nil]).rows

    Repo.query!(
      "INSERT INTO cms.docs_b0_release_articles(release_id,article_id,action,snapshot_id) VALUES ($1,$2,'publish',$3)",
      [id, uuid.(other.id), uuid.(other_snapshot.id)]
    )

    Repo.query!("UPDATE cms.docs_b0_publish_releases SET sealed=true WHERE id=$1", [id])
    id
  end)

Repo.query!("DELETE FROM cms.docs_b0_publish_releases WHERE id=$1", [disposable_release_id])

[[0]] =
  Repo.query!("SELECT count(*) FROM cms.docs_b0_release_articles WHERE release_id=$1", [
    disposable_release_id
  ]).rows

true = Repo.get!(ArticleSnapshot, other_snapshot.id).id == other_snapshot.id

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.query(
    "INSERT INTO cms.docs_b0_release_articles(release_id,article_id,action,snapshot_id) VALUES ($1,$2,'delete',NULL)",
    [release_id, uuid.(other.id)]
  )

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("UPDATE cms.docs_publish_queues SET public_release_id=$1 WHERE id=$2", [
    other_release_id,
    uuid.(queue_id)
  ])

Repo.query!("UPDATE cms.docs_publish_queues SET public_release_id=$1 WHERE id=$2", [
  release_id,
  uuid.(queue_id)
])

{:error, %Postgrex.Error{postgres: %{code: :check_violation}}} =
  Repo.transaction(fn ->
    Repo.query!(approval_insert, [
      uuid.(Ecto.UUID.generate()),
      community.id,
      uuid.(queue_id),
      user.id
    ])

    {:error, error} =
      Repo.query("SET CONSTRAINTS cms.docs_approval_seal_required IMMEDIATE", [],
        mode: :savepoint
      )

    Repo.rollback(error)
  end)

Repo.query!("DELETE FROM cms.docs_queue_articles WHERE queue_id=$1", [uuid.(queue_id)])

[[0]] =
  Repo.query!("SELECT count(*) FROM cms.docs_queue_article_contributors WHERE queue_id=$1", [
    uuid.(queue_id)
  ]).rows

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("DELETE FROM cms.article_working_copies WHERE id=$1", [uuid.(default_work.id)])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("DELETE FROM cms.article_snapshots WHERE id=$1", [uuid.(snapshot.id)])

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query("DELETE FROM cms.docs_b0_publish_releases WHERE id=$1", [release_id])

{:ok, conflict_doc} =
  Repo.transaction(fn ->
    article =
      %Article{} |> Article.changeset(%{thread: :doc, author_id: author.id}) |> Repo.insert!()

    %ArticleBinding{}
    |> ArticleBinding.changeset(%{
      article_id: article.id,
      community_id: community.id,
      thread: :doc
    })
    |> Repo.insert!()

    article
  end)

conflict_work =
  %ArticleWorkingCopy{}
  |> ArticleWorkingCopy.changeset(
    Map.merge(body, %{
      body: Map.merge(body.body, %{article_id: conflict_doc.id, type: :working_copy}),
      article_id: conflict_doc.id,
      scope_kind: :default,
      scope_id: conflict_doc.id,
      revision: 1,
      created_by_id: user.id,
      updated_by_id: user.id
    })
  )
  |> Repo.insert!()

conflict_snapshots =
  for revision <- [1, 2] do
    %ArticleSnapshot{}
    |> ArticleSnapshot.changeset(
      Map.merge(body, %{
        body: Map.merge(body.body, %{article_id: conflict_doc.id, type: :snapshot}),
        article_id: conflict_doc.id,
        source_working_copy_id: conflict_work.id,
        source_revision: revision,
        captured_by_id: user.id,
        captured_at: DateTime.utc_now(:second),
        causation_command_id: Ecto.UUID.generate()
      })
    )
    |> Repo.insert!()
  end

[base_snapshot, published_snapshot] = conflict_snapshots

Repo.query!(
  "INSERT INTO cms.docs_post_publish_conflicts(community_id,article_id,base_snapshot_id,published_snapshot_id,default_revision,inserted_at,updated_at) VALUES ($1,$2,$3,$4,2,now(),now())",
  [community.id, uuid.(conflict_doc.id), uuid.(base_snapshot.id), uuid.(published_snapshot.id)]
)

{:error, %Postgrex.Error{postgres: %{code: :foreign_key_violation}}} =
  Repo.query(
    "UPDATE cms.docs_post_publish_conflicts SET published_snapshot_id=$1 WHERE article_id=$2",
    [uuid.(other_snapshot.id), uuid.(conflict_doc.id)]
  )

{:error,
 %Postgrex.Error{
   postgres: %{
     code: :foreign_key_violation,
     constraint: "docs_post_publish_conflicts_base_owner_fkey"
   }
 }} = Repo.query("DELETE FROM cms.article_snapshots WHERE id=$1", [uuid.(base_snapshot.id)])

Repo.query!("DELETE FROM cms.docs_post_publish_conflicts WHERE article_id=$1", [
  uuid.(conflict_doc.id)
])

Repo.query!("DELETE FROM cms.article_snapshots WHERE id=$1", [uuid.(base_snapshot.id)])

IO.puts("DOCS_B0_QUEUE_FK_BEHAVIOR_PASSED")
