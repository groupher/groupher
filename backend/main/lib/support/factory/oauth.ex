defmodule GroupherServer.Support.Factory.Oauth do
  @moduledoc false

  defmacro __using__(_opts) do
    quote do
      defp mock_meta(:github_profile), do: unquote(__MODULE__).github_profile_meta()

      defp mock_meta(:oauth_profile), do: unquote(__MODULE__).oauth_profile("github")

      defp mock_meta({:oauth_profile, provider}) when is_binary(provider),
        do: unquote(__MODULE__).oauth_profile(provider)
    end
  end

  def github_profile_meta do
    unique_num = System.unique_integer([:positive, :monotonic])

    %{
      id: "#{Faker.Person.first_name()} #{unique_num}",
      login: "#{Faker.Person.first_name()}#{unique_num}",
      github_id: "#{unique_num + 1000}",
      node_id: "#{unique_num + 2000}",
      access_token: "#{unique_num + 3000}",
      bio: Faker.Lorem.Shakespeare.romeo_and_juliet(),
      company: Faker.Company.name(),
      location: "chengdu",
      email: Faker.Internet.email(),
      avatar_url: Faker.Avatar.image_url(),
      html_url: Faker.Avatar.image_url(),
      followers: unique_num * unique_num,
      following: unique_num * unique_num * unique_num
    }
  end

  def oauth_profile(provider \\ "github") when is_binary(provider) do
    unique_num = System.unique_integer([:positive, :monotonic])

    provider_id = unique_num |> to_string()
    login = "#{Faker.Person.first_name()}#{unique_num}"
    nickname = "#{Faker.Person.first_name()}#{unique_num}"
    email = Faker.Internet.email()
    avatar = Faker.Avatar.image_url()

    %{
      provider: provider,
      provider_id: provider_id,
      login: login,
      bio: Faker.Lorem.Shakespeare.romeo_and_juliet(),
      company: Faker.Company.name(),
      country: "",
      city: "",
      email: email,
      nickname: nickname,
      avatar: avatar,
      raw: oauth_raw(provider, provider_id, login, nickname, email, avatar)
    }
  end

  # provider native profile mock (string keys only, so it matches JSON decode behavior)
  defp oauth_raw("github", provider_id, login, nickname, email, avatar) do
    %{
      "id" => provider_id,
      "login" => login,
      "name" => nickname,
      "email" => email,
      "avatar_url" => avatar,
      "html_url" => "https://github.com/#{login}"
    }
  end

  defp oauth_raw("google", provider_id, _login, nickname, email, avatar) do
    %{
      "sub" => provider_id,
      "name" => nickname,
      "email" => email,
      "email_verified" => true,
      "picture" => avatar,
      "locale" => "en"
    }
  end

  defp oauth_raw("facebook", provider_id, _login, nickname, email, avatar) do
    %{
      "id" => provider_id,
      "name" => nickname,
      "email" => email,
      "picture" => %{
        "data" => %{
          "url" => avatar,
          "is_silhouette" => false
        }
      }
    }
  end

  defp oauth_raw("twitter", provider_id, login, nickname, _email, avatar) do
    %{
      "id" => provider_id,
      "username" => login,
      "name" => nickname,
      "profile_image_url" => avatar
    }
  end

  defp oauth_raw("discord", provider_id, login, nickname, email, avatar) do
    %{
      "id" => provider_id,
      "username" => login,
      "global_name" => nickname,
      "email" => email,
      "avatar" => avatar
    }
  end

  defp oauth_raw("notion", provider_id, _login, nickname, email, avatar) do
    %{
      "bot_id" => provider_id,
      "owner" => %{
        "type" => "user",
        "user" => %{
          "id" => provider_id,
          "name" => nickname,
          "person" => %{"email" => email},
          "avatar_url" => avatar
        }
      }
    }
  end

  defp oauth_raw(_provider, provider_id, login, nickname, email, avatar) do
    %{
      "id" => provider_id,
      "login" => login,
      "name" => nickname,
      "email" => email,
      "avatar" => avatar
    }
  end
end
