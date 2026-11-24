defmodule GroupherServer.CMS.Import.Transaction do
  @moduledoc """
  Owns the transaction adapter used by Import staging and job setup.

  The actual multi-stage apply/retry workflow lives in
  `CMS.DocTree.Workflows.Import`; this module is only the reusable
  transaction seam for its bounded row operations.

      Import staging / job setup
        -> Import.Transaction
        -> Import Persist rows
        -> commit or rollback
  """

  alias GroupherServer.Repo

  @doc "Runs a Import operation in the current transaction or opens one."
  def run(fun) when is_function(fun, 0) do
    if Repo.in_transaction?() do
      {:ok, fun.()}
    else
      Repo.transaction(fun)
    end
  end
end
