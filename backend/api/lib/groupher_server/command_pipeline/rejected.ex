defmodule GroupherServer.CommandPipeline.Rejected do
  @moduledoc """
  Marks a business operation as explicitly rejected by a pipeline stage.

  This marker is intentionally separate from ordinary errors. The runner uses
  it to decide whether the pipeline's rejection builder may run, while the
  wrapped error remains the public error returned to the caller.

      pipeline stage -> Rejected marker -> runner rejection audit -> original error
  """

  @enforce_keys [:code, :error]
  defstruct [:code, :error]

  @type t :: %__MODULE__{code: atom(), error: term()}

  @doc """
  Marks an error as an explicit business rejection so the runner may invoke the rejection handler.

  The wrapped error is still returned to the caller after rejection handling.

  ## Examples

      Rejected.new(:policy_rejected, CMS.Gate.ErrorCat.permission_denied())
  """
  @spec new(atom(), term()) :: t()
  def new(code, error) when is_atom(code), do: %__MODULE__{code: code, error: error}

  @doc "Returns the wrapped rejection error, or the original value when it was not marked."
  @spec unwrap(term()) :: term()
  def unwrap(%__MODULE__{error: error}), do: error
  def unwrap(error), do: error
end
