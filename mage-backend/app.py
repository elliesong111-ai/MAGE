"""
MAGE Payment Backend
Flask server using PayPal REST API v2 for checkout and order confirmation emails.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

PAYPAL_CLIENT_ID = os.environ.get("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET = os.environ.get("PAYPAL_CLIENT_SECRET", "")
PAYPAL_ENVIRONMENT = os.environ.get("PAYPAL_ENVIRONMENT", "sandbox")
PAYPAL_BASE_URL = (
    "https://api-m.paypal.com"
    if PAYPAL_ENVIRONMENT == "production"
    else "https://api-m.sandbox.paypal.com"
)

EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USER = os.environ.get("EMAIL_USER", "")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "magecards7@gmail.com")


def get_paypal_token():
    resp = requests.post(
        f"{PAYPAL_BASE_URL}/v1/oauth2/token",
        auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
        data={"grant_type": "client_credentials"},
        headers={"Accept": "application/json"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def send_confirmation_email(customer_email, customer_name, cart, total):
    if not EMAIL_USER or not EMAIL_PASSWORD:
        return  # Skip if not configured

    items_html = "".join(
        f"<li>{item.get('name', 'Item')} &times; {item.get('qty', 1)}"
        f" &mdash; ${float(item.get('price', 0)) * int(item.get('qty', 1)):.2f}</li>"
        for item in cart
    )

    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#222;">
      <h2 style="color:#000;">Thank you for your order, {customer_name}!</h2>
      <p>Your MVGE order has been confirmed and payment received.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr style="border-bottom:2px solid #000;">
            <th style="text-align:left;padding:6px 0;">Item</th>
            <th style="text-align:right;padding:6px 0;">Price</th>
          </tr>
        </thead>
        <tbody>
          {"".join(
            f'<tr><td style="padding:6px 0;">{item.get("name","Item")} &times; {item.get("qty",1)}</td>'
            f'<td style="text-align:right;padding:6px 0;">${float(item.get("price",0))*int(item.get("qty",1)):.2f}</td></tr>'
            for item in cart
          )}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid #000;">
            <td style="padding:8px 0;font-weight:bold;">Total</td>
            <td style="text-align:right;padding:8px 0;font-weight:bold;">${total:.2f}</td>
          </tr>
        </tfoot>
      </table>
      <p>We&rsquo;ll be in touch about shipping details soon.</p>
      <p>Questions? Reply to this email or DM
         <a href="https://www.instagram.com/mvgecards">@MVGE</a> on Instagram.</p>
      <p style="color:#888;font-size:0.85rem;">&mdash; The MVGE Team</p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your MVGE Order Confirmation"
    msg["From"] = EMAIL_FROM
    msg["To"] = customer_email
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_FROM, customer_email, msg.as_string())


@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "ok", "service": "MAGE Payment Backend"})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})


@app.route("/config", methods=["GET"])
def config():
    """Return public configuration for the frontend (PayPal client ID)."""
    return jsonify({"paypal_client_id": PAYPAL_CLIENT_ID})


@app.route("/create-paypal-order", methods=["POST"])
def create_paypal_order():
    """
    Create a PayPal order from the cart.

    Request body:
    {
        "cart": [{"name": "Signature Deck", "price": 10, "qty": 2}, ...],
        "gift_wrap": false
    }

    Response: {"id": "PAYPAL_ORDER_ID"}
    """
    try:
        data = request.get_json() or {}
        cart = data.get("cart", [])
        gift_wrap = data.get("gift_wrap", False)

        if not cart:
            return jsonify({"error": "Cart is empty"}), 400

        total = sum(
            float(item.get("price", 0)) * int(item.get("qty", 1)) for item in cart
        )
        if gift_wrap:
            total += 5.0

        token = get_paypal_token()

        order_payload = {
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "amount": {
                        "currency_code": "USD",
                        "value": f"{total:.2f}",
                        "breakdown": {
                            "item_total": {
                                "currency_code": "USD",
                                "value": f"{total:.2f}",
                            }
                        },
                    },
                    "items": [
                        {
                            "name": item.get("name", "Item")[:127],
                            "quantity": str(int(item.get("qty", 1))),
                            "unit_amount": {
                                "currency_code": "USD",
                                "value": f"{float(item.get('price', 0)):.2f}",
                            },
                        }
                        for item in cart
                    ]
                    + (
                        [
                            {
                                "name": "Gift Packaging",
                                "quantity": "1",
                                "unit_amount": {
                                    "currency_code": "USD",
                                    "value": "5.00",
                                },
                            }
                        ]
                        if gift_wrap
                        else []
                    ),
                }
            ],
        }

        resp = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders",
            json=order_payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        resp.raise_for_status()
        order = resp.json()
        return jsonify({"id": order["id"]})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/capture-paypal-order/<order_id>", methods=["POST"])
def capture_paypal_order(order_id):
    """
    Capture an approved PayPal order and send a confirmation email.

    Request body:
    {
        "customer": {"name": "...", "email": "..."},
        "cart": [...],
        "gift_wrap": false
    }

    Response: {"status": "COMPLETED"}
    """
    try:
        data = request.get_json() or {}
        customer = data.get("customer", {})
        cart = data.get("cart", [])
        gift_wrap = data.get("gift_wrap", False)

        token = get_paypal_token()

        resp = requests.post(
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        resp.raise_for_status()
        capture_data = resp.json()

        if capture_data.get("status") == "COMPLETED":
            total = sum(
                float(item.get("price", 0)) * int(item.get("qty", 1))
                for item in cart
            )
            if gift_wrap:
                total += 5.0

            if customer.get("email"):
                try:
                    send_confirmation_email(
                        customer["email"],
                        customer.get("name", "Customer"),
                        cart,
                        total,
                    )
                except Exception:
                    pass  # Don't fail the payment if email fails

            return jsonify({"status": "COMPLETED"})

        return jsonify(
            {
                "error": "Payment not completed",
                "status": capture_data.get("status"),
            }
        ), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
