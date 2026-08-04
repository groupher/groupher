defmodule GroupherServer.Jobs do
  @moduledoc """
  Application-facing facade for background jobs.

  Business modules should call this facade instead of `Oban.insert/2` directly.
  """

  alias GroupherServer.Jobs
  alias GroupherServer.Jobs.Codec
  alias GroupherServer.Jobs.Config

  @type later_job :: {module(), atom(), list()}

  @spec later(later_job()) :: {:ok, :pass}
  def later({mod, func, args} = job) when is_atom(mod) and is_atom(func) and is_list(args) do
    if Config.skip_enqueue?() do
      {:ok, :pass}
    else
      %{job: Codec.encode(job)}
      |> Jobs.Later.new()
      |> insert_pass()
    end
  end

  @spec search_index(atom(), atom(), term()) :: {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def search_index(action, thread, ref) when is_atom(action) and is_atom(thread) do
    if Config.skip_enqueue?() do
      {:ok, :pass}
    else
      %{action: Atom.to_string(action), thread: Atom.to_string(thread), ref: ref}
      |> Jobs.SearchIndex.new()
      |> Oban.insert()
    end
  end

  @spec snapshot_refresh(atom(), term(), keyword()) :: {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def snapshot_refresh(kind, refs, opts) when is_atom(kind) and is_list(opts) do
    if Config.skip_enqueue?() do
      {:ok, :pass}
    else
      %{kind: Atom.to_string(kind), refs: Codec.encode(refs), opts: Codec.encode(opts)}
      |> Jobs.SnapshotRefresh.new()
      |> Oban.insert()
    end
  end

  defp insert_pass(changeset) do
    case Oban.insert(changeset) do
      {:ok, _job} -> {:ok, :pass}
      {:error, _reason} -> {:ok, :pass}
    end
  rescue
    _ -> {:ok, :pass}
  end
end
