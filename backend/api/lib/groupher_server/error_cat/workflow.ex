defmodule GroupherServer.ErrorCat.Workflow do
  @moduledoc """
  Global ErrorCat registry and lookup API.

  Contexts own declarations; this module owns only the global namespace/range
  contract, reserved definitions, cross-catalog validation, and standard error
  formatting for protocol boundaries such as GraphQL.

  Context catalog -> global registry and validation -> protocol error.

  For example, `valid?(Accounts.Profiles.ErrorCat.not_exist())` checks the
  generated entry against its registered namespace, reason, and transport code.
  `definition/2` is an introspection API and raises for an undeclared pair;
  `declared?/2` is the non-raising membership check.
  """

  alias GroupherServer.ErrorCat
  alias ErrorCat.{Error, Registry, Validator}

  @ranges %{
    {:web} => 4000..4199,
    {:pagi} => 4200..4299,
    {:account, :authentication} => 4300..4349,
    {:cms, :passport} => 4350..4399,
    {:cms, :comment} => 4400..4499,
    {:cms} => 4500..4599,
    {:cms, :gate} => 4600..4699,
    {:account, :collection} => 4700..4799,
    {:account, :fans} => 4800..4899,
    {:cms, :interaction} => 4900..4919,
    {:cms, :view_tracker} => 4920..4949,
    {:cms, :community} => 5500..5599,
    {:cms, :asset} => 5600..5699,
    {:cms, :wallpaper} => 5700..5799,
    {:cms, :article} => 6000..6099,
    {:activity} => 6100..6199,
    {:messaging, :notification} => 6200..6249,
    {:account, :profile_view_tracker} => 6250..6299,
    {:review_bot, :check} => 7400..7499
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
    GroupherServer.Pagi.ErrorCat,
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
    GroupherServer.CMS.Wallpaper.ErrorCat,
    GroupherServer.CMS.Articles.ErrorCat,
    GroupherServer.CMS.ViewTracker.ErrorCat,
    GroupherServer.Accounts.ProfileViewTracker.ErrorCat,
    GroupherServer.Activity.ErrorCat,
    GroupherServer.Messaging.ErrorCat,
    GroupherServer.ReviewBot.ErrorCat
  ]

  @doc "Returns the namespace-to-code-range registry used by ErrorCat validation."
  @spec ranges() :: %{tuple() => Range.t()}
  def ranges, do: @ranges

  @doc "Returns the reserved error definitions outside ordinary context catalogs."
  @spec reserved() :: [map()]
  def reserved, do: @reserved

  @doc "Returns the context-owned catalogs registered with the global ErrorCat system."
  @spec catalogs() :: [module()]
  def catalogs, do: @catalogs

  @doc "Validates all registered catalog entries and their namespace/code ranges."
  @spec validate!() :: {:ok, :pass}
  def validate!, do: Validator.validate!(@ranges, @reserved, @catalogs)

  @doc "Returns the registered definition for one structured error or raises if absent."
  @spec definition(Error.t()) :: map()
  def definition(%Error{namespace: namespace, reason: reason}) do
    definition(namespace, reason)
  end

  @doc "Returns the registered definition for a namespace/reason pair or raises if absent."
  @spec definition(tuple(), atom()) :: map()
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

  @doc "Checks whether a namespace/reason pair is declared without raising on invalid input."
  @spec declared?(term(), term()) :: boolean()
  def declared?(namespace, reason) when is_tuple(namespace) and is_atom(reason) do
    match?(%{}, Registry.find(@catalogs, namespace, reason)) or
      Enum.any?(@reserved, &(&1.namespace == namespace and &1.reason == reason))
  end

  def declared?(_, _), do: false

  @doc "Checks that an ErrorCat struct exactly matches its registered definition."
  @spec valid?(term()) :: boolean()
  def valid?(%Error{} = error) do
    definition = definition(error.namespace, error.reason)

    Enum.all?([:namespace, :reason, :code, :retryable, :actions, :message_key], fn field ->
      Map.fetch!(definition, field) == Map.fetch!(error, field)
    end)
  rescue
    ArgumentError -> false
  end

  def valid?(_), do: false

  @doc "Returns the protocol code carried by a structured ErrorCat error."
  @spec code(Error.t()) :: pos_integer()
  def code(%Error{code: code}), do: code

  @doc """
  Validates an ErrorCat error and converts it to the GraphQL boundary's message/code tuple.

  The Web `ErrorResponse` adapter owns the public GraphQL payload; this helper
  does not serialize Decision metadata or expose arbitrary error details.
  """
  @spec gq_format(Error.t() | {:error, Error.t()}) :: {:error, keyword()}
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

  @doc "Builds the reserved generic custom error with optional diagnostic details."
  @spec custom(term()) :: Error.t()
  def custom(details \\ nil), do: reserved_error({:web}, :custom, details)

  @doc "Builds the reserved generic default error with optional diagnostic details."
  @spec default(term()) :: Error.t()
  def default(details \\ nil), do: reserved_error({:web}, :default, details)

  @doc "Builds the reserved unknown-Gate error with optional diagnostic details."
  @spec gate_unknown(term()) :: Error.t()
  def gate_unknown(details \\ nil) do
    reserved_error({:cms, :gate}, :gate_unknown, details)
  end

  defp reserved_error(namespace, reason, details) do
    definition = definition(namespace, reason)
    struct(Error, Map.put(definition, :details, details))
  end
end
