defmodule GroupherServer.CMS.Assets.ThreadIdentity do
  @moduledoc """
  Defines the narrow Thread identity set used by asset ownership and usage.

  Ticket is valid for asset storage, while ordinary Article feeds and publish
  commands continue to use their smaller `CMS.Artiment.Config.threads/0` set.

      Asset input -> ThreadIdentity -> normalized owner thread
                               |-> Assets.Query and ArticleAssetRef
  """

  alias GroupherServer.CMS

  @values CMS.Artiment.Threads.identity_values_list()

  @doc "Returns the supported asset owner threads, including Ticket identity."
  def values, do: @values

  @doc "Normalizes one supported asset thread without turning invalid values into an unfiltered query."
  def to_atom(value) when is_atom(value) and value in @values, do: {:ok, value}

  def to_atom(value) when is_binary(value) do
    value = String.downcase(String.trim(value))

    Enum.find_value(@values, {:error, :invalid_asset_thread}, fn thread ->
      if Atom.to_string(thread) == value, do: {:ok, thread}
    end)
  end

  def to_atom(_value), do: {:error, :invalid_asset_thread}
end
