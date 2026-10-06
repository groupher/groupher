defmodule GroupherServer.CMS.Model.Interaction.ReactionInfo do
  @moduledoc """
  Generates fixed-reaction projections keyed by stable Article identity.

      concrete ReactionInfo model
        -> shared Ecto fields and constraints
        -> cms.*_reaction_infos
  """

  @doc "Generates a fixed-reaction Ecto model from table and target options."
  defmacro __using__(opts) do
    table = Keyword.fetch!(opts, :table)
    collection? = Keyword.fetch!(opts, :collection?)
    target = Keyword.get(opts, :target, :article)
    unique_index = String.to_atom("#{table}_stable_article_index")

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
          |> cast(attrs, [:comment_id])
          |> validate_required([:comment_id])
          |> foreign_key_constraint(:comment_id)
          |> unique_constraint(:comment_id)
        end
      else
        quote do
          struct
          |> cast(attrs, [:article_id, :branch_id])
          |> validate_required([:article_id])
          |> foreign_key_constraint(:article_id)
          |> foreign_key_constraint(:branch_id)
          |> unique_constraint([:article_id, :branch_id], name: unquote(unique_index))
        end
      end

    collection_fields =
      if collection? do
        quote do
          field(:collected_user_ids, GroupherServer.CMS.Model.Interaction.RoaringBitmap)
          field(:collects_count, :integer, default: 0)
          field(:latest_collected_users, {:array, :map}, default: [])
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

        field(:upvoted_user_ids, Model.Interaction.RoaringBitmap)
        field(:reported_user_ids, Model.Interaction.RoaringBitmap)
        field(:upvotes_count, :integer, default: 0)
        field(:interaction_revision, :integer, default: 0)
        field(:latest_upvoted_users, {:array, :map}, default: [])
        unquote(collection_fields)

        timestamps(type: :utc_datetime)
      end

      @doc false
      def changeset(struct, attrs) do
        unquote(owner_changeset)
      end
    end
  end
end
