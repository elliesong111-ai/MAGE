"""
MAGE Payment Backend
Flask server that creates Square and PayPal checkout links for the MAGE website.
"""

import os
import uuid
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from square.client import Client

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from GitHub Pages

# Square credentials from environment variables
SQUARE_ACCESS_TOKEN = os.environ.get("SQUARE_ACCESS_TOKEN", "")
SQUARE_LOCATION_ID = os.environ.get("SQUARE_LOCATION_ID", "")
SQUARE_ENVIRONMENT = os.environ.get("SQUARE_ENVIRONMENT", "sandbox")  # "sandbox" or "production"

# Initialize Square client
square_client = Client(
    access_token=SQUARE_ACCESS_TOKEN,
    environment=SQUARE_ENVIRONMENT,
)

# PayPal credentials from environment variables
PAYPAL_CLIENT_ID = os.environ.get("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET = os.environ.get("PAYPAL_CLIENT_SECRET", "")
PAYPAL_ENVIRONMENT = os.environ.get("PAYPAL_ENVIRONMENT", "sandbox")  # "sandbox" or "production"

PAYPAL_BASE_URL = (
    "https://api.sandbox.paypal.com"
    if PAYPAL_ENVIRONMENT == "sandbox"
    else "https://api.paypal.com"
)

SITE_URL = "https://elliesong111-ai.github.io/MAGE"


def get_paypal_access_token():
    """Obtain a PayPal OAuth2 access token."""
    resp = requests.post(
        f"{PAYPAL_BASE_URL}/v1/oauth2/token",
        auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
        data={"grant_type": "client_credentials"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "ok", "service": "MAGE Payment Backend"})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})


@app.route("/create-checkout", methods=["POST"])
def create_checkout():
    """
    Create a Square checkout link from the cart.

    Request body:
    {
        "cart": [
            {"sku": "signature", "name": "Signature Deck", "price": 10, "qty": 2},
            ...
        ],
        "shipping": 8,
        "gift_wrap": false,
        "customer": {
            "name": "...",
            "email": "...",
            "address": "..."
        }
    }

    Response:
    {
        "checkout_url": "https://checkout.square.site/..."
    }
    """
    try:
        data = request.get_json() or {}
        cart = data.get("cart", [])
        shipping = data.get("shipping", 0)
        gift_wrap = data.get("gift_wrap", False)
        customer = data.get("customer", {})

        if not cart:
            return jsonify({"error": "Cart is empty"}), 400

        # Build line items for Square
        line_items = []
        for item in cart:
            name = item.get("name", "Product")
            price = int(float(item.get("price", 0)) * 100)  # Convert to cents
            qty = str(item.get("qty", 1))

            line_items.append({
                "name": name,
                "quantity": qty,
                "base_price_money": {
                    "amount": price,
                    "currency": "USD"
                }
            })

        # Add shipping as a line item if applicable
        if shipping > 0:
            line_items.append({
                "name": "Shipping",
                "quantity": "1",
                "base_price_money": {
                    "amount": int(shipping * 100),
                    "currency": "USD"
                }
            })

        # Add gift wrap if selected
        if gift_wrap:
            line_items.append({
                "name": "Gift Packaging",
                "quantity": "1",
                "base_price_money": {
                    "amount": 500,  # $5
                    "currency": "USD"
                }
            })

        # Create checkout using Square Checkout API
        checkout_api = square_client.checkout

        # Generate unique idempotency key
        idempotency_key = str(uuid.uuid4())

        # Build the order
        order = {
            "order": {
                "location_id": SQUARE_LOCATION_ID,
                "line_items": line_items,
            },
            "idempotency_key": idempotency_key,
            "redirect_url": f"{SITE_URL}/?payment=success",
        }

        # Add customer email if provided
        if customer.get("email"):
            order["pre_populate_buyer_email"] = customer["email"]

        result = checkout_api.create_payment_link(body=order)

        if result.is_success():
            checkout_url = result.body.get("payment_link", {}).get("url", "")
            return jsonify({"checkout_url": checkout_url})
        else:
            errors = result.errors
            return jsonify({"error": "Failed to create checkout", "details": errors}), 500

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/create-paypal-order", methods=["POST"])
def create_paypal_order():
    """
    Create a PayPal order and return the approval URL.

    Request body:
    {
        "cart": [
            {"sku": "signature", "name": "Signature Deck", "price": 10, "qty": 2},
            ...
        ],
        "shipping": 8,
        "gift_wrap": false,
        "customer": {
            "name": "...",
            "email": "...",
            "address": "..."
        }
    }

    Response:
    {
        "approval_url": "https://www.paypal.com/checkoutnow?token=..."
    }
    """
    try:
        data = request.get_json() or {}
        cart = data.get("cart", [])
        shipping = float(data.get("shipping", 0))
        gift_wrap = data.get("gift_wrap", False)

        if not cart:
            return jsonify({"error": "Cart is empty"}), 400

        # Build PayPal line items and compute totals
        items = []
        item_total = 0.0

        for item in cart:
            name = item.get("name", "Product")
            price = float(item.get("price", 0))
            qty = int(item.get("qty", 1))
            item_total += price * qty
            items.append({
                "name": name,
                "quantity": str(qty),
                "unit_amount": {"currency_code": "USD", "value": f"{price:.2f}"},
            })

        if gift_wrap:
            item_total += 5.0
            items.append({
                "name": "Gift Packaging",
                "quantity": "1",
                "unit_amount": {"currency_code": "USD", "value": "5.00"},
            })

        order_total = item_total + shipping

        access_token = get_paypal_access_token()

        paypal_order = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "amount": {
                        "currency_code": "USD",
                        "value": f"{order_total:.2f}",
                        "breakdown": {
                            "item_total": {
                                "currency_code": "USD",
                                "value": f"{item_total:.2f}",
                            },
                            "shipping": {
                                "currency_code": "USD",
                                "value": f"{shipping:.2f}",
                            },
                        },
                    },
                    "items": items,
                }
            ],
            "application_context": {
                "return_url": f"{SITE_URL}/?payment=success",
                "cancel_url": f"{SITE_URL}/?payment=cancel",
                "brand_name": "MVGE",
                "user_action": "PAY_NOW",
            },
        }

        resp = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=paypal_order,
            timeout=15,
        )
        resp.raise_for_status()
        order_data = resp.json()

        # Find the "payer-action" (approval) link
        approval_url = next(
            (link["href"] for link in order_data.get("links", []) if link["rel"] == "payer-action"),
            None,
        )
        if not approval_url:
            return jsonify({"error": "Could not get PayPal approval URL"}), 500

        return jsonify({"approval_url": approval_url, "order_id": order_data["id"]})

    except requests.HTTPError as e:
        return jsonify({"error": "PayPal API error", "details": str(e)}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/capture-paypal-order/<order_id>", methods=["POST"])
def capture_paypal_order(order_id):
    """Capture a PayPal order after the payer approves it."""
    try:
        access_token = get_paypal_access_token()
        resp = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        resp.raise_for_status()
        return jsonify(resp.json())
    except requests.HTTPError as e:
        return jsonify({"error": "PayPal capture error", "details": str(e)}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
