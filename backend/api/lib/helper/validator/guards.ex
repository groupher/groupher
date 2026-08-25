defmodule Helper.Validator.Guards do
  @moduledoc """
  Shared guard macros for identifiers, non-empty strings, non-negative integers,
  and non-nil values used across changesets and function clauses.

  Business position:

      Domain or web caller
        -> Guards
        -> normalized value / infrastructure
  """
  @doc "Runs `g_pos_int` through the public `Guards` boundary."
  defguard g_pos_int(value) when is_integer(value) and value >= 0
  @doc "Runs `g_not_nil` through the public `Guards` boundary."
  defguard g_not_nil(value) when not is_nil(value)

  @doc "Runs `g_none_empty_str` through the public `Guards` boundary."
  defguard g_none_empty_str(value) when is_binary(value) and byte_size(value) > 0

  @doc "Runs `g_is_id` through the public `Guards` boundary."
  defguard g_is_id(value) when is_binary(value) or is_integer(value)
end
