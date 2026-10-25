"""API-bearing part of criterion: demo salon is view-only -> any non-GET /api/salon/* is 403."""


def test_demo_session_non_get_salon_write_is_403(client):
    r = client.post("/auth/demo")
    assert r.status_code == 200, r.text

    r = client.post(
        "/salon/services",
        json={"name": "tscheck-demo-write-block", "price": 10, "duration_min": 30},
    )
    assert r.status_code == 403, r.text


def test_demo_session_get_salon_is_allowed(client):
    r = client.post("/auth/demo")
    assert r.status_code == 200, r.text
    r = client.get("/salon/dashboard")
    assert r.status_code == 200, r.text
