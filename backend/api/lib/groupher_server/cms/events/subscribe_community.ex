defmodule GroupherServer.CMS.Events.SubscribeCommunity do
  @moduledoc """
  Auto-subscribes an interacting user to the target content's community.

  CMS emits this handler after qualifying interactions. It resolves comment
  parents when necessary and delegates the idempotent membership write to
  `CMS.Communities.subscribe_ifnot/2`.

  Business position:

      Domain write
        -> CMS.Events
        -> SubscribeCommunity
        -> bounded side effect
  """

  import Ecto.Query, warn: false

  alias GroupherServer.CMS

  alias CMS.Communities
  alias CMS.Events.Event
  alias CMS.FrontDesk
  alias CMS.Model.{Article, Comment, Community}

  @behaviour CMS.Events.Handler

  @type subscribe_result :: {:ok, struct()} | {:error, map()}
  @type handle_result :: {:ok, term()} | {:error, term()}

  @doc """
  Handles the `:subscribe_community` event, subscribing the interacting user to
  the target content's community unless the relationship already exists.

  Comment parents are resolved through their owning article before the
  idempotent membership write is delegated to `CMS.Communities.subscribe_ifnot/2`.
  """
  @spec handle(Event.t()) :: handle_result()
  @impl true
  def handle(%Event{type: :subscribe_community, payload: %{target: target, user: user}}) do
    handle(target, user)
  end

  @doc "Subscribes a user to a community unless the relationship already exists."
  @spec handle(Community.t(), map()) :: subscribe_result()
  def handle(%Community{} = community, user) do
    Communities.subscribe_ifnot(community, user)
  end

  @spec handle(Comment.t(), map()) :: subscribe_result()
  def handle(%Comment{article_id: article_id}, user) when is_binary(article_id) do
    with {:ok, article} <- comment_parent_article(article_id) do
      Communities.subscribe_ifnot(article.community, user)
    end
  end

  @spec comment_parent_article(Ecto.UUID.t()) :: {:ok, Article.t()} | {:error, map()}
  defp comment_parent_article(article_id) do
    FrontDesk.article(article_id, mode: :internal, view: :with_community)
  end
end
