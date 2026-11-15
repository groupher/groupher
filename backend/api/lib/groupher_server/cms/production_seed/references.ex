defmodule GroupherServer.CMS.ProductionSeed.References do
  @moduledoc """
  Links the six seeded node kinds through canonical domain content updates.

      Seed manifest -> Node reference artifact -> locked snapshot checks
        -> Article/Doc/Ticket/Comment Commands -> expected edge manifest

  Projection rows are never inserted here. The normal Mention Outbox must run.
  """
  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.ProductionSeed
  alias Accounts.Model.User

  alias CMS.Model.{
    Article,
    ArticleWorkingCopy,
    ArticlePublic,
    Community,
    Comment,
    CommentBody
  }

  @sources ~w(PX BX CX DX TX CM self)

  @doc "Applies or verifies a Node-generated graph artifact for the same run snapshot."
  def apply(run_id, database, path) when is_binary(path) do
    with {:ok, _} <- ProductionSeed.admit(database),
         {:ok, %{type: :regular, size: size}} when size <= 2_000_000 <- File.stat(path),
         {:ok, bytes} <- File.read(path),
         {:ok, %{"runId" => ^run_id, "schemaVersion" => 1, "entries" => entries} = input} <-
           Jason.decode(bytes),
         true <-
           is_list(entries) and Enum.all?(entries, &is_map/1) and
             Enum.map(entries, & &1["alias"]) == @sources do
      Repo.transaction(
        fn ->
          ProductionSeed.advisory_lock!()
          run = ProductionSeed.lock!(run_id)

          if input["contentChecksum"] != run.manifest["contentChecksum"] do
            Repo.rollback(:seed_artifact_changed)
          end

          hash = Base.encode16(:crypto.hash(:sha256, bytes), case: :lower)
          ProductionSeed.Content.verify_snapshot!(run.manifest)

          case run.manifest["referencesChecksum"] do
            ^hash ->
              run.manifest

            nil ->
              admin = actor(run.manifest["users"]["adminDev"])
              author = actor(run.manifest["users"]["author"])

              resources =
                Enum.reduce(entries, run.manifest["resources"], fn entry, resources ->
                  resource = resources[entry["alias"]] || Repo.rollback(:seed_missing_resource)
                  updated = update!(resource, entry, admin, author)
                  Map.put(resources, entry["alias"], updated)
                end)

              edges =
                Enum.zip(~w(PX BX CX DX TX CM), ~w(BX CX DX TX CM PX))
                |> Enum.map(fn {source, target} -> [source, target] end)

              edges = edges ++ Enum.map(1..21, &["PX", "page#{&1}"])

              manifest =
                Map.merge(run.manifest, %{
                  "resources" => resources,
                  "referencesChecksum" => hash,
                  "expectedEdges" => edges,
                  "expectedNoEdges" => ["zero", "self"],
                  "projectionStatus" => "normal_outbox_must_drain"
                })

              run |> Ecto.Changeset.change(manifest: manifest) |> Repo.update!()
              manifest

            _ ->
              Repo.rollback(:seed_artifact_changed)
          end
        end,
        timeout: 120_000
      )
    else
      _ -> {:error, :seed_invalid_reference_artifact}
    end
  end

  def apply(_, _, _), do: {:error, :seed_invalid_reference_artifact}

  defp update!(%{"commentId" => id} = resource, entry, _admin, author) do
    comment = Repo.get!(Comment, id)

    command!(
      CMS.Comments.update_comment_result(
        comment,
        entry["bodyBag"],
        resource["bodyVersion"],
        author,
        entry["commandId"],
        resource["community"]
      )
    )

    Map.put(resource, "bodyVersion", Repo.get_by!(CommentBody, comment_id: id).version)
  end

  defp update!(%{"thread" => "doc", "articleId" => id} = resource, entry, admin, _author) do
    community = Repo.get_by!(Community, slug: resource["community"])

    public =
      command!(
        CMS.Seeds.Docs.update(
          community,
          id,
          %{body_bag: entry["bodyBag"]},
          admin,
          entry["commandId"]
        )
      )

    Map.put(resource, "snapshotId", public.snapshot_id)
  end

  defp update!(%{"thread" => "ticket", "articleId" => id} = resource, entry, admin, _author) do
    community = Repo.get_by!(Community, slug: resource["community"])
    internal = command!(CMS.Tickets.get_internal(community, id, admin))

    command!(
      CMS.Tickets.ensure_draft(
        community,
        id,
        internal.lifecycle_version,
        admin,
        entry["commands"]["ensure"]
      )
    )

    internal = command!(CMS.Tickets.get_internal(community, id, admin))

    command!(
      CMS.Tickets.save_draft(
        community,
        id,
        %{body_bag: entry["bodyBag"]},
        internal.working_copy_revision,
        internal.lifecycle_version,
        admin,
        entry["commands"]["save"]
      )
    )

    internal = command!(CMS.Tickets.get_internal(community, id, admin))

    command!(
      CMS.Tickets.publish(
        community,
        id,
        "Acceptance reference graph",
        internal.working_copy_revision,
        internal.lifecycle_version,
        internal.workflow_version,
        admin,
        entry["commands"]["publish"],
        CMS.Tickets.Publication.preview_anchor(community.id, id)
      )
    )

    Map.put(resource, "snapshotId", Repo.get_by!(ArticlePublic, article_id: id).snapshot_id)
  end

  defp update!(resource, entry, _admin, author) do
    article = Repo.get!(Article, resource["articleId"])
    community = Repo.get_by!(Community, slug: resource["community"])

    working_copy =
      Repo.get_by!(ArticleWorkingCopy,
        article_id: article.id,
        scope_type: :default,
        scope_id: article.id
      )

    save_command_id = seed_command_id(entry["commandId"], "save-working-copy")
    publish_command_id = seed_command_id(entry["commandId"], "publish-article")

    saved =
      command!(
        CMS.Articles.save_working_copy(
          article,
          community,
          working_copy.id,
          %{body_bag: entry["bodyBag"]},
          working_copy.revision,
          author,
          save_command_id
        )
      )

    public = Repo.get_by(ArticlePublic, article_id: article.id)

    published =
      command!(
        CMS.Articles.publish_article(
          article,
          community,
          %{working_copy_id: saved.id, revision: saved.revision},
          public && public.snapshot_id,
          author,
          publish_command_id
        )
      )

    Map.put(resource, "snapshotId", published.public.snapshot_id)
  end

  defp seed_command_id(command_id, purpose) do
    {:ok, binary_id} = Ecto.UUID.dump(command_id)
    <<derived::binary-size(16), _rest::binary>> = :crypto.hash(:sha256, binary_id <> purpose)
    {:ok, uuid} = Ecto.UUID.load(derived)
    uuid
  end

  defp actor(id) do
    user = Repo.get!(User, id)
    {:ok, rules} = CMS.Passport.get_passport(user)
    %{user | cur_passport: rules}
  end

  defp command!({:ok, value}), do: value
  defp command!({:error, reason}), do: Repo.rollback({:seed_reference_failed, reason})
end
