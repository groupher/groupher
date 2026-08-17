defmodule GroupherServer.CMS.Interactions.Registry do
  @moduledoc """
  Canonical metadata for interaction targets and authoritative fact tables.

  Target metadata describes per-thread projections and lifecycle ownership.
  Fact metadata describes the shared polymorphic interaction tables. Keeping
  these dimensions separate prevents State and Audit from inventing different
  thread-to-column mappings.

      Interaction target/fact
        -> Registry
        -> State / Audit / Gate metadata consumers
  """

  alias GroupherServer.CMS.Model.{
    ArticleCollect,
    ArticleUpvote,
    ArticleUserEmotion,
    BlogEmotionInfo,
    BlogReactionInfo,
    ChangelogEmotionInfo,
    ChangelogReactionInfo,
    CommentUpvote,
    CommentUserEmotion,
    CommentEmotionInfo,
    CommentReactionInfo,
    DocEmotionInfo,
    DocReactionInfo,
    PostEmotionInfo,
    PostReactionInfo,
    Blog,
    Changelog,
    Doc,
    Post
  }

  @targets %{
    post: %{
      article_schema: Post,
      collection?: true,
      emotion: PostEmotionInfo,
      reaction: PostReactionInfo,
      target_id: :post_id,
      lifecycle: :article
    },
    blog: %{
      article_schema: Blog,
      collection?: true,
      emotion: BlogEmotionInfo,
      reaction: BlogReactionInfo,
      target_id: :blog_id,
      lifecycle: :article
    },
    changelog: %{
      article_schema: Changelog,
      collection?: true,
      emotion: ChangelogEmotionInfo,
      reaction: ChangelogReactionInfo,
      target_id: :changelog_id,
      lifecycle: :article
    },
    doc: %{
      article_schema: Doc,
      collection?: true,
      emotion: DocEmotionInfo,
      reaction: DocReactionInfo,
      target_id: :doc_id,
      lifecycle: :doc
    },
    comment: %{
      collection?: false,
      emotion: CommentEmotionInfo,
      reaction: CommentReactionInfo,
      target_id: :comment_id,
      lifecycle: :comment
    }
  }

  @facts %{
    upvote: %{
      schema: ArticleUpvote,
      table: "article_upvotes",
      unique_by: [:user_id, :target_id],
      index_prefix: "article_upvotes"
    },
    collect: %{
      schema: ArticleCollect,
      table: "article_collects",
      unique_by: [:user_id, :target_id],
      index_prefix: "article_collects"
    },
    emotion: %{
      schema: ArticleUserEmotion,
      table: "articles_users_emotions",
      unique_by: [:user_id, :target_id, :emotion],
      index_prefix: "article_user_emotions"
    },
    comment_upvote: %{
      schema: CommentUpvote,
      table: "comments_upvotes",
      unique_by: [:user_id, :target_id],
      index_prefix: "comments_upvotes"
    },
    comment_emotion: %{
      schema: CommentUserEmotion,
      table: "comments_users_emotions",
      unique_by: [:target_id, :user_id, :emotion],
      index_prefix: "comments_users_emotions"
    }
  }

  @spec target(atom()) :: map()
  def target(thread), do: Map.fetch!(@targets, thread)

  @spec targets() :: map()
  def targets, do: @targets

  @spec article_schema(atom()) :: module()
  def article_schema(thread), do: @targets |> Map.fetch!(thread) |> Map.fetch!(:article_schema)

  @spec thread_for(module()) :: {:ok, atom()} | :error
  def thread_for(schema) do
    case Enum.find(@targets, fn {_thread, info} -> Map.get(info, :article_schema) == schema end) do
      {thread, _info} -> {:ok, thread}
      nil -> :error
    end
  end

  @spec article_table(atom()) :: String.t()
  def article_table(thread), do: article_schema(thread).__schema__(:source)

  @spec fact(atom()) :: map()
  def fact(interaction), do: Map.fetch!(@facts, interaction)

  @spec facts() :: map()
  def facts, do: @facts

  @doc "Decodes a persisted emotion only when it belongs to the bounded vocabulary."
  @spec decode_emotion(String.t(), :article | :comment) ::
          {:ok, atom()} | {:error, :unknown_emotion}
  def decode_emotion(value, kind) when is_binary(value) do
    vocabulary =
      case kind do
        :article -> GroupherServer.CMS.Artiment.Config.emotions()
        :comment -> GroupherServer.CMS.Artiment.Config.comment_emotions()
      end

    case Enum.find(vocabulary, &(Atom.to_string(&1) == value)) do
      emotion when is_atom(emotion) and not is_nil(emotion) -> {:ok, emotion}
      nil -> {:error, :unknown_emotion}
    end
  end

  def decode_emotion(_value, _kind), do: {:error, :unknown_emotion}

  @doc "Returns the fixed SQL identifier for a target's physical FK column."
  @spec target_column(atom()) :: String.t()
  def target_column(thread),
    do: @targets |> Map.fetch!(thread) |> Map.fetch!(:target_id) |> Atom.to_string()

  @doc "Expands interaction uniqueness into the real per-target FK columns."
  @spec unique_columns(atom(), atom()) :: [atom()]
  def unique_columns(interaction, thread) do
    target_id = Map.fetch!(target(thread), :target_id)

    fact(interaction).unique_by
    |> Enum.map(fn
      :target_id -> target_id
      column -> column
    end)
  end

  @doc "Returns the migration/index identifier generated from canonical metadata."
  @spec unique_index_name(atom(), atom()) :: String.t()
  def unique_index_name(interaction, thread) do
    columns = unique_columns(interaction, thread) |> Enum.map_join("_", &Atom.to_string/1)
    "#{fact(interaction).index_prefix}_#{columns}_index"
  end
end
