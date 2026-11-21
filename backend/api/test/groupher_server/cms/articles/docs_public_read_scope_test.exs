defmodule GroupherServer.CMS.Articles.DocsPublicReadScopeTest do
  @moduledoc """
  Verifies row-local public Doc visibility and legacy cursor query bindings.

      two-site Sandbox fixture -> canonical Scope -> readers / pagination / signed cursor

  Legacy fingerprints are constructed without restoring optional public filters.
  """

  use GroupherServer.TestMate, async: false

  alias CMS.Articles.{Pagination, Public}
  alias CMS.Gate.Context.Scope.Doc, as: DocContext

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticlePublicBody,
    ArticleSnapshotDoc,
    CommunityDashboard,
    DocsTreeNode
  }

  alias GroupherServer.{Pagi, Test}
  alias Pagi.Params
  alias Test.DocsPublicReadFixture
  alias Helper.ORM.Pagi.{Config, CursorCodec}

  @moduletag :docs_public_read_scope

  setup tags do
    opts =
      cond do
        tags[:local_y_doc] ->
          [
            before_bind: fn %{y: y, actor: actor} ->
              {_, doc, _, _} = mock_article(:doc, y, actor)
              {:ok, %{local_y_doc: doc}}
            end
          ]

        tags[:comment_fixture] ->
          [
            before_bind: fn %{x: x, docs: [doc | _]} ->
              {:ok, viewer} = db_insert(:user)

              case CMS.Comments.Commands.Create.create(
                     :doc,
                     %{id: doc.id, community: x},
                     mock_comment(),
                     viewer,
                     Ecto.UUID.generate()
                   ) do
                {:ok, created} -> {:ok, %{comment: created.comment}}
                {:error, _} = error -> error
              end
            end
          ]

        true ->
          []
      end

    {:ok, fixture} = DocsPublicReadFixture.two_sites(opts)
    fixture
  end

  test "same Docs have two numbered bindings but public pages only in X", fixture do
    for doc <- fixture.docs do
      assert Repo.aggregate(
               from(binding in ArticleBinding, where: binding.article_id == ^doc.id),
               :count
             ) == 2

      assert Repo.aggregate(
               from(node in DocsTreeNode,
                 where:
                   node.community_id == ^fixture.x.id and node.stage == :public and
                     node.type == :page and node.doc_id == ^doc.id
               ),
               :count
             ) == 1

      refute Repo.exists?(
               from(node in DocsTreeNode,
                 where:
                   node.community_id == ^fixture.y.id and node.stage == :public and
                     node.type == :page and node.doc_id == ^doc.id
               )
             )

      assert {:ok, {public, _snapshot}} = Public.current(doc.id)
      assert public.body.article_id == doc.id
      assert public.body.snapshot_id == public.snapshot_id
    end

    assert Enum.all?(fixture.y_bindings, &is_integer(&1.inner_id))
    assert fixture.y_bindings |> Enum.map(& &1.inner_id) |> Enum.uniq() |> length() == 2
  end

  test "Y without pages is excluded and old tree options cannot change public visibility",
       fixture do
    params = %Params.Offset{page: 1, size: 20, config_revision: 0}
    filter = %{community: fixture.y.slug}

    for opts <- [[], [public_tree: false], [public_tree: true]], actor <- [nil, fixture.actor] do
      assert {:ok, %{entries: [], page_info: %{total_count: 0}}} =
               Pagination.page(:doc, filter, params, actor, opts)

      assert {:ok, %{entries: entries, page_info: %{total_count: 2}}} =
               Pagination.page(:doc, %{community: fixture.x.slug}, params, actor, opts)

      assert MapSet.new(entries, & &1.id) == MapSet.new(fixture.docs, & &1.id)
    end
  end

  test "legacy false cursors are rejected while true query bindings still continue",
       fixture do
    config = %Config{
      api: :cursor,
      default_size: 1,
      max_size: 10,
      revision: 0,
      platform_hard_max: 100
    }

    for include_pinned <- [false, true] do
      filter = %{community: fixture.x.slug}
      filter = if include_pinned, do: Map.put(filter, :author_id, fixture.actor.id), else: filter
      opts = [config: config, include_pinned: include_pinned]

      assert {:ok, %{entries: [first], page_info: %{end_cursor: cursor, has_next_page: true}}} =
               Pagination.page(
                 :doc,
                 filter,
                 %Params.Cursor{first: 1, config_revision: 0},
                 nil,
                 opts
               )

      assert {:ok, payload} = CursorCodec.decode(cursor)
      old = fingerprint(filter, payload.order, false, include_pinned)
      new = fingerprint(filter, payload.order, true, include_pinned)
      assert payload.surface == "articles.doc"
      assert payload.fingerprint == new
      refute old == new

      assert {:ok, %{entries: [second]}} =
               Pagination.page(
                 :doc,
                 filter,
                 %Params.Cursor{first: 1, after: cursor, config_revision: 0},
                 nil,
                 opts
               )

      refute first.id == second.id
      assert MapSet.new([first.id, second.id]) == MapSet.new(fixture.docs, & &1.id)

      tree_opts = Keyword.put(opts, :public_tree, true)

      assert {:ok, %{page_info: %{end_cursor: tree_cursor}}} =
               Pagination.page(
                 :doc,
                 filter,
                 %Params.Cursor{first: 1, config_revision: 0},
                 nil,
                 tree_opts
               )

      assert {:ok, %{fingerprint: ^new}} =
               CursorCodec.decode(tree_cursor,
                 surface: payload.surface,
                 order: payload.order,
                 fingerprint: new
               )

      assert {:ok, %{entries: [tree_second]}} =
               Pagination.page(
                 :doc,
                 filter,
                 %Params.Cursor{first: 1, after: tree_cursor, config_revision: 0},
                 nil,
                 tree_opts
               )

      assert tree_second.id == second.id

      assert {:ok, old_cursor} = CursorCodec.encode(%{payload | fingerprint: old})

      assert {:error,
              %ErrorCat.Error{namespace: {:pagi}, reason: :cursor_query_mismatch, code: 4203} =
                error} =
               Pagination.page(
                 :doc,
                 filter,
                 %Params.Cursor{first: 1, after: old_cursor, config_revision: 0},
                 nil,
                 opts
               )

      assert {:error, [message: _, extensions: %{code: 4203}]} =
               GroupherServerWeb.ErrorResponse.format_error(error)
    end
  end

  test "both GraphQL APIs reject old false bindings with 4203 and permit fresh head reads",
       fixture do
    Repo.update_all(
      from(dashboard in CommunityDashboard, where: dashboard.community_id == ^fixture.x.id),
      set: [pagi_mode: :load_more]
    )

    assert {:ok, _} = CMS.Dashboard.PagiMode.invalidate(fixture.x.slug)

    for {field, pinned?} <- [{"docPage", false}, {"pagedPublishedDocs", true}] do
      filter = %{community: fixture.x.slug}

      variables = %{
        "login" => fixture.actor.login,
        "filter" => %{"community" => fixture.x.slug},
        "pagi" => %{"cursor" => %{"first" => 1, "configRevision" => 0}}
      }

      query = graphql_query(field)
      assert {:ok, %{data: data} = response} = graphql(query, variables)
      refute Map.has_key?(response, :errors), inspect(response)
      assert %{"entries" => [first], "pageInfo" => %{"endCursor" => cursor}} = data[field]
      assert is_binary(cursor)
      assert {:ok, payload} = CursorCodec.decode(cursor)
      query_filter = if pinned?, do: Map.put(filter, :author_id, fixture.actor.id), else: filter
      assert payload.fingerprint == fingerprint(query_filter, payload.order, true, pinned?)

      variables = put_in(variables, ["pagi", "cursor", "after"], cursor)
      assert {:ok, %{data: next_data} = response} = graphql(query, variables)
      refute Map.has_key?(response, :errors), inspect(response)
      assert %{"entries" => [second]} = next_data[field]
      refute first["innerId"] == second["innerId"]

      # Sign the exact legacy five-tuple binding using the current fixture IDs.
      changed_payload = %{
        payload
        | fingerprint: fingerprint(query_filter, payload.order, false, pinned?)
      }

      assert {:ok, mismatched_cursor} = CursorCodec.encode(changed_payload)
      mismatch_variables = put_in(variables, ["pagi", "cursor", "after"], mismatched_cursor)
      assert {:ok, %{errors: errors}} = graphql(query, mismatch_variables)
      assert Enum.map(errors, & &1.extensions.code) == [4203]
      refute Enum.any?(errors, &Map.has_key?(&1.extensions, :reason))

      fresh_variables = update_in(variables, ["pagi", "cursor"], &Map.delete(&1, "after"))
      assert {:ok, %{data: fresh_data} = response} = graphql(query, fresh_variables)
      refute Map.has_key?(response, :errors), inspect(response)
      assert fresh_data[field]["entries"] == [first]
    end
  end

  test "single, batch and Press share row-local admission without post-load tree queries",
       fixture do
    [doc | _] = fixture.docs
    [x_binding | _] = fixture.x_bindings
    [y_binding | _] = fixture.y_bindings
    x_path = %{community: fixture.x.slug, thread: :doc, inner_id: x_binding.inner_id}
    y_path = %{community: fixture.y.slug, thread: :doc, inner_id: y_binding.inner_id}
    assert {:ok, %{id: id}} = CMS.FrontDesk.article(x_path)
    assert id == doc.id

    assert {:error, %ErrorCat.Error{reason: :article_not_found, code: 6008}} =
             CMS.FrontDesk.article(y_path)

    assert {:ok, [one, duplicate]} = CMS.FrontDesk.article([x_path, y_path, x_path])
    assert one.article.id == doc.id
    assert duplicate.article.id == doc.id
    {result, queries} = capture_queries(fn -> CMS.Press.article(x_path) end)
    assert {:ok, %{article_id: id}} = result
    assert id == doc.id
    tree_queries = Enum.filter(queries, &String.contains?(&1, "doc_tree_nodes"))
    assert [scope_sql] = tree_queries
    assert scope_sql =~ "article_public_bodies"
    assert String.downcase(scope_sql) =~ "exists"
    assert scope_sql =~ "article_bindings"
    assert {:error, %ErrorCat.Error{code: 6008}} = CMS.Press.article(y_path)
  end

  test "only public policy adds tree and body SQL while management and insights retain Y",
       fixture do
    public = CMS.Gate.scope(Article, nil, :list, DocContext.public())
    {sql, _} = Ecto.Adapters.SQL.to_sql(:all, Repo, public)
    assert sql =~ "doc_tree_nodes"
    assert sql =~ "article_public_bodies"
    assert String.downcase(sql) =~ "exists"

    for {actor, action, context} <- [
          {fixture.actor, :read, DocContext.public(policy_mode: :owner_management)},
          {fixture.actor, :read_insights, DocContext.insights()}
        ] do
      query = CMS.Gate.scope(Article, actor, action, context)
      {sql, _} = Ecto.Adapters.SQL.to_sql(:all, Repo, query)
      refute sql =~ "doc_tree_nodes"
      refute sql =~ "article_public_bodies"
      query = where(query, [gate_community: community], community.id == ^fixture.y.id)
      assert MapSet.new(Repo.all(query), & &1.id) == MapSet.new(fixture.docs, & &1.id)
    end

    draft = CMS.Gate.scope(Article, :operations, :read_draft, DocContext.draft(:operations))
    {draft_sql, _} = Ecto.Adapters.SQL.to_sql(:all, Repo, draft)
    refute draft_sql =~ "doc_tree_nodes"
    refute draft_sql =~ "article_public_bodies"

    [binding | _] = fixture.y_bindings
    path = %{community: fixture.y.slug, thread: :doc, inner_id: binding.inner_id}
    assert {:ok, _} = CMS.FrontDesk.article(path, fixture.actor, mode: :management)
  end

  test "missing Body is excluded without hiding it from management Scope", fixture do
    [doc, remaining] = fixture.docs
    Repo.delete!(Repo.get!(ArticlePublicBody, doc.id))
    params = %Params.Offset{page: 1, size: 20, config_revision: 0}

    assert {:ok, %{entries: [%{id: id}], page_info: %{total_count: 1}}} =
             Pagination.page(:doc, %{community: fixture.x.slug}, params)

    assert id == remaining.id

    query =
      CMS.Gate.scope(
        Article,
        fixture.actor,
        :read,
        DocContext.public(policy_mode: :owner_management)
      )

    assert Repo.exists?(where(query, [article], article.id == ^doc.id))
    assert {:error, :public_not_found} = Public.current(doc.id)
  end

  test "a mismatched Body snapshot is excluded inside the rollback-only fixture", fixture do
    [doc, remaining] = fixture.docs

    Repo.update_all(from(body in ArticlePublicBody, where: body.article_id == ^doc.id),
      set: [snapshot_id: Ecto.UUID.generate()]
    )

    assert {:ok, %{entries: [%{id: id}]}} =
             Pagination.page(:doc, %{community: fixture.x.slug}, nil)

    assert id == remaining.id
  end

  test "hidden page remains readable while public navigation hides it", fixture do
    [doc | _] = fixture.docs
    assert {:ok, tree} = CMS.DocTree.Query.read_public(fixture.x)
    assert Jason.encode!(tree) =~ doc.id

    Repo.update_all(
      from(node in DocsTreeNode,
        where:
          node.community_id == ^fixture.x.id and node.stage == :public and node.doc_id == ^doc.id
      ),
      set: [hidden: true]
    )

    assert {:ok, tree} = CMS.DocTree.Query.read_public(fixture.x)
    refute Jason.encode!(tree) =~ doc.id
    [binding | _] = fixture.x_bindings

    assert {:ok, %{id: id}} =
             CMS.FrontDesk.article(%{
               community: fixture.x.slug,
               thread: :doc,
               inner_id: binding.inner_id
             })

    assert id == doc.id
  end

  test "ordinary Article cursors retain the exact legacy false fingerprint" do
    for thread <- [:post, :blog, :changelog] do
      {community, _, _, _} = mock_article(thread)
      filter = %{community: community.slug}

      config = %Config{
        api: :cursor,
        default_size: 1,
        max_size: 10,
        revision: 0,
        platform_hard_max: 100
      }

      assert {:ok, %{page_info: %{end_cursor: cursor}}} =
               Pagination.page(thread, filter, %Params.Cursor{first: 1, config_revision: 0}, nil,
                 config: config
               )

      assert {:ok, payload} = CursorCodec.decode(cursor)
      assert payload.fingerprint == fingerprint(filter, payload.order, false, false, thread)
    end
  end

  test "counts, indexer, summaries and status exclude Y but preserve X", fixture do
    assert {:ok, x} = CMS.Communities.update_count_field(fixture.x, :doc)
    assert {:ok, y} = CMS.Communities.update_count_field(fixture.y, :doc)
    assert x.meta.docs_count == 2
    assert y.meta.docs_count == 0
    assert {:ok, 2} = CMS.Articles.Query.count_published(:doc, fixture.actor)

    Helper.TestFakes.SearchArtiments.reset()
    [doc | _] = fixture.docs
    assert {:ok, _} = CMS.SearchArtiments.Indexer.sync_binding(:doc, doc.id, fixture.x.id)
    assert {:ok, _} = CMS.SearchArtiments.Indexer.sync_binding(:doc, doc.id, fixture.y.id)
    records = :ets.tab2list(:search_artiments_test_platform) |> Enum.map(&elem(&1, 1))
    assert Enum.any?(records, &(&1.article_id == doc.id and &1.community_ref == fixture.x.slug))
    refute Enum.any?(records, &(&1.article_id == doc.id and &1.community_ref == fixture.y.slug))

    ref = %{key: {:doc, doc.id}, type: :doc, article_id: doc.id}
    assert {:ok, x_statuses} = CMS.Artiment.Status.read_many(fixture.x, [ref])
    assert {:ok, y_statuses} = CMS.Artiment.Status.read_many(fixture.y, [ref])
    assert x_statuses[ref.key].status == :readable
    assert y_statuses[ref.key].status == :unavailable
    summaries = CMS.Snapshot.Query.load_summaries(:article, :doc, [doc.id])
    refute summaries[doc.id][:unavailable] == true
  end

  @tag :comment_fixture
  test "public discussion follows the request site while mentioned targets keep their own policy",
       fixture do
    [doc | _] = fixture.docs

    assert {:ok, %{total_count: 1}} =
             CMS.Comments.comments_state(:doc, doc.id, nil, fixture.x.slug)

    assert {:error, %ErrorCat.Error{reason: :resource_not_found, code: 4601}} =
             CMS.Comments.comments_state(:doc, doc.id, nil, fixture.y.slug)

    params = %Params.Offset{page: 1, size: 20, config_revision: 0}

    assert {:ok, %{entries: [], page_info: %{total_count: 0}}} =
             CMS.Comments.Query.page(:doc, doc.id, fixture.y.slug, %{}, params, :timeline)

    query =
      CMS.Gate.scope(
        CMS.Model.Comment,
        nil,
        :read,
        CMS.Gate.Context.Scope.Comment.mentioned_target(:doc, fixture.y.id)
      )

    {sql, _} = Ecto.Adapters.SQL.to_sql(:all, Repo, query)
    refute sql =~ "doc_tree_nodes"
  end

  test "report diagnoses excluded damage and lists count refresh candidates without repairing",
       fixture do
    [doc | _] = fixture.docs
    Repo.delete!(Repo.get!(ArticlePublicBody, doc.id))
    assert {:ok, report} = CMS.Articles.Query.PublicReadReport.report()

    assert [%{article_id: id, issue: :body_missing, expected_snapshot_id: snapshot_id}] =
             report.projection_issues

    assert id == doc.id
    assert is_binary(snapshot_id)

    assert Enum.any?(
             report.community_counts,
             &(&1.community_id == fixture.x.id and &1.stored == 2 and &1.expected == 1)
           )

    assert Repo.get(CMS.Model.Community, fixture.x.id).meta.docs_count == 2
    refute Repo.get(ArticlePublicBody, doc.id)

    assert {:ok, _} = CMS.Communities.update_count_field(fixture.x, :doc)
    assert {:ok, _} = GroupherServer.Accounts.publish_update_states(fixture.actor, :doc)
    assert {:ok, refreshed} = CMS.Articles.Query.PublicReadReport.report()
    refute Enum.any?(refreshed.community_counts, &(&1.community_id == fixture.x.id))
    refute Enum.any?(refreshed.author_counts, &(&1.user_id == fixture.actor.id))
    assert [%{issue: :body_missing}] = refreshed.projection_issues
  end

  test "Press feed and manifest consume the same X-only collection", fixture do
    for community <- [fixture.x, fixture.y] do
      assert {:ok, _} =
               CMS.Press.update_config(
                 community,
                 %{feed_enabled: true, feed_count: 10, feed_threads: [:doc]},
                 fixture.actor,
                 Ecto.UUID.generate()
               )
    end

    assert {:ok, %{items: x_items}} = CMS.Press.thread_rss_feed(fixture.x, :doc)
    assert MapSet.new(x_items, & &1.item_id) == MapSet.new(fixture.docs, & &1.id)
    assert {:ok, %{items: []}} = CMS.Press.thread_rss_feed(fixture.y, :doc)
    assert {:ok, %{items: []}} = CMS.Press.site_manifest(fixture.y)
  end

  test "diagnostics distinguish a mismatched body from a body without Public", fixture do
    [first, second] = fixture.docs

    Repo.update_all(from(body in ArticlePublicBody, where: body.article_id == ^first.id),
      set: [snapshot_id: Ecto.UUID.generate()]
    )

    body = Repo.get!(ArticlePublicBody, second.id)
    public = Repo.get!(CMS.Model.ArticlePublic, second.id)
    Repo.delete!(public)

    attrs =
      CMS.Model.ArticleBodyDocument.document(body)
      |> Map.merge(%{article_id: second.id, snapshot_id: body.snapshot_id})

    %ArticlePublicBody{} |> ArticlePublicBody.changeset(attrs) |> Repo.insert!()
    assert {:ok, report} = CMS.Articles.Query.PublicReadReport.report()

    assert Enum.any?(
             report.projection_issues,
             &(&1.article_id == first.id and &1.issue == :snapshot_mismatch)
           )

    assert Enum.any?(
             report.projection_issues,
             &(&1.article_id == second.id and &1.issue == :public_missing)
           )
  end

  @tag :local_y_doc
  test "equal inner IDs resolve different local Articles in both directions", fixture do
    [x_doc | _] = fixture.docs
    x_binding = Repo.get_by!(ArticleBinding, article_id: x_doc.id, community_id: fixture.x.id)

    y_binding =
      Repo.get_by!(ArticleBinding, article_id: fixture.local_y_doc.id, community_id: fixture.y.id)

    assert x_binding.inner_id == y_binding.inner_id
    refute x_doc.id == fixture.local_y_doc.id
    x_path = %{community: fixture.x.slug, thread: :doc, inner_id: x_binding.inner_id}
    y_path = %{community: fixture.y.slug, thread: :doc, inner_id: y_binding.inner_id}
    assert {:ok, %{id: x_id}} = CMS.FrontDesk.article(x_path)
    assert {:ok, %{id: y_id}} = CMS.FrontDesk.article(y_path)
    assert x_id == x_doc.id
    assert y_id == fixture.local_y_doc.id
    assert {:ok, [y, x, y_again]} = CMS.FrontDesk.article([y_path, x_path, y_path])
    assert [y.article.id, x.article.id, y_again.article.id] == [y_id, x_id, y_id]
    params = %Params.Offset{page: 1, size: 20, config_revision: 0}

    assert {:ok, %{entries: y_entries, page_info: %{total_count: 1}}} =
             Pagination.page(:doc, %{community: fixture.y.slug}, params)

    assert Enum.map(y_entries, & &1.id) == [y_id]

    assert {:ok, %{entries: x_entries, page_info: %{total_count: 2}}} =
             Pagination.page(:doc, %{community: fixture.x.slug}, params)

    assert MapSet.new(x_entries, & &1.id) == MapSet.new(fixture.docs, & &1.id)
  end

  test "missing typed extension is diagnosed without becoming a Scope predicate", fixture do
    [doc | _] = fixture.docs
    assert {:ok, {public, _}} = Public.current(doc.id)
    Repo.delete!(Repo.get!(ArticleSnapshotDoc, public.snapshot_id))
    assert {:ok, {_, _}} = Public.current(doc.id)

    assert Repo.exists?(
             from(article in CMS.Gate.scope(Article, nil, :list, DocContext.public()),
               where: article.id == ^doc.id
             )
           )

    assert {:error, :article_snapshot_projection_missing} =
             CMS.FrontDesk.article(%{
               community: fixture.x.slug,
               thread: :doc,
               inner_id: hd(fixture.x_bindings).inner_id
             })

    assert {:ok, report} = CMS.Articles.Query.PublicReadReport.report()

    assert [%{article_id: id, issue: :extension_missing, expected_snapshot_id: snapshot_id}] =
             report.projection_issues

    assert {id, snapshot_id} == {doc.id, public.snapshot_id}
  end

  test "current FK rejects missing Snapshot and report independently checks its owner pair",
       fixture do
    [doc | _] = fixture.docs

    assert_raise Postgrex.Error, ~r/article_publics_snapshot_owner_fkey/, fn ->
      Repo.query!(
        "UPDATE cms.article_publics SET snapshot_id = $1 WHERE article_id = $2",
        [Ecto.UUID.dump!(Ecto.UUID.generate()), Ecto.UUID.dump!(doc.id)],
        mode: :savepoint
      )
    end

    {{:ok, report}, queries} =
      capture_queries(fn -> CMS.Articles.Query.PublicReadReport.report() end)

    assert report.projection_issues == []
    assert [sql] = Enum.filter(queries, &String.contains?(&1, "article_snapshot_docs"))
    assert sql =~ "LEFT OUTER JOIN"
    assert sql =~ "article_snapshots"
    assert sql =~ "article_id"
    assert sql =~ "snapshot_id"
    assert sql =~ "IS NULL"
  end

  test "report detects manually stale metadata without updating either stored counter", fixture do
    community = Repo.get!(CMS.Model.Community, fixture.x.id)
    user = Repo.get!(GroupherServer.Accounts.Model.User, fixture.actor.id)
    assert {:ok, _} = Helper.ORM.update_meta(community, %{docs_count: 91})
    assert {:ok, _} = Helper.ORM.update_meta(user, %{published_docs_count: 92})
    assert {:ok, report} = CMS.Articles.Query.PublicReadReport.report()

    assert Enum.any?(
             report.community_counts,
             &(&1.community_id == community.id and &1.stored == 91 and &1.expected == 2)
           )

    assert Enum.any?(
             report.author_counts,
             &(&1.user_id == user.id and &1.stored == 92 and &1.expected == 2)
           )

    assert Repo.get!(CMS.Model.Community, community.id).meta.docs_count == 91
    assert Repo.get!(GroupherServer.Accounts.Model.User, user.id).meta.published_docs_count == 92
  end

  test "query capture ignores events emitted by another process" do
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    {:done, queries} =
      capture_queries(fn ->
        Task.async(fn ->
          :telemetry.execute(event, %{}, %{repo: Repo, query: "foreign doc_tree_nodes query"})
        end)
        |> Task.await()

        Repo.query!("SELECT 1")
        :done
      end)

    assert ["SELECT 1"] = queries
  end

  test "report task identifies the connected database and migration in JSON" do
    output =
      ExUnit.CaptureIO.capture_io(fn -> Mix.Tasks.Docs.PublicRead.Report.run(["--json"]) end)

    result = Jason.decode!(output)

    %{rows: [[database, version]]} =
      Repo.query!(
        "SELECT current_database(), (SELECT max(version) FROM public.schema_migrations)"
      )

    assert result["target"] == %{"database" => database, "migration_version" => version}
    assert result["elapsed_ms"] >= 0
    assert result["projection_issues"] == []
  end

  test "report task rejects prod before starting dependencies or querying" do
    previous_env = Mix.env()

    try do
      Mix.env(:prod)

      assert_raise Mix.Error, ~r/refuses MIX_ENV=prod/, fn ->
        Mix.Tasks.Docs.PublicRead.Report.run(["--json"])
      end
    after
      Mix.env(previous_env)
    end
  end

  defp capture_queries(fun) do
    ref = make_ref()
    handler = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler,
        event,
        fn _, _, metadata, {pid, query_ref} ->
          # Telemetry handlers run synchronously in the querying process. Ignore
          # other tests/workers on this node even while our handler is attached.
          if self() == pid and metadata.repo == Repo do
            send(pid, {query_ref, metadata.query})
          end
        end,
        {self(), ref}
      )

    try do
      result = fun.()
      {result, drain_queries(ref, [])}
    after
      :telemetry.detach(handler)
    end
  end

  defp drain_queries(ref, queries) do
    receive do
      {^ref, query} -> drain_queries(ref, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end

  defp graphql_query("docPage") do
    """
    query R0DocPage($filter: ArticlePageFilter, $pagi: PagiInput) {
      docPage(filter: $filter, pagi: $pagi) {
        entries { innerId }
        pageInfo { ... on CursorPageInfo { endCursor } }
      }
    }
    """
  end

  defp graphql_query("pagedPublishedDocs") do
    """
    query R0ProfileDocs($login: String!, $filter: ArticlePageFilter, $pagi: PagiInput) {
      pagedPublishedDocs(login: $login, filter: $filter, pagi: $pagi) {
        entries { innerId }
        pageInfo { ... on CursorPageInfo { endCursor } }
      }
    }
    """
  end

  defp graphql(query, variables) do
    Absinthe.run(query, GroupherServerWeb.Schema,
      variables: variables,
      context: %{cur_user: nil}
    )
  end

  defp fingerprint(filter, order, tree?, pinned?, thread \\ :doc) do
    :crypto.hash(
      :sha256,
      :erlang.term_to_binary({thread, Map.put(filter, :order, order), order, tree?, pinned?})
    )
    |> Base.encode16(case: :lower)
  end
end
