defmodule GroupherServer.CMS.ContentImport.PayloadStore do
  @moduledoc """
  Durable storage contract for versioned Snapshot, Preparation, and Plan payloads.

  Database rows keep only bounded metadata and opaque refs. Implementations may
  use object storage or another durable blob service, but must never encode
  credentials into the returned ref.
  """

  @type namespace :: :snapshot | :doc_preparation | :plan
  @type ref :: String.t()

  @callback put(namespace(), String.t(), binary(), keyword()) ::
              {:ok, ref()} | {:error, term()}
  @callback get(ref(), keyword()) :: {:ok, binary()} | {:error, term()}
  @callback delete(ref(), keyword()) :: :ok | {:error, term()}
end
