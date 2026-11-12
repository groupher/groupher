defmodule GroupherServerWeb.GraphQL.OneOfValidation do
  @moduledoc """
  Validates that OneOf input objects contain exactly one non-null supplied field.

  Absinthe 1.12 counts only non-null values. This document phase replaces that
  check and distinguishes explicit nulls from fields backed by omitted variables.
  """

  use Absinthe.Phase

  alias Absinthe.Blueprint
  alias Absinthe.Blueprint.Input.Object
  alias Absinthe.Phase.Error
  alias Absinthe.Type

  @doc "Adds the validation to an Absinthe document pipeline."
  def pipeline(pipeline, _options \\ []) do
    Absinthe.Pipeline.replace(
      pipeline,
      Absinthe.Phase.Document.Validation.OneOfDirective,
      __MODULE__
    )
  end

  @doc "Builds the HTTP pipeline with the OneOf validation phase."
  def plug_pipeline(config, options) do
    config
    |> Absinthe.Plug.default_pipeline(options)
    |> pipeline()
  end

  @doc false
  def run(blueprint, _options \\ []) do
    {:ok, Blueprint.prewalk(blueprint, &validate/1)}
  end

  defp validate(%Object{schema_node: %Type.InputObject{__private__: private} = type} = node) do
    supplied = Enum.filter(node.fields, &supplied?/1)

    if Keyword.has_key?(private, :one_of) and not valid?(supplied) do
      error = %Error{
        locations: [node.source_location],
        message:
          ~s[The Input Type "#{type.name}" has the @oneOf directive. It must have exactly one non-null field.],
        phase: __MODULE__
      }

      put_error(node, error)
    else
      node
    end
  end

  defp validate(node), do: node

  defp supplied?(%{input_value: %{normalized: nil}}), do: false
  defp supplied?(_field), do: true

  defp valid?([%{input_value: %{normalized: %Blueprint.Input.Null{}}}]), do: false
  defp valid?([_field]), do: true
  defp valid?(_fields), do: false
end
