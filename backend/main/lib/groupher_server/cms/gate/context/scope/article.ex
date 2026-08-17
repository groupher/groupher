defmodule GroupherServer.CMS.Gate.Context.Scope.Article do
  @moduledoc """
  Explicit read intent for ordinary Article queries.

  Ordinary Articles carry a thread and stage but never a Doc branch selector.
  The compiler owns SQL visibility and actor validation.

      Reader -> Article scope context -> Gate.scope -> Article compiler

  Examples:

      iex> %__MODULE__{thread: :post, stage: :public} = public(:post)
      iex> %__MODULE__{thread: :post, stage: :draft} = draft(:post)
  """

  @threads [:post, :blog, :changelog]
  @modes [:public, :owner_management, :moderator_management, :operations]
  @enforce_keys [:thread, :stage, :policy_mode]
  defstruct [:thread, :stage, :policy_mode, include_illegal: false]

  @type t :: %__MODULE__{
          thread: atom(),
          stage: :public | :draft,
          policy_mode: atom(),
          include_illegal: boolean()
        }

  @doc "Builds a public Article read intent for a supported thread."
  def public(thread, opts \\ []) when thread in @threads,
    do: build(thread, :public, Keyword.get(opts, :policy_mode, :public), opts)

  @doc "Builds a management-scoped draft Article read intent."
  def draft(thread, policy_mode \\ :owner_management, opts \\ []) when thread in @threads do
    build(thread, :draft, policy_mode, opts)
  end

  @doc "Builds the default public read intent for a supported thread."
  def for_thread(thread, opts \\ []), do: public(thread, opts)

  defp build(thread, stage, policy_mode, opts) do
    unless policy_mode in @modes do
      raise ArgumentError, "invalid Article scope policy mode"
    end

    if stage == :draft and policy_mode == :public do
      raise ArgumentError, "draft Article scope requires a management policy mode"
    end

    %__MODULE__{
      thread: thread,
      stage: stage,
      policy_mode: policy_mode,
      include_illegal: Keyword.get(opts, :include_illegal, false)
    }
  end
end
