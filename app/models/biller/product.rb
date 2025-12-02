module Biller
  class Product < Biller::ApplicationRecord
    has_many :subscriptions

    PPRODUCT_CODE_NAME_MAPPING = {
      # Legacy plans
      essential: "Legacy - Solo (9)",
      essential_legacy: "Legacy - Solo (9)",
      prepaid_essential: "Legacy - Solo prepaid (9)",
      deposit_essential: "Legacy - Solo deposit (9)",
      standard: "Legacy - Standard (29)",
      prepaid_standard: "Legacy - Standard prepaid (29)",
      deposit_standard: "Legacy - Standard deposit (29)",
      premium: "Legacy - Advanced (99)",
      # Solo plans
      solo_basic: "Solo - Basic (9)",
      solo_basic_deposit: "Solo - Basic deposit (9)",
      solo_basic_prepaid: "Solo - Basic prepaid (9)",
      solo_basic_2023: "Solo - Basic (11 / 108)",
      solo_basic_2024: "Solo - Basic (11 / 108)",
      solo_smart: "Solo - Smart (19)",
      solo_smart_deposit: "Solo - Smart deposit (19)",
      solo_smart_prepaid: "Solo - Smart prepaid (19)",
      solo_smart_2023: "Solo - Smart (23 / 228)",
      solo_smart_2024: "Solo - Smart (23 / 228)",
      solo_premium: "Solo - Premium (39)",
      solo_premium_2023: "Solo - Premium (45 / 468)",
      solo_premium_2024: "Solo - Premium (45 / 468)",
      # Team plans
      team_essential: "Team - Essential (29)",
      team_essential_deposit: "Team - Essential deposit (29)",
      team_essential_prepaid: "Team - Essential prepaid (29)",
      team_essential_2023: "Team - Essential (34 / 348)",
      team_essential_2024: "Team - Essential (59 / 588)",
      team_business: "Team - Business (99)",
      team_business_2023: "Team - Business (119 / 1188)",
      team_business_2024: "Team - Business (119 / 1188)",
      team_enterprise: "Team - Enterprise (249)",
      team_enterprise_2023: "Team - Enterprise (299 / 2988)",
      team_enterprise_2024: "Team - Enterprise (249 / 2388)",
      # Addons
      accounts_payable: "Accounts Payable addon (69 / 708)",
      accounts_receivable: "Accounts Receivable addon (45 / 420)",
      expense_spend_management: "Expense & Spend Management addon (89 / 828)",
      cash_flow_management: "Cash Flow Management addon (49 / 468)"
    }

    def formatted_code
      PPRODUCT_CODE_NAME_MAPPING[code.to_sym] || code.to_s
    end
  end
end
