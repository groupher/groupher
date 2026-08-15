defmodule GroupherServer.CMS.Interactions.Schema.ReactionInfoSchema do
  @moduledoc """
  Generates the fixed-reaction schema shared by every physical Artiment target.

  Business position:

      ReactionInfoSchema macro -> target projection schema -> cms.*_reaction_infos
  """

  @doc "Generates a fixed-reaction Ecto projection schema from table and target options."
  defmacro __using__(opts) do
    table = Keyword.fetch!(opts, :table)
    target = Keyword.fetch!(opts, :target)
    target_schema = Keyword.fetch!(opts, :target_schema)
    collection? = Keyword.fetch!(opts, :collection?)
    target_id = String.to_atom("#{target}_id")
    unique_index = String.to_atom("#{table}_#{target_id}_index")

    collection_fields =
      if collection? do
        quote do
          field(:collected_user_ids, GroupherServer.CMS.Interactions.RoaringBitmap)
          field(:collects_count, :integer, default: 0)
          field(:latest_collected_users, {:array, :map}, default: [])
        end
      end

    quote do
      use Ecto.Schema

      import Ecto.Changeset

      alias Helper.Constant.DBPrefix

      @schema_prefix DBPrefix.cms()
      @target_id unquote(target_id)

      schema unquote(table) do
        belongs_to(unquote(target), unquote(target_schema), foreign_key: unquote(target_id))

        field(:viewed_user_ids, GroupherServer.CMS.Interactions.RoaringBitmap)
        field(:upvoted_user_ids, GroupherServer.CMS.Interactions.RoaringBitmap)
        field(:reported_user_ids, GroupherServer.CMS.Interactions.RoaringBitmap)
        field(:upvotes_count, :integer, default: 0)
        field(:latest_upvoted_users, {:array, :map}, default: [])
        unquote(collection_fields)

        timestamps(type: :utc_datetime)
      end

      @doc false
      def changeset(struct, attrs) do
        struct
        |> cast(attrs, [@target_id])
        |> validate_required([@target_id])
        |> foreign_key_constraint(@target_id)
        |> unique_constraint(@target_id, name: unquote(unique_index))
      end
    end
  end
end
