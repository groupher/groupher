defmodule GroupherServer.CMS.Press.Invalidation do
  @moduledoc """
  Sends best-effort Press cache invalidation after CMS transactions commit.

  Business position:

      CMS.Press / Press.ConfigWriter
        -> Press.Invalidation
        -> authenticated Press HTTP endpoint
  """

  require Logger

  alias GroupherServer.{CMS, Repo, ServiceAuth}

  alias CMS.Model.Community
  alias ServiceAuth.Client

  @doc "Notifies Press that one Community projection changed."
  @spec invalidate(Community.t() | String.t() | integer()) :: {:ok, :pass}
  def invalidate(%Community{slug: slug}), do: invalidate(slug)

  def invalidate(community_id) when is_integer(community_id) do
    case Repo.get(Community, community_id) do
      %Community{slug: slug} -> invalidate(slug)
      _ -> {:ok, :pass}
    end
  end

  def invalidate(slug) when is_binary(slug) do
    endpoint = System.get_env("PRESS_INTERNAL_URL")

    token =
      Client.token(
        System.get_env("PRESS_INTERNAL_RESOURCE") || "https://press.groupher.com/internal",
        ["press:cache:invalidate"]
      )

    if is_binary(endpoint) and endpoint != "" and match?({:ok, _}, token) do
      {:ok, token} = token

      case Req.post("#{String.trim_trailing(endpoint, "/")}/internal/invalidate",
             json: %{community: slug},
             headers: [{"authorization", "Bearer #{token}"}],
             receive_timeout: 5_000
           ) do
        {:ok, %{status: status}} when status in 200..299 -> {:ok, :pass}
        {:ok, %{status: status}} -> Logger.warning("Press invalidation returned HTTP #{status}")
        {:error, reason} -> Logger.warning("Press invalidation failed: #{inspect(reason)}")
      end
    end

    {:ok, :pass}
  end
end
