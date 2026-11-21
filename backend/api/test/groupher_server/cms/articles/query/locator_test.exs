defmodule GroupherServer.Test.CMS.Articles.Query.LocatorTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Articles.Query.Locator
  alias CMS.Model.{ArticleBinding, ArticleSnapshotTag}
  alias GroupherServerWeb.Schema.Helper.Fields

  test "bounded batch keeps duplicates and input order across Community bindings" do
    {source, article, _attrs, author} = mock_article(:post)
    {:ok, destination} = mock_community(author)

    destination_binding =
      %ArticleBinding{}
      |> ArticleBinding.changeset(%{
        article_id: article.id,
        community_id: destination.id,
        inner_id: 99_001
      })
      |> Repo.insert!()

    source_binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: source.id)

    source_path = %{community: source.slug, thread: :post, inner_id: source_binding.inner_id}

    destination_path = %{
      community: destination.slug,
      thread: :post,
      inner_id: destination_binding.inner_id
    }

    invalid_path = %{community: source.slug, thread: :post, inner_id: 999_999}

    {:ok, {public, _snapshot}} = CMS.Articles.Public.current(article.id)

    {:ok, tag} =
      CMS.Communities.create_tag(
        source,
        :post,
        mock_attrs(:community_tag),
        author,
        Ecto.UUID.generate()
      )

    Repo.insert!(%ArticleSnapshotTag{snapshot_id: public.snapshot_id, tag_id: tag.id})

    assert {:ok, [first, duplicate, mirrored]} =
             CMS.FrontDesk.article([
               source_path,
               source_path,
               invalid_path,
               destination_path
             ])

    assert Enum.all?([first, duplicate, mirrored], &(&1.id == article.id))
    assert first.community.id == source.id
    assert duplicate.community.id == source.id
    assert mirrored.community.id == destination.id
    assert first.inner_id == source_binding.inner_id
    assert duplicate.inner_id == source_binding.inner_id
    assert mirrored.inner_id == destination_binding.inner_id
    assert first.title == article.title
    assert first.snapshot_id == article.snapshot_id
    assert first.inserted_at == first.published_at
    assert first.updated_at == first.published_at
    assert Enum.map(first.article_tags, & &1.id) == [tag.id]
    assert Enum.map(mirrored.article_tags, & &1.id) == [tag.id]
    assert {:ok, [loaded_community]} = Fields.article_relation(first, %{}, nil, :communities)
    assert loaded_community.id == source.id
  end

  test "empty and 100-item batches work; 101 paths return the dedicated ErrorCat reason" do
    assert {:ok, []} = CMS.FrontDesk.article([])

    {community, article, _attrs, _author} = mock_article(:post)
    binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id)
    path = %{community: community.slug, thread: :post, inner_id: binding.inner_id}

    assert {:ok, entries} = CMS.FrontDesk.article(List.duplicate(path, 100))
    assert length(entries) == 100

    assert {:error, %ErrorCat.Error{reason: :batch_limit_exceeded, details: details}} =
             CMS.FrontDesk.article(List.duplicate(path, 101))

    assert details == %{limit: 100, actual: 101}
  end

  test "one community/thread query group keeps SQL work bounded from 1 to 100 paths" do
    {community, first, _attrs, author} = mock_article(:post)

    paths =
      [path_for(first, community)] ++
        Enum.map(1..99, fn _ ->
          {_same_community, article, _attrs, _author} = mock_article(:post, community, author)
          path_for(article, community)
        end)

    {one_result, one_queries} =
      capture_repo_queries(fn -> Locator.resolve(Enum.take(paths, 1)) end)

    {twenty_result, twenty_queries} =
      capture_repo_queries(fn -> Locator.resolve(Enum.take(paths, 20)) end)

    {hundred_result, hundred_queries} =
      capture_repo_queries(fn -> Locator.resolve(paths) end)

    assert {:ok, [%CMS.Model.Article{}]} = one_result
    assert {:ok, entries} = twenty_result
    assert length(entries) == 20
    assert {:ok, entries} = hundred_result
    assert length(entries) == 100

    assert data_query_count(hundred_queries) <= data_query_count(one_queries) + 1
    assert data_query_count(hundred_queries) <= data_query_count(twenty_queries) + 1
  end

  test "public actor preserves anonymous visibility and admin mode requires actor" do
    {community, article, _attrs, owner} = mock_article(:post)
    path = path_for(article, community)

    assert {:ok, anonymous} = Locator.resolve([path])
    assert {:ok, public_with_actor} = Locator.resolve([path], owner, mode: :public)
    assert Enum.map(public_with_actor, & &1.id) == Enum.map(anonymous, & &1.id)

    assert {:ok, [%CMS.Model.Article{id: article_id}]} =
             Locator.resolve([path], owner, mode: :admin)

    assert article_id == article.id
    assert {:error, _reason} = Locator.resolve([path], nil, mode: :admin)
  end

  defp path_for(article, community) do
    binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id)
    %{community: community.slug, thread: article.thread, inner_id: binding.inner_id}
  end

  defp capture_repo_queries(fun) do
    ref = make_ref()
    handler_id = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

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

  defp data_query_count(queries) do
    Enum.count(queries, fn query ->
      query
      |> String.trim_leading()
      |> String.match?(~r/^(SELECT|INSERT|UPDATE|DELETE)/)
    end)
  end
end
