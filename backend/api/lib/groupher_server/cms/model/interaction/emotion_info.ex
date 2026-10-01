defmodule GroupherServer.CMS.Model.Interaction.EmotionInfo do
  @moduledoc """
  Generates per-emotion projections keyed by stable Article identity.

      concrete EmotionInfo model
        -> shared Ecto fields and constraints
        -> cms.*_emotion_infos
  """

  @doc "Generates a per-emotion Ecto model from table and target options."
  defmacro __using__(opts) do
    table = Keyword.fetch!(opts, :table)
    target = Keyword.get(opts, :target, :article)
    unique_index = String.to_atom("#{table}_stable_article_emotion_index")

    owner_fields =
      if target == :comment do
        quote do
          belongs_to(:comment, Model.Comment)
        end
      else
        quote do
          belongs_to(:article, Model.Article, type: Ecto.UUID)
          belongs_to(:branch, Model.DocBranch)
        end
      end

    owner_changeset =
      if target == :comment do
        quote do
          struct
          |> cast(attrs, [:comment_id, :emotion])
          |> validate_required([:comment_id, :emotion])
          |> foreign_key_constraint(:comment_id)
          |> unique_constraint([:comment_id, :emotion])
        end
      else
        quote do
          struct
          |> cast(attrs, [:article_id, :branch_id, :emotion])
          |> validate_required([:article_id, :emotion])
          |> foreign_key_constraint(:article_id)
          |> foreign_key_constraint(:branch_id)
          |> unique_constraint([:article_id, :branch_id, :emotion], name: unquote(unique_index))
        end
      end

    quote do
      use Ecto.Schema

      import Ecto.Changeset

      alias GroupherServer.CMS

      alias CMS.Model
      alias Helper.Constant.DBPrefix

      @schema_prefix DBPrefix.cms()
      schema unquote(table) do
        unquote(owner_fields)

        field(:emotion, :string)
        field(:user_ids, Model.Interaction.RoaringBitmap)
        field(:users_count, :integer, default: 0)
        field(:latest_users, {:array, :map}, default: [])

        timestamps(type: :utc_datetime)
      end

      @doc false
      def changeset(struct, attrs) do
        unquote(owner_changeset)
      end
    end
  end
end
