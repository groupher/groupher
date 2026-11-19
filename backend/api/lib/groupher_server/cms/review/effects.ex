defmodule GroupherServer.CMS.Review.Effects do
  @moduledoc """
  Enqueues durable AI review work from a CMS-owned request transaction.

  Business position:

      CMS ArtimentReview -> Review Effects -> Outbox event -> Oban worker
  """

  alias GroupherServer.CMS
  alias CMS.Model.ArtimentReview
  alias CMS.Outbox.DedupeKey

  @doc "Writes the request's reliable review event in the caller-owned transaction."
  @spec enqueue_artiment_review(ArtimentReview.t()) :: {:ok, struct()} | {:error, term()}
  def enqueue_artiment_review(%ArtimentReview{id: request_id, operation_ref: operation_ref}) do
    CMS.Outbox.send(%{
      event: "cms.artiment_review",
      worker: GroupherServer.Jobs.CMSArtimentReview,
      resource_type: "artiment_review",
      resource_id: request_id,
      operation_ref: operation_ref,
      dedupe_key: DedupeKey.encode([request_id]),
      data: %{"request_id" => request_id}
    })
  end
end
