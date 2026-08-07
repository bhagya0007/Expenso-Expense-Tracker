from typing import List, Dict, Any
from app.models.transaction import BankTransactionModel, TransactionType
from app.utils.logger import logger


class AnalyticsService:
    """
    Transaction Analytics & Financial Advice Engine.
    Generates Monthly Summaries, Budget Advice, and Savings Suggestions.
    Operates strictly on structured transaction objects — NEVER inspects raw PDF files.
    """

    def analyze_transactions(self, transactions: List[BankTransactionModel]) -> Dict[str, Any]:
        if not transactions:
            return {
                "monthlySummary": {
                    "totalIncome": 0.0,
                    "totalExpenses": 0.0,
                    "netSavings": 0.0,
                    "savingsRatePercentage": 0.0,
                    "categoryBreakdown": {},
                },
                "budgetAdvice": ["No transaction data available to generate budget advice."],
                "savingsSuggestions": ["Import transactions to receive personalized savings suggestions."],
            }

        total_income = sum(t.amount for t in transactions if t.type == TransactionType.CREDIT)
        total_expenses = sum(t.amount for t in transactions if t.type == TransactionType.DEBIT)
        net_savings = total_income - total_expenses
        savings_rate = round((net_savings / total_income * 100), 1) if total_income > 0 else 0.0

        category_breakdown: Dict[str, float] = {}
        for t in transactions:
            if t.type == TransactionType.DEBIT:
                cat = t.category or "Uncategorized"
                category_breakdown[cat] = round(category_breakdown.get(cat, 0.0) + t.amount, 2)

        budget_advice: List[str] = []
        
        food_spend = category_breakdown.get("Food", 0.0)
        shopping_spend = category_breakdown.get("Shopping", 0.0)
        entertainment_spend = category_breakdown.get("Entertainment", 0.0)

        if total_income > 0 and (food_spend / total_income) > 0.25:
            budget_advice.append(
                f"Food expenses (₹{food_spend:.2f}) account for over 25% of your income. Consider setting a strict monthly dining budget."
            )
            
        if total_income > 0 and (shopping_spend / total_income) > 0.20:
            budget_advice.append(
                f"Shopping expenses (₹{shopping_spend:.2f}) exceed 20% of income. Cap non-essential impulse purchases."
            )

        if total_expenses > total_income and total_income > 0:
            budget_advice.append(
                f"Deficit alert: Total monthly expenses (₹{total_expenses:.2f}) exceed income (₹{total_income:.2f}) by ₹{abs(net_savings):.2f}."
            )
        elif not budget_advice:
            budget_advice.append("Your category spending is well-balanced across essential and discretionary buckets.")

        savings_suggestions: List[str] = []
        
        if food_spend > 2000:
            potential_food_save = round(food_spend * 0.20, 2)
            savings_suggestions.append(
                f"Reducing food delivery orders by 20% can save approximately ₹{potential_food_save:.2f} per month."
            )

        if shopping_spend > 3000:
            potential_shop_save = round(shopping_spend * 0.15, 2)
            savings_suggestions.append(
                f"Delaying non-urgent e-commerce shopping could preserve ₹{potential_shop_save:.2f} in emergency savings."
            )

        if entertainment_spend > 1000:
            savings_suggestions.append(
                "Audit active streaming subscriptions and eliminate unused entertainment services to save monthly cashflow."
            )

        if not savings_suggestions:
            savings_suggestions.append(
                "Maintain your current spending discipline and transfer surplus savings directly into high-yield savings or mutual funds."
            )

        logger.info(f"AnalyticsService generated report across {len(transactions)} transaction objects")

        return {
            "monthlySummary": {
                "totalIncome": total_income,
                "totalExpenses": total_expenses,
                "netSavings": net_savings,
                "savingsRatePercentage": savings_rate,
                "categoryBreakdown": category_breakdown,
            },
            "budgetAdvice": budget_advice,
            "savingsSuggestions": savings_suggestions,
        }


analytics_service = AnalyticsService()
