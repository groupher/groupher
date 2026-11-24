defmodule Helper.Validator.Guards do
  @moduledoc """
  Shared guard macros for identifiers, non-empty strings, non-negative integers,
  and non-nil values used across changesets and function clauses.

  Business position:

      Domain or web caller
        -> Guards
        -> normalized value / infrastructure
  """
  @doc "Matches non-negative integers, including zero."
  defguard g_pos_int(value) when is_integer(value) and value >= 0
  @doc "Matches any value other than nil, including false."
  defguard g_not_nil(value) when not is_nil(value)

  @doc "Matches binaries with at least one byte; whitespace is not trimmed."
  defguard g_none_empty_str(value) when is_binary(value) and byte_size(value) > 0

  @doc "Matches binary or integer identifiers without checking their contents or range."
  defguard g_is_id(value) when is_binary(value) or is_integer(value)
end
