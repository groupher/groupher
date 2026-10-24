defmodule GroupherServer.CMS.Outbox.Workflow do
  @moduledoc """
  Owns post-commit delivery of CMS outbox events.

      Oban worker
        -> Outbox.Workflow dispatch by event owner
        -> Outbox.execute lease / fencing
        -> domain Effects
        -> complete, retry, snooze, or terminal failure
  """

  alias __MODULE__.{Article, Asset, Comment, Community, Interaction, Press, ArtimentReview}

  @doc "Dispatches one claimed CMS outbox job to its domain delivery workflow."
  @spec perform(atom(), Oban.Job.t()) :: Oban.Worker.result()
  def perform(:article, job), do: Article.perform(job)
  def perform(:asset, job), do: Asset.perform(job)
  def perform(:comment, job), do: Comment.perform(job)
  def perform(:community, job), do: Community.perform(job)
  def perform(:interaction, job), do: Interaction.perform(job)
  def perform(:press, job), do: Press.perform(job)
  def perform(:artiment_review, job), do: ArtimentReview.perform(job)
end
