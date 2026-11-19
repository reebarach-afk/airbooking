"""Simulated payment gateway. No real card data is ever stored.

Test behaviour (documented in the README):
  * card numbers ending in 0002  -> declined
  * everything else              -> approved
"""
import secrets
from dataclasses import dataclass


@dataclass
class PaymentResult:
    success: bool
    reference: str = ""
    message: str = ""


def process_payment(method, amount, card_number="", upi_id=""):
    if method == "card" and card_number.replace(" ", "").endswith("0002"):
        return PaymentResult(False, message="Payment declined by the issuing bank. Try another card.")
    if method == "upi" and upi_id.lower().startswith("fail"):
        return PaymentResult(False, message="UPI payment failed. Please try again.")
    return PaymentResult(True, reference="PAY-" + secrets.token_hex(5).upper(), message="Payment successful.")
