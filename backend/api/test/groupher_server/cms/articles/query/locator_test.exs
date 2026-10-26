defmodule GroupherServer.Test.CMS.Articles.Query.LocatorTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Model.ArticleBinding

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

    assert {:ok, [first, duplicate, mirrored]} =
             CMS.Articles.locators([
               source_path,
               source_path,
               invalid_path,
               destination_path
             ])

    assert first.binding.id == source_binding.id
    assert duplicate.binding.id == source_binding.id
    assert mirrored.binding.id == destination_binding.id
    assert Enum.all?([first, duplicate, mirrored], &(&1.article.id == article.id))
    assert first.path == source_path
    assert duplicate.path == source_path
    assert mirrored.path == destination_path
  end

  test "empty and 100-item batches work; 101 paths return the dedicated ErrorCat reason" do
    assert {:ok, []} = CMS.Articles.locators([])

    {community, article, _attrs, _author} = mock_article(:post)
    binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id)
    path = %{community: community.slug, thread: :post, inner_id: binding.inner_id}

    assert {:ok, entries} = CMS.Articles.locators(List.duplicate(path, 100))
    assert length(entries) == 100

    assert {:error, %ErrorCat.Error{reason: :batch_limit_exceeded, details: details}} =
             CMS.Articles.locators(List.duplicate(path, 101))

    assert details == %{limit: 100, actual: 101}
  end

  test "one community/thread query group keeps SQL work bounded from 1 to 100 paths" do
    {community, article, _attrs, _author} = mock_article(:post)
    binding = Repo.get_by!(ArticleBinding, article_id: article.id, community_id: community.id)
    path = %{community: community.slug, thread: :post, inner_id: binding.inner_id}

    {one_result, one_queries} =
      capture_repo_queries(fn -> CMS.Articles.locators([path]) end)

    {twenty_result, twenty_queries} =
      capture_repo_queries(fn -> CMS.Articles.locators(List.duplicate(path, 20)) end)

    {hundred_result, hundred_queries} =
      capture_repo_queries(fn -> CMS.Articles.locators(List.duplicate(path, 100)) end)

    assert {:ok, [_]} = one_result
    assert {:ok, entries} = twenty_result
    assert length(entries) == 20
    assert {:ok, entries} = hundred_result
    assert length(entries) == 100

    assert data_query_count(hundred_queries) <= data_query_count(one_queries) + 1
    assert data_query_count(hundred_queries) <= data_query_count(twenty_queries) + 1
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
