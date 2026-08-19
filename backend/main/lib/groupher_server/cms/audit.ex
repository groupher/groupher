defmodule GroupherServer.CMS.Audit do
  @moduledoc """
  Append-only write and read boundary for important CMS operations.

  Audit records accountability only. Trash and restore logic must never read
  this table as recovery state.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Audit
        -> Repo / external boundary
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Audit.Actions
  alias GroupherServer.CMS.Model.{AuditLog, Community}
  alias Helper.{ORM, T}

  @spec record(String.t(), map()) :: {:ok, AuditLog.t()} | {:error, term()}
  @doc "Runs `record` through the public `Audit` boundary."
  def record(action, attrs) when is_binary(action) and is_map(attrs) do
    if Actions.valid?(action) do
      {actor, attrs} = Map.pop(attrs, :actor)

      attrs =
        attrs
        |> Map.put(:action, action)
        |> Map.put_new(:occurred_at, DateTime.utc_now(:second))
        |> Map.put_new(:source, "api")
        |> Map.merge(actor_attrs(actor))

      ORM.create(AuditLog, attrs)
    else
      {:error, GroupherServer.ErrorCat.custom("unknown CMS audit action: #{action}")}
    end
  end

  @spec get(Ecto.UUID.t()) :: T.domain_res(AuditLog.t())
  @doc "Runs `get` through the public `Audit` boundary."
  def get(hash_id), do: ORM.find_by(AuditLog, hash_id: hash_id)

  @spec list(Community.t(), map()) :: T.domain_res(map())
  @doc "Runs `list` through the public `Audit` boundary."
  def list(%Community{} = community, filter \\ %{}) do
    page = Map.get(filter, :page, 1)
    size = Map.get(filter, :size, 20)

    AuditLog
    |> where([log], log.community_id == ^community.id)
    |> maybe_filter(:action, Map.get(filter, :action))
    |> maybe_filter(:resource_type, Map.get(filter, :resource_type))
    |> order_by([log], desc: log.occurred_at, desc: log.id)
    |> ORM.paginator(page: page, size: size)
    |> then(&{:ok, &1})
  end

  defp actor_attrs(%User{} = actor) do
    %{
      actor_type: "user",
      actor_id: actor.id,
      actor_snapshot: %{
        login: actor.login,
        nickname: actor.nickname,
        avatar: actor.avatar
      }
    }
  end

  defp actor_attrs(_actor), do: %{actor_type: "system", actor_id: nil, actor_snapshot: %{}}

  defp maybe_filter(query, _field, nil), do: query
  defp maybe_filter(query, field, value), do: where(query, [log], field(log, ^field) == ^value)
end
