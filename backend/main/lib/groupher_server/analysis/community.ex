defmodule GroupherServer.Analysis.Community do
  @moduledoc """
  Route-derived analysis context for one community.
  """

  alias GroupherServer.CMS.Model.Community, as: CMSCommunity

  @type t :: %__MODULE__{community: String.t(), path_prefix: String.t()}

  defstruct [:community, :path_prefix]

  @spec from_community(CMSCommunity.t()) :: t()
  def from_community(%CMSCommunity{slug: slug}) when is_binary(slug) do
    %__MODULE__{community: slug, path_prefix: "/#{slug}"}
  end
end
