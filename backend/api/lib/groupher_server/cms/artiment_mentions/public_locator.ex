defmodule GroupherServer.CMS.ArtimentMentions.PublicLocator do
  @moduledoc """
  Resolves public Mention roots through their typed reader boundaries.

      GraphQL locator -> Community/path validation -> stable source identity
  """

  alias GroupherServer.{CMS, FrontDesk}
  alias CMS.ArtimentMentions.{PublicList, Store}

  def mentions(source, pagi) when is_map(source) do
    with {:ok, type, id} <- resolve_locator(source, [:article, :comment], :source) do
      Store.mentions(type, id, pagi)
    end
  end

  def mentioned_by(target, pagi) when is_map(target) do
    with {:ok, type, id} <- resolve_locator(target, [:article, :comment, :user_login], :target) do
      Store.mentioned_by(type, id, pagi)
    end
  end

  def public_mentions(community, source, pagi) when is_binary(community) and is_map(source) do
    with {:ok, type, id} <-
           resolve_public_locator(source, [:article, :comment, :ticket], :source, community) do
      PublicList.list(:outgoing, type, id, community, pagi)
    end
  end

  def public_mentioned_by(community, target, pagi)
      when is_binary(community) and is_map(target) do
    with {:ok, type, id} <-
           resolve_public_locator(target, [:article, :comment, :ticket, :user_login],
                                  :target, community) do
      PublicList.list(:incoming, type, id, community, pagi)
    end
  end

  defp resolve_public_locator(input, keys, label, community) do
    with {:ok, key, value} <- one_of(input, keys, label),
         {:ok, :pass} <- matching_community(key, value, community) do
      resolve_value(key, value)
    end
  end

  defp matching_community(:user_login, _value, _community), do: {:ok, :pass}
  defp matching_community(:comment, %{article: %{community: community}}, community),
    do: {:ok, :pass}
  defp matching_community(_type, %{community: community}, community), do: {:ok, :pass}
  defp matching_community(_, _, _),
    do: {:error, CMS.ErrorCat.reference_map_not_found()}

  defp resolve_locator(input, keys, label) do
    with {:ok, key, value} <- one_of(input, keys, label) do
      resolve_value(key, value)
    end
  end

  defp resolve_value(:article, path) do
    with {:ok, article} <- FrontDesk.article(path) do
      {:ok, article.thread, article.id}
    end
  end

  defp resolve_value(:comment, path) do
    with {:ok, comment} <- FrontDesk.comment(path) do
      {:ok, :comment, comment.id}
    end
  end

  defp resolve_value(:user_login, login) do
    with {:ok, user} <- FrontDesk.user(login) do
      {:ok, :user, user.id}
    end
  end

  defp resolve_value(:ticket, %{community: community_slug, inner_id: raw}) do
    with {:ok, inner_id} <- public_inner_id(raw),
         {:ok, community} <- FrontDesk.community(community_slug),
         {:ok, ticket} <- CMS.Tickets.get_public(community, inner_id) do
      {:ok, :ticket, ticket.article.id}
    end
  end

  defp public_inner_id(value)
       when is_integer(value) and value > 0 and value <= 9_223_372_036_854_775_807,
       do: {:ok, value}

  defp public_inner_id(value) when is_binary(value) do
    if Regex.match?(~r/\A[1-9][0-9]*\z/, value) do
      case Integer.parse(value) do
        {id, ""} when id <= 9_223_372_036_854_775_807 -> {:ok, id}
        _ -> {:error, "invalid Ticket innerId"}
      end
    else
      {:error, "invalid Ticket innerId"}
    end
  end

  defp public_inner_id(_), do: {:error, "invalid Ticket innerId"}

  defp one_of(input, keys, label) do
    present = Enum.filter(keys, &(not is_nil(Map.get(input, &1))))

    case present do
      [key] -> {:ok, key, Map.get(input, key)}
      [] -> {:error, "missing mention #{label}"}
      _ -> {:error, "ambiguous mention #{label}"}
    end
  end
end
