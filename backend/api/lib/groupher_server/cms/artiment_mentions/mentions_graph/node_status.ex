defmodule GroupherServer.CMS.ArtimentMentions.MentionsGraph.NodeStatus do
  @moduledoc """
  Resolves a bounded batch of endpoint identities and their public graph metadata.

      endpoint identities -> Community locators -> graph metadata + resource status
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Mentions.{Edge, Endpoint}

  alias CMS.Model.{ArticleBinding, Comment}

  @doc "Resolves client locators and returns graph node state in input order."
  def resolve_locators(community, locators) when is_list(locators) do
    endpoints_by_locator = endpoints_for_locators(community, locators)

    with {:ok, nodes_by_identity} <-
           load_endpoints(community, Map.values(endpoints_by_locator)) do
      nodes =
        Enum.map(locators, fn locator ->
          case Map.get(endpoints_by_locator, locator_key(locator)) do
            nil ->
              unavailable_node(locator)

            endpoint ->
              Map.fetch!(nodes_by_identity, endpoint_identity(endpoint))
              |> Map.put(:locator, locator)
          end
        end)

      {:ok, nodes}
    end
  end

  def resolve_locators(_community, _locators) do
    {:error, :invalid_mentions_graph_locator}
  end

  @doc "Loads graph nodes from the resource status boundary."
  def load_endpoints(community, endpoints) when is_list(endpoints) do
    refs =
      Enum.map(endpoints, fn endpoint ->
        %{
          key: endpoint.id,
          type: endpoint.type,
          article_id: endpoint.article_id,
          comment_id: endpoint.comment_id
        }
      end)

    with {:ok, statuses} <- CMS.FrontDesk.artiment_status(community, refs) do
      if Enum.all?(endpoints, &valid_node_metadata?(&1, Map.get(statuses, &1.id))) do
        nodes =
          Enum.map(endpoints, fn endpoint ->
            identity = endpoint_identity(endpoint)
            build_node(community, identity, endpoint, Map.get(statuses, endpoint.id))
          end)

        {:ok, Map.new(nodes, &{&1.identity, &1})}
      else
        {:error, CMS.ErrorCat.mentions_graph_integrity_error()}
      end
    end
  end

  def load_endpoints(_community, _endpoints) do
    {:error, :invalid_mentions_graph_endpoints}
  end

  defp valid_node_metadata?(%Endpoint{type: :comment}, %{
         article_id: article_id,
         comment_inner_id: comment_inner_id,
         thread: thread
       }) do
    is_binary(article_id) and is_integer(comment_inner_id) and
      is_atom(thread) and not is_nil(thread)
  end

  defp valid_node_metadata?(%Endpoint{type: :comment}, _), do: false
  defp valid_node_metadata?(_, _), do: true

  defp unavailable_node(locator) do
    %{
      identity: nil,
      endpoint_id: nil,
      id: nil,
      type: locator.type,
      status: :unavailable,
      title: nil,
      url: nil,
      locator: nil,
      can_open: false
    }
  end

  defp positive_id(value) when is_integer(value) and value > 0, do: value

  defp positive_id(value) when is_binary(value) do
    case Integer.parse(value) do
      {id, ""} when id > 0 -> id
      _ -> nil
    end
  end

  defp positive_id(_), do: nil

  defp locator_key(%{type: type, article_inner_id: article_id} = locator)
       when not is_nil(article_id) do
    type = if is_binary(type), do: String.to_existing_atom(type), else: type
    comment_id = Map.get(locator, :comment_inner_id)

    {type, to_string(article_id), if(is_nil(comment_id), do: nil, else: to_string(comment_id))}
  end

  defp locator_key(%{type: type, article_id: article_id} = locator)
       when is_binary(article_id) do
    type = if is_binary(type), do: String.to_existing_atom(type), else: type
    comment_id = Map.get(locator, :comment_inner_id)
    {type, {:stable, article_id}, if(is_nil(comment_id), do: nil, else: to_string(comment_id))}
  end

  defp locator_key(_), do: nil

  defp endpoints_for_locators(community, locators) do
    inner_ids =
      locators |> Enum.map(&positive_id(Map.get(&1, :article_inner_id))) |> Enum.reject(&is_nil/1)

    stable_ids =
      locators
      |> Enum.map(&Map.get(&1, :article_id))
      |> Enum.filter(&(is_binary(&1) and match?({:ok, _}, Ecto.UUID.cast(&1))))
      |> Enum.uniq()

    comment_inner_ids =
      locators |> Enum.map(&positive_id(Map.get(&1, :comment_inner_id))) |> Enum.reject(&is_nil/1)

    bindings =
      query_all(
        from(binding in ArticleBinding,
          where: binding.community_id == ^community.id and binding.inner_id in ^inner_ids
        )
      )

    article_ids = Enum.map(bindings, & &1.article_id)

    comments =
      if comment_inner_ids == [] do
        []
      else
        query_all(
          from(comment in Comment,
            where:
              comment.article_id in ^(article_ids ++ stable_ids) and
                comment.inner_id in ^comment_inner_ids
          )
        )
      end

    comment_ids = Enum.map(comments, & &1.id)

    endpoints =
      query_all(
        from(endpoint in Endpoint,
          where:
            endpoint.article_id in ^(article_ids ++ stable_ids) or
              endpoint.comment_id in ^comment_ids
        )
      )

    stable_bindings =
      if stable_ids == [] do
        MapSet.new()
      else
        query_all(
          from(binding in ArticleBinding,
            where: binding.community_id == ^community.id and binding.article_id in ^stable_ids,
            select: binding.article_id
          )
        )
        |> MapSet.new()
      end

    stable_endpoint_ids =
      endpoints
      |> Enum.filter(fn endpoint ->
        endpoint.article_id in stable_ids or
          (endpoint.type == :comment and endpoint.comment_id in comment_ids)
      end)
      |> Enum.map(& &1.id)

    stable_mentions =
      if stable_endpoint_ids == [] do
        MapSet.new()
      else
        incoming =
          from(edge in Edge,
            join: source in Endpoint,
            on: source.id == edge.source_endpoint_id,
            left_join: parent in Endpoint,
            on: parent.id == source.parent_endpoint_id,
            join: binding in ArticleBinding,
            on:
              binding.article_id ==
                fragment("COALESCE(?, ?)", source.article_id, parent.article_id) and
                binding.community_id == ^community.id,
            where: edge.target_endpoint_id in ^stable_endpoint_ids,
            select: %{endpoint_id: edge.target_endpoint_id}
          )

        outgoing =
          from(edge in Edge,
            join: target in Endpoint,
            on: target.id == edge.target_endpoint_id,
            left_join: parent in Endpoint,
            on: parent.id == target.parent_endpoint_id,
            join: binding in ArticleBinding,
            on:
              binding.article_id ==
                fragment("COALESCE(?, ?)", target.article_id, parent.article_id) and
                binding.community_id == ^community.id,
            where: edge.source_endpoint_id in ^stable_endpoint_ids,
            select: %{endpoint_id: edge.source_endpoint_id}
          )

        comment_parents_from_targets =
          from(edge in Edge,
            join: target in Endpoint,
            on: target.id == edge.target_endpoint_id and target.type == :comment,
            join: source in Endpoint,
            on: source.id == edge.source_endpoint_id,
            left_join: source_parent in Endpoint,
            on: source_parent.id == source.parent_endpoint_id,
            join: binding in ArticleBinding,
            on:
              binding.article_id ==
                fragment("COALESCE(?, ?)", source.article_id, source_parent.article_id) and
                binding.community_id == ^community.id,
            where: target.parent_endpoint_id in ^stable_endpoint_ids,
            select: %{endpoint_id: target.parent_endpoint_id}
          )

        comment_parents_from_sources =
          from(edge in Edge,
            join: source in Endpoint,
            on: source.id == edge.source_endpoint_id and source.type == :comment,
            join: target in Endpoint,
            on: target.id == edge.target_endpoint_id,
            left_join: target_parent in Endpoint,
            on: target_parent.id == target.parent_endpoint_id,
            join: binding in ArticleBinding,
            on:
              binding.article_id ==
                fragment("COALESCE(?, ?)", target.article_id, target_parent.article_id) and
                binding.community_id == ^community.id,
            where: source.parent_endpoint_id in ^stable_endpoint_ids,
            select: %{endpoint_id: source.parent_endpoint_id}
          )

        query_all(
          from(row in subquery(incoming),
            union: ^outgoing,
            union: ^comment_parents_from_targets,
            union: ^comment_parents_from_sources
          )
        )
        |> Enum.map(& &1.endpoint_id)
        |> MapSet.new()
      end

    binding_by_locator = Map.new(bindings, &{{&1.thread, &1.inner_id}, &1.article_id})
    comments_by_article_and_inner = Map.new(comments, &{{&1.article_id, &1.inner_id}, &1.id})
    endpoints_by_identity = Map.new(endpoints, &{endpoint_identity(&1), &1})

    Enum.reduce(locators, %{}, fn locator, acc ->
      inner_id = positive_id(Map.get(locator, :article_inner_id))

      type =
        if is_binary(locator.type), do: String.to_existing_atom(locator.type), else: locator.type

      identity =
        if type == :comment do
          stable_id = Map.get(locator, :article_id)

          if is_binary(stable_id) do
            case comments_by_article_and_inner[{stable_id, positive_id(locator.comment_inner_id)}] do
              nil ->
                nil

              comment_id ->
                candidate = {:comment, nil, comment_id, nil}
                endpoint = Map.get(endpoints_by_identity, candidate)

                if endpoint &&
                     (MapSet.member?(stable_bindings, stable_id) or
                        MapSet.member?(stable_mentions, endpoint.id)) do
                  candidate
                end
            end
          else
            Enum.find_value(bindings, fn binding ->
              if binding.inner_id == inner_id do
                case comments_by_article_and_inner[
                       {binding.article_id, positive_id(locator.comment_inner_id)}
                     ] do
                  nil -> nil
                  comment_id -> {:comment, nil, comment_id, nil}
                end
              end
            end)
          end
        else
          stable_id = Map.get(locator, :article_id)

          cond do
            is_binary(stable_id) ->
              identity = {type, stable_id, nil, nil}
              endpoint = Map.get(endpoints_by_identity, identity)

              if endpoint &&
                   (MapSet.member?(stable_bindings, stable_id) or
                      MapSet.member?(stable_mentions, endpoint.id)) do
                identity
              end

            true ->
              case binding_by_locator[{type, inner_id}] do
                nil -> nil
                article_id -> {type, article_id, nil, nil}
              end
          end
        end

      case Map.get(endpoints_by_identity, identity) do
        %Endpoint{} = endpoint -> Map.put(acc, locator_key(locator), endpoint)
        nil -> acc
      end
    end)
  end

  defp query_all(query), do: Repo.all(query)

  defp build_node(community, identity, endpoint, metadata) do
    status =
      cond do
        match?(%Endpoint{deleted_at: %DateTime{}}, endpoint) -> :deleted
        is_map(metadata) and metadata.status == :destroy -> :deleted
        is_map(metadata) -> metadata.status
        true -> :unavailable
      end

    locator =
      if metadata && (metadata.article_inner_id || metadata.article_id),
        do: locator(metadata),
        else: nil

    %{
      identity: identity,
      endpoint_id: endpoint_id(endpoint),
      id: node_id(community.id, identity, metadata),
      type: elem(identity, 0),
      status: status,
      title: metadata && metadata.title,
      url: metadata && metadata.url,
      locator: locator,
      can_open: is_map(metadata) and is_binary(metadata.url)
    }
  end

  defp locator(node) do
    if node.article_inner_id do
      %{
        type: node.type,
        article_inner_id: node.article_inner_id,
        comment_inner_id: node.comment_inner_id
      }
    else
      base = %{type: node.type, article_id: Map.get(node, :article_id)}

      if node.type == :comment do
        Map.put(base, :comment_inner_id, node.comment_inner_id)
      else
        base
      end
    end
  end

  defp node_id(community_id, {:comment, _, _, _}, %{
         thread: thread,
         article_inner_id: article_inner_id,
         comment_inner_id: comment_inner_id
       })
       when is_integer(article_inner_id) and is_integer(comment_inner_id) do
    "comment:#{community_id}:#{thread}:#{article_inner_id}:#{comment_inner_id}"
  end

  defp node_id(community_id, {:comment, _, _, _}, %{
         thread: thread,
         article_id: article_id,
         comment_inner_id: comment_inner_id
       })
       when is_binary(article_id) and is_integer(comment_inner_id) do
    "comment:#{community_id}:#{thread}:id:#{article_id}:#{comment_inner_id}"
  end

  defp node_id(community_id, {type, _article_id, _, _}, %{article_inner_id: inner_id})
       when is_integer(inner_id) do
    "article:#{community_id}:#{type}:#{inner_id}"
  end

  defp node_id(community_id, {type, article_id, _, _}, _metadata) do
    "article:#{community_id}:#{type}:id:#{article_id}"
  end

  defp endpoint_id(%Endpoint{id: id}), do: id
  defp endpoint_id(_), do: nil

  defp endpoint_identity(%Endpoint{type: :comment, comment_id: id}) do
    {:comment, nil, id, nil}
  end

  defp endpoint_identity(%Endpoint{type: type, article_id: id}) do
    {type, id, nil, nil}
  end
end
