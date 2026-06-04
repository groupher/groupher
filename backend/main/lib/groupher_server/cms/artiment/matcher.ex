defmodule GroupherServer.CMS.Artiment.Matcher do
  @moduledoc """
  this module defined the matches and handy guard ...
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.MatcherMacros

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User

  @type match_info :: %{
          model: module(),
          thread: atom(),
          foreign_key: atom(),
          preload: atom(),
          default_meta: map() | nil
        }

  @spec match(map()) :: {:ok, match_info()} | {:error, {:custom, String.t()}}
  def match(%{thread: thread}) when is_atom(thread) do
    match(thread)
  end

  def match(%{meta: %{thread: thread}}) when is_atom(thread) do
    match(thread)
  end

  def match(%{}), do: {:error, {:custom, "invalid article"}}

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

  thread_matches()
  thread_query_matches()
end
