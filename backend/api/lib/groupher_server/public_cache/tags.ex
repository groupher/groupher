defmodule GroupherServer.PublicCache.Tags do
  @moduledoc """
  Generates the canonical public-cache tag wire protocol.

  This is the Elixir implementation of
  `packages/contracts/public-cache.contract.json`. Community and Phoenix must
  produce byte-for-byte identical tags; arbitrary tags are never accepted from
  a browser or domain caller.

  Business position:

      typed invalidation -> Tags -> validated Cloudflare tag wire protocol
  """

  alias GroupherServer.PublicCache
  alias PublicCache.{Const, DeliveryConfig}

  @tag_pattern ~r/^community\[[A-Za-z0-9][A-Za-z0-9-]*\](?:-[A-Za-z0-9\[\]-]+)?$/

  @doc """
  Builds a community shell tag.

  ## Examples

      PublicCache.Tags.community("acme")
  """
  def community(community), do: "community[#{community}]"

  @doc """
  Builds an article-list tag.

  ## Examples

      PublicCache.Tags.article_list("acme", :post)
  """
  def article_list(community, thread) do
    "#{community(community)}-thread[#{thread_name(thread)}]-articles"
  end

  @doc """
  Builds an article-detail tag.

  ## Examples

      PublicCache.Tags.article_detail("acme", :post, 42)
  """
  def article_detail(community, thread, inner_id) do
    "#{community(community)}-thread[#{thread_name(thread)}]-article[#{inner_id}]"
  end

  @doc """
  Builds an article-comments tag.

  ## Examples

      PublicCache.Tags.comments("acme", :post, 42)
  """
  def comments(community, thread, inner_id) do
    "#{article_detail(community, thread, inner_id)}-comments"
  end

  @doc """
  Builds the family tag shared by all comment pages in a community.

  ## Examples

      PublicCache.Tags.comments_list("acme")
      #=> "community[acme]-comments"
  """
  def comments_list(community), do: "#{community(community)}-comments"

  @doc """
  Builds a thread-tags tag.

  ## Examples

      PublicCache.Tags.tags("acme", :post)
  """
  def tags(community, thread) do
    "#{community(community)}-thread[#{thread_name(thread)}]-tags"
  end

  @doc """
  Builds a documentation-tree tag.

  ## Examples

      PublicCache.Tags.doc_tree("acme")
  """
  def doc_tree(community), do: "#{community(community)}-doc-tree"

  @doc """
  Builds the public Ticket list tag for a Community.

  ## Examples

      PublicCache.Tags.ticket_list("acme")
      #=> "community[acme]-tickets"
  """
  def ticket_list(community), do: "#{community(community)}-tickets"

  @doc """
  Builds the public Ticket detail tag for one Community number.

  ## Examples

      PublicCache.Tags.ticket_detail("acme", 42)
      #=> "community[acme]-ticket[42]"
  """
  def ticket_detail(community, inner_id) do
    "#{community(community)}-ticket[#{inner_id}]"
  end

  @doc """
  Maps one typed invalidation to its semantic public cache tags.

  ## Examples

      PublicCache.Tags.for_invalidation(:community_presentation_changed, %{community: "acme"})
  """
  @spec for_invalidation(atom(), map()) :: {:ok, [String.t()]} | {:error, atom()}
  def for_invalidation(type, payload) do
    with true <- type in Const.invalidation_types(),
         {:ok, community} <- required_text(payload, :community) do
      case type do
        type
        when type in [:article_published, :article_content_changed, :article_visibility_changed] ->
          with {:ok, thread} <- required_value(payload, :thread),
               {:ok, inner_id} <- required_value(payload, :inner_id) do
            validate([
              article_detail(community, thread, inner_id),
              article_list(community, thread)
            ])
          end

        :comments_content_changed ->
          with {:ok, thread} <- required_value(payload, :thread),
               {:ok, inner_id} <- required_value(payload, :inner_id) do
            validate([comments(community, thread, inner_id)])
          end

        :community_presentation_changed ->
          validate([community(community)])

        :pagination_config_changed ->
          with {:ok, surface} <- required_value(payload, :surface) do
            pagination_tags(community, surface)
          end

        :taxonomy_changed ->
          with {:ok, thread} <- required_value(payload, :thread) do
            validate([tags(community, thread), article_list(community, thread)])
          end

        :doc_tree_changed ->
          validate([doc_tree(community), article_list(community, :doc)])
      end
    else
      false -> {:error, :unknown_invalidation_type}
      error -> error
    end
  end

  @doc """
  Validates the wire-level tag contract before an external purge.

  ## Examples

      PublicCache.Tags.validate(["community[acme]"])
  """
  def validate(tags) when is_list(tags) do
    cond do
      tags == [] ->
        {:error, :invalid_cache_tag}

      length(tags) > DeliveryConfig.max_tags_per_request() ->
        {:error, :too_many_cache_tags}

      Enum.all?(
        tags,
        &(is_binary(&1) and byte_size(&1) <= 1_024 and Regex.match?(@tag_pattern, &1))
      ) ->
        {:ok, Enum.uniq(tags)}

      true ->
        {:error, :invalid_cache_tag}
    end
  end

  def validate(_tags), do: {:error, :too_many_cache_tags}

  defp required_text(payload, key) do
    case Map.get(payload, key) || Map.get(payload, Atom.to_string(key)) do
      value when is_binary(value) and value != "" -> {:ok, value}
      _ -> {:error, :invalid_cache_scope}
    end
  end

  defp required_value(payload, key) do
    case Map.get(payload, key) || Map.get(payload, Atom.to_string(key)) do
      nil -> {:error, :invalid_cache_scope}
      value -> {:ok, value}
    end
  end

  defp pagination_tags(community, surface) when surface in [:posts, "posts"] do
    validate([article_list(community, :post)])
  end

  defp pagination_tags(community, surface) when surface in [:changelogs, "changelogs"] do
    validate([article_list(community, :changelog)])
  end

  defp pagination_tags(community, surface) when surface in [:comments, "comments"] do
    validate([comments_list(community)])
  end

  defp pagination_tags(_community, _surface), do: {:error, :invalid_cache_scope}

  defp thread_name(thread) when is_atom(thread), do: thread |> Atom.to_string() |> String.upcase()
  defp thread_name(thread), do: to_string(thread)
end
