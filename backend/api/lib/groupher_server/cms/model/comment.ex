defmodule GroupherServer.CMS.Model.Comment do
  @moduledoc """
  Ecto schema for comments across article threads.

  Comment rows carry source-thread foreign keys, author data, floor/reply state,
  and moderation/reaction embeds. Keep public comment identity separate from
  internal database ids when exposing this schema through GraphQL.

  Business position:

      CMS context
        -> Comment schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  alias __MODULE__
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Artiment.Threads
  alias CMS.Model.{Article, CommentLifecycle, CommentUpvote, Community, DocBranch, Embeds}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @type t :: %__MODULE__{}

  # alias Helper.HTML
  @required_fields ~w(body author_id community_id)a
  @optional_fields ~w(body_html reply_to_comment_id root_comment_id replies_count is_folded inner_id floor is_article_author thread is_for_question pending)a
  @updatable_fields ~w(
    body_html
    is_folded
    floor
    is_pinned
    is_for_question
    replies_count
    pending
    inserted_at
    updated_at
    is_article_author
    root_comment_id
  )a

  @max_participator_count 5
  @max_parent_replies_count 3

  @max_latest_emotion_users_count 5

  @delete_hint "this comment is deleted"
  # 举报超过此数评论会被自动折叠
  @report_threshold_for_fold 5

  # 每篇文章最多含有置顶评论的条数
  @pinned_comment_limit 10

  @doc "latest participants stores in article comment_participants field"
  def max_participator_count, do: @max_participator_count
  @doc "latest replies stores in comment replies field, used for frontend display"
  def max_parent_replies_count, do: @max_parent_replies_count

  @doc "操作某 emotion 的最近用户"
  def max_latest_emotion_users_count, do: @max_latest_emotion_users_count

  @doc "Returns the placeholder body shown for deleted comments."
  def delete_hint, do: @delete_hint

  @doc "Returns the report count at which a comment is auto-folded."
  def report_threshold_for_fold, do: @report_threshold_for_fold

  @doc "Returns the maximum number of pinned comments per article."
  def pinned_comment_limit, do: @pinned_comment_limit

  schema "comments" do
    belongs_to(:author, User, foreign_key: :author_id)
    belongs_to(:community, Community)
    has_one(:lifecycle, CommentLifecycle)
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:branch, DocBranch)

    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:body, :string)
    field(:body_html, :string)
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
    field(:viewer_has_reported, :boolean, default: false, virtual: true)
    # Command metadata is attached to mutation responses only.
    field(:command_id, Ecto.UUID, virtual: true)

    belongs_to(:reply_to_comment, Comment, foreign_key: :reply_to_comment_id)
    field(:root_comment_id, :integer, default: nil)

    embeds_many(:replies, Comment, on_replace: :delete)
    field(:replies_count, :integer, default: 0)

    embeds_one(:emotions, Embeds.CommentEmotion, on_replace: :update)
    embeds_one(:meta, Embeds.CommentMeta, on_replace: :update)

    has_many(:upvotes, {"comments_upvotes", CommentUpvote})

    field(:pending, :integer, default: 0)

    timestamps(type: :utc_datetime)
  end

  @doc false
  @spec changeset(t(), map()) :: Ecto.Changeset.t(t())
  def changeset(%Comment{} = comment, attrs) do
    comment
    |> cast(
      attrs,
      [:article_id, :branch_id] ++ @required_fields ++ @optional_fields
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
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
    |> check_constraint(:community_id, name: :comments_community_matches_article)

    # |> validate_length(:body_html, min: 3, max: 2000)
    # |> HTML.safe_string(:body_html)
  end
end
