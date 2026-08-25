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
      @stream_field stream_field
      @actions actions
      @extra_fields extra_fields
      @action_constraint "#{table}_action_check"
      @source_constraint "#{table}_source_check"
      @actor_type_constraint "#{table}_actor_type_check"
      @target_pair_constraint "#{table}_target_pair_check"
      @on_behalf_of_pair_constraint "#{table}_on_behalf_of_pair_check"
      @on_behalf_of_type_constraint "#{table}_on_behalf_of_type_check"
      @outcome_constraint "#{table}_outcome_check"
      @outcome_denial_constraint "#{table}_outcome_denial_check"
      @operation_index_constraint "#{table}_operation_index_check"
      @occurred_at_constraint "#{table}_occurred_at_check"

      @required_fields [
        :community_id,
        @stream_field,
        :subject_type,
        :subject_ref,
        :actor_type,
        :actor_ref,
        :action,
        :outcome,
        :source,
        :event_ref,
        :operation_ref,
        :operation_index,
        :occurred_at
      ]
      @optional_fields [
                         :stream_snapshot,
                         :subject_snapshot,
                         :target_type,
                         :target_ref,
                         :target_snapshot,
                         :actor_snapshot,
                         :on_behalf_of_type,
                         :on_behalf_of_ref,
                         :on_behalf_of_snapshot,
                         :denial_code,
                         :parent_event_ref,
                         :changed_fields,
                         :payload,
                         :metadata
                       ] ++ Enum.map(@extra_fields, &elem(&1, 0))

      @type t :: %__MODULE__{}

      schema table do
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
        field(:actor_ref, :string)
        field(:actor_snapshot, :map, default: %{})
        field(:on_behalf_of_type, Ecto.Enum, values: Const.actor_type_values())
        field(:on_behalf_of_ref, :string)
        field(:on_behalf_of_snapshot, :map, default: %{})
        field(:action, Ecto.Enum, values: @actions)
        field(:outcome, Ecto.Enum, values: Const.outcome_values())
        field(:denial_code, :string)

        field(
          :source,
          Ecto.Enum,
          values: Const.source_values()
        )

        field(:event_ref, Ecto.UUID)
        field(:operation_ref, Ecto.UUID)
        field(:parent_event_ref, Ecto.UUID)
        field(:operation_index, :integer)
        field(:record_sequence, :integer, read_after_writes: true)
        field(:changed_fields, {:array, :string}, default: [])
        field(:payload, :map, default: %{})
        field(:metadata, :map, default: %{})
        field(:occurred_at, :utc_datetime)
        field(:recorded_at, :utc_datetime, read_after_writes: true)
      end

      @doc false
      def changeset(log, attrs) do
        log
        |> cast(attrs, @required_fields ++ @optional_fields)
        |> validate_required(@required_fields)
        |> validate_length(@stream_field, min: 1, max: 240)
        |> validate_length(:subject_type, min: 1, max: 80)
        |> validate_length(:subject_ref, min: 1, max: 240)
        |> validate_length(:actor_ref, min: 1, max: 240)
        |> validate_target_pair()
        |> validate_on_behalf_of_pair()
        |> validate_outcome_denial()
        |> validate_number(:operation_index, greater_than_or_equal_to: 0)
        |> check_constraint(:action, name: @action_constraint)
        |> check_constraint(:source, name: @source_constraint)
        |> check_constraint(:actor_type, name: @actor_type_constraint)
        |> check_constraint(:outcome, name: @outcome_constraint)
        |> check_constraint(:denial_code, name: @outcome_denial_constraint)
        |> check_constraint(:target_ref, name: @target_pair_constraint)
        |> check_constraint(:on_behalf_of_ref, name: @on_behalf_of_pair_constraint)
        |> check_constraint(:on_behalf_of_type, name: @on_behalf_of_type_constraint)
        |> check_constraint(:operation_index, name: @operation_index_constraint)
        |> check_constraint(:occurred_at, name: @occurred_at_constraint)
        |> unique_constraint(:event_ref)
      end

      defp validate_on_behalf_of_pair(changeset) do
        case {get_field(changeset, :on_behalf_of_type), get_field(changeset, :on_behalf_of_ref)} do
          {nil, nil} ->
            changeset

          {type, ref} when not is_nil(type) and is_binary(ref) ->
            changeset

          _ ->
            add_error(
              changeset,
              :on_behalf_of_ref,
              "must be present together with on_behalf_of_type"
            )
        end
      end

      defp validate_outcome_denial(changeset) do
        case {get_field(changeset, :outcome), get_field(changeset, :denial_code)} do
          {:allowed, nil} ->
            changeset

          {:denied, code} when is_binary(code) and code != "" ->
            changeset

          {:allowed, _code} ->
            add_error(changeset, :denial_code, "must be empty for allowed events")

          {:denied, _code} ->
            add_error(changeset, :denial_code, "is required for denied events")

          _ ->
            changeset
        end
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
