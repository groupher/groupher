defmodule GroupherServer.CMS.Model.Interaction.EmotionInfo do
  @moduledoc """
  Generates the per-emotion schema shared by physical Artiment models.

      concrete EmotionInfo model
        -> shared Ecto fields and constraints
        -> cms.*_emotion_infos
  """

  @doc "Generates a per-emotion Ecto model from table and target options."
  defmacro __using__(opts) do
    table = Keyword.fetch!(opts, :table)
    target = Keyword.fetch!(opts, :target)
    target_schema = Keyword.fetch!(opts, :target_schema)
    target_id = String.to_atom("#{target}_id")
    unique_index = String.to_atom("#{table}_#{target_id}_emotion_index")

    quote do
      use Ecto.Schema

      import Ecto.Changeset

      alias GroupherServer.CMS.Model
      alias Helper.Constant.DBPrefix

      @schema_prefix DBPrefix.cms()
      @target_id unquote(target_id)

      schema unquote(table) do
        belongs_to(unquote(target), unquote(target_schema), foreign_key: unquote(target_id))

        field(:emotion, :string)
        field(:user_ids, Model.Interaction.RoaringBitmap)
        field(:users_count, :integer, default: 0)
        field(:latest_users, {:array, :map}, default: [])

        timestamps(type: :utc_datetime)
      end

      @doc false
      def changeset(struct, attrs) do
        struct
        |> cast(attrs, [@target_id, :emotion])
        |> validate_required([@target_id, :emotion])
        |> foreign_key_constraint(@target_id)
        |> unique_constraint(@target_id, name: unquote(unique_index))
      end
    end
  end
end
