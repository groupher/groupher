defmodule GroupherServer.CMS.Articles.WorkingCopy.Access do
  @moduledoc """
  Resolves editing admission through the canonical Gate, with Doc branch context when needed.

      Article + Community + actor/action -> Gate or Doc branch access -> admission result
  """

  alias GroupherServer.CMS
  alias CMS.Model.{Article, ArticleWorkingCopy, Community}

  @doc "Rejects generic writes to Docs-managed workspace copies."
  def generic_save(%Article{thread: :doc, id: article_id}, %ArticleWorkingCopy{} = work) do
    if work.scope_kind == :default and work.scope_id == article_id do
      {:ok, :pass}
    else
      {:error, CMS.ErrorCat.docs_managed_content()}
    end
  end

  def generic_save(%Article{}, %ArticleWorkingCopy{}), do: {:ok, :pass}

  @doc "Rejects generic deletion of all Doc copies, including the protected default."
  def generic_delete(%Article{thread: :doc}), do: {:error, CMS.ErrorCat.docs_managed_content()}
  def generic_delete(%Article{}), do: {:ok, :pass}

  @doc "Rejects generic Doc Snapshot fork and publication; Docs owns these operations."
  def generic_snapshot_mutation(%Article{thread: :doc}),
    do: {:error, CMS.ErrorCat.docs_managed_content()}

  def generic_snapshot_mutation(%Article{}), do: {:ok, :pass}

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
      |> normalize_decision()
    end
  end

  def access_check(actor, action, %Article{} = article, %Community{} = community) do
    CMS.Gate.access_check(actor, action, %{
      id: article.id,
      thread: article.thread,
      community: community
    })
    |> normalize_decision()
  end

  defp normalize_decision({:error, %CMS.Gate.Decision{} = decision}) do
    {:error, CMS.Gate.Decision.primary_error(decision)}
  end

  defp normalize_decision(result), do: result

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
