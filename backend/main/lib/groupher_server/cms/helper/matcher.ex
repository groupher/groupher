defmodule GroupherServer.CMS.Helper.Matcher do
  @moduledoc """
  this module defined the matches and handy guard ...
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.MatcherMacros

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User

  @type match_info :: %{
          model: module(),
          thread: atom(),
          foreign_key: atom(),
          preload: atom(),
          default_meta: map() | nil
        }

  @spec match(map()) :: {:ok, match_info()}
  def match(%{} = article) do
    {:ok, thread} = thread_of(article)

    match(thread)
  end

  @spec match(:account) :: {:ok, match_info()}
  def match(:account) do
    {:ok,
     %{
       model: User,
       foreign_key: :account_id,
       preload: :account,
       default_meta: Accounts.Model.Embeds.UserMeta.default_meta()
     }}
  end

  @spec match(:comment) :: {:ok, match_info()}
  def match(:comment) do
    {:ok,
     %{
       model: CMS.Model.Comment,
       foreign_key: :comment_id,
       preload: :comment,
       default_meta: CMS.Model.Embeds.CommentMeta.default_meta()
     }}
  end

  @spec match(:community_tag) :: {:ok, match_info()}
  def match(:community_tag) do
    {:ok,
     %{
       model: CMS.Model.CommunityTag,
       foreign_key: :community_tag_id,
       preload: :community_tag
     }}
  end

  defp thread_of(%{thread: thread}) when is_binary(thread) do
    thread |> String.downcase() |> String.to_atom() |> then(&{:ok, &1})
  end

  defp thread_of(%{meta: %{thread: thread}}) do
    thread |> String.downcase() |> String.to_atom() |> then(&{:ok, &1})
  end

  defp thread_of(_), do: {:error, {:custom, "invalid article"}}

  thread_matches()
  thread_query_matches()
end
