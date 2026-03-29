defmodule GroupherServer.CMS.CanCan do
  @moduledoc """
  Top-level facade for CMS policy checks.

  This module exists to keep policy decisions out of individual CMS domains
  such as `CMS.Articles` and `CMS.Comments`.

  Design intent:
  - `FrontDesk` prepares runtime context such as community, dashboard, thread, article, comment.
  - `CMS.CanCan` validates whether a capability is allowed in that context.
  - CMS domains execute the actual read/write logic after the check passes.

  Current implementation delegates community-scoped decisions to
  `CMS.CanCan.Communities`.

  Example:

      iex> CMS.CanCan.allow_thread(community, :post)
      {:ok, :post}

      iex> CMS.CanCan.allow_emotion(community.slug, :comment, :post, :beer)
      {:ok, :post_comment}

      iex> CMS.CanCan.allow_emotion(community.slug, :comment, :post, :upvote)
      {:error, :emotion_not_allowed}
  """

  alias GroupherServer.CMS.CanCan.Communities

  @type scope :: :article | :comment

  @spec allow_thread(map() | String.t() | nil, atom() | String.t()) ::
          {:ok, atom()} | {:error, atom()}
  def allow_thread(community, thread), do: Communities.allow_thread(community, thread)

  @spec allow_emotion(String.t() | nil, scope(), atom() | String.t(), atom()) ::
          {:ok, atom()} | {:error, atom()}
  def allow_emotion(community, scope, thread, emotion) do
    Communities.allow_emotion(community, scope, thread, emotion)
  end
end
