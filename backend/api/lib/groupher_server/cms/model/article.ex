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
  @threads CMS.Artiment.Config.threads()
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
        doc_active_at: [binding: :stable_doc_state, field: :active_at, ecto_type: :utc_datetime],
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
