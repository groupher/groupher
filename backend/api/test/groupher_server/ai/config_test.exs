defmodule GroupherServer.Test.AI.ConfigTest do
  use ExUnit.Case, async: false

  alias GroupherServer.AI
  alias AI.Config

  setup do
    previous_env = Application.get_env(:groupher_server, :env)
    previous_ai = Application.get_env(:groupher_server, :ai)
    previous_token = System.get_env("REVIEW_BOT_TEST_JUDGE_TOKEN")

    System.put_env("REVIEW_BOT_TEST_JUDGE_TOKEN", "test-token")

    Application.put_env(:groupher_server, :ai,
      profiles: %{
        "local-judge" => %{
          adapter: :judge_http,
          base_url: "http://127.0.0.1:8788",
          model: "clef-flash",
          credential_env: "REVIEW_BOT_TEST_JUDGE_TOKEN",
          modalities: [:text]
        }
      }
    )

    on_exit(fn ->
      restore_app_env(:env, previous_env)
      restore_app_env(:ai, previous_ai)

      case previous_token do
        nil -> System.delete_env("REVIEW_BOT_TEST_JUDGE_TOKEN")
        token -> System.put_env("REVIEW_BOT_TEST_JUDGE_TOKEN", token)
      end
    end)

    :ok
  end

  test "allows a loopback HTTP judge endpoint in local environments" do
    Application.put_env(:groupher_server, :env, :dev)

    assert {:ok, %{base_url: "http://127.0.0.1:8788"}} = Config.profile("local-judge")
  end

  test "keeps HTTP judge endpoints disabled outside local environments" do
    Application.put_env(:groupher_server, :env, :prod)

    assert {:error, _reason} = Config.profile("local-judge")
  end

  test "the current HTTP judge never advertises image review" do
    profiles =
      Config.profiles_from_env(%{
        "REVIEW_BOT_JUDGE_URL" => "http://127.0.0.1:8788",
        "REVIEW_BOT_JUDGE_TOKEN" => "test-token"
      })

    assert profiles["judge_http"].modalities == [:text]

    Application.put_env(:groupher_server, :env, :dev)

    Application.put_env(:groupher_server, :ai,
      profiles: %{
        "local-judge" => %{profiles["judge_http"] | credential_env: "REVIEW_BOT_TEST_JUDGE_TOKEN"}
      },
      review_profile_id: "local-judge"
    )

    assert {:error, _reason} = Config.review_profile([:text, :image])
  end

  defp restore_app_env(key, nil), do: Application.delete_env(:groupher_server, key)
  defp restore_app_env(key, value), do: Application.put_env(:groupher_server, key, value)
end
