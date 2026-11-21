defmodule GroupherServer.CMS.Model.Article do
  @moduledoc """
  Stable aggregate root for one logical Article across editing and publishing.

      Draft / Revision / Public
                 |
                 `-> stable Article id -> comments / stats / activity

  Content heads and lifecycle state deliberately live outside this schema.
  """

  use Ecto.Schema
  use Flop.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.Author
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @threads CMS.Artiment.Threads.identity_values_list()
  @required_fields ~w(thread author_id)a
  @optional_fields ~w(active_at is_sunk last_active_at
                      is_edited comments_locked next_floor next_comment_inner_id)a

  @flop_options [
    filterable: [],
    sortable: [
      :active_at,
      :inserted_at,
      :updated_at,
      :id,
      :published_at,
      :doc_active_at,
      :inner_id,
      :binding_id,
      :views,
      :upvotes_count,
      :comments_count
    ],
    pagination_types: [:page, :first],
    adapter_opts: [
      join_fields: [
        published_at: [binding: :stable_public, field: :published_at, ecto_type: :utc_datetime],
        inner_id: [binding: :article_binding, field: :inner_id, ecto_type: :integer],
        binding_id: [binding: :article_binding, field: :id, ecto_type: :integer],
        views: [binding: :article_stats, field: :views, ecto_type: :integer],
        upvotes_count: [
          binding: :article_stats,
          field: :upvotes_count,
          ecto_type: :integer
        ],
        comments_count: [
          binding: :article_stats,
          field: :comments_count,
          ecto_type: :integer
        ]
      ],
      custom_fields: [
        doc_active_at: [
          field_dynamic: {GroupherServer.CMS.Articles.ActivityTime, :effective_doc, []},
          ecto_type: :utc_datetime,
          bindings: [:stable_public]
        ]
      ]
    ]
  ]

  @type t :: %__MODULE__{}

  schema "articles" do
    belongs_to(:author, Author, type: :id)
    field(:thread, Ecto.Enum, values: @threads)
    field(:active_at, :utc_datetime)
    field(:is_sunk, :boolean, default: false)
    field(:last_active_at, :utc_datetime)
    field(:is_edited, :boolean, default: false)
    field(:comments_locked, :boolean, default: false)
    field(:next_floor, :integer, default: 1)
    field(:next_comment_inner_id, :integer, default: 1)

    # Selected public content and request-community facts are read projections
    # on the canonical Article struct. They are never cast or persisted here.
    field(:title, :string, virtual: true)
    field(:digest, :string, virtual: true)
    field(:slug, :string, virtual: true)
    field(:body, :map, virtual: true)
    field(:snapshot_id, Ecto.UUID, virtual: true)
    field(:version, :integer, virtual: true)
    field(:published_at, :utc_datetime, virtual: true)
    field(:public_updated_at, :utc_datetime, virtual: true)
    field(:body_hash, :string, virtual: true)
    field(:inner_id, :integer, virtual: true)
    field(:community, :map, virtual: true)
    field(:community_tags, {:array, :map}, virtual: true)
    field(:article_tags, {:array, :map}, virtual: true)
    field(:comments_participants, {:array, :map}, virtual: true)
    field(:asset_refs, {:array, :map}, virtual: true)
    field(:is_pinned, :boolean, virtual: true)
    field(:lifecycle, :map, virtual: true)
    field(:copy_right, :string, virtual: true)
    field(:link_addr, :string, virtual: true)
    field(:cover_url, :string, virtual: true)
    field(:cover_url_dark, :string, virtual: true)
    field(:subtitle, :string, virtual: true)
    field(:template_key, :string, virtual: true)
    field(:cat, :map, virtual: true)

    timestamps(type: :utc_datetime)
  end

  @doc """
  Builds the stable identity and operational-state changeset for an Article.

  ## Examples

      Article.changeset(%Article{}, %{
        thread: :post,
        author_id: Ecto.UUID.generate()
      })

  """
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = article, attrs) do
    article
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:next_floor, greater_than: 0)
    |> validate_number(:next_comment_inner_id, greater_than: 0)
    |> foreign_key_constraint(:author_id)
  end
end
