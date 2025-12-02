module Api
  class CsOrganization < Api::ApplicationRecord
    belongs_to :organization
    belongs_to :organizations_view, foreign_key: :organization_id

    ONBOARDING_RISK_CHECK_STATUS = {
      pending: 0,
      accepted: 1,
      rejected: 2,
      escalated: 3,
      ubo_waiting_doc: 4
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

    KBIS_INVALID_REASONS = [
      "temporary_document",
      "ubo_related_document",
      "unrelated_document",
      "insee_document",
      "suspicious_document",
      "information_mismatch",
      "power_poi_required",
      "forbidden_activity",
      "ubo_blacklisted",
      "deregistered_company"
    ].freeze

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

    enum :kbis_invalid_reason, KBIS_INVALID_REASONS.zip(KBIS_INVALID_REASONS).to_h, prefix: :kbis_invalid_reason
    enum :onboarding_risk_check_status, ONBOARDING_RISK_CHECK_STATUS, prefix: :onboarding_risk_check
    enum :account_closing_notice_period, ACCOUNT_CLOSING_NOTICE_PERIOD
    enum :license_registration_status, LICENSE_REGISTRATION_STATUS.zip(LICENSE_REGISTRATION_STATUS).to_h.freeze
    enum :license_registration_type, LICENSE_REGISTRATION_TYPE.zip(LICENSE_REGISTRATION_TYPE).to_h.freeze
  end
end
