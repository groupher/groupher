defmodule GroupherServer.CMS.ArtimentMentions do
  @moduledoc """
  Public facade for CMS artiment mention facts.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> ArtimentMentions
        -> Repo / external boundary
  """

  alias __MODULE__.Store
  alias GroupherServer.{CMS, FrontDesk}
  alias CMS.Model.Comment
  alias Helper.T

  @type target_state :: Store.target_state()
  @type sync_output :: Store.sync_output()
  @type sync_result :: Store.sync_result()

  @doc "Runs `sync` through the public `ArtimentMentions` boundary."
  @spec sync(Comment.t() | T.article() | map()) :: sync_result()
  defdelegate sync(artiment), to: Store

  @doc "Runs `purge` through the public `ArtimentMentions` boundary."
  @spec purge(Comment.t() | T.article() | map()) :: T.domain_res(term())
  defdelegate purge(artiment), to: Store

  @doc "Runs `purge_article_comments` through the public `ArtimentMentions` boundary."
  @spec purge_article_comments(T.article() | map()) :: T.domain_res(term())
  defdelegate purge_article_comments(article), to: Store

  @doc "Runs `purge_outgoing` through the public `ArtimentMentions` boundary."
  @spec purge_outgoing(T.article() | map()) :: T.domain_res(term())
  defdelegate purge_outgoing(artiment), to: Store

  @doc "Runs `preserve_incoming_deleted` through the public `ArtimentMentions` boundary."
  @spec preserve_incoming_deleted(T.article() | map()) :: T.domain_res(:pass)
  defdelegate preserve_incoming_deleted(artiment), to: Store

  @doc "Runs `mark_target_state` through the public `ArtimentMentions` boundary."
  @spec mark_target_state(T.article() | map(), target_state()) :: T.domain_res(:pass)
  defdelegate mark_target_state(artiment, state), to: Store

  @doc "Runs `mentions` through the public `ArtimentMentions` boundary."
  @spec mentions(atom(), T.id(), map() | nil) :: T.domain_res(T.paged_data())
  defdelegate mentions(mentioner_type, mentioner_id, filter), to: Store

  @doc "Runs `mentioned_by` through the public `ArtimentMentions` boundary."
  @spec mentioned_by(atom(), T.id(), map() | nil) :: T.domain_res(T.paged_data())
  defdelegate mentioned_by(mentioned_type, mentioned_id, filter), to: Store

  @doc "Resolves one public mention source and returns its outgoing mentions."
  @spec mentions(map(), map() | nil) :: T.domain_res(T.paged_data())
  def mentions(source, filter) when is_map(source) do
    with {:ok, type, id} <- resolve_locator(source, [:article, :comment], :source) do
      Store.mentions(type, id, filter)
    end
  end

  @doc "Resolves one public mention target and returns incoming mentions."
  @spec mentioned_by(map(), map() | nil) :: T.domain_res(T.paged_data())
  def mentioned_by(target, filter) when is_map(target) do
    with {:ok, type, id} <- resolve_locator(target, [:article, :comment, :user_login], :target) do
      Store.mentioned_by(type, id, filter)
    end
  end

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

  defp one_of(input, keys, label) do
    present = Enum.filter(keys, &(not is_nil(Map.get(input, &1))))

    case present do
      [key] -> {:ok, key, Map.get(input, key)}
      [] -> {:error, "missing mention #{label}"}
      _ -> {:error, "ambiguous mention #{label}"}
    end
  end
end
