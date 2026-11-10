defmodule GroupherServer.CMS.Articles.WorkingCopy.Access do
  @moduledoc """
  Resolves editing admission through the canonical Gate, with Doc branch context when needed.

      Article + Community + actor/action -> Gate or Doc branch access -> admission result
  """

  alias GroupherServer.CMS
  alias CMS.Model.{Article, Community}

  def access_check(
        actor,
        action,
        %Article{thread: :doc, id: article_id},
        %Community{} = community
      ) do
    with {:ok, branch} <- CMS.Docs.Branch.resolve(community, nil) do
      CMS.Gate.access_check(actor, action, %{
        id: article_id,
        thread: :doc,
        community: community,
        branch_id: branch.id
      })
    end
  end

  def access_check(actor, action, %Article{} = article, %Community{} = community) do
    CMS.Gate.access_check(actor, action, %{
      id: article.id,
      thread: article.thread,
      community: community
    })
  end

  def check_in_transaction(
        actor,
        action,
        %Article{thread: :doc} = article,
        %Community{} = community
      ) do
    with {:ok, branch} <- CMS.Docs.Branch.resolve(community, nil) do
      CMS.Gate.check_in_transaction(actor, action, article, community, branch.id)
    end
  end

  def check_in_transaction(actor, action, %Article{} = article, %Community{} = community) do
    CMS.Gate.check_in_transaction(actor, action, article, community)
  end
end
