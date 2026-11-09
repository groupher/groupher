defmodule GroupherServer.CMS.Model.Comment do
  @moduledoc """
  Ecto schema for comments across article threads.

  Comment rows carry source-thread foreign keys, author data, floor/reply state,
  and reaction embeds. Keep public comment identity separate from
  internal database ids when exposing this schema through GraphQL.

  Business position:

      CMS context
        -> Comment schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Flop.Schema
  use Accessible

  import Ecto.Changeset
  alias __MODULE__
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Artiment.Threads

  alias CMS.Model.{
    Article,
    CommentBody,
    CommentLifecycle,
    CommentUpvote,
    Embeds
  }

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @type t :: %__MODULE__{}

  # alias Helper.HTML
  @required_fields ~w(author_id)a
  @optional_fields ~w(reply_to_comment_id root_comment_id is_folded inner_id floor is_article_author thread is_for_question)a
  @updatable_fields ~w(
    is_folded
    floor
    is_pinned
    is_for_question
    inserted_at
    updated_at
    is_article_author
    root_comment_id
  )a

  @reply_preview_limit 3

  @max_latest_emotion_users_count 5

  @flop_options [
    filterable: [],
    sortable: [:inserted_at, :id],
    pagination_types: [:page, :first]
  ]

  @delete_hint "this comment is deleted"
  # 举报超过此数评论会被自动折叠

  # 每篇文章最多含有置顶评论的条数
  @pinned_comment_limit 10

  @doc "Returns the bounded initial reply preview size; full replies are paginated."
  def reply_preview_limit, do: @reply_preview_limit

  @doc "操作某 emotion 的最近用户"
  def max_latest_emotion_users_count, do: @max_latest_emotion_users_count

  @doc "Returns the placeholder body shown for deleted comments."
  def delete_hint, do: @delete_hint

  @doc "Returns the maximum number of pinned comments per article."
  def pinned_comment_limit, do: @pinned_comment_limit

  schema "comments" do
    belongs_to(:author, User, foreign_key: :author_id)
    has_one(:lifecycle, CommentLifecycle)
    belongs_to(:article, Article, type: Ecto.UUID)

    field(:thread, Ecto.Enum, values: Threads.article_enums())
    has_one(:body, CommentBody)
    # 是否被折叠
    field(:is_folded, :boolean, default: false)
    # Public comment locator within its article.
    field(:inner_id, :id)
    # 楼层
    field(:floor, :integer, default: 0)

    field(:is_for_question, :boolean, default: false)
    field(:is_solution, :boolean, default: false, virtual: true)

    # 是否是评论文章的作者
    field(:is_article_author, :boolean, default: false)
    # Projection-backed response field; no column is persisted on comments.
    field(:upvotes_count, :integer, default: 0, virtual: true)
    # 是否置顶
    field(:is_pinned, :boolean, default: false)
    field(:viewer_has_upvoted, :boolean, default: false, virtual: true)
    # Command metadata is attached to mutation responses only.
    field(:command_id, Ecto.UUID, virtual: true)
    field(:request_community_slug, :string, virtual: true)

    belongs_to(:reply_to_comment, Comment, foreign_key: :reply_to_comment_id)
    field(:root_comment_id, :integer, default: nil)

    field(:replies, {:array, :map}, default: [], virtual: true)
    field(:replies_count, :integer, default: 0)
    field(:reply_entries_count, :integer, default: 0)
    embeds_many(:reply_participants, Embeds.User, on_replace: :delete)
    field(:last_reply_at, :utc_datetime)
    field(:replies_revision, :integer, default: 1)

    embeds_one(:emotions, Embeds.CommentEmotion, on_replace: :update)
    embeds_one(:meta, Embeds.CommentMeta, on_replace: :update)

    has_many(:upvotes, {"comments_upvotes", CommentUpvote})

    timestamps(type: :utc_datetime)
  end

  @doc false
  @spec changeset(t(), map()) :: Ecto.Changeset.t(t())
  def changeset(%Comment{} = comment, attrs) do
    comment
    |> cast(
      attrs,
      [:article_id] ++ @required_fields ++ @optional_fields
    )
    |> cast_embed(:emotions, required: true, with: &Embeds.CommentEmotion.changeset/2)
    |> cast_embed(:meta, required: true, with: &Embeds.CommentMeta.changeset/2)
    |> validate_required(@required_fields)
    |> geneal_changeset
  end

  # @doc false
  def update_changeset(%Comment{} = comment, attrs) do
    comment
    |> cast(attrs, @required_fields ++ @updatable_fields)
    |> cast_embed(:meta, required: true, with: &Embeds.CommentMeta.changeset/2)
    |> geneal_changeset
  end

  defp geneal_changeset(content) do
    content
    |> foreign_key_constraint(:author_id)
    |> foreign_key_constraint(:article_id)
  end
end
