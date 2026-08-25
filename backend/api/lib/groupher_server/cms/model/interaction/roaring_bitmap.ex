defmodule GroupherServer.CMS.Model.Interaction.RoaringBitmap do
  @moduledoc """
  Ecto type and query expressions for PostgreSQL `roaringbitmap64` values.

  A bitmap stays serialized in Elixir. Interaction queries use the macros here
  and select only scalar booleans or counts into application code.

      ReactionInfo / EmotionInfo model
        -> RoaringBitmap Ecto type and SQL expressions
        -> PostgreSQL roaringbitmap64
  """

  @behaviour Ecto.Type

  @type t :: binary()

  @doc "Declares the underlying PostgreSQL representation used by Ecto."
  @impl true
  def type, do: :binary

  @doc "Accepts serialized roaringbitmap64 values loaded from or passed to Ecto."
  @impl true
  def cast(value) when is_binary(value), do: {:ok, value}
  def cast(_value), do: :error

  @doc "Loads a serialized roaringbitmap64 value returned by PostgreSQL."
  @impl true
  def load(value) when is_binary(value), do: {:ok, value}
  def load(_value), do: :error

  @doc "Dumps a serialized roaringbitmap64 value for PostgreSQL."
  @impl true
  def dump(value) when is_binary(value), do: {:ok, value}
  def dump(_value), do: :error

  @doc "Keeps the value embedded as the custom Ecto type."
  @impl true
  def embed_as(_format), do: :self

  @doc "Compares two serialized bitmap values for Ecto change tracking."
  @impl true
  def equal?(left, right), do: left == right

  @doc "Adds one user id to a bitmap in SQL."
  defmacro add(bitmap, user_id) do
    quote do
      fragment(
        "COALESCE(?, '{}'::roaringbitmap64) | ?::bigint",
        unquote(bitmap),
        unquote(user_id)
      )
    end
  end

  @doc "Removes one user id from a bitmap in SQL."
  defmacro remove(bitmap, user_id) do
    quote do
      fragment(
        "COALESCE(?, '{}'::roaringbitmap64) - ?::bigint",
        unquote(bitmap),
        unquote(user_id)
      )
    end
  end

  @doc "Returns a SQL boolean for whether a bitmap contains one user id."
  defmacro contains(bitmap, user_id) do
    quote do
      fragment(
        "COALESCE(?, '{}'::roaringbitmap64) @> ?::bigint",
        unquote(bitmap),
        unquote(user_id)
      )
    end
  end

  @doc "Unions a batch of user ids into a bitmap in SQL."
  defmacro merge(bitmap, user_ids) do
    quote do
      fragment(
        "COALESCE(?, '{}'::roaringbitmap64) | rb64_build(?::bigint[])",
        unquote(bitmap),
        unquote(user_ids)
      )
    end
  end

  @doc "Returns bitmap cardinality for audit and repair queries only."
  defmacro cardinality(bitmap) do
    quote do
      fragment("rb64_cardinality(COALESCE(?, '{}'::roaringbitmap64))", unquote(bitmap))
    end
  end
end
