defmodule GroupherServer.CMS.Artiment.Matcher do
  @moduledoc """
  Resolves an artiment kind to its schema, association key, preload, and default
  viewer metadata.

  Callers use this registry to handle accounts, comments, tags, and thread
  articles uniformly without scattering model-selection conditionals across
  queries and mutations.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Matcher
        -> Repo / domain event
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.MatcherMacros

  alias GroupherServer.CMS

  alias Accounts.Model.User
  alias CMS.Interactions.ErrorCat

  alias CMS.Model.{
    Blog,
    BlogEmotionInfo,
    BlogReactionInfo,
    Changelog,
    ChangelogEmotionInfo,
    ChangelogReactionInfo,
    Comment,
    CommentEmotionInfo,
    CommentReactionInfo,
    Doc,
    DocEmotionInfo,
    DocReactionInfo,
    Post,
    PostEmotionInfo,
    PostReactionInfo
  }

  @type match_info :: %{
          model: module(),
          thread: atom(),
          foreign_key: atom(),
          preload: atom(),
          default_meta: map() | nil
        }

  @type interaction_info :: %{
          artiment: :post | :blog | :changelog | :doc | :comment,
          model: module(),
          foreign_key: atom(),
          reaction_info_model: module(),
          emotion_info_model: module(),
          collection?: boolean()
        }

  @spec match(map()) :: {:ok, match_info()} | {:error, GroupherServer.ErrorCat.custom(String.t())}
  @doc "Resolves matcher metadata from an artiment or metadata map."
  def match(%{thread: thread}) when is_atom(thread) do
    match(thread)
  end

  def match(%{meta: %{thread: thread}}) when is_atom(thread) do
    match(thread)
  end

  def match(%{}), do: {:error, GroupherServer.ErrorCat.custom("invalid article")}

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

  @doc "Resolves the complete Interaction metadata for an Artiment kind, schema, or struct."
  @spec match_interaction(atom() | struct()) ::
          {:ok, interaction_info()} | {:error, GroupherServer.ErrorCat.Error.t()}
  def match_interaction(%Post{}), do: match_interaction(:post)
  def match_interaction(Post), do: match_interaction(:post)

  def match_interaction(%Blog{}), do: match_interaction(:blog)
  def match_interaction(Blog), do: match_interaction(:blog)

  def match_interaction(%Changelog{}), do: match_interaction(:changelog)
  def match_interaction(Changelog), do: match_interaction(:changelog)

  def match_interaction(%Doc{}), do: match_interaction(:doc)
  def match_interaction(Doc), do: match_interaction(:doc)

  def match_interaction(%Comment{}), do: match_interaction(:comment)
  def match_interaction(Comment), do: match_interaction(:comment)

  def match_interaction(:post) do
    interaction_info(:post, Post, PostReactionInfo, PostEmotionInfo, true)
  end

  def match_interaction(:blog) do
    interaction_info(:blog, Blog, BlogReactionInfo, BlogEmotionInfo, true)
  end

  def match_interaction(:changelog) do
    interaction_info(
      :changelog,
      Changelog,
      ChangelogReactionInfo,
      ChangelogEmotionInfo,
      true
    )
  end

  def match_interaction(:doc) do
    interaction_info(:doc, Doc, DocReactionInfo, DocEmotionInfo, true)
  end

  def match_interaction(:comment) do
    interaction_info(:comment, Comment, CommentReactionInfo, CommentEmotionInfo, false)
  end

  def match_interaction(_artiment), do: {:error, ErrorCat.unsupported_artiment()}

  thread_matches()
  thread_query_matches()

  defp interaction_info(artiment, model, reaction_info_model, emotion_info_model, collection?) do
    {:ok,
     %{
       artiment: artiment,
       model: model,
       foreign_key: :"#{artiment}_id",
       reaction_info_model: reaction_info_model,
       emotion_info_model: emotion_info_model,
       collection?: collection?
     }}
  end
end
