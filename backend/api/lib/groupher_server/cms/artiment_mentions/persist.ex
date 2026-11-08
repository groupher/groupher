defmodule GroupherServer.CMS.ArtimentMentions.Persist do
  @moduledoc """
  Stores stable Mention endpoints and the current relationships of each source.

      selected published body -> Mention diff -> current edges
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.ArtimentMentions.MentionsGraph.Revision, as: Revision
  alias CMS.Model.Mentions.{Edge, Endpoint}
  alias CMS.Model.Comment

  @doc false
  defp ensure_endpoint(attrs) when is_map(attrs) do
    with {:ok, identity} <- endpoint_identity(attrs),
         {:ok, :pass} <- validate_parent_endpoint(identity) do
      endpoint_query(identity)
      |> Repo.one()
      |> case do
        %Endpoint{} = endpoint ->
          if endpoint_identity(endpoint) == {:ok, identity},
            do: {:ok, endpoint},
            else: {:error, :mention_endpoint_identity_conflict}

        nil ->
          insert_or_get_endpoint(identity)
      end
    end
  end

  defp ensure_endpoint(_), do: {:error, :invalid_mention_endpoint}

  @doc "Locks or creates the source endpoint in the owning Command transaction."
  def lock_source(identity) when is_map(identity) do
    with true <- Repo.in_transaction?(),
         {:ok, id} <- ensure_source_endpoint(identity),
         %Endpoint{} = source <- Repo.get(Endpoint, id, lock: "FOR UPDATE") do
      {:ok, source}
    else
      false -> {:error, :mention_current_requires_transaction}
      nil -> {:error, :mention_current_source_missing}
      {:error, _reason} = error -> error
    end
  end

  def lock_source(_), do: {:error, :invalid_mention_endpoint}

  @doc "Keeps a hidden source's relationships and invalidates graph cursors."
  def hide_outgoing_mentions(source_identity) when is_map(source_identity) do
    with true <- Repo.in_transaction?(),
         {:ok, identity} <- endpoint_identity(source_identity) do
      case endpoint_query(identity) |> lock("FOR UPDATE") |> Repo.one() do
        %Endpoint{} -> Revision.bump()
        nil -> {:ok, :pass}
      end
    else
      false -> {:error, :mention_current_requires_transaction}
      {:error, _reason} = error -> error
    end
  end

  def hide_outgoing_mentions(_), do: {:error, :invalid_mention_endpoint}

  @doc "Permanently removes an endpoint's incoming, outgoing and child Comment relationships."
  def mark_deleted(source_identity) when is_map(source_identity) do
    with true <- Repo.in_transaction?(),
         {:ok, identity} <- endpoint_identity(source_identity) do
      case endpoint_query(identity) |> lock("FOR UPDATE") |> Repo.one() do
        %Endpoint{} = endpoint ->
          now = DateTime.utc_now() |> DateTime.truncate(:second)

          with {:ok, :pass} <- mark_endpoint_deleted(endpoint, now),
               {:ok, removed} <- remove_adjacent_edges([endpoint.id]),
               {:ok, children} <- remove_comment_child_edges(endpoint) do
            if is_nil(endpoint.deleted_at) or removed + children > 0,
              do: Revision.bump(),
              else: {:ok, :pass}
          end

        nil ->
          {:ok, :pass}
      end
    else
      false -> {:error, :mention_current_requires_transaction}
      {:error, _reason} = error -> error
    end
  end

  def mark_deleted(_), do: {:error, :invalid_mention_endpoint}

  defp mark_endpoint_deleted(%Endpoint{deleted_at: %DateTime{}}, _now), do: {:ok, :pass}

  defp mark_endpoint_deleted(endpoint, now) do
    case endpoint |> Endpoint.changeset(%{deleted_at: now}) |> Repo.update() do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp remove_adjacent_edges(ids) do
    {count, nil} =
      Repo.delete_all(
        from(edge in Edge,
          where: edge.source_endpoint_id in ^ids or edge.target_endpoint_id in ^ids
        )
      )

    {:ok, count}
  end

  defp remove_comment_child_edges(%Endpoint{id: parent_id}) do
    ids =
      from(endpoint in Endpoint,
        where: endpoint.type == :comment and endpoint.parent_endpoint_id == ^parent_id,
        order_by: endpoint.id,
        lock: "FOR UPDATE",
        select: endpoint.id
      )
      |> Repo.all()

    if ids == [], do: {:ok, 0}, else: remove_adjacent_edges(ids)
  end

  @doc "Diffs a selected body's relationships against the current edges under the source lock."
  def update_graph(%Endpoint{id: source_id}, %{mentions: mentions, mentioned_at: mentioned_at})
      when is_list(mentions) and is_struct(mentioned_at, DateTime) do
    with true <- Repo.in_transaction?(),
         %Endpoint{deleted_at: nil} <- Repo.get(Endpoint, source_id, lock: "FOR UPDATE"),
         {:ok, targets} <- target_attrs(mentions, mentioned_at),
         old_edges <-
           Repo.all(from(edge in Edge, where: edge.source_endpoint_id == ^source_id)),
         {:ok, desired} <- grouped_current_edges(source_id, targets, old_edges),
         {:ok, changed?} <- sync_current_edges(old_edges, desired),
         {:ok, :pass} <- maybe_bump_revision(changed?) do
      {:ok,
       %{
         source_endpoint_id: source_id,
         selection_changed: changed?,
         edge_count: length(desired),
         mentions: targets
       }}
    else
      false -> {:error, :mention_current_requires_transaction}
      nil -> {:error, :mention_current_source_missing}
      %Endpoint{} -> {:error, :mention_current_source_deleted}
      {:error, _reason} = error -> error
    end
  end

  def update_graph(_, _), do: {:error, :invalid_mention_capture}

  defp target_attrs(mentions, mentioned_at) do
    Enum.reduce_while(mentions, {:ok, []}, fn mention, {:ok, acc} ->
      case mention_target_attrs(mention, mentioned_at) do
        {:ok, attrs} -> {:cont, {:ok, [attrs | acc]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, attrs} -> {:ok, Enum.reverse(attrs)}
      {:error, _reason} = error -> error
    end
  end

  defp grouped_current_edges(source_id, targets, old_edges) do
    previous = Map.new(old_edges, &{&1.edge_key, &1})

    edges =
      targets
      |> Enum.group_by(&edge_identity/1)
      |> Enum.map(fn {identity, matches} ->
        first = hd(matches)
        key = edge_key(source_id, identity)
        old = Map.get(previous, key)

        %{
          source_endpoint_id: source_id,
          target_type: first.target_type,
          target_endpoint_id: Map.get(first, :target_endpoint_id),
          target_user_id: Map.get(first, :target_user_id),
          normalized_url: if(first.target_type == :url, do: Map.get(first, :normalized_url)),
          url_hash: if(first.target_type == :url, do: Map.get(first, :url_hash)),
          mention_case: first.mention_case,
          edge_key: key,
          mentioned_at: if(old, do: old.mentioned_at, else: first.mentioned_at),
          occurrences_count: length(matches)
        }
      end)
      |> Enum.sort_by(& &1.edge_key)

    {:ok, edges}
  end

  defp edge_identity(target) do
    {target.mention_case, target.target_type, Map.get(target, :target_endpoint_id),
     Map.get(target, :target_user_id),
     if(target.target_type == :url, do: Map.get(target, :normalized_url))}
  end

  defp edge_key(source_id, identity) do
    :crypto.hash(:sha256, :erlang.term_to_binary({source_id, identity}))
    |> Base.encode16(case: :lower)
  end

  defp sync_current_edges(old_edges, desired) do
    old_by_key = Map.new(old_edges, &{&1.edge_key, &1})
    desired_by_key = Map.new(desired, &{&1.edge_key, &1})

    removed_ids =
      old_edges |> Enum.reject(&Map.has_key?(desired_by_key, &1.edge_key)) |> Enum.map(& &1.id)

    {removed_count, nil} =
      Repo.delete_all(from(edge in Edge, where: edge.id in ^removed_ids))

    Enum.reduce_while(desired, {:ok, removed_count > 0}, fn attrs, {:ok, changed?} ->
      case Map.get(old_by_key, attrs.edge_key) do
        nil ->
          case Repo.insert(Edge.changeset(%Edge{}, attrs)) do
            {:ok, _} -> {:cont, {:ok, true}}
            {:error, _reason} = error -> {:halt, error}
          end

        %Edge{} = old ->
          if old.occurrences_count == attrs.occurrences_count do
            {:cont, {:ok, changed?}}
          else
            case old |> Edge.changeset(attrs) |> Repo.update() do
              {:ok, _} -> {:cont, {:ok, true}}
              {:error, _reason} = error -> {:halt, error}
            end
          end
      end
    end)
  end

  defp maybe_bump_revision(true), do: Revision.bump()
  defp maybe_bump_revision(false), do: {:ok, :pass}

  defp ensure_source_endpoint(%{type: :comment, parent: parent} = identity) do
    with {:ok, parent_endpoint} <- ensure_endpoint(parent),
         {:ok, endpoint} <-
           ensure_endpoint(
             identity
             |> Map.delete(:parent)
             |> Map.put(:parent_endpoint_id, parent_endpoint.id)
           ) do
      {:ok, endpoint.id}
    end
  end

  defp ensure_source_endpoint(identity) do
    with {:ok, endpoint} <- ensure_endpoint(identity), do: {:ok, endpoint.id}
  end

  defp mention_target_attrs(
         %{mentioned_scope: :external, mentioned_type: :url} = mention,
         mentioned_at
       ) do
    url = Map.get(mention, :mentioned_url)
    hash = Map.get(mention, :mentioned_url_hash)

    if is_binary(url) and is_binary(hash) do
      {:ok,
       base_mention(mention, mentioned_at)
       |> Map.merge(%{
         target_type: :url,
         normalized_url: url,
         url_hash: hash
       })}
    else
      {:error, :invalid_mention_url_target}
    end
  end

  defp mention_target_attrs(
         %{mentioned_scope: :internal, mentioned_type: :user} = mention,
         mentioned_at
       ) do
    case Map.get(mention, :mentioned_id) do
      id when is_integer(id) ->
        {:ok,
         Map.merge(base_mention(mention, mentioned_at), %{
           target_type: :user,
           target_user_id: id
         })}

      _ ->
        {:error, :invalid_mention_user_target}
    end
  end

  defp mention_target_attrs(
         %{mentioned_scope: :internal, mentioned_type: type} = mention,
         mentioned_at
       )
       when type in [:post, :blog, :changelog, :doc, :ticket, :comment] and
              not is_map_key(mention, :trusted_target_endpoint_id) do
    with {:ok, endpoint} <- target_endpoint(mention, type) do
      {:ok,
       Map.merge(base_mention(mention, mentioned_at), %{
         target_type: type,
         target_endpoint_id: endpoint.id,
         normalized_url: inherited_url(mention)
       })}
    end
  end

  defp mention_target_attrs(
         %{
           mentioned_scope: :internal,
           mentioned_type: type,
           trusted_target_endpoint_id: endpoint_id
         } = mention,
         mentioned_at
       )
       when type in [:post, :blog, :changelog, :doc, :ticket, :comment] and
              is_binary(endpoint_id) do
    case Repo.get_by(Endpoint, id: endpoint_id, type: type) do
      %Endpoint{} ->
        {:ok,
         Map.merge(base_mention(mention, mentioned_at), %{
           target_type: type,
           target_endpoint_id: endpoint_id,
           normalized_url: inherited_url(mention)
         })}

      nil ->
        {:error, :invalid_inherited_mention_target}
    end
  end

  defp mention_target_attrs(_, _), do: {:error, :invalid_mention_target}

  defp inherited_url(mention) do
    case get_in(mention, [:occurrence, :raw_url]) do
      raw_url when is_binary(raw_url) -> normalize_mention_url(raw_url)
      _ -> nil
    end
  end

  defp normalize_mention_url(url) when is_binary(url) do
    uri = URI.parse(String.trim(url))
    scheme = if is_binary(uri.scheme), do: String.downcase(uri.scheme), else: nil
    host = if is_binary(uri.host), do: String.downcase(uri.host), else: nil

    port =
      case {scheme, uri.port} do
        {"http", 80} -> nil
        {"https", 443} -> nil
        {_, value} -> value
      end

    uri
    |> Map.put(:scheme, scheme)
    |> Map.put(:host, host)
    |> Map.put(:port, port)
    |> URI.to_string()
  end

  defp target_endpoint(%{artiment: %{article_id: article_id}}, type)
       when type in [:post, :blog, :changelog, :doc, :ticket] and is_binary(article_id) do
    ensure_endpoint(%{
      type: type,
      article_id: article_id
    })
  end

  defp target_endpoint(%{artiment: %Comment{} = comment, parent_article: parent}, :comment)
       when is_map(parent) do
    parent_identity = %{
      type: Map.get(parent, :thread),
      article_id: Map.get(parent, :article_id)
    }

    with {:ok, parent_endpoint} <- ensure_endpoint(parent_identity) do
      ensure_endpoint(%{
        type: :comment,
        comment_id: comment.id,
        parent_endpoint_id: parent_endpoint.id
      })
    end
  end

  defp target_endpoint(_, _), do: {:error, :invalid_mention_target_identity}

  defp base_mention(mention, mentioned_at) do
    %{
      mention_case: Map.get(mention, :mention_case),
      mentioned_at: mentioned_at
    }
  end

  defp endpoint_identity(%{type: type, article_id: article_id} = attrs)
       when type in [:post, :blog, :changelog, :doc, :ticket] and is_binary(article_id) do
    if Map.get(attrs, :branch_id) || Map.get(attrs, :comment_id) ||
         Map.get(attrs, :parent_endpoint_id) do
      {:error, :invalid_mention_endpoint}
    else
      {:ok, %{type: type, article_id: article_id, comment_id: nil}}
    end
  end

  defp endpoint_identity(
         %{type: :comment, comment_id: comment_id, parent_endpoint_id: parent_id} = attrs
       )
       when is_integer(comment_id) and is_binary(parent_id) do
    if Map.get(attrs, :article_id) || Map.get(attrs, :branch_id) do
      {:error, :invalid_mention_endpoint}
    else
      {:ok, Map.take(attrs, [:type, :comment_id, :parent_endpoint_id])}
    end
  end

  defp endpoint_identity(_), do: {:error, :invalid_mention_endpoint}

  defp validate_parent_endpoint(%{type: :comment} = identity) do
    case Repo.get(CMS.Model.Mentions.Endpoint, identity.parent_endpoint_id) do
      %CMS.Model.Mentions.Endpoint{type: type}
      when type in [:post, :blog, :changelog, :doc] ->
        {:ok, :pass}

      _ ->
        {:error, :mention_parent_endpoint_not_found}
    end
  end

  defp validate_parent_endpoint(_identity), do: {:ok, :pass}

  defp endpoint_query(%{type: :comment, comment_id: comment_id}) do
    from(endpoint in CMS.Model.Mentions.Endpoint,
      where: endpoint.type == :comment and endpoint.comment_id == ^comment_id
    )
  end

  defp endpoint_query(%{type: type, article_id: article_id}) do
    from(endpoint in CMS.Model.Mentions.Endpoint,
      where: endpoint.type == ^type and endpoint.article_id == ^article_id
    )
  end

  defp insert_or_get_endpoint(identity) do
    case Repo.insert(
           CMS.Model.Mentions.Endpoint.changeset(
             %CMS.Model.Mentions.Endpoint{},
             identity
           )
         ) do
      {:ok, endpoint} ->
        {:ok, endpoint}

      {:error, changeset} ->
        case endpoint_query(identity) |> lock("FOR UPDATE") |> Repo.one() do
          %CMS.Model.Mentions.Endpoint{} = endpoint ->
            if endpoint_identity(endpoint) == {:ok, identity} do
              {:ok, endpoint}
            else
              {:error, :mention_endpoint_identity_conflict}
            end

          nil ->
            {:error, changeset}
        end
    end
  end
end
