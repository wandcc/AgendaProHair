"""Backend regression for refactored salon/admin endpoints (criterion: backend regression)."""

import httpx
import pytest


def _demo_client(client):
    r = client.post("/auth/demo")
    assert r.status_code == 200, r.text
    return r


def test_salon_dashboard_demo_session(client):
    _demo_client(client)
    r = client.get("/salon/dashboard")
    assert r.status_code == 200, r.text
    body = r.json()
    for field in ("revenue_today", "appointments_today_count", "notifications", "appointments_today"):
        assert field in body, f"missing {field} in {body.keys()}"


def test_salon_finance_demo_session(client):
    _demo_client(client)
    r = client.get("/salon/finance")
    assert r.status_code == 200, r.text
    body = r.json()
    for field in ("revenue", "by_professional", "daily", "expenses"):
        assert field in body, f"missing {field} in {body.keys()}"
    assert len(body["by_professional"]) == 3, body["by_professional"]
    # daily should have one point per day of the queried month
    import calendar
    year, month = (int(x) for x in body["month"].split("-"))
    days_in_month = calendar.monthrange(year, month)[1]
    assert len(body["daily"]) == days_in_month, (len(body["daily"]), days_in_month)


def test_salon_finance_bad_month_is_422(client):
    _demo_client(client)
    r = client.get("/salon/finance", params={"month": "bad"})
    assert r.status_code == 422, r.text


def test_admin_metrics_superadmin_ok(client):
    r = client.post(
        "/auth/login",
        json={"email": "wand_cc@hotmail.com", "password": "Wand050391@"},
    )
    assert r.status_code == 200, r.text
    r = client.get("/admin/metrics")
    assert r.status_code == 200, r.text
    body = r.json()
    for field in ("mrr", "active", "suspended", "delinquent"):
        assert field in body, f"missing {field} in {body.keys()}"


def test_admin_metrics_non_admin_forbidden(client):
    _demo_client(client)
    r = client.get("/admin/metrics")
    assert r.status_code == 403, r.text
