module CompanyMonitoring
  class CompaniesView < CompanyMonitoring::ApplicationRecord
    self.table_name = "companies_latest_statuses_view"
    self.primary_key = "id"

    COLLECTIVE_PROCEDURES_STATUSES_FR = %w[
      judicial_liquidation
      redress
      deregistered
      none
    ].freeze

    COLLECTIVE_PROCEDURES_STATUSES_IT = %w[
      fallimento
      concordato_preventivo
      none
      other
      cancellazione
    ].freeze

    def creditsafe_report_url
      return if creditsafe_safenumber.blank?

      "https://www.creditsafe.fr/csfr/Company/Summary/#{creditsafe_safenumber}"
    end
  end
end
