defmodule GroupherServer.CMS.Gate.Decision do
  @moduledoc """
  Structured Gate admission result.

  Decision aggregates internal policy reasons, removes duplicates, and selects
  one stable primary reason. It keeps only domain-level violation metadata;
  API formatting and localization belong to the Web boundary. Successful Gate
  access checks still return `{:ok, resource}`.

      loaded resource command
        -> Gate.Access private Decision conversion
        -> Decision
        -> Web GraphQL / API adapter

  Example:

      iex> decision = deny(:permission_denied)
      iex> {:error, error} = {:error, primary_error(decision)}
  """

  alias GroupherServer.ErrorCat
  alias GroupherServer.ErrorCat.Error

  @type violation :: %{
          reason: atom(),
          error: Error.t(),
          err_code: non_neg_integer(),
          source: atom(),
          retryable: boolean(),
          actions: [atom()]
        }

  @type t :: %__MODULE__{
          allowed: boolean(),
          context: map(),
          primary: violation() | nil,
          violations: [violation()]
        }

  @enforce_keys [:allowed, :context, :primary, :violations]
  defstruct [:allowed, :context, :primary, :violations]

  @known_reasons [
    :resource_not_found,
    :gate_resource_mismatch,
    :doc_branch_required,
    :lifecycle_not_found,
    :ancestor_community_not_writable,
    :ancestor_article_archived,
    :ancestor_article_deleted,
    :ancestor_article_destroyed,
    :article_archived,
    :article_deleted,
    :article_destroyed,
    :article_not_mutable,
    :comment_deleted,
    :comment_destroyed,
    :article_comments_locked,
    :permission_denied,
    :unknown_action,
    :lifecycle_not_loaded,
    :scope_root_mismatch,
    :scope_binding_conflict,
    :scope_context_missing,
    :unknown_policy_mode,
    :scope_policy_actor_mismatch,
    :unsupported_resource
  ]

  @priority [
    :resource_not_found,
    :unsupported_resource,
    :gate_resource_mismatch,
    :doc_branch_required,
    :lifecycle_not_found,
    :ancestor_community_not_writable,
    :ancestor_article_archived,
    :ancestor_article_deleted,
    :ancestor_article_destroyed,
    :article_archived,
    :article_deleted,
    :article_destroyed,
    :article_not_mutable,
    :comment_deleted,
    :comment_destroyed,
    :article_comments_locked,
    :permission_denied,
    :unknown_action,
    :lifecycle_not_loaded
  ]

  @doc "Builds an allowed Decision with the supplied internal context."
  @spec allow(map()) :: t()
  def allow(context \\ %{}),
    do: %__MODULE__{allowed: true, context: context, primary: nil, violations: []}

  @doc "Builds a denied Decision from one or more internal reasons."
  @spec deny(Error.t() | [Error.t()], map()) :: t()
  def deny(errors, context \\ %{}) do
    violations =
      errors
      |> List.wrap()
      |> Enum.uniq_by(fn error -> {error.namespace, error.reason} end)
      |> Enum.map(&metadata/1)

    %__MODULE__{
      allowed: false,
      context: context,
      primary: Enum.min_by(violations, &priority/1, fn -> metadata(ErrorCat.gate_unknown()) end),
      violations: violations
    }
  end

  @doc "Converts a policy result into a structured Decision."
  @spec from_result(:ok | {:error, Error.t()}, map()) :: t()
  def from_result(:ok, context), do: allow(context)

  def from_result({:error, %Error{} = error}, context), do: deny(error, context)

  @doc "Returns the selected primary reason, or `:ok` for an allowed Decision."
  @spec primary_reason(t()) :: atom()
  def primary_reason(%__MODULE__{allowed: true}), do: :ok
  def primary_reason(%__MODULE__{primary: %{reason: reason}}), do: reason

  @doc "Returns the selected declared ErrorCat value, or nil for an allowed Decision."
  @spec primary_error(t()) :: Error.t() | nil
  def primary_error(%__MODULE__{allowed: true}), do: nil
  def primary_error(%__MODULE__{primary: %{error: %Error{} = error}}), do: error

  defp metadata(%Error{} = error) do
    reason = if error.reason in @known_reasons, do: error.reason, else: :gate_unknown
    error = if reason == error.reason, do: error, else: ErrorCat.gate_unknown()

    %{
      reason: reason,
      error: error,
      err_code: error.code,
      source: source(reason),
      retryable: retryable?(reason),
      actions: actions(reason)
    }
  end

  defp priority(%{reason: reason}) do
    case Enum.find_index(@priority, &(&1 == reason)) do
      nil -> length(@priority)
      index -> index
    end
  end

  defp source(reason) when reason in [:permission_denied, :unknown_action],
    do: :authorization

  defp source(reason)
       when reason in [
              :doc_branch_required,
              :ancestor_community_not_writable,
              :ancestor_article_archived,
              :ancestor_article_deleted,
              :ancestor_article_destroyed,
              :article_archived,
              :article_deleted,
              :article_destroyed,
              :article_not_mutable,
              :comment_deleted,
              :comment_destroyed,
              :lifecycle_not_found,
              :lifecycle_not_loaded
            ],
       do: :lifecycle

  defp source(:article_comments_locked), do: :policy
  defp source(reason) when reason in [:scope_root_mismatch, :scope_binding_conflict], do: :scope
  defp source(:scope_context_missing), do: :scope
  defp source(:unknown_policy_mode), do: :scope
  defp source(:scope_policy_actor_mismatch), do: :scope
  defp source(_reason), do: :resource

  defp retryable?(reason) when reason in [:lifecycle_not_loaded, :doc_branch_required],
    do: true

  defp retryable?(_reason), do: false

  defp actions(reason)
       when reason in [
              :ancestor_community_not_writable,
              :ancestor_article_archived,
              :article_archived
            ],
       do: [:read_only_notice]

  defp actions(reason)
       when reason in [
              :ancestor_article_deleted,
              :ancestor_article_destroyed,
              :article_deleted,
              :article_destroyed,
              :comment_deleted,
              :comment_destroyed,
              :resource_not_found
            ],
       do: [:return_to_list]

  defp actions(:permission_denied), do: [:show_permission_notice]
  defp actions(:lifecycle_not_loaded), do: [:retry]
  defp actions(:doc_branch_required), do: [:return_to_list]
  defp actions(_reason), do: []
end
