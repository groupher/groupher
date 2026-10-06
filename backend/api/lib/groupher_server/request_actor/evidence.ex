defmodule GroupherServer.RequestActor.Evidence do
  @moduledoc """
  Selects exactly one trusted request object and wraps it in an internal typed
  variant before classification. Invalid or conflicting trusted inputs fail
  closed; raw IDs and caller-selected classifications are ignored.

      verified request objects
        -> Evidence.select/1
        -> one typed variant or conflict error
  """

  alias GroupherServer.{Accounts, CMS, RequestActor}
  alias Accounts.Model.User
  alias CMS.ViewTracker.AnonymousSession
  alias RequestActor.Crawler

  defmodule AccountSession do
    @moduledoc """
    Carries one account session already verified at the request boundary.

        verified User -> AccountSession -> human classification
    """
    @enforce_keys [:user]
    defstruct [:user]
    @type t :: %__MODULE__{user: User.t()}
  end

  defmodule SignedAnonymousSession do
    @moduledoc """
    Carries one signed first-party anonymous browser session.

        verified anonymous cookie -> SignedAnonymousSession -> probable human
    """
    @enforce_keys [:session]
    defstruct [:session]
    @type t :: %__MODULE__{session: AnonymousSession.t()}
  end

  defmodule ServiceCredential do
    @moduledoc """
    Carries one service credential already verified for its issuer and claims.

        verified service JWT -> ServiceCredential -> agent classification
    """
    @enforce_keys [:credential]
    defstruct [:credential]
    @type t :: %__MODULE__{credential: map()}
  end

  defmodule Delegation do
    @moduledoc """
    Keeps the verified service and delegated user binding together.

        service + bound User -> Delegation -> authenticated agent
    """
    @enforce_keys [:delegation]
    defstruct [:delegation]
    @type t :: %__MODULE__{delegation: map()}
  end

  defmodule VerifiedCrawler do
    @moduledoc """
    Wraps a crawler result produced by a trusted verifier.

        RequestActor.Crawler -> VerifiedCrawler -> crawler classification
    """
    @enforce_keys [:crawler]
    defstruct [:crawler]
    @type t :: %__MODULE__{crawler: Crawler.t()}
  end

  defmodule Unknown do
    @moduledoc """
    Records whether an untrusted request was merely self-reported or had no
    usable evidence.

        User-Agent or no signal -> Unknown -> fail-closed classification
    """
    @enforce_keys [:classified_by]
    defstruct [:classified_by]
    @type t :: %__MODULE__{classified_by: :self_reported | :fallback}
  end

  @type t ::
          AccountSession.t()
          | SignedAnonymousSession.t()
          | ServiceCredential.t()
          | Delegation.t()
          | VerifiedCrawler.t()
          | Unknown.t()

  @trusted_keys [
    :account_session,
    :anonymous_session,
    :service_credential,
    :delegation,
    :crawler
  ]

  @doc """
  Selects exactly one verified request identity for classification.

  Conflicting or malformed trusted inputs fail closed. When no trusted input is
  present, the User-Agent may produce self-reported automation evidence; a signed
  anonymous session never upgrades such automation into a probable human.
  """
  @spec select(keyword()) :: {:ok, t()} | {:error, :conflicting_evidence | :invalid_evidence}
  def select(opts) when is_list(opts) do
    with {:ok, evidence} <- trusted_evidence(opts) do
      case evidence do
        [] ->
          {:ok, unknown_evidence(opts)}

        [%SignedAnonymousSession{} = selected] ->
          if self_reported_automation?(Keyword.get(opts, :user_agent)) do
            {:ok, %Unknown{classified_by: :self_reported}}
          else
            {:ok, selected}
          end

        [selected] ->
          {:ok, selected}

        _multiple ->
          {:error, :conflicting_evidence}
      end
    end
  end

  def select(_opts), do: {:error, :invalid_evidence}

  defp trusted_evidence(opts) do
    Enum.reduce_while(@trusted_keys, {:ok, []}, fn key, {:ok, evidence} ->
      case build(key, Keyword.get(opts, key)) do
        :missing -> {:cont, {:ok, evidence}}
        {:ok, item} -> {:cont, {:ok, [item | evidence]}}
        :error -> {:halt, {:error, :invalid_evidence}}
      end
    end)
  end

  defp build(_key, nil), do: :missing

  defp build(:account_session, %User{} = user) do
    {:ok, %AccountSession{user: user}}
  end

  defp build(:anonymous_session, %AnonymousSession{} = session) do
    {:ok, %SignedAnonymousSession{session: session}}
  end

  defp build(:service_credential, credential) when is_map(credential) do
    if valid_service_credential?(credential) do
      {:ok, %ServiceCredential{credential: credential}}
    else
      :error
    end
  end

  defp build(
         :delegation,
         %{service_actor: credential, user_actor: %User{}} = delegation
       ) do
    if valid_service_credential?(credential) do
      {:ok, %Delegation{delegation: delegation}}
    else
      :error
    end
  end

  defp build(:crawler, %Crawler{family: family} = crawler)
       when is_binary(family) and byte_size(family) > 0 do
    {:ok, %VerifiedCrawler{crawler: crawler}}
  end

  defp build(_key, _value), do: :error

  defp valid_service_credential?(credential) do
    is_binary(Map.get(credential, :audience)) and
      match?(%MapSet{}, Map.get(credential, :scopes)) and
      is_binary(Map.get(credential, :subject)) and
      (is_nil(Map.get(credential, :token_id)) or is_binary(Map.get(credential, :token_id)))
  end

  defp unknown_evidence(opts) do
    user_agent = Keyword.get(opts, :user_agent)

    if self_reported_automation?(user_agent) do
      %Unknown{classified_by: :self_reported}
    else
      %Unknown{classified_by: :fallback}
    end
  end

  defp self_reported_automation?(user_agent) when is_binary(user_agent) do
    Regex.match?(~r/(bot\b|crawler\b|spider\b|slurp\b|scraper\b|headless|phantomjs)/i, user_agent)
  end

  defp self_reported_automation?(_user_agent), do: false
end
