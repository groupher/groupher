defmodule GroupherServer.ErrorCat.Validator do
  @moduledoc """
  Compile-time validation for the global ErrorCat contract.

  Ranges and catalogs -> invariant checks -> `:ok` or a compilation error.
  """

  alias GroupherServer.ErrorCat.Registry

  @message_key ~r/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/
  @definition_fields [:namespace, :reason, :code, :retryable, :actions, :message_key]

  def validate!(ranges, reserved, catalogs) do
    validate_ranges!(ranges)
    validate_reserved!(ranges, reserved)
    validate_catalogs!(ranges, reserved, catalogs)
    :ok
  end

  defp validate_ranges!(ranges) do
    unless is_map(ranges) and map_size(ranges) > 0 do
      raise ArgumentError, "ErrorCat ranges must be a non-empty map"
    end

    validate_range_definitions!(ranges)
    validate_ranges_disjoint!(ranges)
  end

  defp validate_range_definitions!(ranges) do
    Enum.each(ranges, fn {namespace, range} ->
      validate_namespace!(namespace)

      unless is_struct(range, Range) and range.step == 1 do
        raise ArgumentError, "ErrorCat range must be an ascending range: #{inspect(namespace)}"
      end
    end)
  end

  defp validate_ranges_disjoint!(ranges) do
    ranges
    |> Map.to_list()
    |> Enum.with_index()
    |> Enum.each(fn {{left_namespace, left_range}, index} ->
      validate_range_against_following!(left_namespace, left_range, ranges, index)
    end)
  end

  defp validate_range_against_following!(left_namespace, left_range, ranges, index) do
    ranges
    |> Map.to_list()
    |> Enum.drop(index + 1)
    |> Enum.each(fn {right_namespace, right_range} ->
      if Range.disjoint?(left_range, right_range),
        do: :ok,
        else:
          raise(ArgumentError,
            message:
              "ErrorCat code ranges overlap: #{inspect(left_namespace)} and #{inspect(right_namespace)}"
          )
    end)
  end

  defp validate_catalogs!(ranges, reserved, catalogs) do
    entries = Registry.all_entries(catalogs)
    validate_catalog_namespaces!(ranges, catalogs)
    validate_duplicate_entries!(entries)
    validate_codes!(ranges, reserved, entries)
    validate_message_keys!(entries ++ reserved)
  end

  defp validate_catalog_namespaces!(ranges, catalogs) do
    catalog_namespaces = Enum.map(catalogs, & &1.namespace())
    range_namespaces = Map.keys(ranges)

    if length(catalog_namespaces) != length(Enum.uniq(catalog_namespaces)) do
      raise ArgumentError, "ErrorCat catalog namespace declared more than once"
    end

    Enum.each(catalog_namespaces, fn namespace ->
      unless Map.has_key?(ranges, namespace) do
        raise ArgumentError, "ErrorCat catalog namespace is not registered: #{inspect(namespace)}"
      end
    end)

    Enum.each(range_namespaces, fn namespace ->
      unless namespace in catalog_namespaces do
        raise ArgumentError, "ErrorCat range has no catalog owner: #{inspect(namespace)}"
      end
    end)
  end

  defp validate_duplicate_entries!(entries) do
    entries
    |> Enum.group_by(&{&1.namespace, &1.reason})
    |> Enum.each(fn
      {_identity, [_entry]} ->
        :ok

      {identity, _entries} ->
        raise ArgumentError, "ErrorCat duplicate entry: #{inspect(identity)}"
    end)
  end

  defp validate_codes!(ranges, reserved, entries) do
    reserved_identities = MapSet.new(reserved, &{&1.namespace, &1.reason})

    Enum.each(entries, fn entry ->
      if MapSet.member?(reserved_identities, {entry.namespace, entry.reason}) do
        raise ArgumentError,
              "ErrorCat reserved reason is used by ordinary entry: #{inspect(entry.namespace)}.#{entry.reason}"
      end
    end)

    reserved
    |> Enum.group_by(& &1.code)
    |> Enum.each(fn
      {_code, [_definition]} ->
        :ok

      {code, _definitions} ->
        raise ArgumentError, "ErrorCat reserved code is duplicated: #{code}"
    end)

    reserved_by_code = Map.new(reserved, &{&1.code, &1})

    entries
    |> Enum.group_by(& &1.code)
    |> Enum.each(fn
      {_code, [entry]} ->
        validate_entry_code!(ranges, reserved_by_code, entry)

      {code, _entries} ->
        raise ArgumentError, "ErrorCat numeric code is duplicated: #{code}"
    end)

    Enum.each(reserved, fn definition ->
      range = Map.fetch!(ranges, definition.namespace)

      unless definition.code in range do
        raise ArgumentError,
              "ErrorCat reserved code #{definition.code} is outside namespace #{inspect(definition.namespace)} range"
      end
    end)
  end

  defp validate_entry_code!(ranges, reserved_by_code, entry) do
    range = Map.fetch!(ranges, entry.namespace)

    unless entry.code in range do
      raise ArgumentError,
            "ErrorCat code #{entry.code} is outside namespace #{inspect(entry.namespace)} range"
    end

    if Map.has_key?(reserved_by_code, entry.code) do
      raise ArgumentError,
            "ErrorCat reserved code #{entry.code} is used by #{inspect(entry.namespace)}.#{entry.reason}"
    end
  end

  defp validate_reserved!(ranges, reserved) when is_list(reserved) do
    Enum.each(reserved, fn definition ->
      validate_reserved_definition!(ranges, definition)
    end)
  end

  defp validate_reserved!(_ranges, _reserved),
    do: raise(ArgumentError, "ErrorCat reserved definitions must be a list")

  defp validate_reserved_definition!(ranges, definition) do
    validate_reserved_shape!(definition)
    validate_namespace!(definition.namespace)
    validate_reserved_namespace!(ranges, definition.namespace)
    validate_reserved_reason!(definition.reason)
    validate_reserved_code!(definition.code)
    validate_reserved_retryable!(definition.retryable)
    validate_reserved_actions!(definition.actions)
    validate_reserved_message_key!(definition.message_key)
  end

  defp validate_reserved_shape!(definition) do
    unless is_map(definition) and Enum.all?(@definition_fields, &Map.has_key?(definition, &1)) do
      raise ArgumentError, "ErrorCat reserved definition is incomplete: #{inspect(definition)}"
    end
  end

  defp validate_reserved_namespace!(ranges, namespace) do
    unless Map.has_key?(ranges, namespace),
      do:
        raise(
          ArgumentError,
          "ErrorCat reserved definition namespace is not registered: #{inspect(namespace)}"
        )
  end

  defp validate_reserved_reason!(reason) when is_atom(reason), do: :ok

  defp validate_reserved_reason!(_),
    do: raise(ArgumentError, "ErrorCat reserved reason must be an atom")

  defp validate_reserved_code!(code) when is_integer(code) and code > 0, do: :ok

  defp validate_reserved_code!(_),
    do: raise(ArgumentError, "ErrorCat reserved code must be a positive integer")

  defp validate_reserved_retryable!(retryable) when is_boolean(retryable), do: :ok

  defp validate_reserved_retryable!(_),
    do: raise(ArgumentError, "ErrorCat reserved retryable must be boolean")

  defp validate_reserved_actions!(actions) when is_list(actions) do
    if Enum.all?(actions, &is_atom/1),
      do: :ok,
      else: raise(ArgumentError, "ErrorCat reserved actions must be a list of atoms")
  end

  defp validate_reserved_actions!(_),
    do: raise(ArgumentError, "ErrorCat reserved actions must be a list of atoms")

  defp validate_reserved_message_key!(message_key) when is_binary(message_key), do: :ok

  defp validate_reserved_message_key!(_),
    do: raise(ArgumentError, "ErrorCat reserved message_key must be a string")

  defp validate_message_keys!(definitions) do
    Enum.each(definitions, fn definition ->
      prefix = namespace_path(definition.namespace) <> "."

      unless Regex.match?(@message_key, definition.message_key) and
               String.starts_with?(definition.message_key, prefix) do
        raise ArgumentError,
              "ErrorCat invalid message_key #{inspect(definition.message_key)} for #{inspect(definition.namespace)}.#{definition.reason}"
      end
    end)
  end

  defp validate_namespace!(namespace) when is_tuple(namespace) and tuple_size(namespace) > 0 do
    unless Enum.all?(Tuple.to_list(namespace), &is_atom/1) do
      raise ArgumentError, "ErrorCat namespace must contain atoms: #{inspect(namespace)}"
    end
  end

  defp validate_namespace!(namespace),
    do:
      raise(ArgumentError, "ErrorCat namespace must be a non-empty tuple: #{inspect(namespace)}")

  def default_message_key(namespace, reason),
    do: namespace_path(namespace) <> "." <> Atom.to_string(reason)

  def namespace_path(namespace),
    do: namespace |> Tuple.to_list() |> Enum.map_join(".", &Atom.to_string/1)
end
