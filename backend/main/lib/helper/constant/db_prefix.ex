defmodule Helper.Constant.DBPrefix do
  @moduledoc """
  Canonical PostgreSQL schema prefixes used by Ecto schemas and migrations.

  Keeping these names in one module prevents domain schemas from drifting onto
  differently named database namespaces.

  Business position:

      Domain or web caller
        -> DBPrefix
        -> normalized value / infrastructure
  """

  @default "public"
  @cms "cms"
  @account "account"
  @statistics "statistics"
  @delivery "delivery"
  @messaging "messaging"
  @log "log"
  @activity "activity"

  @doc "Returns the default PostgreSQL schema prefix."
  def default, do: @default
  @doc "Returns the CMS PostgreSQL schema prefix."
  def cms, do: @cms
  @doc "Returns the Messaging PostgreSQL schema prefix."
  def messaging, do: @messaging
  @doc "Returns the Delivery PostgreSQL schema prefix."
  def delivery, do: @delivery
  @doc "Returns the Statistics PostgreSQL schema prefix."
  def statistics, do: @statistics
  @doc "Returns the Accounts PostgreSQL schema prefix."
  def account, do: @account
  @doc "Returns the Log PostgreSQL schema prefix."
  def log, do: @log
  @doc "Returns the Activity PostgreSQL schema prefix."
  def activity, do: @activity
end
