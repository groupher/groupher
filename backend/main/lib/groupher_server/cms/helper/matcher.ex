defmodule GroupherServer.CMS.Helper.Matcher do
  @moduledoc """
  this module defined the matches and handy guard ...
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.MatcherMacros

  import Helper.Utils, only: [thread_of: 1]

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.Comment

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
       model: Comment,
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
