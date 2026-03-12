"""
MAGE Payment Backend
Receives Square payment webhooks and sends order confirmation emails.
"""

import os
import hmac
import hashlib
import base64
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

SQUARE_WEBHOOK_SIGNATURE_KEY = os.environ.get("SQUARE_WEBHOOK_SIGNATURE_KEY", "")
SQUARE_WEBHOOK_URL = os.environ.get("SQUARE_WEBHOOK_URL", "")  # full URL of this endpoint

EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USER = os.environ.get("EMAIL_USER", "")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "magecards7@gmail.com")


def verify_square_signature(body_bytes: bytes, signature: str) -> bool:
    """Verify Square webhook HMAC-SHA256 signature."""
    if not SQUARE_WEBHOOK_SIGNATURE_KEY or not SQUARE_WEBHOOK_URL:
        return True  # skip verification if not configured (dev mode)
    combined = (SQUARE_WEBHOOK_URL + body_bytes.decode("utf-8")).encode("utf-8")
    expected = base64.b64encode(
        hmac.new(
            SQUARE_WEBHOOK_SIGNATURE_KEY.encode("utf-8"),
            combined,
            hashlib.sha256,
        ).digest()
    ).decode("utf-8")
    return hmac.compare_digest(expected, signature)


def send_confirmation_email(customer_email: str, customer_name: str, amount_dollars: float):
    if not EMAIL_USER or not EMAIL_PASSWORD:
        return

    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#222;">
      <h2 style="color:#000;">Thank you for your order{", " + customer_name if customer_name else ""}!</h2>
      <p>Your MVGE payment of <strong>${amount_dollars:.2f}</strong> has been received.</p>
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


@app.route("/webhook/square", methods=["POST"])
def square_webhook():
    """
    Receive Square payment webhooks.
    Square sends a POST when a payment completes.
    We verify the signature then send a confirmation email to the buyer.
    """
    body_bytes = request.get_data()
    signature = request.headers.get("x-square-hmacsha256-signature", "")

    if not verify_square_signature(body_bytes, signature):
        return jsonify({"error": "Invalid signature"}), 403

    event = request.get_json(silent=True) or {}
    event_type = event.get("type", "")

    if event_type == "payment.updated":
        payment = event.get("data", {}).get("object", {}).get("payment", {})
        status = payment.get("status", "")
        buyer_email = payment.get("buyer_email_address", "")
        amount_cents = payment.get("amount_money", {}).get("amount", 0)
        amount_dollars = amount_cents / 100.0

            try:
                send_confirmation_email(buyer_email, "", amount_dollars)
            except Exception as e:
                app.logger.error("Failed to send confirmation email: %s", e)

    # Always return 200 so Square doesn't retry
    return jsonify({"status": "ok"}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
