defmodule GroupherServer.CMS.Docs.Commands.PublishBranch do
  @moduledoc """
  Publishes one stable Doc branch and runs post-publish effects.

      Doc branch -> atomic publish -> public projection -> effects
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.Publish.Doc
  alias CMS.Docs.Editor
  alias CMS.Model.{Author, Community}

  @spec execute(Ecto.UUID.t(), pos_integer(), User.t() | Author.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def execute(doc_id, branch_id, actor, opts) when is_binary(doc_id) do
    opts =
      Keyword.put_new(
        opts,
        :workflow_ref,
        "doc-publish:#{doc_id}:#{branch_id}:#{Keyword.get(opts, :expected_draft_version, "unknown")}"
      )

    execute_pipeline(doc_id, branch_id, actor, opts)
  end

  @pipeline operation: :doc_publish_branch, target: :doc_id
  direct_pipeline execute_pipeline(doc_id, branch_id, actor, opts) do
    prepare(fn ->
      with {:ok, article} <- Editor.stable_doc(doc_id),
           {:ok, author} <- Editor.target_author(actor),
           {:ok, user} <- Editor.actor_user(actor),
           {:ok, community} <- branch_community(branch_id, opts) do
        {:ok, {article, author, user, community}}
      end
    end)

    gate(fn {article, author, user, community} ->
      with {:ok, canonical} <-
             CMS.Gate.check_in_transaction(user, :publish, article, community, branch_id) do
        {:ok, {canonical, author}}
      end
    end)

    change(fn {canonical, author} -> Doc.publish(canonical, branch_id, author, opts) end)
  end

  @doc "Publishes after an enclosing Command gate admitted the aggregate write."
  def publish_after_gate(doc_id, branch_id, actor, opts) when is_binary(doc_id) do
    with {:ok, article} <- Editor.stable_doc(doc_id),
         {:ok, author} <- Editor.target_author(actor),
         {:ok, _community} <- branch_community(branch_id, opts),
         true <-
           GroupherServer.Repo.in_transaction?() ||
             {:error, :pipeline_transaction_required} do
      Doc.publish(article, branch_id, author, opts)
    end
  end

  defp branch_community(branch_id, opts) do
    case Keyword.get(opts, :community) do
      %Community{} = community ->
        {:ok, community}

      _ ->
        with {:ok, %{community_id: community_id}} <- CMS.Docs.Store.branch_context(branch_id),
             {:ok, community} <- CMS.FrontDesk.community(community_id, mode: :internal) do
          {:ok, community}
        end
    end
  end
end
