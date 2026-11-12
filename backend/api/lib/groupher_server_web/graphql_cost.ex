defmodule GroupherServerWeb.GraphQLCost do
  @moduledoc """
  Enforces an additional conservative budget for paginated field fan-out.

      Validated operation -> page-aware cost -> resolver execution

  A field accepting `pagi` multiplies its descendants by the requested page
  size (or the platform maximum when omitted). This is an estimate, not a SQL
  or execution-time measurement.
  """

  use Absinthe.Phase

  alias Absinthe.{Blueprint, Phase, Pipeline}
  alias Absinthe.Blueprint.Document.{Field, Fragment, Operation}

  @max_cost 500_000
  @max_page_size 100

  def pipeline(config, options) do
    config
    |> Absinthe.Plug.default_pipeline(options)
    |> Pipeline.insert_after(Absinthe.Phase.Document.Complexity.Result, {__MODULE__, options})
  end

  def run(blueprint, _options) do
    operation = Blueprint.current_operation(blueprint)
    fragments = Map.new(blueprint.fragments, &{&1.name, &1})
    {cost, _cache} = selections_cost(operation.selections, fragments, %{})

    if cost > @max_cost do
      error = %Phase.Error{
        phase: __MODULE__,
        message: "Operation page-aware cost is #{cost} and maximum is #{@max_cost}",
        locations: [operation.source_location]
      }

      blueprint = put_in(blueprint.execution.validation_errors, [error])

      {:jump, blueprint, Absinthe.Phase.Document.Result}
    else
      {:ok, blueprint}
    end
  end

  defp selections_cost(selections, fragments, cache) do
    Enum.reduce_while(selections, {0, cache}, fn selection, {total, cache} ->
      {cost, cache} = selection_cost(selection, fragments, cache)
      total = min(total + cost, @max_cost + 1)
      if total > @max_cost, do: {:halt, {total, cache}}, else: {:cont, {total, cache}}
    end)
  end

  defp selection_cost(%{flags: %{skip: _}}, _fragments, cache), do: {0, cache}

  defp selection_cost(%Field{} = field, fragments, cache) do
    {child, cache} = selections_cost(field.selections, fragments, cache)
    base = if field.name == "__typename", do: 0, else: 1
    {min(base + page_multiplier(field) * child, @max_cost + 1), cache}
  end

  defp selection_cost(%Fragment.Inline{selections: selections}, fragments, cache) do
    selections_cost(selections, fragments, cache)
  end

  defp selection_cost(%Fragment.Spread{name: name}, fragments, cache) do
    case Map.fetch(cache, name) do
      {:ok, cost} ->
        {min(cost + 1, @max_cost + 1), cache}

      :error ->
        %Fragment.Named{selections: selections} = Map.fetch!(fragments, name)
        {cost, cache} = selections_cost(selections, fragments, cache)
        {min(cost + 1, @max_cost + 1), Map.put(cache, name, cost)}
    end
  end

  defp selection_cost(%Operation{selections: selections}, fragments, cache) do
    selections_cost(selections, fragments, cache)
  end

  defp page_multiplier(%Field{schema_node: %{args: args}, argument_data: values}) do
    if Map.has_key?(args, :pagi) do
      size = get_in(values, [:pagi, :offset, :size]) || get_in(values, [:pagi, :cursor, :first])
      if is_integer(size) and size > 0, do: min(size, @max_page_size), else: @max_page_size
    else
      1
    end
  end
end
