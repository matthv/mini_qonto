module Api
  class Organization < Api::ApplicationRecord
    has_one :current_bank_account, -> { where(account_type: 0) }, class_name: "Api::BankAccount"
    has_one :account_owner, -> { where(role: Api::Membership::ROLES[:owner]) }, class_name: "Api::Membership"
    has_one :cs_organization, class_name: "Api::CsOrganization"

    has_many :deposit_accounts, -> { where(account_type: 1) }, class_name: "Api::BankAccount"
    has_many :memberships
    has_many :active_memberships, -> { where(status: Api::Membership::STATUS[:active]) }, class_name: "Api::Membership"
    has_many :bank_accounts
    has_many :transfers, through: :bank_accounts
    has_many :wallet_to_wallets, through: :bank_accounts
    has_many :beneficiaries, through: :bank_accounts
    has_many :incomes, through: :bank_accounts
    has_many :transactions, through: :bank_accounts

    belongs_to :treezor_organization, class_name: "Api::Organization", optional: true

    STATUS = {
      kyb_waiting: 0,
      activated: 1,
      suspended: 2,
      deactivated: 3
    }.freeze

    KYB_STATUS = {
      pending: 0,
      reviewable: 1,
      submitted: 2,
      accepted: 3,
      refused: 4,
      submission_error: 5,
      waiting_document: 6
    }.freeze

    KYB_LEVEL = {
      init: 0,
      light: 1,
      regular: 2,
      dismissed: 4
    }.freeze

    KYB_REVIEW = {
      review_none: 0,
      review_pending: 1,
      review_validated: 2,
      review_refused: 3
    }.freeze

    KYB_SUBMISSION_ERRORS = {
      unknow_error: 0,
      address_required: 1,
      birth_country_required: 2,
      nationality_required: 3,
      other_threads_currently_uploading_documents: 4,
      server_down: 5
    }.freeze

    CONTRACT_STATUS = {
      signature_requested: 0,
      signed: 1
    }.freeze

    DEPOSIT_CAPITAL_STATUS = {
      waiting: 0,
      uncompleted: 1,
      mismatch: 2,
      deposit_request_sent: 3,
      deposit_request_signed: 4,
      reviewed: 5,
      capital_transferred: 6,
      deposit_certificate_sent: 7,
      deposit_certificate_signed: 8,
      kbis_submitted: 9,
      deposit_release_sent: 10,
      deposit_release_requested: 11,
      capital_released: 12,
      awaiting_documents: 13,
      pending_review: 14,
      awaiting_shareholders: 15
    }.freeze

    LOCALES = {
      en: 0,
      fr: 1,
      it: 2,
      de: 3,
      es: 4
    }.freeze

    MISMATCH_REASONS = {
      emitter_name: 0,
      income_amount: 1,
      emitter_name_and_income_amount: 2,
      wallet_to_wallet: 3
    }.freeze

    CORE_BANKING_SYSTEM = {
      treezor: 0,
      qonto: 1
    }.freeze

    MIGRATION_STATUS = {
      checking: 0,
      pending: 1,
      preoptin: 2,
      closing: 3,
      optin: 4,
      in_progress: 5,
      completed: 6
    }.freeze

    COMPANY_CREATION_STATUS = %w[
      pending
      application_pending
      application_submitted
      application_rejected
      application_accepted
      capital_deposit_submitted
      capital_deposit_rejected
      capital_deposit_accepted
      registration_submitted
    ].freeze

    LEGAL_COUNTRY_IT = "IT"

    enum :status, STATUS
    enum :locale, LOCALES
    enum :kyb_status, KYB_STATUS
    enum :kyb_level, KYB_LEVEL
    enum :kyb_review, KYB_REVIEW
    enum :kyb_submission_error, KYB_SUBMISSION_ERRORS
    enum :contract_status, CONTRACT_STATUS
    enum :deposit_capital_status, DEPOSIT_CAPITAL_STATUS
    enum :mismatch_reason, MISMATCH_REASONS
    enum :core_banking_system, CORE_BANKING_SYSTEM
    enum :migration_status, MIGRATION_STATUS, prefix: :migration_status
    enum :company_creation_status, COMPANY_CREATION_STATUS.zip(COMPANY_CREATION_STATUS).to_h.freeze, prefix: :company_creation

    alias_method :cs, :cs_organization

    def cbs
      core_banking_system
    end

    def international?
      legal_country.to_s.strip.upcase != "FR"
    end

    def italian?
      legal_country == LEGAL_COUNTRY_IT
    end

    def ongoing_accepted_incorporation?
      %w[
        application_accepted
        capital_deposit_submitted
        capital_deposit_rejected
        capital_deposit_accepted
      ].include?(company_creation_status)
    end
  end
end
