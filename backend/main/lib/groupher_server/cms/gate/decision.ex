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
      iex> {:error, :permission_denied} = {:error, primary_reason(decision)}
  """

  alias Helper.ErrorCode

  @type violation :: %{
          reason: atom(),
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
    :scope_policy_actor_mismatch
  ]

  @priority [
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
    :lifecycle_not_loaded
  ]

  @doc "Builds an allowed Decision with the supplied internal context."
  @spec allow(map()) :: t()
  def allow(context \\ %{}),
    do: %__MODULE__{allowed: true, context: context, primary: nil, violations: []}

  @doc "Builds a denied Decision from one or more internal reasons."
  @spec deny(atom() | [atom()], map()) :: t()
  def deny(reasons, context \\ %{}) do
    violations = reasons |> List.wrap() |> Enum.uniq() |> Enum.map(&metadata/1)

    %__MODULE__{
      allowed: false,
      context: context,
      primary: Enum.min_by(violations, &priority/1, fn -> metadata(:gate_unknown) end),
      violations: violations
    }
  end

  @doc "Converts a policy result into a structured Decision."
  @spec from_result(:ok | {:error, atom()}, map()) :: t()
  def from_result(:ok, context), do: allow(context)
  def from_result({:error, reason}, context) when is_atom(reason), do: deny(reason, context)

  @doc "Returns the selected primary reason, or `:ok` for an allowed Decision."
  @spec primary_reason(t()) :: atom()
  def primary_reason(%__MODULE__{allowed: true}), do: :ok
  def primary_reason(%__MODULE__{primary: %{reason: reason}}), do: reason

  defp metadata(reason) do
    reason = if reason in @known_reasons, do: reason, else: :gate_unknown

    %{
      reason: reason,
      err_code: ErrorCode.ecode(reason),
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
