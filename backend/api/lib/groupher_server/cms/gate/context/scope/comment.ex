defmodule GroupherServer.CMS.Gate.Context.Scope.Comment do
  @moduledoc """
  Explicit public discussion scope. Doc discussion belongs to the stable Article
  in its single owner Community, independently of the requested body branch.
  `all_public/0` supports both batch queries and one Comment lookup by ID when
  the caller must check public visibility across Communities.

      request Community + thread -> typed Comment scope -> Gate parent admission
  """
  alias GroupherServer.CMS
  alias CMS.Gate.Config
  @threads Config.article_threads()
  @enforce_keys [:thread, :policy_mode]
  defstruct [:thread, :policy_mode, :community_id]
  @type t :: %__MODULE__{thread: atom(), policy_mode: atom(), community_id: integer() | nil}

  @doc "Builds a Comment scope with an explicit Community for Doc discussion."
  def for_thread(thread, opts \\ []) when thread in @threads do
    community_id = Keyword.get(opts, :community_id)
    policy_mode = Keyword.get(opts, :policy_mode, :public)

    if Keyword.has_key?(opts, :branch_policy) or Keyword.has_key?(opts, :branch_id) do
      raise ArgumentError, "Comment scope does not accept body branch selectors"
    end

    if not is_integer(community_id) do
      raise ArgumentError, "Comment scope requires community_id"
    end

    unless policy_mode in [
             :public,
             :owner_management,
             :moderator_management,
             :operations
           ] do
      raise ArgumentError, "invalid Comment scope policy mode"
    end

    %__MODULE__{thread: thread, policy_mode: policy_mode, community_id: community_id}
  end

  @doc "Builds the explicit cross-thread public discussion scope."
  def all_public, do: %__MODULE__{thread: :all, policy_mode: :public}

  @doc "Scopes one graph-confirmed Comment by its own state, independently of parent body admission."
  def mentioned_target(thread, community_id)
      when thread in @threads and is_integer(community_id) do
    %__MODULE__{thread: thread, policy_mode: :mentioned_target, community_id: community_id}
  end
end
