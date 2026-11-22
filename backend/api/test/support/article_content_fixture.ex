defmodule GroupherServer.Test.ArticleContentFixture do
  @moduledoc """
  Sets up content tests independently of retired Docs Branch initialization.

      Community core + lifecycle + root moderator -> real Article commands -> content fixture

  This is not an acceptance fixture for the production Community create workflow.
  """
  alias GroupherServer.{CMS, Repo, ReviewBot, Support}
  alias Support.Factory
  alias CMS.Model.{CommunityDashboard, Embeds}

  @doc "Creates the admission prerequisites without initializing the retired DocTree."
  def community(actor, attrs \\ %{}) do
    Repo.transact(fn ->
      values =
        Factory.mock_attrs(:community)
        |> Map.merge(attrs)
        |> Map.merge(%{
          meta: Embeds.CommunityMeta.default_meta(),
          dashboard: CommunityDashboard.default()
        })

      with {:ok, community} <- CMS.Communities.CreationPersist.create_core(values, actor),
           {:ok, _} <- CMS.Communities.Lifecycle.ensure_created(community.id),
           {:ok, _} <- ReviewBot.create_default_configs_for_community(community.id),
           {:ok, _} <- CMS.Communities.Moderators.Setup.add_root(community, actor) do
        {:ok, community}
      end
    end)
  end

  @doc "Creates a published ordinary Article through the real content commands."
  def article(thread) do
    {:ok, actor} = Factory.db_insert(:user)
    {:ok, community} = community(actor)
    article(thread, community, actor)
  end

  def article(thread, community, actor) do
    attrs = Factory.mock_attrs(thread, %{community_id: community.id, author: %{user: actor}})
    {:ok, public} = Factory.create_published_article(community, thread, attrs, actor)
    {community, public, attrs, actor}
  end
end
