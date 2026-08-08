defmodule GroupherServer.Analysis.Web.Community do
  @moduledoc """
  Route-derived analysis context for one community.
  """

  alias GroupherServer.CMS.Model.Community, as: CMSCommunity

  @type t :: %__MODULE__{
          community: String.t(),
          path_prefix: String.t(),
          umami_website_id: String.t() | nil
        }

  defstruct [:community, :path_prefix, :umami_website_id]

  @doc """
  Builds the route-derived analytics scope for one CMS community.

  ## Example

      from_community(%GroupherServer.CMS.Model.Community{slug: "home"})
      #=> %GroupherServer.Analysis.Web.Community{community: "home", path_prefix: "/home", umami_website_id: nil}

  """
  @spec from_community(CMSCommunity.t()) :: t()
  def from_community(%CMSCommunity{slug: slug}) when is_binary(slug) do
    %__MODULE__{community: slug, path_prefix: "/#{slug}", umami_website_id: nil}
  end

  @spec from_community(CMSCommunity.t(), String.t() | nil) :: t()
  def from_community(%CMSCommunity{slug: slug}, umami_website_id) when is_binary(slug) do
    %__MODULE__{
      community: slug,
      path_prefix: "/#{slug}",
      umami_website_id: umami_website_id
    }
  end
end
