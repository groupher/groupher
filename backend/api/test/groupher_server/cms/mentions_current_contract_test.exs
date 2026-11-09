defmodule GroupherServer.Test.CMS.MentionsCurrentContractTest do
  @moduledoc "Current Mention relationships without version facts."
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.ArtimentMentions.Capture
  alias CMS.Model.Mentions.{Edge, Endpoint}
  alias CMS.Model.{ArticleBinding, ArticleLifecycle}

  test "two Plate mentions of one target form one edge with count two" do
    {community, source, _, author} = mock_article(:post)
    {_, target, _, _} = mock_article(:blog, community, author)
    now = DateTime.utc_now(:second)

    assert {:ok, %{edge_count: 1}} =
             capture(source, community, mention_ast(:blog, target.article_id, 2), now)

    edge = Repo.one!(from(edge in Edge, where: edge.target_type == :blog))
    assert edge.occurrences_count == 2
    assert edge.mentioned_at == now
  end

  test "retained edges keep mentioned_at; removed then readded edges get a new time" do
    {community, source, _, author} = mock_article(:post)
    {_, target, _, _} = mock_article(:blog, community, author)
    first_at = DateTime.utc_now(:second)
    second_at = DateTime.add(first_at, 60, :second)
    third_at = DateTime.add(first_at, 120, :second)
    ast = mention_ast(:blog, target.article_id, 1)

    assert {:ok, _} = capture(source, community, ast, first_at)
    first = edge_for(source)
    assert {:ok, _} = capture(source, community, ast, second_at)
    retained = edge_for(source)
    assert retained.id == first.id
    assert retained.mentioned_at == first_at

    assert {:ok, _} = capture(source, community, [], second_at)

    refute Repo.exists?(
             from(edge in Edge,
               where: edge.source_endpoint_id == ^first.source_endpoint_id
             )
           )

    assert {:ok, _} = capture(source, community, ast, third_at)
    readded = edge_for(source)
    assert readded.mentioned_at == third_at
    assert readded.id != first.id
  end

  test "stable Article ID targeting a draft keeps its edge and graph metadata" do
    {community, source, _, author} = mock_article(:post)
    {_, target, _, _} = mock_article(:blog, community, author)

    Repo.update_all(
      from(state in ArticleLifecycle, where: state.article_id == ^target.article_id),
      set: [state: :draft]
    )

    assert {:ok, _} =
             capture(
               source,
               community,
               mention_ast(:blog, target.article_id, 1),
               DateTime.utc_now(:second)
             )

    assert Repo.exists?(from(edge in Edge, where: edge.target_type == :blog))

    focus = %{type: :post, article_inner_id: source.inner_id}
    assert {:ok, page} = CMS.mentions_graph_page(community.slug, focus, nil, 20)
    assert length(page.edges) == 1

    assert Enum.any?(page.nodes, fn node ->
             node.type == :blog and node.status == :unavailable and is_binary(node.title) and
               is_binary(node.url)
           end)
  end

  test "a draft target without a public number has a status URL and stable graph locator" do
    {community, source, _, author} = mock_article(:post)
    {_, target, _, _} = mock_article(:blog, community, author)

    Repo.update_all(
      from(binding in ArticleBinding, where: binding.article_id == ^target.article_id),
      set: [inner_id: nil]
    )

    Repo.update_all(
      from(state in ArticleLifecycle, where: state.article_id == ^target.article_id),
      set: [state: :draft]
    )

    assert {:ok, _} =
             capture(
               source,
               community,
               mention_ast(:blog, target.article_id, 1),
               DateTime.utc_now(:second)
             )

    source_focus = %{type: :post, article_inner_id: source.inner_id}

    assert {:ok, page} =
             CMS.mentions_graph_page(community.slug, source_focus, nil, 20)

    target_node = Enum.find(page.nodes, &(&1.type == :blog))
    assert target_node.status == :unavailable
    assert target_node.url == "/#{community.slug}/blog/#{target.article_id}"
    assert target_node.locator == %{type: :blog, article_id: target.article_id}

    assert {:ok, target_page} =
             CMS.mentions_graph_page(
               community.slug,
               target_node.locator,
               nil,
               20
             )

    assert length(target_page.edges) == 1

    query = """
    query($community: String!, $focus: MentionsGraphLocatorInput!) {
      mentionsGraph(community: $community, focus: $focus) {
        nodes { type status title url locator { type articleInnerId articleId } }
        edges { id }
      }
    }
    """

    graphql_page =
      gq_query(simu_conn(:guest), query, %{
        community: community.slug,
        focus: %{type: "BLOG", article_id: target.article_id}
      })

    assert length(graphql_page["edges"]) == 1

    assert Enum.any?(graphql_page["nodes"], fn node ->
             node["type"] == "BLOG" and node["locator"]["articleId"] == target.article_id and
               node["url"] == "/#{community.slug}/blog/#{target.article_id}"
           end)

    Repo.delete_all(
      from(binding in ArticleBinding, where: binding.article_id == ^target.article_id)
    )

    assert {:ok, without_binding} =
             CMS.mentions_graph_page(community.slug, source_focus, nil, 20)

    assert Enum.any?(without_binding.nodes, fn node ->
             node.type == :blog and node.url == "/#{community.slug}/blog/#{target.article_id}"
           end)

    assert {:ok, direct_without_binding} =
             CMS.mentions_graph_page(
               community.slug,
               target_node.locator,
               nil,
               20
             )

    assert length(direct_without_binding.edges) == 1

    graphql_without_binding =
      gq_query(simu_conn(:guest), query, %{
        community: community.slug,
        focus: %{type: "BLOG", article_id: target.article_id}
      })

    assert length(graphql_without_binding["edges"]) == 1
  end

  test "an unbound source stays reachable from a bound target's graph" do
    {community, source, _, author} = mock_article(:post)
    {_, target, _, _} = mock_article(:blog, community, author)

    assert {:ok, _} =
             capture(
               source,
               community,
               mention_ast(:blog, target.article_id, 1),
               DateTime.utc_now(:second)
             )

    Repo.delete_all(
      from(binding in ArticleBinding, where: binding.article_id == ^source.article_id)
    )

    target_focus = %{type: :blog, article_inner_id: target.inner_id}

    assert {:ok, page} =
             CMS.mentions_graph_page(community.slug, target_focus, nil, 20)

    source_node = Enum.find(page.nodes, &(&1.type == :post))
    assert source_node.url == "/#{community.slug}/post/#{source.article_id}"
    assert source_node.locator == %{type: :post, article_id: source.article_id}

    assert {:ok, direct} =
             CMS.mentions_graph_page(
               community.slug,
               source_node.locator,
               nil,
               20
             )

    assert length(direct.edges) == 1
  end

  test "hiding a source preserves its outgoing edges" do
    {community, source, _, author} = mock_article(:post)
    {_, target, _, _} = mock_article(:blog, community, author)

    assert {:ok, _} =
             capture(
               source,
               community,
               mention_ast(:blog, target.article_id, 1),
               DateTime.utc_now(:second)
             )

    endpoint = Repo.get_by!(Endpoint, type: :post, article_id: source.article_id)

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.hide_source(%{type: :post, article_id: source.article_id})
             end)

    assert Repo.exists?(from(edge in Edge, where: edge.source_endpoint_id == ^endpoint.id))
  end

  test "permanent deletion clears both directions of an endpoint" do
    {community, source, _, author} = mock_article(:post)
    {_, target, _, _} = mock_article(:blog, community, author)

    assert {:ok, _} =
             capture(
               source,
               community,
               mention_ast(:blog, target.article_id, 1),
               DateTime.utc_now(:second)
             )

    assert {:ok, _} =
             capture(
               target,
               community,
               mention_ast(:post, source.article_id, 1),
               DateTime.utc_now(:second)
             )

    endpoint = Repo.get_by!(Endpoint, type: :post, article_id: source.article_id)

    assert {:ok, {:ok, :pass}} =
             Repo.transaction(fn ->
               CMS.ArtimentMentions.mark_deleted(%{type: :post, article_id: source.article_id})
             end)

    refute Repo.exists?(
             from(edge in Edge,
               where:
                 edge.source_endpoint_id == ^endpoint.id or
                   edge.target_endpoint_id == ^endpoint.id
             )
           )
  end

  test "transaction rollback does not leave current edges" do
    {community, source, _, author} = mock_article(:post)
    {_, target, _, _} = mock_article(:blog, community, author)
    endpoint = Repo.get_by!(Endpoint, type: :post, article_id: source.article_id)

    assert {:error, :deliberate_rollback} =
             Repo.transaction(fn ->
               assert {:ok, _} =
                        Capture.execute(
                          %{type: :post, article_id: source.article_id},
                          selected(
                            community,
                            mention_ast(:blog, target.article_id, 1),
                            DateTime.utc_now(:second)
                          ),
                          {:command, Ecto.UUID.generate()}
                        )

               Repo.rollback(:deliberate_rollback)
             end)

    refute Repo.exists?(from(edge in Edge, where: edge.source_endpoint_id == ^endpoint.id))
  end

  defp capture(source, community, ast, now) do
    identity = %{type: source.thread, article_id: source.article_id}

    case Repo.transaction(fn ->
           Capture.execute(
             identity,
             selected(community, ast, now),
             {:command, Ecto.UUID.generate()}
           )
         end) do
      {:ok, result} -> result
      {:error, reason} -> {:error, reason}
    end
  end

  defp selected(community, ast, now) do
    %{
      published_revision_identity: Ecto.UUID.generate(),
      ast: ast,
      community_id: community.id,
      mentioned_at: now
    }
  end

  defp edge_for(source) do
    endpoint = Repo.get_by!(Endpoint, type: source.thread, article_id: source.article_id)
    Repo.one!(from(edge in Edge, where: edge.source_endpoint_id == ^endpoint.id))
  end

  defp mention_ast(type, id, count) do
    Enum.map(1..count, fn index ->
      %{
        "type" => "mention",
        "key" => "#{type}:#{id}",
        "value" => "target-#{index}",
        "children" => [%{"text" => "target"}]
      }
    end)
  end
end
