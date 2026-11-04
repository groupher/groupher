defmodule GroupherServer.CMS.ProductionSeed.MapFailure do
  @moduledoc """
  Exercises the real rebuild failure manifest for the run-owned CM source.

      admitted run -> transaction-local malformed Comment BodyBag -> real rebuild
                   -> rollback all database writes -> persistent failure evidence

  The malformed body is never committed or visible to public readers. No Mention
  facts, publication revisions, constraints or global keys are fabricated. The
  ordinary rebuild retry is deliberately left to the operator after inspection
  and the restart persistence check.
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.ArtimentMentions.Rebuild
  alias CMS.ProductionSeed.Workflow
  alias CMS.Model.CommentBody

  @doc "Injects one recoverable failure, retaining only its on-disk manifest."
  def inject(run_id, database) do
    with {:ok, _} <- Workflow.admit(database) do
      result =
        Repo.transaction(fn ->
          Workflow.advisory_lock!()
          run = Workflow.lock!(run_id)
          comment_id = get_in(run.manifest, ["resources", "CM", "commentId"])

          unless is_integer(comment_id) do
            Repo.rollback(:seed_comment_required)
          end

          owned = Map.values(run.manifest["resources"] || %{})

          unless Enum.all?(Rebuild.sources(), fn {locator, _} ->
                   Enum.any?(owned, fn resource ->
                     if locator[:comment_id] do
                       resource["commentId"] == locator[:comment_id]
                     else
                       resource["articleId"] == locator[:article_id]
                     end
                   end)
                 end) do
            Repo.rollback(:seed_foreign_map_source)
          end

          path = Rebuild.default_manifest()

          unless Rebuild.report_all().issues == [] do
            Repo.rollback(:seed_map_not_healthy)
          end

          {1, _} =
            Repo.update_all(from(b in CommentBody, where: b.comment_id == ^comment_id),
              set: [json: "{"]
            )

          after_key = Rebuild.key(%{type: :comment, comment_id: comment_id - 1})
          report = Rebuild.apply(after_key, 1, true, path)
          expected = Rebuild.key(%{type: :comment, comment_id: comment_id})

          unless Enum.map(report.failures, & &1["source_key"]) == [expected] and
                   report.checkpoint == expected do
            Repo.rollback(:seed_unexpected_failure_set)
          end

          Repo.rollback({:seed_injected_failure, report})
        end)

      case result do
        {:error, {:seed_injected_failure, report}} -> {:ok, report}
        {:error, reason} -> {:error, reason}
      end
    end
  end
end
