defmodule GroupherServer.CMS.Comments.PaginationTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias CMS.Comments.Query.Contract

  test "comment query contract rejects unsupported sort and filter keys" do
    assert {:error, %{reason: :unsupported_sort}} = Contract.validate_filter(%{sort: :most_views})
    assert {:error, _} = Contract.validate_filter(%{author_id: 1})
    assert {:ok, :pass} = Contract.validate_filter(%{sort: :desc_inserted})
  end

  alias GroupherServer.{CMS, ErrorCat}

  test "returns an offset CommentPage and rejects an explicit branch without revision" do
    {community, article, _attrs, user} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(article, community),
        mock_comment("comment page"),
        user,
        Ecto.UUID.generate()
      )

    assert {:ok,
            %{
              entries: [entry],
              pinned_entries: [],
              page_info: %{api: :offset, page: 1, total_count: 1}
            }} =
             CMS.Comments.page(
               :post,
               article.id,
               community.slug,
               %{sort: :asc_inserted},
               %{offset: %{page: 1, size: 20, config_revision: 0}},
               :replies,
               user
             )

    assert entry.id == comment.id
    assert Ecto.assoc_loaded?(entry.body)
    assert Ecto.assoc_loaded?(entry.author)

    assert {:error, %ErrorCat.Error{reason: :invalid_config_context}} =
             CMS.Comments.page(
               :post,
               article.id,
               community.slug,
               %{},
               %{offset: %{}},
               :replies,
               user
             )
  end

  test "continues a cursor CommentPage after a Dashboard config revision" do
    {community, article, _attrs, user} = mock_article(:post)

    for body <- ["first", "second"] do
      assert {:ok, _comment} =
               CMS.Comments.create_comment(
                 community,
                 :post,
                 article_inner_id(article, community),
                 mock_comment(body),
                 user,
                 Ecto.UUID.generate()
               )
    end

    assert {:ok, dashboard} =
             CMS.Dashboard.update(
               community,
               :pagi_mode,
               %{mode: :load_more, mobile_mode: :infinite_scroll, expected_revision: 0},
               user,
               Ecto.UUID.generate()
             )

    assert dashboard.pagi_revision == 1

    assert {:ok,
            %{
              entries: [first],
              page_info: %{api: :cursor, end_cursor: cursor, has_next_page: true}
            }} =
             CMS.Comments.page(
               :post,
               article.id,
               community.slug,
               %{sort: :asc_inserted},
               %{cursor: %{first: 1, config_revision: 1}},
               :replies,
               user
             )

    assert is_binary(cursor)

    assert {:ok,
            %{
              entries: [second],
              pinned_entries: [],
              page_info: %{api: :cursor, has_next_page: false}
            }} =
             CMS.Comments.page(
               :post,
               article.id,
               community.slug,
               %{sort: :asc_inserted},
               %{cursor: %{first: 1, after: cursor, config_revision: 1}},
               :replies,
               user
             )

    refute first.id == second.id
  end

  test "offset pages traverse comment roots and replies with complete boundary metadata" do
    {community, article, _attrs, user} = mock_article(:post)
    roots = Enum.map(1..3, fn _ -> create_root(community, article, user) end)

    root_pages =
      for page_number <- 1..3 do
        assert {:ok, page} =
                 CMS.Comments.page(
                   :post,
                   article.id,
                   community.slug,
                   %{sort: :asc_inserted},
                   offset_page(page_number, 1),
                   :replies
                 )

        expected_boundary =
          case page_number do
            1 -> {false, true}
            2 -> {true, true}
            3 -> {true, false}
          end

        assert {page.page_info.has_previous_page, page.page_info.has_next_page} ==
                 expected_boundary

        assert page.page_info.total_count == 3
        assert length(page.entries) == 1
        page
      end

    root_offset_ids = Enum.flat_map(root_pages, &Enum.map(&1.entries, fn entry -> entry.id end))
    assert root_offset_ids == Enum.map(roots, & &1.id)

    root_cursor_ids =
      traverse(fn after_cursor ->
        CMS.Comments.page(
          :post,
          article.id,
          community.slug,
          %{sort: :asc_inserted},
          cursor(after_cursor),
          :replies
        )
      end)

    assert root_cursor_ids == root_offset_ids
    assert length(Enum.uniq(root_cursor_ids)) == 3

    root = hd(roots)

    replies =
      Enum.map(1..3, fn _ ->
        {:ok, reply} =
          CMS.Comments.reply_comment(
            root.id,
            mock_comment("paged reply"),
            user,
            Ecto.UUID.generate()
          )

        reply
      end)

    reply_pages =
      for page_number <- 1..3 do
        assert {:ok, page} =
                 CMS.Comments.reply_page(
                   root,
                   community.slug,
                   %{sort: :asc_inserted},
                   offset_page(page_number, 1)
                 )

        expected_boundary =
          case page_number do
            1 -> {false, true}
            2 -> {true, true}
            3 -> {true, false}
          end

        assert {page.page_info.has_previous_page, page.page_info.has_next_page} ==
                 expected_boundary

        assert page.page_info.total_count == 3
        assert length(page.entries) == 1
        page
      end

    reply_offset_ids = Enum.flat_map(reply_pages, &Enum.map(&1.entries, fn entry -> entry.id end))
    assert reply_offset_ids == Enum.map(replies, & &1.id)

    reply_cursor_ids =
      traverse(fn after_cursor ->
        CMS.Comments.reply_page(
          root,
          community.slug,
          %{sort: :asc_inserted},
          cursor(after_cursor)
        )
      end)

    assert reply_cursor_ids == reply_offset_ids
    assert length(Enum.uniq(reply_cursor_ids)) == 3
  end

  test "canonical preview is bounded, counts all descendants and preserves direct parents" do
    {community, article, _, user} = mock_article(:post)
    root = create_root(community, article, user)

    replies =
      Enum.reduce(1..5, [], fn n, acc ->
        parent = List.first(acc) || root

        {:ok, reply} =
          CMS.Comments.reply_comment(
            parent.id,
            mock_comment("reply #{n}"),
            user,
            Ecto.UUID.generate()
          )

        [reply | acc]
      end)
      |> Enum.reverse()

    {:ok, page} = CMS.Comments.page(:post, article.id, community.slug, %{}, offset(), :replies)
    assert [entry] = page.entries
    assert entry.replies_count == 5
    assert Enum.map(entry.replies, & &1.id) == replies |> Enum.take(3) |> Enum.map(& &1.id)
    assert Enum.at(entry.replies, 1).reply_to_comment.id == hd(replies).id
    assert Enum.all?(entry.replies, &(to_string(&1.root_inner_id) == to_string(root.inner_id)))

    assert {:ok, %{entries: all, page_info: %{total_count: 5}}} =
             CMS.Comments.reply_page(root, community.slug, %{}, offset(), nil)

    assert Enum.map(all, & &1.id) == Enum.map(replies, & &1.id)
    assert Enum.all?(all, &(&1.replies == []))
    assert Enum.all?(all, &(&1.root_comment_id == root.id))
  end

  test "roots timeline and descendants share offset/cursor order including timestamp ties and empty tails" do
    {community, article, _, user} = mock_article(:post)
    first = create_root(community, article, user)
    second = create_root(community, article, user)

    {:ok, reply} =
      CMS.Comments.reply_comment(first.id, mock_comment("nested"), user, Ecto.UUID.generate())

    Repo.update_all(from(c in Comment, where: c.id in ^[first.id, second.id, reply.id]),
      set: [inserted_at: first.inserted_at]
    )

    for mode <- [:replies, :timeline] do
      {:ok, offset_page} =
        CMS.Comments.page(:post, article.id, community.slug, %{}, offset(), mode)

      cursor_ids =
        traverse(fn after_cursor ->
          CMS.Comments.page(:post, article.id, community.slug, %{}, cursor(after_cursor), mode)
        end)

      assert cursor_ids == Enum.map(offset_page.entries, & &1.id)
    end

    assert traverse(fn after_cursor ->
             CMS.Comments.reply_page(first, community.slug, %{}, cursor(after_cursor))
           end) == [reply.id]

    assert {:ok, %{entries: [], page_info: %{has_next_page: false}}} =
             CMS.Comments.reply_page(second, community.slug, %{}, cursor())

    assert {:ok, %{entries: [], page_info: %{has_next_page: false}}} =
             CMS.Comments.reply_page(
               first,
               community.slug,
               %{},
               %{offset: %{page: 2, size: 20, config_revision: 0}}
             )
  end

  test "cursor is bound to the root and collection, and defaults do not restrict explicit APIs" do
    {community, article, _, user} = mock_article(:post)
    first = create_root(community, article, user)
    second = create_root(community, article, user)

    for _ <- 1..2 do
      {:ok, _} =
        CMS.Comments.reply_comment(first.id, mock_comment("reply"), user, Ecto.UUID.generate())
    end

    {:ok, %{page_info: %{end_cursor: position}}} =
      CMS.Comments.reply_page(first, community.slug, %{}, cursor())

    assert {:ok, %{entries: [_]}} =
             CMS.Comments.reply_page(
               first,
               community.slug,
               %{sort: :asc_inserted},
               cursor(position)
             )

    assert {:error, %ErrorCat.Error{reason: :cursor_query_mismatch}} =
             CMS.Comments.reply_page(second, community.slug, %{}, cursor(position))

    assert {:error, %ErrorCat.Error{reason: :cursor_query_mismatch}} =
             CMS.Comments.page(:post, article.id, community.slug, %{}, cursor(position), :replies)

    {:ok, _} =
      CMS.Dashboard.update(
        community,
        :pagi_mode,
        %{mode: :load_more, mobile_mode: :infinite_scroll, expected_revision: 0},
        user,
        Ecto.UUID.generate()
      )

    assert {:ok, %{page_info: %{api: :offset}}} =
             CMS.Comments.reply_page(first, community.slug, %{}, offset(1))

    assert {:ok, %{entries: [_], page_info: %{has_next_page: false}}} =
             CMS.Comments.reply_page(first, community.slug, %{}, cursor(position, 1))
  end

  test "folded descendants are excluded from preview, count, page and reply targets" do
    {community, article, _, user} = mock_article(:post)
    root = create_root(community, article, user)

    {:ok, hidden} =
      CMS.Comments.reply_comment(root.id, mock_comment("hidden"), user, Ecto.UUID.generate())

    {:ok, visible} =
      CMS.Comments.reply_comment(hidden.id, mock_comment("visible"), user, Ecto.UUID.generate())

    Repo.update_all(from(c in Comment, where: c.id == ^hidden.id), set: [is_folded: true])

    {:ok, %{entries: [entry]}} =
      CMS.Comments.page(:post, article.id, community.slug, %{}, offset(), :replies)

    assert entry.replies_count == 1
    assert [preview] = entry.replies
    assert preview.id == visible.id
    assert preview.reply_to_comment == nil

    {:ok, %{entries: [expanded], page_info: %{total_count: 1}}} =
      CMS.Comments.reply_page(root, community.slug, %{}, offset())

    assert expanded.reply_to_comment == nil
  end

  test "preview SQL budget stays constant when the root page grows" do
    {community, article, _, user} = mock_article(:post)

    for _ <- 1..4 do
      root = create_root(community, article, user)

      {:ok, _} =
        CMS.Comments.reply_comment(root.id, mock_comment("preview"), user, Ecto.UUID.generate())
    end

    # Warm configuration/snapshot caches so this measures collection growth rather than cache misses.
    CMS.Comments.page(:post, article.id, community.slug, %{}, offset(), :replies)

    {_, one} =
      capture_queries(fn ->
        CMS.Comments.page(
          :post,
          article.id,
          community.slug,
          %{},
          %{offset: %{page: 1, size: 1, config_revision: 0}},
          :replies
        )
      end)

    {_, four} =
      capture_queries(fn ->
        CMS.Comments.page(:post, article.id, community.slug, %{}, offset(), :replies)
      end)

    assert length(one) == length(four)
    assert Enum.count(four, &String.contains?(&1, "row_number")) == 1
  end

  test "removed public fields are absent and new reply page uses PagiInput" do
    schema = GroupherServerWeb.Schema
    fields = Absinthe.Schema.lookup_type(schema, :query).fields
    refute Map.has_key?(fields, :paged_comments)
    refute Map.has_key?(fields, :paged_comment_replies)
    assert fields.comment_reply_page.args.pagi.type == :pagi_input
  end

  defp create_root(community, article, user) do
    {:ok, root} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(article, community),
        mock_comment("root"),
        user,
        Ecto.UUID.generate()
      )

    root
  end

  defp offset(revision \\ 0), do: %{offset: %{page: 1, size: 20, config_revision: revision}}

  defp offset_page(page, size, revision \\ 0) do
    %{offset: %{page: page, size: size, config_revision: revision}}
  end

  defp cursor(after_cursor \\ nil, revision \\ 0) do
    %{cursor: %{first: 1, after: after_cursor, config_revision: revision}}
  end

  defp traverse(fetch, after_cursor \\ nil) do
    {:ok, page} = fetch.(after_cursor)
    ids = Enum.map(page.entries, & &1.id)

    if page.page_info.has_next_page do
      ids ++ traverse(fetch, page.page_info.end_cursor)
    else
      ids
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
end
