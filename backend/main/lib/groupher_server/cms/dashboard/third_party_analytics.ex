defmodule GroupherServer.CMS.Dashboard.ThirdPartyAnalytics do
  @moduledoc """
  Provider registry and validation rules for community third-party analytics.

  Dashboard reads provider definitions from this module through GraphQL, while
  persistence and public rendering reuse the same registry so provider support
  is not maintained independently in multiple layers.
  """

  import Ecto.Changeset

  @max_value_length 255

  @providers [
    %{
      provider: "ga",
      title: "dsb.third_part.ga.title",
      desc: "dsb.third_part.ga.desc",
      detail: "dsb.third_part.ga.detail",
      docs_url: "https://developers.google.com/analytics",
      icon: "/integrations/ga.png",
      identity_field: "measurementId",
      config_fields: [
        %{
          key: "measurementId",
          label: "dsb.third_part.ga.track_label",
          desc: "dsb.third_part.ga.track_desc",
          placeholder: "dsb.third_part.ga.placeholder",
          required_when_enabled: true,
          pattern: "^G-[A-Za-z0-9-]+$"
        }
      ]
    },
    %{
      provider: "gtm",
      title: "dsb.third_part.gtm.title",
      desc: "dsb.third_part.gtm.desc",
      detail: "dsb.third_part.gtm.detail",
      docs_url: "https://developers.google.com/tag-platform/tag-manager",
      icon: "/integrations/gtm.png",
      identity_field: "containerId",
      config_fields: [
        %{
          key: "containerId",
          label: "dsb.third_part.gtm.track_label",
          desc: "dsb.third_part.gtm.track_desc",
          placeholder: "dsb.third_part.gtm.placeholder",
          required_when_enabled: true,
          pattern: "^GTM-[A-Za-z0-9-]+$"
        }
      ]
    },
    %{
      provider: "clarity",
      title: "dsb.third_part.clarity.title",
      desc: "dsb.third_part.clarity.desc",
      detail: "dsb.third_part.clarity.detail",
      docs_url: "https://learn.microsoft.com/zh-cn/clarity/",
      icon: "/integrations/clarity.png",
      identity_field: "projectId",
      config_fields: [
        %{
          key: "projectId",
          label: "dsb.third_part.clarity.track_label",
          desc: "dsb.third_part.clarity.track_desc",
          placeholder: "dsb.third_part.clarity.placeholder",
          required_when_enabled: true,
          pattern: "^[A-Za-z0-9_-]+$"
        }
      ]
    },
    %{
      provider: "plausible",
      title: "dsb.third_part.plausible.title",
      desc: "dsb.third_part.plausible.desc",
      detail: "dsb.third_part.plausible.detail",
      docs_url: "https://plausible.io/docs",
      icon: "/integrations/plausible.png",
      identity_field: "domain",
      config_fields: [
        %{
          key: "domain",
          label: "dsb.third_part.plausible.track_label",
          desc: "dsb.third_part.plausible.track_desc",
          placeholder: "dsb.third_part.plausible.placeholder",
          required_when_enabled: true,
          pattern:
            "^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$"
        }
      ]
    },
    %{
      provider: "fathom",
      title: "dsb.third_part.fathom.title",
      desc: "dsb.third_part.fathom.desc",
      detail: "dsb.third_part.fathom.detail",
      docs_url: "https://usefathom.com/docs",
      icon: "/integrations/fathom.png",
      identity_field: "siteId",
      config_fields: [
        %{
          key: "siteId",
          label: "dsb.third_part.fathom.track_label",
          desc: "dsb.third_part.fathom.track_desc",
          placeholder: "dsb.third_part.fathom.placeholder",
          required_when_enabled: true,
          pattern: "^[A-Za-z0-9_-]+$"
        }
      ]
    }
  ]

  @provider_keys Enum.map(@providers, & &1.provider)

  def providers, do: @providers

  def provider_keys, do: @provider_keys

  def validate_provider(changeset) do
    changeset
    |> validate_inclusion(:provider, provider_keys())
    |> validate_lengths()
    |> validate_provider_config()
  end

  def enabled_valid_configs(configs) when is_list(configs) do
    configs
    |> Enum.filter(fn config -> Map.get(config, :enabled) end)
    |> Enum.filter(&valid_config?/1)
  end

  def enabled_valid_configs(_configs), do: []

  defp valid_config?(config) do
    config
    |> config.__struct__.changeset(Map.from_struct(config))
    |> Map.get(:valid?)
  end

  defp validate_lengths(changeset) do
    Enum.reduce(config_fields(), changeset, fn field, acc ->
      validate_length(acc, field, max: @max_value_length)
    end)
  end

  defp validate_provider_config(%{valid?: false} = changeset), do: changeset

  defp validate_provider_config(changeset) do
    if get_field(changeset, :enabled) do
      validate_enabled_provider_config(changeset, get_field(changeset, :provider))
    else
      changeset
    end
  end

  defp validate_enabled_provider_config(changeset, "ga") do
    validate_format(changeset, :measurement_id, ~r/^G-[A-Za-z0-9-]+$/)
  end

  defp validate_enabled_provider_config(changeset, "gtm") do
    validate_format(changeset, :container_id, ~r/^GTM-[A-Za-z0-9-]+$/)
  end

  defp validate_enabled_provider_config(changeset, "clarity") do
    validate_format(changeset, :project_id, ~r/^[A-Za-z0-9_-]+$/)
  end

  defp validate_enabled_provider_config(changeset, "plausible") do
    validate_format(
      changeset,
      :domain,
      ~r/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/
    )
  end

  defp validate_enabled_provider_config(changeset, "fathom") do
    validate_format(changeset, :site_id, ~r/^[A-Za-z0-9_-]+$/)
  end

  defp validate_enabled_provider_config(changeset, _provider), do: changeset

  defp config_fields do
    ~w(measurement_id container_id project_id domain site_id)a
  end
end
