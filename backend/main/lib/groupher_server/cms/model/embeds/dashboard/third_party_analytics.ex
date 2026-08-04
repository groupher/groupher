defmodule GroupherServer.CMS.Model.Embeds.Dashboard.ThirdPartyAnalytics do
  @moduledoc """
  Community-owned third-party analytics provider configuration.

  These values are normal browser-visible tracking identities, not provider API
  credentials. Validation delegates to the Dashboard provider registry so the
  provider list and field rules have a single backend source of truth.
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Dashboard.ThirdPartyAnalytics, as: ProviderRegistry

  @primary_key false
  embedded_schema do
    field(:provider, :string)
    field(:enabled, :boolean, default: false)
    field(:measurement_id, :string, default: "")
    field(:container_id, :string, default: "")
    field(:project_id, :string, default: "")
    field(:domain, :string, default: "")
    field(:site_id, :string, default: "")
  end

  def default, do: []

  def changeset(struct, attrs) do
    struct
    |> cast(attrs, [
      :provider,
      :enabled,
      :measurement_id,
      :container_id,
      :project_id,
      :domain,
      :site_id
    ])
    |> validate_required([:provider])
    |> ProviderRegistry.validate_provider()
  end
end
