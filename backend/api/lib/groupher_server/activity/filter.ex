defmodule GroupherServer.Activity.Filter do
  @moduledoc """
  Resolves custom Activity filters and built-in question presets into one applied filter.

      selection -> preset lookup -> intersection -> applied filter + query context

  Presets only compose existing filter atoms. They do not own a second query path.
  """

  alias GroupherServer.Activity.ErrorCat
  alias GroupherServer.Activity.Const

  @list_dimensions [
    :resource_types,
    :actions,
    :categories,
    :outcomes,
    :denial_codes,
    :actor_types,
    :changed_fields
  ]

  @filter_keys [
    :resource_types,
    :actions,
    :categories,
    :outcomes,
    :denial_codes,
    :actor_types,
    :actor_ref,
    :on_behalf_of_ref,
    :subject_ref,
    :target_ref,
    :changed_fields,
    :source,
    :occurred_after,
    :occurred_before,
    :operation_ref,
    :event_ref,
    :parent_event_ref
  ]

  @presets %{
    "destructive_actions" => %{
      question_key: "dsb.activity.preset.destructive_actions.question",
      description_key: "dsb.activity.preset.destructive_actions.description",
      coverage_note_key: "dsb.activity.preset.coverage.from_launch",
      default_time_range: %{amount: 30, unit: :day},
      filter: %{
        actions: [:permanently_deleted, :blocker_terminated, :destroyed],
        outcomes: [:allowed, :denied]
      },
      required_actions: [:permanently_deleted, :blocker_terminated, :destroyed]
    },
    "community_destruction" => %{
      question_key: "dsb.activity.preset.community_destruction.question",
      description_key: "dsb.activity.preset.community_destruction.description",
      coverage_note_key: "dsb.activity.preset.coverage.from_launch",
      default_time_range: %{amount: 30, unit: :day},
      filter: %{
        actions: [
          :destroy_scheduled,
          :destroy_cancelled,
          :destroyed,
          :lifecycle_reconciled
        ]
      },
      required_actions: [
        :destroy_scheduled,
        :destroy_cancelled,
        :destroyed,
        :lifecycle_reconciled
      ]
    },
    "publishing_and_configuration" => %{
      question_key: "dsb.activity.preset.publishing_and_configuration.question",
      description_key: "dsb.activity.preset.publishing_and_configuration.description",
      coverage_note_key: "dsb.activity.preset.coverage.from_launch",
      default_time_range: %{amount: 30, unit: :day},
      filter: %{
        actions: [
          :config_updated,
          :published,
          :publish_restored,
          :released,
          :release_rescheduled,
          :release_withdrawn
        ]
      },
      required_actions: [
        :config_updated,
        :published,
        :publish_restored,
        :released,
        :release_rescheduled,
        :release_withdrawn
      ]
    },
    "denied_high_risk_attempts" => %{
      question_key: "dsb.activity.preset.denied_high_risk_attempts.question",
      description_key: "dsb.activity.preset.denied_high_risk_attempts.description",
      coverage_note_key: "dsb.activity.preset.coverage.from_launch",
      default_time_range: %{amount: 30, unit: :day},
      filter: %{outcomes: [:denied], high_risk: true},
      required_actions: [:permanently_deleted, :blocker_terminated, :destroyed]
    },
    "activity_exports" => %{
      question_key: "dsb.activity.preset.activity_exports.question",
      description_key: "dsb.activity.preset.activity_exports.description",
      coverage_note_key: "dsb.activity.preset.coverage.from_launch",
      default_time_range: %{amount: 30, unit: :day},
      filter: %{actions: [:activity_exported]},
      required_actions: [:activity_exported]
    }
  }

  @preset_order [
    "destructive_actions",
    "community_destruction",
    "publishing_and_configuration",
    "denied_high_risk_attempts",
    "activity_exports"
  ]

  def descriptors do
    Enum.map(@preset_order, fn key ->
      preset = Map.fetch!(@presets, key)

      preset
      |> Map.take([:question_key, :description_key, :coverage_note_key, :default_time_range])
      |> Map.put(:key, key)
    end)
  end

  def resolve(selection, active_actions) when is_map(selection) do
    preset_key = Map.get(selection, :preset_key)
    user_filter = Map.get(selection, :filter) || %{}

    with :ok <- validate_selection_keys(selection),
         {:ok, preset} <- fetch_preset(preset_key),
         :ok <- validate_user_filter(user_filter, active_actions),
         {:ok, applied_filter, empty?} <- merge_filter(preset, user_filter, active_actions) do
      coverage = coverage(preset, active_actions)

      {:ok,
       %{
         filter: applied_filter,
         empty?: empty?,
         query_context: %{
           preset: preset_context(preset_key, preset),
           applied_filter: applied_filter,
           coverage: coverage,
           preset_intersection_empty: empty?
         }
       }}
    end
  end

  def resolve(_, _), do: {:error, ErrorCat.invalid_pagination()}

  defp validate_selection_keys(selection) do
    if Map.keys(selection) -- [:preset_key, :filter] == [],
      do: :ok,
      else: {:error, ErrorCat.invalid_pagination()}
  end

  defp fetch_preset(nil), do: {:ok, nil}

  defp fetch_preset(key) when is_binary(key) do
    case Map.fetch(@presets, key) do
      {:ok, preset} -> {:ok, preset}
      :error -> {:error, ErrorCat.preset_unavailable(%{preset_key: key})}
    end
  end

  defp fetch_preset(_), do: {:error, ErrorCat.preset_unavailable()}

  defp validate_user_filter(filter, active_actions) when is_map(filter) do
    known = %{
      resource_types: Enum.map(active_actions, & &1.resource_type),
      actions: Enum.map(active_actions, & &1.action),
      categories: Enum.map(active_actions, & &1.category),
      outcomes: Const.outcome_values(),
      denial_codes: Enum.flat_map(active_actions, & &1.denial_codes),
      actor_types: Const.actor_type_values(),
      changed_fields: Enum.flat_map(active_actions, & &1.changed_fields)
    }

    cond do
      Map.keys(filter) -- @filter_keys != [] ->
        {:error, ErrorCat.invalid_pagination()}

      Enum.any?(known, fn {key, values} -> invalid_list_value?(Map.get(filter, key), values) end) ->
        {:error, ErrorCat.invalid_pagination()}

      not is_nil(Map.get(filter, :source)) and
          normalize_atom(Map.get(filter, :source)) not in Const.source_values() ->
        {:error, ErrorCat.invalid_pagination()}

      true ->
        :ok
    end
  end

  defp validate_user_filter(_, _), do: {:error, ErrorCat.invalid_pagination()}

  defp invalid_list_value?(nil, _known), do: false

  defp invalid_list_value?(values, known) when is_list(values) do
    known = Enum.map(known, &to_string/1)
    values == [] or Enum.any?(values, &(to_string(&1) not in known))
  end

  defp invalid_list_value?(_, _known), do: true

  defp merge_filter(nil, user_filter, _active_actions), do: {:ok, user_filter, false}

  defp merge_filter(preset, user_filter, active_actions) do
    active_action_names = Enum.map(active_actions, & &1.action)

    base_filter =
      preset.filter
      |> expand_filter(active_actions)
      |> Map.update(:actions, nil, fn actions ->
        Enum.filter(actions, &(normalize_atom(&1) in active_action_names))
      end)

    user_filter = expand_filter(user_filter, active_actions)

    {filter, empty?} =
      Enum.reduce(@list_dimensions, {Map.merge(base_filter, user_filter), false}, fn key,
                                                                                     {filter,
                                                                                      empty?} ->
        case {Map.get(base_filter, key), Map.get(user_filter, key)} do
          {nil, _} ->
            {filter, empty?}

          {_, nil} ->
            {filter, empty?}

          {base, user} ->
            intersection = Enum.filter(List.wrap(user), &(&1 in List.wrap(base)))
            {Map.put(filter, key, intersection), empty? or intersection == []}
        end
      end)

    {:ok, materialize_default_time(filter, preset.default_time_range), empty?}
  end

  defp expand_filter(filter, active_actions) do
    derived_action_sets =
      []
      |> maybe_add_action_set(Map.get(filter, :actions))
      |> maybe_add_action_set(
        if(Map.get(filter, :high_risk) == true,
          do: active_actions |> Enum.filter(& &1.high_risk) |> Enum.map(& &1.action)
        )
      )
      |> maybe_add_action_set(
        case Map.get(filter, :categories) do
          nil ->
            nil

          categories ->
            categories =
              Enum.map(List.wrap(categories), fn category -> normalize_atom(category) end)

            active_actions
            |> Enum.filter(&(&1.category in categories))
            |> Enum.map(& &1.action)
        end
      )

    actions =
      case derived_action_sets do
        [] -> nil
        [first | rest] -> Enum.reduce(rest, Enum.map(first, &normalize_atom/1), &intersection/2)
      end

    filter = Map.delete(filter, :high_risk)
    if is_nil(actions), do: filter, else: Map.put(filter, :actions, actions)
  end

  defp maybe_add_action_set(sets, nil), do: sets
  defp maybe_add_action_set(sets, values), do: sets ++ [List.wrap(values)]

  defp intersection(values, current) do
    values = Enum.map(values, &normalize_atom/1)
    Enum.filter(current, &(&1 in values))
  end

  defp normalize_atom(value) when is_atom(value), do: value

  defp normalize_atom(value) when is_binary(value) do
    String.to_existing_atom(value)
  rescue
    ArgumentError -> value
  end

  defp materialize_default_time(filter, %{amount: amount, unit: :day}) do
    if is_nil(Map.get(filter, :occurred_after)) and is_nil(Map.get(filter, :occurred_before)) do
      before = DateTime.utc_now(:second)

      Map.merge(filter, %{
        occurred_after: DateTime.add(before, -amount, :day),
        occurred_before: before
      })
    else
      filter
    end
  end

  defp coverage(nil, _active_actions), do: %{limitations: []}

  defp coverage(preset, active_actions) do
    required_outcomes = Map.get(preset.filter, :outcomes, [:allowed])

    limitations =
      Enum.flat_map(preset.required_actions, fn action ->
        matching = Enum.filter(active_actions, &(&1.action == action))

        Enum.flat_map(required_outcomes, fn outcome ->
          if Enum.any?(matching, &(outcome in &1.outcomes)),
            do: [],
            else: [%{action: action, outcome: outcome, reason: :producer_not_active}]
        end)
      end)

    %{limitations: limitations}
  end

  defp preset_context(nil, _preset), do: nil

  defp preset_context(key, preset),
    do: %{key: key, question_key: preset.question_key}
end
