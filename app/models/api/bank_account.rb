module Api
  class BankAccount < Api::ApplicationRecord
    belongs_to :organization
    belongs_to :organizations_view, foreign_key: :organization_id
    belongs_to :subject, polymorphic: true, touch: true, optional: true
    belongs_to :membership, class_name: "Api::Membership", foreign_key: :subject_id, optional: true

    has_many :transactions
    has_many :transfers
    has_many :beneficiaries
    has_many :incomes
    has_many :wallet_to_wallets

    STATUS = {
      pending: 0,
      active: 1,
      closed: 2,
      canceled_by_provider: 3,
      waiting_for_funds: 4
    }.freeze

    ACCOUNT_TYPE = {
      current: 0,
      deposit: 1,
      card: 2,
      closure: 3,
      processor: 4,
      seizure: 5,
      release: 6,
      remunerated: 7,
      wealth: 8,
      other: 9,
      shadow: 10
    }.freeze

    BANKING_SYSTEMS = {
      (QONTO = :qonto) => "qonto",
      (CONNECT = :connect) => "connect"
    }.freeze

    enum :status, STATUS
    enum :account_type, ACCOUNT_TYPE

    def self.seizable(organization_id)
      current
        .active
        .where(organization_id: organization_id)
        .where(authorized_balance_cents: 1..)
        .order(main: :desc)
    end

    def qonto_cbs?
      organization.qonto?
    end

    def external?
      provider_object_type == BANKING_SYSTEMS[CONNECT]
    end

    def cbs
      @cbs ||= external? ? BANKING_SYSTEMS[CONNECT] : organization.core_banking_system
    end
  end
end
