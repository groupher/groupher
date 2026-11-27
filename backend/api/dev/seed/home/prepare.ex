defmodule GroupherServer.Seed.Home.Prepare do
  @moduledoc """
  Prepares the shared local home dataset through the existing LiteHome seed.

      managed development admission -> serialized home preparation -> LiteHome
  """
  alias GroupherServer.{CMS, Repo}

  @doc "Prepares home once at a time; the shared implementation owns its transactions."
  def run(seed \\ &seed_home/0) when is_function(seed, 0) do
    Repo.checkout(fn ->
      %{rows: [[locked?]]} =
        Repo.query!("SELECT pg_try_advisory_lock(hashtextextended($1, 0))", ["local-seed-home"])

      if locked? do
        try do
          seed.()
        after
          Repo.query!("SELECT pg_advisory_unlock(hashtextextended($1, 0))", ["local-seed-home"])
        end
      else
        {:error, :local_seed_home_busy}
      end
    end)
  end

  defp seed_home do
    case CMS.Seeds.LiteHome.seed(command_id_factory: &Ecto.UUID.generate/0) do
      {:ok, community} ->
        {:ok,
         %{
           communityRef: community.ref,
           slug: community.slug
         }}

      {:error, _} = error ->
        error
    end
  end
end
