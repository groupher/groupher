defmodule GroupherServer.CMS.Review.Effects do
  @moduledoc """
  Enqueues durable AI review work from a CMS-owned request transaction.

  Business position:

      CMS ArtimentReview -> Review Effects -> Outbox event -> Oban worker
  """

  alias GroupherServer.CMS
  alias CMS.Model.ArtimentReview

  @doc "Writes the request's reliable review event in the caller-owned transaction."
  @spec enqueue_artiment_review(ArtimentReview.t()) :: {:ok, struct()} | {:error, term()}
  def enqueue_artiment_review(%ArtimentReview{id: request_id}) do
    CMS.Outbox.send(%{
      event: "cms.artiment_review",
      worker: GroupherServer.Jobs.CMSArtimentReview,
      resource_type: "artiment_review",
      resource_id: request_id,
      identity: {:workflow, "review-request:#{request_id}"},
      effect_key: "review-request:#{request_id}",
      data: %{"request_id" => request_id}
    })
  end
end
