defmodule GroupherServer.CMS.Articles.PaginationTest do
  @moduledoc """
  Verifies the Articles reference pagination adapter against published fixtures.

      Article fixture -> Lite page -> offset/cursor contract
  """

  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias CMS.Articles.Pagination
  alias CMS.Articles.Query.Contract
  alias GroupherServer.CMS
  alias CMS.Model.ArticleStats
  alias GroupherServer.ErrorCat
  alias Helper.ORM.Pagi.Config

  test "null optional order preserves an explicit sort and unknown sorts fail closed" do
    {community, first, _, user} = mock_article(:post)
    {_, second, _, _} = mock_article(:post, community, user)

    assert {:ok, %{entries: entries}} =
             Pagination.page(
               :post,
               %{community: community.slug, order: nil, sort: :asc_inserted},
               nil
             )

    assert Enum.map(entries, & &1.id) == [first.id, second.id]

    assert {:error, %{reason: :unsupported_sort}} =
             Pagination.page(:post, %{community: community.slug, sort: :unknown}, nil)
  end

  test "Article query contract rejects unknown keys, ambiguous aliases, and unwired collects" do
    assert {:error, %{reason: :unsupported_sort}} = Contract.validate_filter(%{sort: :collects})
    assert {:error, _} = Contract.validate_filter(%{unrecognized: true})
    assert {:error, _} = Contract.validate_filter(%{sort: :desc_inserted, order: :views})

    assert {:error, _} =
             Contract.validate_filter(%{community_tag: "one", community_tags: ["two"]})

    assert {:ok, :pass} = Contract.validate_filter(%{order: :views})
    assert :collects in CMS.Interactions.Const.interaction_order_values()
  end

  test "offset returns Article Lite rows and a distinct binding count" do
    {community, article, _attrs, _user} = mock_article(:post)

    assert {:ok,
            %{
              entries: [entry],
              pinned_entries: [],
              page_info: %{api: :offset, page: 1, total_count: 1}
            }} =
             Pagination.page(
               :post,
               %{community: community.slug},
               %GroupherServer.Pagi.Params.Offset{
                 page: 1,
                 size: 20,
                 config_revision: 0
               }
             )

    assert entry.id == article.id
    assert entry.inner_id == 1
    assert entry.community.id == community.id
    assert entry.author.id == article.author.id
  end

  test "Article Lite loads author and ordered tags in the page query" do
    {community, article, _attrs, user} = mock_article(:post)

    {:ok, first_tag} =
      CMS.Communities.create_tag(
        community,
        :post,
        mock_attrs(:community_tag),
        user,
        Ecto.UUID.generate()
      )

    {:ok, second_tag} =
      CMS.Communities.create_tag(
        community,
        :post,
        mock_attrs(:community_tag),
        user,
        Ecto.UUID.generate()
      )

    {:ok, _assignment} =
      CMS.Communities.set_tag(article, first_tag.id, user, Ecto.UUID.generate())

    {:ok, _assignment} =
      CMS.Communities.set_tag(article, second_tag.id, user, Ecto.UUID.generate())

    assert {:ok, %{entries: [entry]}} =
             Pagination.page(
               :post,
               %{community: community.slug},
               %GroupherServer.Pagi.Params.Offset{
                 page: 1,
                 size: 20,
                 config_revision: 0
               }
             )

    assert entry.author.id == article.author.id
    assert Enum.map(entry.community_tags, & &1.id) == [first_tag.id, second_tag.id]
    assert Enum.all?(entry.community_tags, &(is_binary(&1.group) and &1.group != ""))
    assert Enum.all?(entry.community_tags, &(&1.community.id == community.id))
  end

  test "cursor continues from the Article binding identity without a count" do
    {community, first_article, _attrs, user} = mock_article(:post)
    {_, second_article, _attrs, _user} = mock_article(:post, community, user)

    config = %Config{
      api: :cursor,
      default_size: 1,
      max_size: 10,
      revision: 0,
      platform_hard_max: 100
    }

    assert {:ok, %{entries: [first_entry], page_info: %{api: :cursor, end_cursor: cursor}}} =
             Pagination.page(
               :post,
               %{community: community.slug},
               %GroupherServer.Pagi.Params.Cursor{first: 1, config_revision: 0},
               nil,
               config: config
             )

    assert first_entry.id == second_article.id
    assert is_binary(cursor)

    assert {:ok, %{entries: entries, page_info: %{api: :cursor}}} =
             Pagination.page(
               :post,
               %{community: community.slug},
               %GroupherServer.Pagi.Params.Cursor{first: 1, after: cursor, config_revision: 0},
               nil,
               config: config
             )

    assert [next_entry] = entries
    refute next_entry.id == first_entry.id

    assert MapSet.new([first_article.id, second_article.id]) ==
             MapSet.new([first_entry.id, next_entry.id])
  end

  test "stats cursor treats a missing stats row as zero without omissions" do
    {community, first_article, _attrs, user} = mock_article(:post)
    {_, second_article, _attrs, _user} = mock_article(:post, community, user)
    {_, third_article, _attrs, _user} = mock_article(:post, community, user)

    Repo.delete_all(from(stats in ArticleStats, where: stats.article_id == ^second_article.id))

    config = %Config{
      api: :cursor,
      default_size: 1,
      max_size: 10,
      revision: 0,
      platform_hard_max: 100
    }

    base_filter = %{
      community: community.slug,
      first: 1,
      config_revision: 0,
      order: :upvotes
    }

    assert {:ok, %{entries: [first], page_info: %{end_cursor: first_cursor}}} =
             Pagination.page(
               :post,
               Map.drop(base_filter, [:page, :size, :first, :after, :config_revision]),
               %GroupherServer.Pagi.Params.Cursor{first: 1, config_revision: 0},
               nil,
               config: config
             )

    assert {:ok, %{entries: [second], page_info: %{end_cursor: second_cursor}}} =
             Pagination.page(
               :post,
               Map.drop(Map.put(base_filter, :after, first_cursor), [
                 :page,
                 :size,
                 :first,
                 :after,
                 :config_revision
               ]),
               %GroupherServer.Pagi.Params.Cursor{
                 first: 1,
                 after: first_cursor,
                 config_revision: 0
               },
               nil,
               config: config
             )

    assert {:ok, %{entries: [third], page_info: %{has_next_page: false}}} =
             Pagination.page(
               :post,
               Map.drop(Map.put(base_filter, :after, second_cursor), [
                 :page,
                 :size,
                 :first,
                 :after,
                 :config_revision
               ]),
               %GroupherServer.Pagi.Params.Cursor{
                 first: 1,
                 after: second_cursor,
                 config_revision: 0
               },
               nil,
               config: config
             )

    assert MapSet.new([first.id, second.id, third.id]) ==
             MapSet.new([first_article.id, second_article.id, third_article.id])
  end

  test "an explicit Pagi branch never receives a synthesized config revision" do
    {community, _article, _attrs, _user} = mock_article(:post)
    filter = %{community: community.slug}

    for pagi_input <- [%{offset: %{}}, %{offset: %{page: 1}}, %{cursor: %{}}] do
      assert {:error, %ErrorCat.Error{reason: :invalid_config_context}} =
               Pagination.page(:post, filter, pagi_input, nil)
    end
  end

  test "paging keys in business filters are rejected" do
    {community, _article, _, _user} = mock_article(:post)

    assert {:error, %ErrorCat.Error{reason: :invalid_body}} =
             Pagination.page(:post, %{community: community.slug, page: 1, size: 20}, nil)
  end

  test "cursor returns pinned entries only on the starting page" do
    {community, pinned_article, _attrs, user} = mock_article(:post)
    {_, _regular_article, _attrs, _user} = mock_article(:post, community, user)
    {_, _another_regular_article, _attrs, _user} = mock_article(:post, community, user)
    user = grant_post_pin(user, community)

    assert {:ok, _pinned} =
             CMS.Articles.pin(community, pinned_article.id, user, Ecto.UUID.generate())

    config = %Config{
      api: :cursor,
      default_size: 1,
      max_size: 10,
      revision: 0,
      platform_hard_max: 100
    }

    assert {:ok,
            %{pinned_entries: [pinned_entry], entries: entries, page_info: %{end_cursor: cursor}}} =
             Pagination.page(
               :post,
               %{community: community.slug},
               %GroupherServer.Pagi.Params.Cursor{first: 1, config_revision: 0},
               nil,
               config: config
             )

    assert pinned_entry.id == pinned_article.id
    refute Enum.any?(entries, &(&1.id == pinned_article.id))
    assert is_binary(cursor)

    assert {:ok, %{pinned_entries: [], entries: next_entries}} =
             Pagination.page(
               :post,
               %{community: community.slug},
               %GroupherServer.Pagi.Params.Cursor{first: 1, after: cursor, config_revision: 0},
               nil,
               config: config
             )

    assert length(next_entries) == 1
    refute Enum.any?(next_entries, &(&1.id == pinned_article.id))
  end

  test "keeps the three-query first-page budget constant as page size grows" do
    {community, _article, _attrs, _user} = mock_article(:post)
    filter = %{community: community.slug, config_revision: 0}

    assert {:ok, _config} =
             CMS.Dashboard.PagiMode.for_community(community.slug)

    {_small_result, small_queries} =
      capture_queries(fn ->
        Pagination.page(
          :post,
          Map.drop(Map.merge(filter, %{page: 1, size: 1}), [
            :page,
            :size,
            :first,
            :after,
            :config_revision
          ]),
          %GroupherServer.Pagi.Params.Offset{page: 1, size: 1, config_revision: 0}
        )
      end)

    query_sets =
      for size <- [20, Config.platform_hard_max()] do
        {_result, queries} =
          capture_queries(fn ->
            Pagination.page(
              :post,
              Map.drop(Map.merge(filter, %{page: 1, size: size}), [
                :page,
                :size,
                :first,
                :after,
                :config_revision
              ]),
              %GroupherServer.Pagi.Params.Offset{page: 1, size: size, config_revision: 0}
            )
          end)

        queries
      end

    assert Enum.all?(query_sets, &(length(&1) == length(small_queries)))

    article_queries =
      Enum.count(small_queries, fn query ->
        String.contains?(query, "FROM \"cms\".\"articles\"")
      end)

    assert article_queries == 3

    assert Enum.all?(query_sets, fn queries ->
             Enum.count(queries, &String.contains?(&1, "FROM \"cms\".\"articles\"")) == 3
           end)
  end

  test "joins ArticleStats only for a stats order" do
    {community, _article, _attrs, _user} = mock_article(:post)
    base_filter = %{community: community.slug, page: 1, size: 20, config_revision: 0}

    assert {:ok, _config} =
             CMS.Dashboard.PagiMode.for_community(community.slug)

    {_result, active_queries} =
      capture_queries(fn ->
        Pagination.page(
          :post,
          Map.drop(base_filter, [:page, :size, :first, :after, :config_revision]),
          %GroupherServer.Pagi.Params.Offset{page: 1, size: 20, config_revision: 0}
        )
      end)

    {_result, stats_queries} =
      capture_queries(fn ->
        Pagination.page(
          :post,
          Map.drop(Map.put(base_filter, :order, :upvotes), [
            :page,
            :size,
            :first,
            :after,
            :config_revision
          ]),
          %GroupherServer.Pagi.Params.Offset{page: 1, size: 20, config_revision: 0}
        )
      end)

    refute Enum.any?(active_queries, &String.contains?(&1, "article_stats"))
    assert Enum.count(stats_queries, &String.contains?(&1, "article_stats")) == 1
  end

  test "Dashboard config is loaded once on a cold cache and reused by list pages" do
    {community, _article, _attrs, _user} = mock_article(:post)

    assert {:ok, _deleted?} =
             CMS.Dashboard.PagiMode.invalidate(community.slug)

    {{:ok, _config}, cold_queries} =
      capture_queries(fn ->
        CMS.Dashboard.PagiMode.for_community(community.slug)
      end)

    {{:ok, _config}, warm_queries} =
      capture_queries(fn ->
        CMS.Dashboard.PagiMode.for_community(community.slug)
      end)

    assert Enum.count(cold_queries, &String.contains?(&1, "community_dashboards")) == 1
    refute Enum.any?(warm_queries, &String.contains?(&1, "community_dashboards"))
  end

  test "explicit offset input emits pinned entries only on page one" do
    {community, pinned, _attrs, user} = mock_article(:post)
    mock_article(:post, community, user)
    mock_article(:post, community, user)
    user = grant_post_pin(user, community)
    assert {:ok, _pin} = CMS.Articles.pin(community, pinned.id, user, Ecto.UUID.generate())
    filter = %{community: community.slug}

    assert {:ok, %{pinned_entries: [pin], page_info: %{total_count: 2}}} =
             Pagination.page(
               :post,
               filter,
               %{offset: %{page: 1, size: 1, config_revision: 0}},
               nil
             )

    assert pin.id == pinned.id

    assert {:ok, %{pinned_entries: [], entries: [_entry], page_info: %{page: 2}}} =
             Pagination.page(
               :post,
               filter,
               %{offset: %{page: 2, size: 1, config_revision: 0}},
               nil
             )
  end

  test "omitted pagination synthesizes the effective offset or cursor starting page" do
    {community, article, _attrs, _user} = mock_article(:post)
    filter = %{community: community.slug}

    assert {:ok, %{entries: [entry], page_info: %{api: :offset, page: 1, size: 20}}} =
             Pagination.page(:post, filter, nil)

    assert entry.id == article.id

    config = %Config{
      api: :cursor,
      default_size: 10,
      max_size: 10,
      revision: 3,
      platform_hard_max: 100
    }

    assert {:ok, %{entries: [entry], page_info: %{api: :cursor}}} =
             Pagination.page(:post, filter, nil, nil, config: config)

    assert entry.id == article.id
  end

  test "tag filters preserve offset ordering, unique count and complete cursor traversal" do
    {community, first, _attrs, user} = mock_article(:post)
    {_, second, _attrs, _user} = mock_article(:post, community, user)

    {:ok, tag} =
      CMS.Communities.create_tag(
        community,
        :post,
        mock_attrs(:community_tag),
        user,
        Ecto.UUID.generate()
      )

    {:ok, other} =
      CMS.Communities.create_tag(
        community,
        :post,
        mock_attrs(:community_tag),
        user,
        Ecto.UUID.generate()
      )

    for article <- [first, second], tag <- [tag, other] do
      assert {:ok, _assignment} =
               CMS.Communities.set_tag(article, tag.id, user, Ecto.UUID.generate())
    end

    for tag_filter <- [%{community_tag: tag.slug}, %{community_tags: [tag.slug, other.slug]}] do
      filter = Map.merge(tag_filter, %{community: community.slug})

      assert {:ok, %{entries: [head], page_info: %{total_count: 2, total_pages: 2}}} =
               Pagination.page(:post, filter, %GroupherServer.Pagi.Params.Offset{
                 page: 1,
                 size: 1,
                 config_revision: 0
               })

      assert head.id == second.id

      assert {:ok, %{entries: [tail]}} =
               Pagination.page(
                 :post,
                 Map.drop(Map.put(filter, :page, 2), [
                   :page,
                   :size,
                   :first,
                   :after,
                   :config_revision
                 ]),
                 %GroupherServer.Pagi.Params.Offset{page: 2, size: 1, config_revision: 0}
               )

      assert tail.id == first.id

      config = %Config{
        api: :cursor,
        default_size: 1,
        max_size: 10,
        revision: 0,
        platform_hard_max: 100
      }

      cursor_filter =
        Map.merge(tag_filter, %{community: community.slug})

      assert {:ok, %{entries: [head], page_info: %{end_cursor: cursor, has_next_page: true}}} =
               Pagination.page(:post, cursor_filter, nil, nil, config: config)

      assert head.id == second.id

      assert {:ok, %{entries: [tail], page_info: %{has_next_page: false}}} =
               Pagination.page(
                 :post,
                 Map.drop(Map.put(cursor_filter, :after, cursor), [
                   :page,
                   :size,
                   :first,
                   :after,
                   :config_revision
                 ]),
                 %GroupherServer.Pagi.Params.Cursor{
                   first: config.default_size,
                   after: cursor,
                   config_revision: config.revision
                 },
                 nil,
                 config: config
               )

      assert tail.id == first.id
    end
  end

  test "GraphQL postPage accepts omitted pagi and exposes safe mismatch subtypes" do
    {community, _article, _attrs, _user} = mock_article(:post)

    query = """
    query($community: String!) {
      postPage(filter: {community: $community}) {
        entries { innerId }
        pageInfo { ... on OffsetPageInfo { page size } }
      }
    }
    """

    assert {:ok, %{data: %{"postPage" => %{"pageInfo" => %{"page" => 1}}}}} =
             Absinthe.run(query, GroupherServerWeb.Schema,
               variables: %{"community" => community.slug}
             )

    for {input, subtype} <- [
          {"offset: {configRevision: 99}", "revision"},
          {"cursor: {configRevision: 99}", "revision"}
        ] do
      query = """
      { postPage(filter: {community: "#{community.slug}"}, pagi: {#{input}}) { entries { innerId } } }
      """

      assert {:ok, %{errors: [%{extensions: extensions}]}} =
               Absinthe.run(query, GroupherServerWeb.Schema)

      assert extensions == %{code: 4211, mismatch: subtype}
    end
  end

  defp capture_queries(fun) do
    ref = make_ref()
    handler_id = {__MODULE__, ref}

    event =
      GroupherServer.Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, metadata, {pid, query_ref} ->
          send(pid, {query_ref, metadata.query})
        end,
        {self(), ref}
      )

    try do
      result = fun.()
      {result, drain_queries(ref, [])}
    after
      :telemetry.detach(handler_id)
    end
  end

  defp drain_queries(ref, queries) do
    receive do
      {^ref, query} -> drain_queries(ref, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end

  defp grant_post_pin(user, community) do
    Map.put(user, :cur_passport, %{
      "global" => %{},
      community.slug => %{"cms" => %{"post.pin" => true}}
    })
  end
end
