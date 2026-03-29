defmodule GroupherServer.CMS.CanCan do
  @moduledoc """
  Top-level facade for CMS policy checks.

  This module exists to keep policy decisions out of individual CMS domains
  such as `CMS.Articles` and `CMS.Comments`.

  Design intent:
  - `FrontDesk` prepares runtime context such as community, dashboard, thread, article, comment.
  - `CMS.CanCan` answers whether a capability is allowed in that context.
  - CMS domains execute the actual read/write logic after the check passes.

  Current implementation delegates community-scoped decisions to
  `CMS.CanCan.Communities`.

  Example:

      iex> CMS.CanCan.thread_visible?(community, :post)
      true

      iex> CMS.CanCan.emotion_allowed?(community.slug, :comment, :post, :beer)
      true

      iex> CMS.CanCan.ensure_emotion_allowed(community.slug, :comment, :post, :upvote)
      {:error, :emotion_not_allowed}

  The `?` functions are boolean checks. `ensure_*` helpers are for write paths
  that need a standard error atom when a policy rejects the action.
  """

  alias GroupherServer.CMS.CanCan.Communities

  @type scope :: :article | :comment

  @spec thread_visible?(map(), atom() | String.t()) :: boolean()
  def thread_visible?(community, thread), do: Communities.thread_visible?(community, thread)

  @spec ensure_thread_visible(map() | String.t() | nil, atom() | String.t()) ::
          {:ok, atom()} | {:error, atom()}
  def ensure_thread_visible(community, thread), do: Communities.ensure_thread_visible(community, thread)

  @spec thread_mutable?(map(), atom() | String.t()) :: boolean()
  def thread_mutable?(community, thread), do: Communities.thread_mutable?(community, thread)

  @spec emotion_allowed?(String.t() | nil, scope(), atom() | String.t(), atom()) :: boolean()
  def emotion_allowed?(community, scope, thread, emotion) do
    Communities.emotion_allowed?(community, scope, thread, emotion)
  end

  @spec ensure_emotion_allowed(String.t() | nil, scope(), atom() | String.t(), atom()) ::
          {:ok, atom()} | {:error, atom()}
  def ensure_emotion_allowed(community, scope, thread, emotion) do
    Communities.ensure_emotion_allowed(community, scope, thread, emotion)
  end

  @spec community_frozen?(map()) :: boolean()
  def community_frozen?(community), do: Communities.community_frozen?(community)

  @spec publishable?(map(), atom() | String.t(), map() | nil) :: boolean()
  def publishable?(community, thread, user), do: Communities.publishable?(community, thread, user)

  @spec dashboard_updatable?(map(), map() | nil) :: boolean()
  def dashboard_updatable?(community, user), do: Communities.dashboard_updatable?(community, user)
end
