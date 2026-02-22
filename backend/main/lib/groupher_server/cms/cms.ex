defmodule GroupherServer.CMS do
  @moduledoc """
  this module defined basic method to handle [CMS] content [CRUD] ..
  [CMS]: post, job, ...
  [CRUD]: create, update, delete ...
  """
  alias GroupherServer.CMS.Delegate

  alias Delegate.{
    ThirdPart
  }

  # Community functions are now in CMS.Communities module
  # Use CMS.Communities.xxx directly

  # Comment functions moved to CMS.Comments module
  # Use CMS.Comments.xxx directly

  # AbuseReport functions moved to CMS.AbuseReports module
  # Use CMS.AbuseReports.xxx directly

  # Search functions moved to CMS.Search module
  # Use CMS.Search.xxx directly

  # defdelegate seed_bot, to: Seeds
  defdelegate upload_tokens(), to: ThirdPart
end
