import re
from typing import Dict, List, Optional
from app.utils.logger import logger

CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "Food": [
        "swiggy", "zomato", "mcdonalds", "dominos", "starbucks", "kfc",
        "restaurant", "cafe", "dining", "bakery", "dosa", "bikanervala",
        "eats", "food", "kitchen", "pizzeria", "canteen", "coffee"
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "zara", "ajio", "blinkit",
        "zepto", "dmart", "supermarket", "mall", "retail", "mart",
        "store", "fashion", "apparel", "decathlon", "uniqlo"
    ],
    "Bills": [
        "electricity", "water", "gas", "wifi", "broadband", "airtel",
        "jio", "recharge", "bescom", "tata power", "billdesk", "utility",
        "postpaid", "electricity bill", "piped gas", "dth"
    ],
    "Travel": [
        "uber", "ola", "rapido", "irctc", "indigo", "air india",
        "spicejet", "makemytrip", "goibibo", "fuel", "petrol", "toll",
        "metro", "fastag", "shell", "hpcl", "bpcl", "iocl", "cab"
    ],
    "Salary": [
        "salary", "payroll", "stipend", "wages", "credit/salary",
        "remuneration", "monthly pay", "sal credit", "monthly salary"
    ],
    "Entertainment": [
        "netflix", "spotify", "prime video", "hotstar", "bookmyshow",
        "pvr", "inox", "cinema", "steam", "playstation", "movie",
        "youtube", "gaming", "tickets"
    ],
}


class CategoryAssigner:
    """
    Rule-based Transaction Auto-Categorizer.
    Evaluates transaction text signatures and assigns one of the 6 standard categories:
    Food, Shopping, Bills, Travel, Salary, Entertainment (or 'Uncategorized').
    Never modifies raw extracted parser fields.
    """

    def assign_category(self, description: str, transaction_type: str = "debit") -> str:
        if not description:
            return "Uncategorized"
            
        desc_lower = description.lower()
        
        if "salary" in desc_lower or "payroll" in desc_lower or "stipend" in desc_lower:
            return "Salary"

        for category, keywords in CATEGORY_KEYWORDS.items():
            for kw in keywords:
                if kw in desc_lower:
                    return category

        return "Uncategorized"


category_assigner = CategoryAssigner()
