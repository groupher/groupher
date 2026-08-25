defmodule GroupherServer.CMS.Helper.Macros do
  require GroupherServer.CMS.Const
  @moduledoc """
  Defines shared artiment schema fields and CMS changeset validation macros.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Macros
        -> Repo / external boundary
  """
  import Ecto.Changeset, only: [add_error: 3, get_field: 2, prepare_changes: 2]

  alias GroupherServer.CMS

  alias GroupherServer.CMS.Model.{
    ArticleCollect,
    ArticleLifecycle,
    ArticleUpvote,
    Author,
    Comment,
    Community,
    CommunityJoinTag,
    CommunityTag,
    CoverEditInfo,
    DocBranch,
    DocLifecycle,
    Embeds
  }

  @threads GroupherServer.CMS.Artiment.Config.threads()

  @doc """
  generate base schema type with shared fields for artiments
  """
  defmacro schema_artiment_type(extra_fields \\ []) do
    fields =
      [
        author_id: quote(do: integer() | nil),
        thread: quote(do: String.t() | nil),
        body: quote(do: String.t() | nil),
        body_html: quote(do: String.t() | nil),
        is_pinned: quote(do: boolean()),
        pending: quote(do: integer())
      ] ++ extra_fields

    quote do
      @type t_artiment :: %__MODULE__{
              unquote_splicing(fields),
              id: integer() | nil,
              inserted_at: DateTime.t() | nil,
              updated_at: DateTime.t() | nil
            }

      @type t :: t_artiment()
    end
  end

  @doc """
  generate base schema type with shared fields
  """
  defmacro schema_base_type(extra_fields \\ []) do
    fields =
      for {key, type_ast} <- extra_fields do
        {key, type_ast}
      end

    quote do
      @type t :: %__MODULE__{
              unquote_splicing(fields),
              id: integer() | nil,
              inserted_at: DateTime.t() | nil,
              updated_at: DateTime.t() | nil
            }
    end
  end

  @doc """
  generate belongs to fields for given thread

  e.g:
  belongs_to(:post, Post, foreign_key: :post_id)

  MIGRATION:
  should do migration to DB manually:
  数据库层面的 migration 需要手动添加，参考：

  add(:post_id, references(:cms_posts, on_delete: :delete_all))
  add(:xxx_id, references(:cms_xxxs, on_delete: :delete_all))
  ...
  """
  defmacro article_belongs_to_fields do
    @threads
    |> Enum.map(fn thread ->
      quote do
        belongs_to(
          unquote(thread),
          Module.concat(CMS.Model, Recase.to_pascal(to_string(unquote(thread)))),
          foreign_key: unquote(:"#{thread}_id")
        )
      end
    end)
  end

  @doc """
  for GroupherServer.CMS.[Article]
  comments related fields

  MIGRATION:
  should do migration to DB manually:
  数据库层面的 migration 需要手动添加，参考：

  TABLE: "comments"
  -----
  add(:[article]_id, references(:cms_[article]s, on_delete: :delete_all))

  TABLE: "cms_[article]s"
  -----
  add(:comments_participants_count, :integer, default: 0)
  add(:comments_count, :integer, default: 0)
  add(:comments_participants, :map)
  """
  defmacro comment_fields do
    quote do
      field(:comments_participants_count, :integer, default: 0)
      field(:comments_count, :integer, default: 0)
      has_many(:comments, {"comments", Comment})
      # 评论参与者，只保留最近 5 个
      embeds_many(:comments_participants, Embeds.User, on_replace: :delete)
    end
  end

  @doc """
  for GroupherServer.CMS.[Article]
  viewer has xxx fields for each article

  those fields is virtual, do not need DB migration
  """
  defmacro viewer_has_fields do
    quote do
      field(:viewer_has_viewed, :boolean, default: false, virtual: true)
      field(:viewer_has_upvoted, :boolean, default: false, virtual: true)
      field(:viewer_has_collected, :boolean, default: false, virtual: true)
      field(:viewer_has_reported, :boolean, default: false, virtual: true)
    end
  end

  @doc """
  for GroupherServer.CMS.[Article]
  article's upvote and collect feature

  MIGRATION:
  should do migration to DB manually:
  数据库层面的 migration 需要手动添加，参考：

  TABLE: "cms_[article]s"
  -----
  ## TABLE: "article_upvotes" and TABLE: "article_collects"
  -----
  add(:[article]_id, references(:cms_[article]s, on_delete: :delete_all))
  """
  defmacro upvote_and_collect_fields do
    quote do
      has_many(:upvotes, {"article_upvotes", ArticleUpvote})
      has_many(:collects, {"article_collects", ArticleCollect})

      # Projection-backed response fields; no columns are persisted on the article table.
      field(:upvotes_count, :integer, default: 0, virtual: true)
      field(:collects_count, :integer, default: 0, virtual: true)
    end
  end

  @doc """
  for GroupherServer.CMS.[Article]

  common casting fields for general_article_fields
  """
  def general_article_cast_fields do
    [
      :title,
      :digest,
      :link_addr,
      :community_id,
      :comments_count,
      :comments_participants_count,
      :active_at,
      :pending
    ]
  end

  @doc """
  Returns the shared persistence fields owned by the Article version lifecycle.

  Product schemas append these fields to their changeset cast lists instead of
  repeating identity, branch, stage, and derived-document fields.
  """
  @spec article_version_cast_fields() :: [atom()]
  def article_version_cast_fields do
    [:article_hash_id, :stage, :body_hash, :schema_version, :version]
  end

  @doc """
  Adds the ordinary Article logical identity and current stage coordinate.

      article_hash_id + stage
                     |
                     +--> exactly one current row per Community and stage
  """
  defmacro article_version_fields do
    quote do
      field(:article_hash_id, Ecto.UUID)

      field(:stage, Ecto.Enum,
        values: unquote(CMS.Const.stage_values()),
        default: unquote(CMS.Const.stage(:public))
      )

      field(:body_hash, :string)
      field(:schema_version, :integer, default: 1)
      field(:version, :integer, default: 1)
    end
  end

  @doc "Adds the Doc-only branch/stage coordinate."
  defmacro doc_version_fields do
    quote do
      field(:article_hash_id, Ecto.UUID)
      belongs_to(:branch, DocBranch)

      field(:stage, Ecto.Enum,
        values: unquote(CMS.Const.stage_values()),
        default: unquote(CMS.Const.stage(:public))
      )

      field(:body_hash, :string)
      field(:schema_version, :integer, default: 1)
      field(:version, :integer, default: 1)
    end
  end

  @doc """
  Validates the ordinary Article identity/stage invariant.

  Ordinary Articles deliberately have no Branch. Database uniqueness is the
  source of truth for one Draft and one Public row per Community and identity.
  """
  @spec validate_article_version_scope(Ecto.Changeset.t(), atom()) :: Ecto.Changeset.t()
  def validate_article_version_scope(changeset, _thread), do: changeset

  @doc "Validates the Doc branch/community/stage invariant."
  @spec validate_doc_version_scope(Ecto.Changeset.t()) :: Ecto.Changeset.t()
  def validate_doc_version_scope(changeset) do
    prepare_changes(changeset, fn changeset ->
      branch_id = get_field(changeset, :branch_id)
      community_id = get_field(changeset, :community_id)

      case changeset.repo.get_by(DocBranch, id: branch_id, community_id: community_id) do
        %DocBranch{} -> changeset
        nil -> add_error(changeset, :branch_id, "does not belong to the Doc scope")
      end
    end)
  end

  @doc """
  for GroupherServer.CMS.[Article]

  MIGRATION:

  TABLE: "cms_[article]s"
  -----
  # for :author
  add(:author_id, references(:cms_authors, on_delete: :delete_all), null: false)
  create(index(:cms_[article]s, [:author_id]))

  # for :views
  add(:views, :integer, default: 0)

  # for :meta
  add(:meta, :map)

  # for :emotion
  add(:emotions, :map)

  # for :original_community
  add(:community_id, references(:communities, on_delete: :delete_all))

  # for :comment
  add(:comments_participants_count, :integer, default: 0)
  add(:comments_count, :integer, default: 0)
  add(:comments_participants, :map)

  # for table contains macro "article_belongs_to_fields":
  # TABLE: "abuse_reports"
  # TABLE: "article_collects"
  # TABLE: "article_upvotes"
  # TABLE: "articles_comments"
  # TABLE: "articles_pinned_comments"
  # TABLE: "articles_users_emotions"
  # TABLE: "pinned_articles"
  -----
  add(:[article]_id, references(:cms_[article]s, on_delete: :delete_all))

  """
  defmacro general_article_fields(thread) do
    quote do
      field(:inner_id, :id)
      field(:title, :string)
      field(:digest, :string)

      field(:views, :integer, default: 0)
      field(:is_pinned, :boolean, default: false, virtual: true)
      field(:cover_url, :string)
      field(:cover_url_dark, :string)

      belongs_to(:author, Author)
      belongs_to(:cover_edit_info, CoverEditInfo)

      field(:link_addr, :string)

      has_one(
        :document,
        CMS.Model.ArticleDocument,
        foreign_key: :article_id,
        where: [thread: unquote(thread)]
      )

      embeds_one(:meta, Embeds.ArticleMeta, on_replace: :update)
      embeds_one(:emotions, Embeds.ArticleEmotion, on_replace: :update)

      belongs_to(:community, Community)

      unquote(lifecycle_association(thread))

      upvote_and_collect_fields()
      viewer_has_fields()
      comment_fields()

      field(:active_at, :utc_datetime)

      field(:pending, :integer, default: 0)

      timestamps(type: :utc_datetime)
    end
  end

  defp lifecycle_association(:doc) do
    quote do
      has_one(
        :lifecycle,
        DocLifecycle,
        foreign_key: :article_hash_id,
        references: :article_hash_id
      )
    end
  end

  defp lifecycle_association(thread) do
    quote do
      has_one(
        :lifecycle,
        ArticleLifecycle,
        foreign_key: :article_hash_id,
        references: :article_hash_id,
        where: [thread: unquote(thread)]
      )
    end
  end

  @doc """
  for GroupherServer.CMS.[Article]

  # TABLE: "communities_join_[article]s"
  add(:community_id, references(:communities, on_delete: :delete_all), null: false)
  add(:[article]_id, references(:cms_[article]s, on_delete: :delete_all), null: false)

  create(unique_index(:communities_join_[article]s, [:community_id, :[article]_id]))
  """
  defmacro article_communities_field(thread) do
    quote do
      many_to_many(
        :communities,
        Community,
        # NOTE: can not use "communities_join_[article]s" here because it need to set schema_prefix
        # unfortunately, we need to manually default community_join_[article]
        # join_through: unquote("communities_join_#{plural(thread)}"),
        join_through:
          unquote(Module.concat(CMS.Model, "CommunityJoin#{Recase.to_title(to_string(thread))}")),
        on_replace: :delete
      )
    end
  end

  @doc """
  for GroupherServer.CMS.[Article]

  # TABLE: "community_join_tags"

  add(:[article]_id, references(:cms_[article]s, on_delete: :delete_all))
  """
  defmacro article_tags_field(thread) do
    quote do
      many_to_many(
        :community_tags,
        CommunityTag,
        # NOTE: can not use "community_join_tags" here because it need to set schema_prefix
        join_through: CommunityJoinTag,
        join_keys: Keyword.new([{unquote(:"#{thread}_id"), :id}]) ++ [community_tag_id: :id],
        # :delete_all will only remove data from the join source
        on_delete: :delete_all,
        on_replace: :delete
      )
    end
  end
end
