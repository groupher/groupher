defmodule GroupherServer.Analysis.Web.Community do
  @moduledoc """
  Route-derived analysis context for one community.
  """

  alias GroupherServer.CMS.Model.Community, as: CMSCommunity

  @type t :: %__MODULE__{community: String.t(), path_prefix: String.t()}

  defstruct [:community, :path_prefix]

  @doc """
  Builds the route-derived analytics scope for one CMS community.

  v1/v2 use one global Umami website, so community isolation is derived from the
  public route prefix rather than a per-community provider website ID.

  ## Example

      from_community(%GroupherServer.CMS.Model.Community{slug: "home"})
      #=> %GroupherServer.Analysis.Web.Community{community: "home", path_prefix: "/home"}

  """
  @spec from_community(CMSCommunity.t()) :: t()
  def from_community(%CMSCommunity{slug: slug}) when is_binary(slug) do
    %__MODULE__{community: slug, path_prefix: "/#{slug}"}
  end
end
