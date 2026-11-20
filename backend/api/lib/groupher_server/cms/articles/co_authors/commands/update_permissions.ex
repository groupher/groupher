defmodule GroupherServer.CMS.Articles.CoAuthors.Commands.UpdatePermissions do
  @moduledoc """
  Replaces one co-author's Article Passport grants under the aggregate lock.

      Receipt -> Article / User / member locks -> Passport grants + audit event
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.CoAuthors.{Effects, Locks}
  alias CMS.Model.{Article, ArticleCoAuthor, Author}
  alias CMS.Passport.Scope.ArticleGrant

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation keyed by the current member whose Article grants changed.

        committed grant replacement -> member_id -> Receipt replay -> current member read
    """
    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :article_co_author_permissions_update,
      data_keys: ["member_id"],
      field_types: %{"member_id" => :string}
  end

  @pipeline operation: :article_co_author_permissions_update,
            confirmation: Confirmation,
            target: :article,
            params: [:member_id, :revision, :permissions]
  receipt_pipeline run(article, member_id, revision, permissions, actor, command_id) do
    gate(fn canonical -> CMS.Gate.check_in_transaction(actor, :manage_coauthors, canonical) end)

    change(fn canonical, operation ->
      with %ArticleCoAuthor{} = candidate <-
             Repo.get_by(ArticleCoAuthor, id: member_id, article_id: canonical.id),
           {:ok, subject} <- member_user(candidate),
           {:ok, locked} <- Locks.lock(canonical.id, [actor.id, subject.id]),
           %ArticleCoAuthor{} = member <- Enum.find(locked.members, &(&1.id == member_id)),
           true <- member.revision == revision,
           {:ok, desired} <- CMS.Passport.Catalog.validate_permissions(:article, permissions),
           {:ok, updated} <- replace_grants(member, subject, desired),
           {:ok, :pass} <- record_changes(member, updated, actor, subject, operation) do
        {:ok, updated}
      else
        nil -> {:error, :article_co_author_not_found}
        false -> {:error, :permission_revision_conflict}
        {:error, _} = error -> error
      end
    end)

    confirm(fn member -> {:ok, %Confirmation{data: %{"member_id" => member.id}}} end)

    present(fn %Confirmation{data: %{"member_id" => id}} ->
      case Repo.get(ArticleCoAuthor, id) do
        %ArticleCoAuthor{} = member -> {:ok, member}
        nil -> {:error, CMS.ErrorCat.command_result_unavailable()}
      end
    end)
  end

  @doc "Replaces the grantable Article permissions for one current member."
  def execute(%Article{} = article, member_id, revision, permissions, %User{} = actor, command_id)
      when is_binary(member_id) and is_integer(revision) and revision > 0 and
             is_map(permissions) and is_binary(command_id),
      do: run(article, member_id, revision, permissions, actor, command_id)

  def execute(_, _, _, _, _, _), do: {:error, :invalid_article_co_author_permissions}

  defp member_user(%ArticleCoAuthor{author_id: author_id}) do
    case Repo.get(Author, author_id) do
      %Author{user_id: id} ->
        case Repo.get(User, id) do
          %User{} = user -> {:ok, user}
          nil -> {:error, :article_co_author_not_found}
        end

      nil ->
        {:error, :article_co_author_not_found}
    end
  end

  defp replace_grants(member, subject, desired) do
    current = member.permissions
    removals = for {action, true} <- current, desired[action] != true, do: action
    additions = for {action, true} <- desired, current[action] != true, do: {action, true}
    scope = %ArticleGrant{subject_id: subject.id, article_id: member.article_id, member: member}

    if removals == [] and additions == [] do
      {:ok, member}
    else
      with {:ok, after_revoke} <- revoke_if_needed(subject, scope, removals, member.revision),
           {:ok, updated} <- grant_if_needed(subject, scope, additions, after_revoke) do
        {:ok, updated}
      end
    end
  end

  defp revoke_if_needed(_subject, _scope, [], _revision), do: {:ok, nil}

  defp revoke_if_needed(subject, scope, removals, revision),
    do: CMS.Passport.revoke_in_transaction(subject, scope, removals, revision)

  defp grant_if_needed(_subject, _scope, [], nil), do: {:ok, nil}
  defp grant_if_needed(_subject, _scope, [], member), do: {:ok, member}

  defp grant_if_needed(subject, scope, additions, nil),
    do:
      CMS.Passport.grant_in_transaction(subject, scope, Map.new(additions), scope.member.revision)

  defp grant_if_needed(subject, scope, additions, member) do
    updated_scope = %{scope | member: member}
    CMS.Passport.grant_in_transaction(subject, updated_scope, Map.new(additions), member.revision)
  end

  defp record_changes(before, after_member, actor, subject, operation) do
    before_permissions = before.permissions
    after_permissions = after_member.permissions

    removed =
      for {action, true} <- before_permissions, after_permissions[action] != true, do: action

    added =
      for {action, true} <- after_permissions, before_permissions[action] != true, do: action

    events =
      []
      |> maybe_event(:revoke, removed, before_permissions, Map.drop(before_permissions, removed))
      |> maybe_event(
        :grant,
        added,
        if(removed == [], do: before_permissions, else: Map.drop(before_permissions, removed)),
        after_permissions
      )

    events
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, :pass}, fn {{type, event_before, event_after}, index}, _acc ->
      case Effects.record_event(%{
             article_id: before.article_id,
             subject_user_id: subject.id,
             member_id: before.id,
             actor: actor,
             type: type,
             before_permissions: event_before,
             after_permissions: event_after,
             request_id: nil,
             operation_ref: operation,
             operation_index: index
           }) do
        {:ok, _event} -> {:cont, {:ok, :pass}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp maybe_event(events, _type, [], _before, _after), do: events

  defp maybe_event(events, type, _changed, before, after_permissions),
    do: events ++ [{type, before, after_permissions}]
end
