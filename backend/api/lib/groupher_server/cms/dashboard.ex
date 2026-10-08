defmodule GroupherServer.CMS.Dashboard do
  @moduledoc """
  Public CMS boundary for persisted community dashboard settings and theme presets.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Dashboard
        -> Repo / external boundary
  """

  alias GroupherServer.CMS

  alias CMS.Dashboard.Commands.{SaveCustomThemePreset, SelectThemePreset, UpdateSection}
  alias CMS.Communities.ErrorCat
  alias CMS.Model.{Community, CommunityDashboard}
  alias Helper.T

  @doc """
  Updates dashboard settings using the internal operations actor.

  ## Examples

      Dashboard.update(community, :seo, %{og_title: "Groupher"})
      #=> {:ok, %CommunityDashboard{}}
  """
  @spec update(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, args),
    do: update(community, args, :operations, Ecto.UUID.generate())

  @doc """
  Updates a dashboard section after the caller supplies its actor context.

  ## Examples

      Dashboard.update(community, %{dsb_section: :seo, og_title: "Groupher"}, actor)
      #=> {:ok, %CommunityDashboard{}}
  """
  @spec update(Community.t(), map(), term()) :: T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, %{dsb_section: _key} = args, actor),
    do: update(community, args, actor, Ecto.UUID.generate())

  def update(%Community{}, args, _actor) when is_map(args),
    do: {:error, ErrorCat.invalid_dsb_section()}

  @spec update(Community.t(), atom(), map() | list() | boolean()) ::
          T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, key, args) when is_atom(key),
    do: update(community, key, args, :operations, Ecto.UUID.generate())

  @doc "Updates one dashboard section with the caller-provided command identity."
  @spec update(Community.t(), map(), term(), Ecto.UUID.t()) ::
          T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, %{dsb_section: _key} = args, actor, command_id),
    do: UpdateSection.execute(community, Map.get(args, :dsb_section), args, actor, command_id)

  @doc false
  @spec update(Community.t(), atom(), map() | list() | boolean(), term()) ::
          T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, key, args, actor),
    do: update(community, key, args, actor, Ecto.UUID.generate())

  @doc false
  @spec update(Community.t(), atom(), map() | list() | boolean(), term(), Ecto.UUID.t()) ::
          T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, key, args, actor, command_id),
    do: UpdateSection.execute(community, key, args, actor, command_id)

  @doc """
  Saves a custom theme using the internal operations actor.

  ## Examples

      Dashboard.save_custom_theme_preset(community, %{theme_preset: :custom})
      #=> {:ok, %CommunityDashboard{}}
  """
  @spec save_custom_theme_preset(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def save_custom_theme_preset(%Community{} = community, args),
    do: save_custom_theme_preset(community, args, :operations, Ecto.UUID.generate())

  @doc """
  Saves a custom theme preset after actor admission.

  ## Examples

      Dashboard.save_custom_theme_preset(community, %{theme_preset: :custom}, actor)
      #=> {:ok, %CommunityDashboard{}}
  """
  @spec save_custom_theme_preset(Community.t(), map(), term()) ::
          T.domain_res(CommunityDashboard.t())
  def save_custom_theme_preset(%Community{} = community, args, actor),
    do: save_custom_theme_preset(community, args, actor, Ecto.UUID.generate())

  @doc "Saves a custom theme preset with the caller-provided command identity."
  @spec save_custom_theme_preset(Community.t(), map(), term(), Ecto.UUID.t()) ::
          T.domain_res(CommunityDashboard.t())
  def save_custom_theme_preset(%Community{} = community, args, actor, command_id),
    do: SaveCustomThemePreset.execute(community, args, actor, command_id)

  @doc """
  Selects a theme preset using the internal operations actor.

  ## Examples

      Dashboard.select_theme_preset(community, %{theme_preset: :hn})
      #=> {:ok, %CommunityDashboard{}}
  """
  @spec select_theme_preset(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def select_theme_preset(%Community{} = community, args),
    do: select_theme_preset(community, args, :operations, Ecto.UUID.generate())

  @doc """
  Selects a theme preset after actor admission.

  ## Examples

      Dashboard.select_theme_preset(community, %{theme_preset: :hn}, actor)
      #=> {:ok, %CommunityDashboard{}}
  """
  @spec select_theme_preset(Community.t(), map(), term()) ::
          T.domain_res(CommunityDashboard.t())
  def select_theme_preset(%Community{} = community, args, actor),
    do: select_theme_preset(community, args, actor, Ecto.UUID.generate())

  @doc "Selects a theme preset with the caller-provided command identity."
  @spec select_theme_preset(Community.t(), map(), term(), Ecto.UUID.t()) ::
          T.domain_res(CommunityDashboard.t())
  def select_theme_preset(%Community{} = community, args, actor, command_id),
    do: SelectThemePreset.execute(community, args, actor, command_id)
end
