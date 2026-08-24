defmodule GroupherServer.ErrorCat do
  @moduledoc """
  Global ErrorCat registry and lookup API.

  Contexts own declarations; this module owns only the global namespace/range
  contract, reserved definitions, cross-catalog validation, and standard error
  formatting for protocol boundaries such as GraphQL.
  """

  alias GroupherServer.ErrorCat.{Error, Registry, Validator}

  @ranges %{
    {:web} => 4000..4199,
    {:account, :authentication} => 4300..4349,
    {:cms, :passport} => 4350..4399,
    {:cms, :comment} => 4400..4499,
    {:cms} => 4500..4599,
    {:cms, :gate} => 4600..4699,
    {:account, :collection} => 4700..4799,
    {:account, :fans} => 4800..4899,
    {:cms, :interaction} => 4900..4999,
    {:cms, :community} => 5500..5599,
    {:cms, :asset} => 5600..5699,
    {:cms, :article} => 6000..6099,
    {:activity} => 6100..6199
  }

  @reserved [
    %{
      namespace: {:web},
      reason: :default,
      code: 4000,
      retryable: false,
      actions: [],
      message_key: "web.default"
    },
    %{
      namespace: {:web},
      reason: :custom,
      code: 4001,
      retryable: false,
      actions: [],
      message_key: "web.custom"
    },
    %{
      namespace: {:cms, :gate},
      reason: :gate_unknown,
      code: 4699,
      retryable: false,
      actions: [],
      message_key: "cms.gate.gate_unknown"
    }
  ]

  @catalogs [
    GroupherServerWeb.ErrorCat,
    GroupherServer.Accounts.Profiles.ErrorCat,
    GroupherServer.Accounts.CollectFolders.ErrorCat,
    GroupherServer.Accounts.Fans.ErrorCat,
    GroupherServer.CMS.ErrorCat,
    GroupherServer.CMS.Gate.ErrorCat,
    GroupherServer.CMS.Passport.ErrorCat,
    GroupherServer.CMS.Comments.ErrorCat,
    GroupherServer.CMS.Interactions.ErrorCat,
    GroupherServer.CMS.Communities.ErrorCat,
    GroupherServer.CMS.Assets.ErrorCat,
    GroupherServer.CMS.Articles.ErrorCat,
    GroupherServer.Activity.ErrorCat
  ]

  def ranges, do: @ranges
  def reserved, do: @reserved
  def catalogs, do: @catalogs

  def validate!, do: Validator.validate!(@ranges, @reserved, @catalogs)

  def definition(%Error{namespace: namespace, reason: reason}),
    do: definition(namespace, reason)

  def definition(namespace, reason) when is_tuple(namespace) and is_atom(reason) do
    case Registry.find(@catalogs, namespace, reason) do
      nil ->
        case Enum.find(@reserved, &(&1.namespace == namespace and &1.reason == reason)) do
          nil ->
            raise ArgumentError,
                  "unknown ErrorCat definition: #{inspect(namespace)}.#{inspect(reason)}"

          definition ->
            definition
        end

      entry ->
        entry
    end
  end

  def definition(namespace, reason) do
    raise ArgumentError,
          "invalid ErrorCat definition lookup: #{inspect(namespace)}.#{inspect(reason)}"
  end

  def declared?(namespace, reason) when is_tuple(namespace) and is_atom(reason) do
    match?(%{}, Registry.find(@catalogs, namespace, reason)) or
      Enum.any?(@reserved, &(&1.namespace == namespace and &1.reason == reason))
  end

  def declared?(_, _), do: false

  def valid?(%Error{} = error) do
    definition = definition(error.namespace, error.reason)

    Enum.all?([:namespace, :reason, :code, :retryable, :actions, :message_key], fn field ->
      Map.fetch!(definition, field) == Map.fetch!(error, field)
    end)
  rescue
    ArgumentError -> false
  end

  def valid?(_), do: false

  def code(%Error{code: code}), do: code

  @doc "Formats a declared ErrorCat error for the GraphQL error boundary."
  @spec gq_format(Error.t() | {:error, Error.t()} | {:error, keyword()}) :: {:error, keyword()}
  def gq_format({:error, [message: _message, code: _code]} = error), do: error
  def gq_format({:error, error}), do: gq_format(error)

  def gq_format(%Error{} = error) do
    unless valid?(error) do
      raise ArgumentError,
            "invalid ErrorCat.Error at the GraphQL boundary: #{inspect(error)}"
    end

    %{reason: reason, details: details, code: code} = error

    message =
      cond do
        is_binary(details) -> details
        is_map(details) and is_binary(details[:message]) -> details[:message]
        true -> Atom.to_string(reason)
      end

    {:error, [message: message, code: code]}
  end

  def gq_format(value) do
    raise ArgumentError,
          "ErrorCat.Error is required at the GraphQL boundary, got: #{inspect(value)}"
  end

  def custom(details \\ nil), do: reserved_error({:web}, :custom, details)
  def default(details \\ nil), do: reserved_error({:web}, :default, details)

  def gate_unknown(details \\ nil),
    do: reserved_error({:cms, :gate}, :gate_unknown, details)

  defp reserved_error(namespace, reason, details) do
    definition = definition(namespace, reason)
    struct(Error, Map.put(definition, :details, details))
  end
end
