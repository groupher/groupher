defmodule GroupherServer.Test.WallpaperGraphQL do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Assets.{Capability, GeneratedBatch.PublishCapability}
  alias CMS.Wallpaper
  alias CMS.Wallpaper.{RequestDigest, Settings}

  defmodule FakeBatchClient do
    def claim_for_publish(_batch_ref, _submit_command_id) do
      payload = Application.fetch_env!(:groupher_server, :wallpaper_graphql_batch_payload)
      {:ok, %{"capability" => Capability.sign(payload)}}
    end

    def delete_claim(_batch_ref, _token) do
      calls = Application.get_env(:groupher_server, :wallpaper_graphql_delete_calls, 0)
      Application.put_env(:groupher_server, :wallpaper_graphql_delete_calls, calls + 1)
      :ok
    end
  end

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = CMS.Communities.create(mock_attrs(:community), user, Ecto.UUID.generate())
    rule_conn = simu_conn(:user, cms: %{"community.update" => true})

    Application.put_env(:groupher_server, :wallpaper_batch_client, FakeBatchClient)

    on_exit(fn ->
      Application.delete_env(:groupher_server, :wallpaper_batch_client)
      Application.delete_env(:groupher_server, :wallpaper_graphql_batch_payload)
      Application.delete_env(:groupher_server, :wallpaper_graphql_delete_calls)
    end)

    {:ok, ~m(community rule_conn)a}
  end

  test "reads defaults, saves one theme, removes it, and restores a snapshot",
       ~m(community rule_conn)a do
    initial =
      gq_query(rule_conn, S.Dsb.q(:wallpaper), %{
        community: community.slug,
        theme: "LIGHT"
      })

    assert get_in(initial, ["dashboard", "wallpaper", "version"]) == 0
    assert get_in(initial, ["dashboard", "wallpaper", "light"]) == nil
    assert get_in(initial, ["dashboard", "wallpaperSettings", "light", "type"]) == "GRADIENT"

    settings = %{
      custom_wallpaper: nil,
      render_config: render_config(),
      settings_schema_version: 1,
      source: "amber_mauve",
      type: :gradient
    }

    settings_input = %{
      renderConfig: Jason.encode!(render_config()),
      settingsSchemaVersion: 1,
      source: "amber_mauve",
      type: "GRADIENT"
    }

    prepared =
      gq_mutation(rule_conn, S.Dsb.m(:prepare_wallpaper_upload), %{
        community: community.slug,
        input: %{
          baseVersion: 0,
          commandId: "graphql-prepare",
          images: wallpaper_images(),
          settings: settings_input,
          theme: "LIGHT"
        }
      })

    assert is_binary(prepared["batchRef"])
    assert is_binary(prepared["batchCapability"])

    assert Enum.map(prepared["uploadIntents"], & &1["profile"]) ==
             ["WIDE", "DESKTOP", "TABLET", "PHONE"]

    {:ok, prepare_payload} = Capability.verify(prepared["batchCapability"])

    snapshot_ref =
      get_in(prepare_payload, ["expectedVariants", Access.at(0), "candidateOwnerRef"])

    batch_ref = prepared["batchRef"]
    {:ok, normalized_settings} = Settings.normalize(settings)
    checksum = Base.encode64(:binary.copy(<<0>>, 32))

    manifest =
      Wallpaper.profile_specs()
      |> Enum.map(fn profile ->
        variant_key = "light-#{profile.key}"

        %{
          "assetPublicRef" => "asset-#{profile.key}",
          "candidateOwnerRef" => snapshot_ref,
          "checksum" => checksum,
          "height" => profile.height,
          "mimeType" => "image/webp",
          "storageKey" => "wallpaper/#{variant_key}.webp",
          "variantKey" => variant_key,
          "width" => profile.width
        }
      end)

    canonical_manifest =
      Enum.map(manifest, fn entry ->
        %{
          asset_public_ref: entry["assetPublicRef"],
          candidate_owner_ref: entry["candidateOwnerRef"],
          checksum: entry["checksum"],
          height: entry["height"],
          mime_type: entry["mimeType"],
          storage_key: entry["storageKey"],
          variant_key: entry["variantKey"],
          width: entry["width"]
        }
      end)

    request_digest =
      RequestDigest.digest(%{
        base_version: 0,
        community_id: community.id,
        request_digest_version: 1,
        settings: normalized_settings,
        theme: :light
      })

    Application.put_env(:groupher_server, :wallpaper_graphql_batch_payload, %{
      "batchRef" => batch_ref,
      "claimKey" => "graphql-publish",
      "expiresAt" => "2099-01-01T00:00:00Z",
      "manifest" => manifest,
      "manifestDigest" => PublishCapability.manifest_digest(canonical_manifest),
      "policyVersion" => "v1",
      "purpose" => "generated_image_publish",
      "requestDigest" => request_digest,
      "requestDigestVersion" => 1,
      "signingKeyId" => "hmac-v1"
    })

    published =
      gq_mutation(rule_conn, S.Dsb.m(:publish_wallpaper), %{
        community: community.slug,
        input: %{
          baseVersion: 0,
          batchRef: batch_ref,
          commandId: "graphql-publish",
          settings: %{
            renderConfig: Jason.encode!(render_config()),
            settingsSchemaVersion: 1,
            source: "amber_mauve",
            type: "GRADIENT"
          },
          theme: "LIGHT"
        }
      })

    assert published["version"] == 1

    Application.put_env(:groupher_server, :wallpaper_graphql_delete_calls, 0)

    loser_response =
      rule_conn
      |> post("/graphiql",
        query: S.Dsb.m(:publish_wallpaper),
        variables: %{
          community: community.slug,
          input: %{
            baseVersion: 0,
            batchRef: batch_ref,
            commandId: "graphql-loser",
            settings: %{
              renderConfig: Jason.encode!(render_config()),
              settingsSchemaVersion: 1,
              source: "amber_mauve",
              type: "GRADIENT"
            },
            theme: "LIGHT"
          }
        }
      )
      |> json_response(200)

    assert loser_response["data"] == nil
    assert [_error] = loser_response["errors"]
    assert Application.get_env(:groupher_server, :wallpaper_graphql_delete_calls) == 0

    after_publish =
      gq_query(rule_conn, S.Dsb.q(:wallpaper), %{
        community: community.slug,
        theme: "LIGHT"
      })

    assert get_in(after_publish, ["dashboard", "wallpaper", "version"]) == 1
    assert get_in(after_publish, ["dashboard", "wallpaper", "light", "wide", "width"]) == 1920

    assert get_in(after_publish, ["dashboard", "wallpaperSettings", "light", "type"]) ==
             "GRADIENT"

    snapshot_id =
      after_publish
      |> get_in(["dashboard", "wallpaperHistory"])
      |> List.first()
      |> Map.fetch!("id")

    none_publish =
      gq_mutation(rule_conn, S.Dsb.m(:publish_wallpaper), %{
        community: community.slug,
        input: %{
          baseVersion: 1,
          batchRef: nil,
          commandId: "graphql-none",
          settings: %{settingsSchemaVersion: 1, type: "NONE"},
          theme: "LIGHT"
        }
      })

    assert none_publish["version"] == 2

    replayed =
      gq_mutation(rule_conn, S.Dsb.m(:publish_wallpaper), %{
        community: community.slug,
        input: %{
          baseVersion: 0,
          batchRef: batch_ref,
          commandId: "graphql-publish",
          settings: %{
            renderConfig: Jason.encode!(render_config()),
            settingsSchemaVersion: 1,
            source: "amber_mauve",
            type: "GRADIENT"
          },
          theme: "LIGHT"
        }
      })

    assert replayed["version"] == 2

    after_none =
      gq_query(rule_conn, S.Dsb.q(:wallpaper), %{
        community: community.slug,
        theme: "LIGHT"
      })

    assert get_in(after_none, ["dashboard", "wallpaper", "version"]) == 2
    assert get_in(after_none, ["dashboard", "wallpaper", "light"]) == nil
    assert get_in(after_none, ["dashboard", "wallpaperSettings", "light", "type"]) == "NONE"

    restored =
      gq_mutation(rule_conn, S.Dsb.m(:restore_wallpaper_snapshot), %{
        community: community.slug,
        input: %{baseVersion: 2, snapshotId: snapshot_id}
      })

    assert restored["version"] == 3

    after_restore =
      gq_query(rule_conn, S.Dsb.q(:wallpaper), %{
        community: community.slug,
        theme: "LIGHT"
      })

    assert get_in(after_restore, ["dashboard", "wallpaper", "version"]) == 3
    assert get_in(after_restore, ["dashboard", "wallpaper", "light", "wide", "height"]) == 1080

    assert get_in(after_restore, ["dashboard", "wallpaperSettings", "light", "type"]) ==
             "GRADIENT"

    assert Enum.any?(
             get_in(after_restore, ["dashboard", "wallpaperHistory"]),
             &(&1["id"] == snapshot_id and &1["active"])
           )
  end

  defp wallpaper_images do
    checksum = Base.encode64(:binary.copy(<<0>>, 32))

    Wallpaper.profile_specs()
    |> Enum.map(fn profile ->
      %{
        checksum: checksum,
        height: profile.height,
        mimeType: "image/webp",
        profile: profile.key |> Atom.to_string() |> String.upcase(),
        sizeBytes: 1,
        width: profile.width
      }
    end)
  end

  defp render_config do
    %{
      "effect" => %{"blurIntensity" => 0, "brightness" => 100, "saturation" => 100},
      "gradient" => %{
        "angle" => 180,
        "colors" => ["#FBEFDE", "#D8B9E3"],
        "preset" => "amber_mauve",
        "renderer" => "linear",
        "spread" => 52,
        "version" => 2
      },
      "pattern" => %{"enabled" => false, "id" => "01", "intensity" => 0, "tone" => "dark"},
      "texture" => %{"enabled" => false, "intensity" => 0, "params" => %{}, "type" => "noise"}
    }
  end
end
