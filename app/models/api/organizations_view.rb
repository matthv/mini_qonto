module Api
  class OrganizationsView < Api::ApplicationRecord
    self.primary_key = "id"

    has_one :current_bank_account, -> { where(account_type: 0) }, class_name: "Api::BankAccount", foreign_key: :organization_id
    has_one :cs_organization, class_name: "Api::CsOrganization", foreign_key: :organization_id

    has_many :bank_accounts, foreign_key: :organization_id
    has_many :incomes, through: :bank_accounts, foreign_key: :organization_id
    has_many :transactions, through: :bank_accounts, foreign_key: :organization_id
    has_many :claims, class_name: "CardClaim::Claim", foreign_key: :organization_id

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

    MISMATCH_REASONS = {
      emitter_name: 0,
      income_amount: 1,
      emitter_name_and_income_amount: 2,
      wallet_to_wallet: 3
    }.freeze

    FX_STATUS = {
      fx_kyc_waiting: 0,
      fx_approved: 1,
      fx_suspended: 2,
      fx_kyc_submission_error: 3
    }.freeze

    CORE_BANKING_SYSTEM = {
      treezor: 0,
      qonto: 1
    }.freeze

    ONBOARDING_RISK_CHECK_STATUS = {
      pending: 0,
      accepted: 1,
      rejected: 2,
      escalated: 3,
      ubo_waiting_doc: 4
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

    ACCOUNT_CLOSING_NOTICE_PERIOD = {
      immediate: 0,
      thirty_days: 1,
      sixty_days: 2,
      ninety_days: 3,
      seven_days: 4,
      ten_days: 5,
      fifteen_days: 6,
      twenty_days: 7,
      end_of_the_month: 8,
      end_sdd_refund_period: 9,
      one_day: 10
    }.freeze

    IT_ACTIVITY_STATUS = ["unknown", "active", "inactive"].freeze

    LICENSE_REGISTRATION_STATUS = %w[
      to_clean
      no_registration_required
      registration_required
      registration_in_progress
      registration_confirmed
      amf_blacklist
      struck_off
    ].freeze

    LICENSE_REGISTRATION_TYPE = %w[
      finance
      insurance
      crypto
      risky_activity
      fincrime_review
      poi
    ].freeze

    enum :status, STATUS
    enum :locale, Organization::LOCALES
    enum :kyb_status, KYB_STATUS
    enum :kyb_status, KYB_STATUS, prefix: true
    enum :kyb_level, KYB_LEVEL
    enum :kyb_review, KYB_REVIEW
    enum :contract_status, CONTRACT_STATUS
    enum :deposit_capital_status, DEPOSIT_CAPITAL_STATUS
    enum :mismatch_reason, MISMATCH_REASONS
    enum :core_banking_system, CORE_BANKING_SYSTEM
    enum :onboarding_risk_check_status, ONBOARDING_RISK_CHECK_STATUS, prefix: :onboarding_risk_check
    enum :account_closing_notice_period, ACCOUNT_CLOSING_NOTICE_PERIOD
    enum :migration_status, MIGRATION_STATUS, prefix: :migration_status
    enum :license_registration_status, LICENSE_REGISTRATION_STATUS.zip(LICENSE_REGISTRATION_STATUS).to_h.freeze
    enum :license_registration_type, LICENSE_REGISTRATION_TYPE.zip(LICENSE_REGISTRATION_TYPE).to_h.freeze

    alias_method :cs, :cs_organization

    def italian?
      legal_country == "IT"
    end

    def german?
      legal_country == "DE"
    end

    def belgian?
      legal_country == "BE"
    end

    def french?
      legal_country == "FR"
    end

    def spanish?
      legal_country == "ES"
    end

    def companies_view
      @companies_view ||= CompanyMonitoring::CompaniesView.find_by(organization_id: id)
    end

    def account_closing_requested?
      account_closing_requested_at.present?
    end
  end
end
