defmodule GroupherServer.CMS.CommunityApplications.Write do
  @moduledoc """
  Transactional submission, cancellation, and expiry operations.

  Business position:

      Apply UI / reviewer
        -> GraphQL resolver
        -> CMS.CommunityApplications
        -> Write
        -> Repo / Oban
  """

  import Ecto.Query, warn: false

  alias Ecto.Multi
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Communities.{NamePolicy, SlugClaims}
  alias GroupherServer.CMS.CommunityApplications.{Config, LogoUploads, Policy, Transitions}
  alias GroupherServer.CMS.Model.CommunityApplication
  alias GroupherServer.Repo
  alias Helper.Utils

  @categories %{
    "PRODUCT" => :PRODUCT,
    "GAMING" => :GAMING,
    "TEACH" => :TEACH,
    "GROUP" => :GROUP
  }

  @spec submit(map(), User.t(), String.t()) :: {:ok, CommunityApplication.t()} | {:error, term()}
  def submit(attrs, %User{} = user, idempotency_key)
      when is_map(attrs) and is_binary(idempotency_key) do
    with {:ok, normalized} <- normalize_input(attrs),
         fingerprint <- fingerprint(normalized),
         :miss <- idempotency_lookup(user.id, idempotency_key, fingerprint),
         %{allowed: true} = policy <- Policy.can_apply(user),
         {:ok, upload} <- LogoUploads.fetch_finalized(normalized.logo_asset_ref, user) do
      now = DateTime.utc_now(:second)
      expires_at = DateTime.add(now, Config.submitted_ttl_days(), :day)

      application_changeset =
        CommunityApplication.changeset(%CommunityApplication{}, %{
          public_ref: "capp_" <> Utils.uid(24),
          user_id: user.id,
          status: :submitted,
          version: 1,
          title: normalized.title,
          slug: normalized.slug,
          desc: normalized.desc,
          logo_asset_ref: normalized.logo_asset_ref,
          locale: normalized.locale,
          apply_category: normalized.apply_category,
          apply_message: normalized.apply_message,
          idempotency_key: idempotency_key,
          input_fingerprint: fingerprint,
          policy_snapshot: policy,
          submitted_at: now,
          expires_at: expires_at
        })

      Multi.new()
      |> Multi.insert(:application, application_changeset)
      |> SlugClaims.insert_application(:slug_claim, :application, expires_at)
      |> LogoUploads.attach(:logo_upload, upload, :application)
      |> Multi.insert(:event, fn %{application: application} ->
        Transitions.initial_event_changeset(application, %{
          type: :applicant,
          id: user.id,
          operation_ref: idempotency_key,
          occurred_at: now
        })
      end)
      |> Repo.transaction()
      |> normalize_submit_result(user.id, idempotency_key, fingerprint)
    else
      {:hit, application} -> {:ok, application}
      {:error, _} = error -> error
      %{allowed: false, reason_code: reason_code} -> {:error, reason_code}
    end
  end

  @spec cancel(String.t(), User.t(), integer()) ::
          {:ok, CommunityApplication.t()} | {:error, term()}
  def cancel(public_ref, %User{} = user, expected_version) do
    now = DateTime.utc_now(:second)

    Repo.transaction(fn ->
      with {:ok, application} <- lock_owned(public_ref, user.id),
           :ok <- expected_version(application, expected_version) do
        Multi.new()
        |> Transitions.add(
          :application,
          :event,
          application,
          :cancelled,
          %{cancelled_at: now, expires_at: nil},
          %{type: :applicant, id: user.id, occurred_at: now}
        )
        |> SlugClaims.release_application(:claim, application, now)
        |> Repo.transaction()
        |> unwrap_nested_transaction()
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @spec expire_due(DateTime.t()) :: {:ok, non_neg_integer()} | {:error, term()}
  def expire_due(%DateTime{} = now) do
    applications =
      CommunityApplication
      |> where([application], application.status == :submitted and application.expires_at <= ^now)
      |> order_by([application], asc: application.expires_at)
      |> limit(100)
      |> Repo.all()

    Enum.reduce_while(applications, {:ok, 0}, fn application, {:ok, count} ->
      case expire_one(application.public_ref, now) do
        {:ok, :noop} -> {:cont, {:ok, count}}
        {:ok, _application} -> {:cont, {:ok, count + 1}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp expire_one(public_ref, now) do
    Repo.transaction(fn ->
      application =
        CommunityApplication
        |> where([application], application.public_ref == ^public_ref)
        |> lock("FOR UPDATE SKIP LOCKED")
        |> Repo.one()

      cond do
        is_nil(application) or application.status != :submitted ->
          :noop

        DateTime.compare(application.expires_at, now) == :gt ->
          :noop

        true ->
          operation_ref = "expire_" <> application.public_ref

          Multi.new()
          |> Transitions.add(
            :application,
            :event,
            application,
            :expired,
            %{expired_at: now, expires_at: nil},
            %{
              type: :job,
              operation_ref: operation_ref,
              metadata: %{"worker" => "ExpireSubmitted"},
              occurred_at: now
            }
          )
          |> SlugClaims.release_application(:claim, application, now)
          |> Repo.transaction()
          |> unwrap_nested_transaction()
      end
    end)
  end

  defp normalize_input(attrs) do
    title = attrs |> get(:title) |> normalize_string()
    desc = attrs |> get(:desc) |> normalize_string()
    logo_asset_ref = attrs |> get(:logo_asset_ref) |> normalize_string()
    locale = attrs |> get(:locale, "en") |> normalize_string()
    apply_message = attrs |> get(:apply_message) |> normalize_string()
    category = attrs |> get(:apply_category) |> normalize_category()

    with {:ok, slug} <- NamePolicy.validate(get(attrs, :slug)),
         true <- is_binary(title) and byte_size(title) <= 80,
         true <- is_binary(desc) and byte_size(desc) <= 2_000,
         true <- is_binary(logo_asset_ref),
         true <- is_binary(locale),
         true <- not is_nil(category) do
      {:ok,
       %{
         title: title,
         slug: slug,
         desc: desc,
         logo_asset_ref: logo_asset_ref,
         locale: locale,
         apply_category: category,
         apply_message: apply_message
       }}
    else
      {:error, _} = error -> error
      _ -> {:error, :invalid_application_input}
    end
  end

  defp idempotency_lookup(user_id, key, fingerprint) do
    case Repo.get_by(CommunityApplication, user_id: user_id, idempotency_key: key) do
      nil -> :miss
      %{input_fingerprint: ^fingerprint} = application -> {:hit, application}
      _ -> {:error, :idempotency_conflict}
    end
  end

  defp normalize_submit_result({:ok, %{application: application}}, _user_id, _key, _fingerprint),
    do: {:ok, application}

  defp normalize_submit_result(
         {:error, :application, %Ecto.Changeset{}, _changes},
         user_id,
         key,
         fingerprint
       ) do
    case idempotency_lookup(user_id, key, fingerprint) do
      {:hit, application} -> {:ok, application}
      {:error, :idempotency_conflict} -> {:error, :idempotency_conflict}
      :miss -> {:error, :active_application_exists}
    end
  end

  defp normalize_submit_result({:error, :slug_claim, _changeset, _changes}, _, _, _),
    do: {:error, :slug_claimed}

  defp normalize_submit_result({:error, _step, reason, _changes}, _, _, _), do: {:error, reason}

  defp lock_owned(public_ref, user_id) do
    case Repo.one(
           from(application in CommunityApplication,
             where: application.public_ref == ^public_ref and application.user_id == ^user_id,
             lock: "FOR UPDATE"
           )
         ) do
      nil -> {:error, :application_not_found}
      application -> {:ok, application}
    end
  end

  defp expected_version(%{version: version}, version), do: :ok
  defp expected_version(_, _), do: {:error, :application_state_conflict}

  defp unwrap_nested_transaction({:ok, %{application: application}}), do: application
  defp unwrap_nested_transaction({:error, _step, reason, _changes}), do: Repo.rollback(reason)

  defp fingerprint(attrs) do
    attrs
    |> Enum.sort()
    |> :erlang.term_to_binary()
    |> then(&:crypto.hash(:sha256, &1))
    |> Base.encode16(case: :lower)
  end

  defp normalize_category(value) when is_atom(value),
    do: normalize_category(Atom.to_string(value))

  defp normalize_category(value) when is_binary(value) do
    Map.get(@categories, value |> String.trim() |> String.upcase())
  end

  defp normalize_category(_), do: nil

  defp get(map, key, default \\ nil),
    do: Map.get(map, key, Map.get(map, Atom.to_string(key), default))

  defp normalize_string(value) when is_binary(value) do
    value = String.trim(value)
    if value == "", do: nil, else: value
  end

  defp normalize_string(_), do: nil
end
