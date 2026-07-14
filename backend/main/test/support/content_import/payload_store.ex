defmodule GroupherServer.CMS.ContentImport.TestPayloadStore do
  @moduledoc false

  @behaviour GroupherServer.CMS.ContentImport.PayloadStore

  @impl true
  def put(namespace, key, binary, _opts) do
    ref = "memory://#{namespace}/#{key}"
    Process.put({__MODULE__, ref}, binary)
    {:ok, ref}
  end

  @impl true
  def get(ref, _opts) do
    case Process.get({__MODULE__, ref}) do
      binary when is_binary(binary) -> {:ok, binary}
      nil -> {:error, :payload_not_found}
    end
  end

  @impl true
  def delete(ref, _opts) do
    Process.delete({__MODULE__, ref})
    :ok
  end

  def corrupt(ref, binary) do
    Process.put({__MODULE__, ref}, binary)
    :ok
  end
end
