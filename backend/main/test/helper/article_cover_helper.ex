defmodule GroupherServer.Test.ArticleCoverHelper do
  @moduledoc false

  defmacro __using__(thread: thread) do
    thread_name = thread |> to_string()

    quote do
      use GroupherServer.TestMate

      import GroupherServer.Test.ArticleCoverHelper

      @thread unquote(thread)

      describe unquote("[mutation #{thread_name} cover]") do
        test unquote("create #{thread_name} allows omitted cover") do
          {community, _article, _, _user} = mock_article(@thread)
          user_conn = simu_conn(:user)

          variables = mock_attrs(@thread) |> Map.merge(%{community: community.slug})
          result = user_conn |> gq_mutation(cover_create_schema(@thread), variables)

          assert is_nil(result["coverUrl"])
          assert is_nil(result["coverUrlDark"])
          assert is_nil(result["coverEditInfo"])
        end

        test unquote("create #{thread_name} allows empty cover") do
          {community, _article, _, _user} = mock_article(@thread)
          user_conn = simu_conn(:user)

          variables =
            mock_attrs(@thread) |> Map.merge(%{community: community.slug, coverEditInfo: nil})

          result = user_conn |> gq_mutation(cover_create_schema(@thread), variables)

          assert is_nil(result["coverUrl"])
          assert is_nil(result["coverUrlDark"])
          assert is_nil(result["coverEditInfo"])
        end

        test unquote("create #{thread_name} with cover edit info") do
          {community, _article, _, _user} = mock_article(@thread)
          user_conn = simu_conn(:user)

          variables =
            mock_attrs(@thread)
            |> Map.merge(%{
              community: community.slug,
              coverUrl: cover_url(@thread, "create-light"),
              coverUrlDark: cover_url(@thread, "create-dark"),
              coverEditInfo: cover_edit_info_input()
            })

          result = user_conn |> gq_mutation(cover_create_schema(@thread), variables)

          assert result["coverUrl"] == variables.coverUrl
          assert result["coverUrlDark"] == variables.coverUrlDark
          assert result["coverEditInfo"]["light"]["background"]["id"]
          assert result["coverEditInfo"]["light"]["images"] |> length == 1
          assert result["coverEditInfo"]["dark"]["images"] |> length == 1

          {:ok, article} =
            GroupherServer.CMS.FrontDesk.article(community, @thread, result["innerId"])

          assert article.cover_url == variables.coverUrl
          assert article.cover_url_dark == variables.coverUrlDark
          assert article.cover_edit_info_id
        end

        test unquote("read #{thread_name} returns cover edit info") do
          {community, article, _, _user} = mock_article(@thread)
          owner_conn = simu_conn(:owner, article)
          guest_conn = simu_conn(:guest)
          other_conn = simu_conn(:user)

          variables = %{
            article: %{inner_id: article.inner_id, community: community.slug},
            coverUrl: cover_url(@thread, "read-light"),
            coverUrlDark: cover_url(@thread, "read-dark"),
            coverEditInfo: cover_edit_info_input()
          }

          updated = owner_conn |> gq_mutation(cover_update_schema(@thread), variables)

          read_variables = %{article: %{inner_id: article.inner_id, community: community.slug}}

          result =
            owner_conn
            |> gq_query(cover_read_schema(@thread), read_variables)

          assert result["coverUrl"] == variables.coverUrl
          assert result["coverUrlDark"] == variables.coverUrlDark
          assert result["coverEditInfo"]["id"] == updated["coverEditInfo"]["id"]
          assert result["coverEditInfo"]["canvasWidth"] == variables.coverEditInfo.canvasWidth
          assert result["coverEditInfo"]["light"]["background"]["id"]
          assert result["coverEditInfo"]["light"]["background"]["type"] == "gradient"
          assert result["coverEditInfo"]["light"]["images"] |> length == 1
          assert result["coverEditInfo"]["dark"]["background"]["id"]
          assert result["coverEditInfo"]["dark"]["images"] |> length == 1

          guest_result =
            guest_conn
            |> gq_query(cover_read_schema(@thread), read_variables)

          assert guest_result["coverUrl"] == variables.coverUrl
          assert is_nil(guest_result["coverEditInfo"])

          other_result =
            other_conn
            |> gq_query(cover_read_schema(@thread), read_variables)

          assert other_result["coverUrl"] == variables.coverUrl
          assert is_nil(other_result["coverEditInfo"])
        end

        test unquote("update #{thread_name} replaces cover edit info") do
          {community, article, _, _user} = mock_article(@thread)
          owner_conn = simu_conn(:owner, article)

          variables = %{
            article: %{inner_id: article.inner_id, community: community.slug},
            coverUrl: cover_url(@thread, "update-light"),
            coverUrlDark: cover_url(@thread, "update-dark"),
            coverEditInfo: cover_edit_info_input(%{canvasWidth: 1600, canvasHeight: 900})
          }

          result = owner_conn |> gq_mutation(cover_update_schema(@thread), variables)

          assert result["coverUrl"] == variables.coverUrl
          assert result["coverUrlDark"] == variables.coverUrlDark
          assert result["coverEditInfo"]["canvasWidth"] == variables.coverEditInfo.canvasWidth

          {:ok, article} =
            GroupherServer.CMS.FrontDesk.article(community, @thread, article.inner_id,
              preload: :cover_edit_info
            )

          assert article.cover_url == variables.coverUrl
          assert article.cover_url_dark == variables.coverUrlDark
          assert article.cover_edit_info.light.background_id
        end

        test unquote("update #{thread_name} can remove cover edit info") do
          {community, article, _, _user} = mock_article(@thread)
          owner_conn = simu_conn(:owner, article)

          variables = %{
            article: %{inner_id: article.inner_id, community: community.slug},
            coverUrl: cover_url(@thread, "remove-light"),
            coverUrlDark: cover_url(@thread, "remove-dark"),
            coverEditInfo: cover_edit_info_input()
          }

          updated = owner_conn |> gq_mutation(cover_update_schema(@thread), variables)
          cover_edit_info_id = updated["coverEditInfo"]["id"]

          remove_variables = %{
            article: %{inner_id: article.inner_id, community: community.slug},
            coverUrl: nil,
            coverUrlDark: nil,
            coverEditInfo: nil
          }

          removed = owner_conn |> gq_mutation(cover_update_schema(@thread), remove_variables)

          assert is_nil(removed["coverUrl"])
          assert is_nil(removed["coverUrlDark"])
          assert is_nil(removed["coverEditInfo"])

          assert {:error, _} =
                   Helper.ORM.find(GroupherServer.CMS.Model.CoverEditInfo, cover_edit_info_id)
        end

        test unquote("delete #{thread_name} removes cover edit info but keeps background") do
          {community, article, _, _user} = mock_article(@thread)
          owner_conn = simu_conn(:owner, article)

          variables = %{
            article: %{inner_id: article.inner_id, community: community.slug},
            coverUrl: cover_url(@thread, "delete-light"),
            coverUrlDark: cover_url(@thread, "delete-dark"),
            coverEditInfo: cover_edit_info_input()
          }

          updated = owner_conn |> gq_mutation(cover_update_schema(@thread), variables)
          cover_edit_info_id = updated["coverEditInfo"]["id"]
          background_id = updated["coverEditInfo"]["light"]["background"]["id"]

          delete_variables = %{article: %{inner_id: article.inner_id, community: community.slug}}

          owner_conn
          |> gq_mutation(
            GroupherServer.Test.Helper.Schema.m(:delete_article, @thread),
            delete_variables
          )

          assert {:error, _} =
                   Helper.ORM.find(GroupherServer.CMS.Model.CoverEditInfo, cover_edit_info_id)

          assert {:ok, _} =
                   Helper.ORM.find(GroupherServer.CMS.Model.CoverBackground, background_id)
        end

        test unquote("create #{thread_name} rejects cover url without edit info") do
          {community, _article, _, _user} = mock_article(@thread)
          user_conn = simu_conn(:user)

          variables =
            mock_attrs(@thread)
            |> Map.merge(%{community: community.slug, coverUrl: cover_url(@thread, "invalid")})

          assert user_conn |> mutation_error?(cover_create_schema(@thread), variables)
        end

        test unquote("create #{thread_name} rejects edit info without cover url") do
          {community, _article, _, _user} = mock_article(@thread)
          user_conn = simu_conn(:user)

          variables =
            mock_attrs(@thread)
            |> Map.merge(%{community: community.slug, coverEditInfo: cover_edit_info_input()})

          assert user_conn |> mutation_error?(cover_create_schema(@thread), variables)
        end

        test unquote("create #{thread_name} rejects raw background id") do
          {community, _article, _, _user} = mock_article(@thread)
          user_conn = simu_conn(:user)

          variables =
            mock_attrs(@thread)
            |> Map.merge(%{
              community: community.slug,
              coverUrl: cover_url(@thread, "invalid-raw-bg"),
              coverEditInfo:
                cover_edit_info_input(%{
                  light: cover_config_id_input("light", 1),
                  dark: cover_config_input("dark")
                })
            })

          assert user_conn |> mutation_error?(cover_create_schema(@thread), variables)
        end

        test unquote("update #{thread_name} rejects cover url without edit info") do
          {community, article, _, _user} = mock_article(@thread)
          owner_conn = simu_conn(:owner, article)

          variables = %{
            article: %{inner_id: article.inner_id, community: community.slug},
            coverUrl: cover_url(@thread, "invalid")
          }

          assert owner_conn |> mutation_error?(cover_update_schema(@thread), variables)
        end

        test unquote("update #{thread_name} rejects edit info without cover url") do
          {community, article, _, _user} = mock_article(@thread)
          owner_conn = simu_conn(:owner, article)

          variables = %{
            article: %{inner_id: article.inner_id, community: community.slug},
            coverEditInfo: cover_edit_info_input()
          }

          assert owner_conn |> mutation_error?(cover_update_schema(@thread), variables)
        end

        test unquote("update #{thread_name} rejects background id from another cover") do
          {community, article, _, user} = mock_article(@thread)
          {_community, other_article, _, _user} = mock_article(@thread, community, user)
          owner_conn = simu_conn(:owner, article)
          other_owner_conn = simu_conn(:owner, other_article)

          other_variables = %{
            article: %{inner_id: other_article.inner_id, community: community.slug},
            coverUrl: cover_url(@thread, "other-light"),
            coverUrlDark: cover_url(@thread, "other-dark"),
            coverEditInfo: cover_edit_info_input()
          }

          other_updated =
            other_owner_conn |> gq_mutation(cover_update_schema(@thread), other_variables)

          other_background_id = other_updated["coverEditInfo"]["light"]["background"]["id"]

          variables = %{
            article: %{inner_id: article.inner_id, community: community.slug},
            coverUrl: cover_url(@thread, "foreign-bg"),
            coverEditInfo:
              cover_edit_info_input(%{
                light: cover_config_id_input("light", other_background_id),
                dark: cover_config_input("dark")
              })
          }

          assert owner_conn |> mutation_error?(cover_update_schema(@thread), variables)
        end
      end
    end
  end

  def cover_edit_info_input(overrides \\ %{}) do
    %{
      canvasWidth: 1200,
      canvasHeight: 630,
      light: cover_config_input("light"),
      dark: cover_config_input("dark")
    }
    |> Map.merge(overrides)
  end

  def cover_config_input(theme) do
    %{
      background: cover_background_input(theme),
      images: cover_images_input(theme)
    }
  end

  def cover_config_id_input(theme, background_id) do
    %{
      backgroundId: background_id,
      images: cover_images_input(theme)
    }
  end

  def cover_create_schema(thread) do
    thread_name = thread |> to_string() |> String.capitalize()

    """
    mutation(
      $title: String!
      $body: String!
      $community: String!
      $coverUrl: String
      $coverUrlDark: String
      $coverEditInfo: CoverEditInfoInput
    ) {
      create#{thread_name}(
        title: $title
        body: $body
        community: $community
        coverUrl: $coverUrl
        coverUrlDark: $coverUrlDark
        coverEditInfo: $coverEditInfo
      ) {
        innerId
        coverUrl
        coverUrlDark
        coverEditInfo {
          id
          canvasWidth
          canvasHeight
          light {
            background {
              id
              type
            }
            images
          }
          dark {
            background {
              id
              type
            }
            images
          }
        }
      }
    }
    """
  end

  def cover_update_schema(thread) do
    thread_name = thread |> to_string() |> String.capitalize()

    """
    mutation(
      $article: ArticleRefInput!
      $coverUrl: String
      $coverUrlDark: String
      $coverEditInfo: CoverEditInfoInput
    ) {
      update#{thread_name}(
        article: $article
        coverUrl: $coverUrl
        coverUrlDark: $coverUrlDark
        coverEditInfo: $coverEditInfo
      ) {
        innerId
        coverUrl
        coverUrlDark
        coverEditInfo {
          id
          canvasWidth
          canvasHeight
          light {
            background {
              id
              type
            }
            images
          }
        }
      }
    }
    """
  end

  def cover_read_schema(thread) do
    GroupherServer.Test.Helper.Schema.q(:article, thread, """
    coverUrl
    coverUrlDark
    coverEditInfo {
      id
      canvasWidth
      canvasHeight
      light {
        background {
          id
          type
        }
        images
      }
      dark {
        background {
          id
          type
        }
        images
      }
    }
    """)
  end

  def cover_url(thread, suffix), do: "https://img.test/#{thread}-cover-#{suffix}.png"

  defp cover_background_input(theme) do
    %{
      type: "gradient",
      source: theme,
      pattern:
        Jason.encode!(%{
          enabled: false,
          id: "01",
          intensity: 0,
          tone: "dark"
        }),
      gradient:
        Jason.encode!(%{
          version: 2,
          renderer: "linear",
          preset: theme,
          colors: ["#FFFFFF", "#111111"],
          angle: 180,
          spread: 50
        }),
      contentShadow: Jason.encode!(%{enabled: false}),
      effect: Jason.encode!(%{blurIntensity: 0, brightness: 100, saturation: 100}),
      texture: Jason.encode!(%{enabled: false, type: "noise", intensity: 0, params: %{}})
    }
  end

  defp cover_images_input(theme) do
    [
      Jason.encode!(%{
        url: "https://img.test/#{theme}.png",
        x: 10,
        y: 20,
        width: 320,
        height: 180,
        border: %{width: 1},
        shadow: %{blur: 12}
      })
    ]
  end
end
