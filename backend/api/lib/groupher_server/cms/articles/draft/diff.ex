defmodule GroupherServer.CMS.Articles.Draft.Diff do
  @moduledoc """
  Keeps legacy Draft callers on the current public-versus-WorkingCopy comparison implementation.

      legacy Draft comparison -> WorkingCopy.Diff -> saved Article content comparison
  """

  alias GroupherServer.CMS.Articles.WorkingCopy.Diff, as: WorkingCopyDiff
  alias GroupherServer.CMS.Model.Article

  def unpublished?(%Article{} = article), do: WorkingCopyDiff.unpublished?(article)
  def compare(%Article{} = article), do: WorkingCopyDiff.compare_public(article)
end
