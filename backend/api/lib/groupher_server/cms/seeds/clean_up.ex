defmodule GroupherServer.CMS.Seeds.CleanUp do
  @moduledoc """
  Cleanup helpers for seed data reset.

  Use this only from seed/setup flows where destructive cleanup is expected.

  Business position:

      Seed task
        -> CleanUp
        -> CMS context
        -> Repo
  """

  alias GroupherServer.CMS

  alias CMS.ErrorCat
  alias CMS.Model.Community
  alias Helper.T

  @doc """
  Deletes a community and its seeded post articles.

  The community is found by slug and removed together with its `:post` thread
  articles. Used by seed reset flows.

  ## Examples

      CMS.Seeds.CleanUp.community(:elixir)

  """
  @spec community(atom()) :: T.domain_res(Community.t())
  def community(slug) do
    CMS.Seeds.FullCommunity.delete(slug)
  end

  @spec articles(Community.t(), atom()) :: T.domain_res(:ok)
  def articles(%Community{} = community, _thread),
    do: CMS.Seeds.FullCommunity.delete(community.slug)

  def articles(_, _), do: {:error, ErrorCat.custom("community is required")}
end
