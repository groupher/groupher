defmodule GroupherServer.Test.Helper.Schema.Statistics do
  @moduledoc "GraphQL documents used by statistics tests."

  def q(:cities_geo_info) do
    """
    query {
        citiesGeoInfo {
          entries {
            city
            value
            long
            lant
          }
          totalCount
        }
      }
    """
  end

  def q(:online_status) do
    """
    query {
          onlineStatus {
            realtimeVisitors
          }
        }
    """
  end

  def q(:count_status) do
    """
    query {
          countStatus {
            communitiesCount
            postsCount
            categoriesCount
            communityTagsCount
          }
        }
    """
  end
end
