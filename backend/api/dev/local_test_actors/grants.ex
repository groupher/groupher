defmodule GroupherServer.LocalTestActors.Grants do
  @moduledoc """
  Configures real scope-specific grants for registered synthetic accounts.

      local fixture -> explicit lord setup OR normal invite/accept/update Commands

  Ordinary grants use the generated Passport Catalog and retain domain events,
  requests, CAS revisions and notices. Only lord initialization is a trusted fixture.
  """
  alias GroupherServer.{CMS, Repo, LocalTestActors}
  alias CMS.Model.{Article, ArticleCoAuthor, Author, Community, CommunityAdmin}
  alias CMS.Communities.Admins
  alias CMS.Articles.CoAuthors

  def configure(run, %{"alias" => name, "community" => slug, "role" => "lord"}) do
    with {:ok, user, _} <- LocalTestActors.actor(run, name),
         %Community{} = community <- Repo.get_by(Community, slug: slug),
         {:ok, {member, created?}} <- lord(community, user),
         {:ok, _} <- lord_activity(community, user, member, created?) do
      {:ok,
       %{
         community: slug,
         login: user.login,
         isLord: member.is_lord,
         permissions: member.permissions
       }}
    else
      nil -> {:error, :community_not_found}
      {:error, _} = error -> error
    end
  end

  def configure(
        run,
        %{"alias" => name, "community" => slug, "by" => by, "permissions" => permissions} = input
      ) do
    with {:ok, subject, _} <- LocalTestActors.actor(run, name),
         {:ok, manager, _} <- LocalTestActors.actor(run, by),
         %Community{} = community <- Repo.get_by(Community, slug: slug),
         {:ok, normalized} <- CMS.Passport.Catalog.validate_permissions(:community, permissions) do
      case Repo.get_by(CommunityAdmin, community_id: community.id, user_id: subject.id) do
        nil ->
          with {:ok, request} <-
                 Admins.create(
                   community.ref,
                   subject.login,
                   :invite,
                   normalized,
                   manager,
                   Ecto.UUID.generate()
                 ),
               true <- request.proposed_permissions == normalized do
            if input["pending"] == true do
              {:ok, %{requestId: request.id, status: "pending"}}
            else
              with {:ok, _} <-
                     Admins.decide(
                       request.id,
                       request.revision,
                       :accept,
                       nil,
                       subject,
                       Ecto.UUID.generate()
                     ) do
                {:ok,
                 %{community: slug, memberships: LocalTestActors.Communities.memberships(subject)}}
              end
            end
          else
            false -> {:error, :local_test_pending_permissions_mismatch}
            {:error, _} = error -> error
          end

        %CommunityAdmin{} = member ->
          with {:ok, _} <-
                 Admins.update_permissions(
                   community.ref,
                   member.id,
                   member.revision,
                   normalized,
                   manager,
                   Ecto.UUID.generate()
                 ) do
            {:ok,
             %{community: slug, memberships: LocalTestActors.Communities.memberships(subject)}}
          end
      end
    else
      nil -> {:error, :community_not_found}
      {:error, _} = error -> error
    end
  end

  def configure(
        run,
        %{"alias" => name, "article" => article_id, "by" => by, "permissions" => permissions} =
          input
      ) do
    with {:ok, subject, _} <- LocalTestActors.actor(run, name),
         {:ok, manager, _} <- LocalTestActors.actor(run, by),
         {:ok, _} <- Ecto.UUID.cast(article_id),
         %Article{} = article <- Repo.get(Article, article_id),
         {:ok, normalized} <- CMS.Passport.Catalog.validate_permissions(:article, permissions) do
      author = Repo.get_by(Author, user_id: subject.id)

      member =
        if author, do: Repo.get_by(ArticleCoAuthor, article_id: article.id, author_id: author.id)

      case member do
        nil ->
          with {:ok, request} <-
                 CoAuthors.Commands.CreateRequest.execute(
                   article,
                   subject.id,
                   :invite,
                   normalized,
                   manager,
                   Ecto.UUID.generate()
                 ),
               true <- request.proposed_permissions == normalized do
            if input["pending"] == true do
              {:ok, %{requestId: request.id, status: "pending"}}
            else
              with {:ok, _} <-
                     CoAuthors.Commands.DecideRequest.execute(
                       article,
                       request.id,
                       request.revision,
                       :accept,
                       normalized,
                       subject,
                       Ecto.UUID.generate()
                     ) do
                CoAuthors.permissions(article.id, subject)
              end
            end
          else
            false -> {:error, :local_test_pending_permissions_mismatch}
            {:error, _} = error -> error
          end

        %ArticleCoAuthor{} = member ->
          with {:ok, _} <-
                 CoAuthors.update_permissions(
                   article.id,
                   member.id,
                   member.revision,
                   normalized,
                   manager,
                   Ecto.UUID.generate()
                 ) do
            CoAuthors.permissions(article.id, subject)
          end
      end
    else
      nil -> {:error, :article_not_found}
      :error -> {:error, :invalid_article_id}
      {:error, _} = error -> error
    end
  end

  def configure(run, %{"alias" => name, "scope" => "global", "permissions" => permissions}) do
    with {:ok, user, _} <- LocalTestActors.actor(run, name),
         {:ok, normalized} <- CMS.Passport.Catalog.validate_permissions(:global, permissions),
         current <- Repo.get_by(CMS.Model.GlobalPassport, user_id: user.id),
         {:ok, _} <-
           CMS.Passport.grant_in_transaction(
             user,
             %CMS.Passport.Scope.GlobalGrant{subject_id: user.id, current: current},
             normalized,
             nil
           ) do
      CMS.Passport.global_facts(user.id)
    end
  end

  def configure(_, _), do: {:error, :explicit_scope_and_permissions_required}

  defp lord(community, user) do
    case Repo.get_by(CommunityAdmin, user_id: user.id, community_id: community.id) do
      nil ->
        with {:ok, member} <-
               %CommunityAdmin{}
               |> CommunityAdmin.changeset(%{
                 user_id: user.id,
                 community_id: community.id,
                 is_lord: true,
                 permissions: %{}
               })
               |> Repo.insert(),
             {:ok, _} <- CMS.Communities.Count.update(community, user, :admins_count, :inc) do
          {:ok, {member, true}}
        end

      %CommunityAdmin{is_lord: true} = member ->
        {:ok, {member, false}}

      %CommunityAdmin{} ->
        {:error, :local_test_refuses_implicit_lord_promotion}
    end
  end

  defp lord_activity(_community, _user, _member, false), do: {:ok, :pass}

  defp lord_activity(community, user, member, true) do
    Admins.Effects.activity(community, :admin_joined, :system, Ecto.UUID.generate(), 0, %{
      subject_user_id: user.id,
      member_id: member.id,
      before_permissions: %{},
      after_permissions: %{}
    })
  end
end
