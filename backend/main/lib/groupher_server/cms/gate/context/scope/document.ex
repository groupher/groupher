defmodule GroupherServer.CMS.Gate.Context.Scope.Document do
  @moduledoc """
  Explicit read intent for ArticleDocument aggregate queries.

  It mirrors Article/Doc stage and branch semantics while keeping the
  ArticleDocument root schema distinct from Article rows.

      Reader -> Document scope context -> Gate.scope -> Document compiler

  Examples:

      iex> %__MODULE__{thread: :post, stage: :public} = public(:post)
      iex> %__MODULE__{thread: :doc, branch_policy: :main} = public_main()
  """

  @modes [:public, :owner_management, :moderator_management, :operations]
  @enforce_keys [:thread, :stage, :policy_mode]
  defstruct [:thread, :stage, :policy_mode, :branch_id, :branch_policy]

  @type t :: %__MODULE__{
          thread: atom(),
          stage: :public | :draft,
          policy_mode: atom(),
          branch_id: integer() | nil,
          branch_policy: :main | nil
        }

  @doc "Builds a public ArticleDocument read intent for an ordinary thread."
  def public(thread) when thread in [:post, :blog, :changelog],
    do: %__MODULE__{thread: thread, stage: :public, policy_mode: :public}

  @doc "Builds a public ArticleDocument read intent for the Doc main branch."
  def public_main,
    do: %__MODULE__{thread: :doc, stage: :public, policy_mode: :public, branch_policy: :main}

  @doc "Builds a public ArticleDocument read intent for a concrete Doc branch."
  def public_branch(branch_id),
    do: %__MODULE__{thread: :doc, stage: :public, policy_mode: :public, branch_id: branch_id}

  @doc "Builds a management-scoped draft ArticleDocument read intent."
  def draft(thread_or_branch, policy_mode \\ :owner_management) do
    unless policy_mode in @modes and policy_mode != :public do
      raise ArgumentError, "draft Document scope requires a management policy mode"
    end

    case thread_or_branch do
      branch_id when is_integer(branch_id) ->
        %__MODULE__{thread: :doc, stage: :draft, policy_mode: policy_mode, branch_id: branch_id}

      thread when thread in [:post, :blog, :changelog] ->
        %__MODULE__{thread: thread, stage: :draft, policy_mode: policy_mode}
    end
  end
end
