defmodule GroupherServer.CMS.ContentImport.Query do
  @moduledoc """
  Read-side projection boundaries for Content Import lifecycle state.

      Assets maintenance -> ContentImport.Query -> active import community ids
  """

  import Ecto.Query

  alias GroupherServer.CMS
  alias CMS.ContentImport.Model.Job

  @doc "Returns community ids protected by an active Content Import job."
  @spec active_community_ids() :: Ecto.Query.t()
  def active_community_ids do
    from(job in Job,
      where: job.status in [:staging, :ready, :applying],
      select: job.community_id
    )
  end
end
