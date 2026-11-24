defmodule GroupherServer.CMS.ProductionSeed.Bootstrap do
  @moduledoc """
  Owns the narrow operational initialization of dev/mock/tmp and fixed accounts.

      Locked run -> reject unknown collisions -> core Community + Lifecycle setup
                 -> typed GlobalPassport / CommunityAdmin snapshots -> manifest

  Public registration and rename retain the normal reserved-name rejection.
  """
  import Ecto.Query
  alias GroupherServer.{Repo, CMS, ReviewBot}
  alias CMS.ProductionSeed.{Privileges, Run}
  alias GroupherServer.Accounts
  alias Accounts.Model.{User, OauthProvider}
  alias CMS.Model.{Community, CommunitySlugClaim}
  @report_threshold Application.compile_env(:groupher_server, :cms_review_report_threshold, 3)
  @aliases ~w(author adminDev adminMock platform outsider) ++
             Enum.map(1..max(@report_threshold, 3), &"reporter#{&1}")

  @doc "Initializes fixed resources inside the caller's serialized transaction."
  def apply(manifest) do
    if Map.has_key?(manifest, "passports") and
         not Map.has_key?(manifest, "globalPassports") do
      Repo.rollback(:seed_legacy_manifest_requires_p4c)
    end

    users =
      Map.new(@aliases, fn name ->
        login = "ps-" <> String.downcase(name)

        user =
          case Repo.get_by(User, login: login) do
            nil ->
              Repo.insert!(
                User.changeset(%User{}, %{
                  login: login,
                  nickname: name,
                  avatar: "https://groupher.com/favicon.ico"
                })
              )

            user ->
              unless owned?(manifest, "users", name, user.id) do
                Repo.rollback({:seed_user_collision, name})
              end

              user
          end

        if Repo.exists?(from(o in OauthProvider, where: o.user_id == ^user.id)) do
          Repo.rollback(:seed_unexpected_oauth)
        end

        {name, user.id}
      end)

    communities =
      Map.new(~w(dev mock tmp), fn slug ->
        owner = Repo.get!(User, users[if(slug == "mock", do: "adminMock", else: "adminDev")])

        community =
          case Repo.get_by(Community, slug: slug) do
            nil ->
              if Repo.exists?(from(c in CommunitySlugClaim, where: c.slug == ^slug)) do
                Repo.rollback({:seed_slug_claim_collision, slug})
              end

              {:ok, c} =
                CMS.Communities.CreationPersist.create_core(
                  %{
                    slug: slug,
                    title: "Acceptance #{slug}",
                    desc: "Production acceptance seed community",
                    logo: "https://groupher.com/favicon.ico"
                  },
                  owner
                )

              {:ok, _} = CMS.Communities.Lifecycle.ensure_created(c.id)
              {:ok, _} = ReviewBot.create_default_configs_for_community(c.id)
              {:ok, _} = CMS.Communities.Admins.Setup.add_lord(c, owner)
              c

            c ->
              unless c.user_id == owner.id and owned?(manifest, "communities", slug, c.id) do
                Repo.rollback({:seed_community_collision, slug})
              end

              c
          end

        {slug, community.id}
      end)

    global_passports = Privileges.provision_global_passports!(users, manifest)

    community_admins =
      Privileges.provision_admins!(users, communities, manifest["communityAdmins"] || %{})

    Map.merge(manifest, %{
      "schemaVersion" => 1,
      "runtimeImageRef" => System.get_env("FLY_IMAGE_REF"),
      "runtimeVersion" => Application.spec(:groupher_server, :vsn) |> to_string(),
      "users" => users,
      "communities" => communities,
      "globalPassports" => global_passports,
      "communityAdmins" => community_admins
    })
  end

  defp owned?(manifest, kind, name, id) do
    get_in(manifest, [kind, name]) == id or
      Enum.any?(Repo.all(from(r in Run, select: r.manifest)), &(get_in(&1, [kind, name]) == id))
  end
end
