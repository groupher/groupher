defmodule GroupherServer.Activity.Model.Base do
  @moduledoc """
  Defines the shared append-only fields and constraints for Activity schemas.

      resource log schema -> shared Activity fields -> Ecto changeset
  """

  defmacro __using__(opts) do
    table = Keyword.fetch!(opts, :table)
    stream_field = Keyword.fetch!(opts, :stream_field)
    actions = Keyword.fetch!(opts, :actions)
    extra_fields = Keyword.get(opts, :extra_fields, [])

    quote bind_quoted: [
            table: table,
            stream_field: stream_field,
            actions: actions,
            extra_fields: extra_fields
          ] do
      use Ecto.Schema
      use Accessible

      import Ecto.Changeset

      alias Helper.Constant.DBPrefix
      alias GroupherServer.Activity.Const

      @schema_prefix DBPrefix.activity()
      @timestamps_opts [type: :utc_datetime]
      @stream_field stream_field
      @actions actions
      @extra_fields extra_fields
      @action_constraint "#{table}_action_check"
      @source_constraint "#{table}_source_check"
      @actor_type_constraint "#{table}_actor_type_check"
      @target_pair_constraint "#{table}_target_pair_check"

      @required_fields [
        :community_id,
        @stream_field,
        :subject_type,
        :subject_ref,
        :actor_type,
        :action,
        :source,
        :event_ref,
        :operation_ref,
        :occurred_at
      ]
      @optional_fields [
                         :stream_snapshot,
                         :subject_snapshot,
                         :target_type,
                         :target_ref,
                         :target_snapshot,
                         :actor_id,
                         :actor_snapshot,
                         :parent_event_ref,
                         :payload,
                         :metadata
                       ] ++ Enum.map(@extra_fields, &elem(&1, 0))

      @type t :: %__MODULE__{}

      schema table do
        field(:hash_id, Ecto.UUID, autogenerate: true)
        field(:community_id, :id)
        field(@stream_field, :string)

        for {name, type} <- @extra_fields do
          field(name, type)
        end

        field(:stream_snapshot, :map, default: %{})
        field(:subject_type, :string)
        field(:subject_ref, :string)
        field(:subject_snapshot, :map, default: %{})
        field(:target_type, :string)
        field(:target_ref, :string)
        field(:target_snapshot, :map, default: %{})
        field(:actor_type, Ecto.Enum, values: Const.actor_type_values())
        field(:actor_id, :id)
        field(:actor_snapshot, :map, default: %{})
        field(:action, Ecto.Enum, values: @actions)

        field(
          :source,
          Ecto.Enum,
          values: Const.source_values()
        )

        field(:event_ref, Ecto.UUID)
        field(:operation_ref, Ecto.UUID)
        field(:parent_event_ref, Ecto.UUID)
        field(:payload, :map, default: %{})
        field(:metadata, :map, default: %{})
        field(:occurred_at, :utc_datetime)

        timestamps(type: :utc_datetime, updated_at: false)
      end

      @doc false
      def changeset(log, attrs) do
        log
        |> cast(attrs, @required_fields ++ @optional_fields)
        |> validate_required(@required_fields)
        |> validate_length(@stream_field, min: 1, max: 240)
        |> validate_length(:subject_type, min: 1, max: 80)
        |> validate_length(:subject_ref, min: 1, max: 240)
        |> validate_target_pair()
        |> check_constraint(:action, name: @action_constraint)
        |> check_constraint(:source, name: @source_constraint)
        |> check_constraint(:actor_type, name: @actor_type_constraint)
        |> check_constraint(:target_ref, name: @target_pair_constraint)
        |> unique_constraint(:hash_id)
        |> unique_constraint(:event_ref)
      end

      defp validate_target_pair(changeset) do
        case {get_field(changeset, :target_type), get_field(changeset, :target_ref)} do
          {nil, nil} -> changeset
          {type, ref} when is_binary(type) and is_binary(ref) -> changeset
          _ -> add_error(changeset, :target_ref, "must be present together with target_type")
        end
      end
    end
  end
end
