defmodule GroupherServer.Test.CMS.Articles.PublicBodyTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Test}
  alias CMS.Articles.{Body, Public}
  alias CMS.Articles.WorkingCopy.Snapshotter

  alias CMS.Model.{
    Article,
    ArticleBodyDocument,
    ArticlePublic,
    ArticlePublicBody,
    ArticleSnapshot,
    ArticleWorkingCopy
  }

  alias Test.ArticleContentFixture

  setup do
    {community, view, _, actor} = ArticleContentFixture.article(:post)
    article = Repo.get!(Article, view.id)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
    public = Repo.get!(ArticlePublic, article.id)

    %{
      community: community,
      article: article,
      actor: actor,
      work: work,
      public: public,
      snapshot: Repo.get!(ArticleSnapshot, public.snapshot_id),
      inner_id: view.inner_id
    }
  end

  test "publishing copies all formats atomically, replay keeps one body and history stays immutable",
       ctx do
    assert current_document(ctx.article) == Body.document(ctx.snapshot)

    Repo.update_all(from(b in CMS.Model.ArticleBody, where: b.id == ^ctx.work.body_id),
      set: [xml: "<xml>fixed</xml>", rss: "fixed rss"]
    )

    {:ok, work} = save(ctx, "R3 new content")

    command_id = Ecto.UUID.generate()
    assert {:ok, %{public: public}} = publish(ctx, work, command_id)
    assert public.snapshot_id != ctx.snapshot.id
    fresh = Repo.get!(ArticleSnapshot, public.snapshot_id)

    assert current_document(ctx.article) == Body.document(fresh)
    assert current_document(ctx.article).xml == "<xml>fixed</xml>"
    assert current_document(ctx.article).rss == "fixed rss"
    assert Repo.get!(ArticleSnapshot, ctx.snapshot.id)

    assert Repo.aggregate(
             from(b in ArticlePublicBody, where: b.article_id == ^ctx.article.id),
             :count
           ) == 1

    assert {:ok, %{public: replayed}} = publish(ctx, work, command_id)
    assert replayed.snapshot_id == public.snapshot_id
    assert current_document(ctx.article) == Body.document(fresh)
    # Publishing an existing historical Snapshot uses the same projection path.
    assert {:ok, %{public: selected}} =
             CMS.Articles.publish_article(
               ctx.article,
               ctx.community,
               %{snapshot_id: ctx.snapshot.id},
               public.snapshot_id,
               ctx.actor,
               Ecto.UUID.generate()
             )

    assert selected.snapshot_id == ctx.snapshot.id
    assert current_document(ctx.article) == Body.document(ctx.snapshot)
  end

  test "body write failure rolls back new Snapshot, public head and effects", ctx do
    {:ok, work} = save(ctx, "body failure")

    Repo.query!("""
    CREATE FUNCTION cms.reject_r3_test_body() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'R3 body failure'; END $$
    """)

    Repo.query!(
      "CREATE TRIGGER r3_body_failure BEFORE UPDATE ON cms.article_public_bodies FOR EACH ROW EXECUTE FUNCTION cms.reject_r3_test_body()"
    )

    count = Repo.aggregate(ArticleSnapshot, :count)
    effects = Repo.aggregate(CMS.Outbox.Event, :count)
    before = Repo.get!(ArticlePublicBody, ctx.article.id)
    assert {:error, _} = publish(ctx, work, Ecto.UUID.generate())
    assert Repo.get!(ArticlePublic, ctx.article.id).snapshot_id == ctx.public.snapshot_id
    assert Repo.get!(ArticlePublicBody, ctx.article.id) == before
    assert Repo.aggregate(ArticleSnapshot, :count) == count
    assert Repo.aggregate(CMS.Outbox.Event, :count) == effects
  end

  test "rebuild refuses stale Snapshot jobs and never changes publication facts", ctx do
    assert {:error, :transaction_required} = Public.rebuild(ctx.article, ctx.snapshot.id)
    {:ok, work} = save(ctx, "new head")
    assert {:ok, %{public: public}} = publish(ctx, work, Ecto.UUID.generate())

    assert {:error, :public_conflict} =
             Repo.transact(fn -> Public.rebuild(ctx.article, ctx.snapshot.id) end)

    before = Repo.get!(ArticlePublic, ctx.article.id)

    assert {:ok, rebuilt} =
             Repo.transact(fn -> Public.rebuild(ctx.article, public.snapshot_id) end)

    assert rebuilt.published_at == before.published_at
    assert rebuilt.published_by_id == before.published_by_id
    assert rebuilt.snapshot_id == public.snapshot_id
  end

  test "commit constraints reject missing or mismatched bodies; removing Public cascades only its projection",
       ctx do
    assert_raise Postgrex.Error, fn ->
      Repo.transaction(
        fn ->
          Repo.delete!(Repo.get!(ArticlePublicBody, ctx.article.id))
          Repo.query!("SET CONSTRAINTS ALL IMMEDIATE")
        end,
        mode: :savepoint
      )
    end

    {:ok, work} = save(ctx, "another snapshot")

    {:ok, snapshot} =
      Repo.transact(fn ->
        Snapshotter.freeze_in_transaction(work.id, work.revision, ctx.actor, Ecto.UUID.generate())
      end)

    assert_raise Postgrex.Error, fn ->
      Repo.transaction(
        fn ->
          Repo.query!("UPDATE cms.article_public_bodies SET snapshot_id=$1 WHERE article_id=$2", [
            Ecto.UUID.dump!(snapshot.id),
            Ecto.UUID.dump!(ctx.article.id)
          ])

          Repo.query!("SET CONSTRAINTS ALL IMMEDIATE")
        end,
        mode: :savepoint
      )
    end

    assert {:ok, _} =
             Repo.transaction(fn ->
               Repo.delete!(Repo.get!(ArticlePublic, ctx.article.id))
               Repo.query!("SET CONSTRAINTS ALL IMMEDIATE")
             end)

    refute Repo.get(ArticlePublicBody, ctx.article.id)
    assert Repo.get!(ArticleSnapshot, ctx.snapshot.id)
    assert Body.document(ctx.snapshot)
  end

  test "details, Search and Press read PublicBody without reading historical body storage", ctx do
    assert {:ok, _} =
             CMS.Press.update_config(
               ctx.community,
               %{feed_enabled: true, feed_threads: [:post]},
               ctx.actor,
               Ecto.UUID.generate()
             )

    listener = "r3-public-read-#{Ecto.UUID.generate()}"

    :telemetry.attach(
      listener,
      [:groupher_server, :repo, :query],
      &__MODULE__.capture_query/4,
      self()
    )

    on_exit(fn -> :telemetry.detach(listener) end)

    assert {:ok, view} =
             CMS.FrontDesk.article(%{
               community: ctx.community.slug,
               thread: :post,
               inner_id: ctx.inner_id
             })

    assert {:ok, artiment} = CMS.SearchArtiments.Projection.article(:post, view)
    assert artiment.indexed_snapshot_id == ctx.snapshot.id
    assert artiment.plain_text == current_document(ctx.article).plain_text
    assert {:ok, _} = CMS.SearchArtiments.Indexer.upsert_article(:post, ctx.article.id)
    assert {:ok, %{items: [item]}} = CMS.Press.thread_rss_feed(ctx.community, :post)
    assert item.html == current_document(ctx.article).html
    counted = CMS.SearchArtiments.Capacity.article_documents().post.count
    assert counted >= 1
    queries = drain_queries([])
    assert Enum.any?(queries, &String.contains?(&1, "article_public_bodies"))
    refute Enum.any?(queries, &String.contains?(&1, ~s("article_bodies")))
    # Corrupt/missing projection fails closed instead of silently reading history.
    Repo.delete!(Repo.get!(ArticlePublicBody, ctx.article.id))
    remaining = CMS.SearchArtiments.Capacity.article_documents() |> Map.get(:post, %{count: 0})
    assert remaining.count == counted - 1

    assert {:error, _} =
             CMS.FrontDesk.article(%{
               community: ctx.community.slug,
               thread: :post,
               inner_id: ctx.inner_id
             })

    assert {:error, :public_body_missing} = Public.body(ctx.public)
  end

  test "Ticket public reads use PublicBody while internal edits retain their own body", ctx do
    grants =
      ~w(ticket.create ticket.link_source ticket.update ticket.transition ticket.assign ticket.manage_case ticket.manage_visibility ticket.read_internal)
      |> Map.new(&{&1, true})

    {:ok, _} =
      GroupherServer.Test.PassportFixture.grant_community(ctx.actor, ctx.community.slug, grants)

    actor = ctx.actor

    assert {:ok, ticket} =
             CMS.Tickets.create_from_post(
               ctx.community,
               ctx.article.id,
               %{title: "R3 ticket", digest: "Ticket summary"},
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, internal} = CMS.Tickets.get_internal(ctx.community, ticket.id, actor)
    assert is_binary(internal.body.json)

    assert {:ok, _} =
             CMS.Tickets.publish(
               ctx.community,
               ticket.id,
               "Reviewed publication",
               internal.working_copy_revision,
               internal.lifecycle_version,
               internal.workflow_version,
               actor,
               Ecto.UUID.generate(),
               CMS.Tickets.Publication.preview_anchor(ctx.community.id, ticket.id)
             )

    assert {:ok, published} = CMS.Tickets.get_internal(ctx.community, ticket.id, actor)
    assert {:ok, view} = CMS.Tickets.get_public(ctx.community, published.inner_id)
    assert view.body == current_document(%Article{id: ticket.id})
    assert view.published_content.body == view.body
  end

  test "Gate hides deleted content while history and public projection remain private", ctx do
    counted = CMS.SearchArtiments.Capacity.article_documents().post.count

    Repo.update_all(from(l in CMS.Model.ArticleLifecycle, where: l.article_id == ^ctx.article.id),
      set: [state: :deleted]
    )

    assert Repo.get!(ArticlePublicBody, ctx.article.id)

    assert {:error, _} =
             CMS.FrontDesk.article(%{
               community: ctx.community.slug,
               thread: :post,
               inner_id: ctx.inner_id
             })

    assert {:error, _} =
             CMS.Press.article(%{
               community: ctx.community.slug,
               thread: :post,
               inner_id: ctx.inner_id
             })

    remaining = CMS.SearchArtiments.Capacity.article_documents() |> Map.get(:post, %{count: 0})
    assert remaining.count == counted - 1
  end

  test "migration refuses nonempty Public", ctx do
    migration = GroupherServer.Repo.Migrations.CreateArticlePublicBodies

    unless Code.ensure_loaded?(migration) do
      Code.require_file("priv/repo/migrations/20261112140000_create_article_public_bodies.exs")
    end

    assert_raise Postgrex.Error, ~r/requires empty Public/, fn ->
      Repo.transaction(
        fn ->
          Ecto.Migration.Runner.run(
            Repo,
            Repo.config(),
            20_261_112_140_000,
            migration,
            :forward,
            :up,
            :up,
            log: false
          )
        end,
        mode: :savepoint
      )
    end

    assert Repo.get!(ArticlePublicBody, ctx.article.id).snapshot_id == ctx.snapshot.id
  end

  @doc false
  def capture_query(_, _, %{query: query}, receiver), do: send(receiver, {:r3_query, query})

  defp drain_queries(acc) do
    receive do
      {:r3_query, query} -> drain_queries([query | acc])
    after
      0 -> acc
    end
  end

  defp current_document(article) do
    Repo.get!(ArticlePublicBody, article.id) |> ArticleBodyDocument.document()
  end

  defp save(ctx, text) do
    bag = mock_body_bag(mock_rich_text(text))

    CMS.Articles.save_working_copy(
      ctx.article,
      ctx.community,
      ctx.work.id,
      %{body_bag: bag},
      ctx.work.revision,
      ctx.actor,
      Ecto.UUID.generate()
    )
  end

  defp publish(ctx, work, command_id) do
    CMS.Articles.publish_article(
      ctx.article,
      ctx.community,
      %{working_copy_id: work.id, revision: work.revision},
      ctx.public.snapshot_id,
      ctx.actor,
      command_id
    )
  end
end
