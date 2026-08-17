defmodule GroupherServer.CMS.Gate.Decision do
  @moduledoc """
  Structured Gate admission result.

  `allow/1` is an internal success-state constructor used only while
  `access_check/3` builds its control-flow Decision. It is never an external
  success protocol: a successful Gate access check returns `{:ok, resource}`.

  Gate access checks consume a Decision so command boundaries retain a stable
  primary code, its owning domain, retry semantics, and safe user-action hints.

      loaded resource command
        -> Gate.Access.decision/4
      -> Decision
      -> GraphQL / API adapter
  """

  @type violation :: %{
          required(:code) => atom(),
          required(:source) => atom(),
          required(:retryable) => boolean(),
          required(:actions) => [atom()]
        }

  @type t :: %__MODULE__{
          allowed: boolean(),
          context: map(),
          primary: violation() | nil,
          violations: [violation()]
        }

  @enforce_keys [:allowed, :context, :primary, :violations]
  defstruct [:allowed, :context, :primary, :violations]

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

  @doc false
  @spec allow(map()) :: t()
  def allow(context \\ %{}),
    do: %__MODULE__{allowed: true, context: context, primary: nil, violations: []}

  @spec deny(atom() | [atom()], map()) :: t()
  def deny(reasons, context \\ %{}) do
    violations = reasons |> List.wrap() |> Enum.uniq() |> Enum.map(&violation/1)

    %__MODULE__{
      allowed: false,
      context: context,
      primary: Enum.min_by(violations, &priority/1, fn -> violation(:permission_denied) end),
      violations: violations
    }
  end

  @spec from_result({:ok, true} | {:error, atom()}, map()) :: t()
  def from_result({:ok, true}, context), do: allow(context)
  def from_result({:error, reason}, context) when is_atom(reason), do: deny(reason, context)

  @spec primary_code(t()) :: atom()
  def primary_code(%__MODULE__{allowed: true}), do: :ok
  def primary_code(%__MODULE__{primary: %{code: code}}), do: code

  @doc "Builds the safe, stable payload shared by GraphQL and other API adapters."
  @spec public_error(t()) :: %{
          required(:actions) => [String.t()],
          required(:code) => String.t(),
          required(:message) => String.t(),
          required(:retryable) => boolean()
        }
  def public_error(%__MODULE__{allowed: false, primary: primary}) do
    %{
      actions: Enum.map(primary.actions, &(&1 |> Atom.to_string() |> String.upcase())),
      code: primary.code |> Atom.to_string() |> String.upcase(),
      message: public_message(primary.code),
      retryable: primary.retryable
    }
  end

  @doc "Formats a denied Decision as an Absinthe-compatible resolver error."
  @spec graphql_error(t()) :: {:error, keyword()}
  def graphql_error(%__MODULE__{} = decision) do
    %{actions: actions, code: code, message: message, retryable: retryable} =
      public_error(decision)

    {:error,
     [
       message: message,
       extensions: %{actions: actions, code: code, retryable: retryable}
     ]}
  end

  defp priority(%{code: code}) do
    case Enum.find_index(@priority, &(&1 == code)) do
      nil -> length(@priority)
      index -> index
    end
  end

  defp violation(reason) do
    %{
      actions: actions(reason),
      code: reason,
      retryable: retryable?(reason),
      source: source(reason)
    }
  end

  defp source(reason) when reason in [:permission_denied, :unknown_action], do: :authorization

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
  defp source(_reason), do: :resource

  defp retryable?(:lifecycle_not_loaded), do: true
  defp retryable?(:doc_branch_required), do: true
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
  defp actions(:article_not_mutable), do: []
  defp actions(_reason), do: []

  defp public_message(reason)
       when reason in [
              :ancestor_community_not_writable,
              :ancestor_article_archived,
              :article_archived
            ],
       do: "当前内容处于只读状态。"

  defp public_message(reason)
       when reason in [
              :ancestor_article_deleted,
              :ancestor_article_destroyed,
              :article_deleted,
              :article_destroyed,
              :comment_deleted,
              :comment_destroyed,
              :resource_not_found
            ],
       do: "内容不可用。"

  defp public_message(:permission_denied), do: "当前账号没有执行此操作的权限。"
  defp public_message(:lifecycle_not_loaded), do: "当前状态正在更新，请稍后重试。"
  defp public_message(:doc_branch_required), do: "文档分支上下文缺失，请返回后重试。"
  defp public_message(:article_not_mutable), do: "当前内容不可执行此操作。"
  defp public_message(_reason), do: "当前操作暂不可执行。"
end
