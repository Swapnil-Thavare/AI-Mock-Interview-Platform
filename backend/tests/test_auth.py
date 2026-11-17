import pytest

pytestmark = pytest.mark.asyncio


async def _register_and_login(client, email, password, full_name):
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": full_name, "password": password},
    )
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    return login.json()["access_token"]


async def test_register(db_client):
    payload = {
        "email": "new@example.com",
        "full_name": "New User",
        "password": "supersecret",
    }
    response = await db_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == payload["email"]
    assert data["full_name"] == payload["full_name"]
    assert "id" in data


async def test_register_duplicate_email(db_client):
    email = "dup@example.com"
    await _register_and_login(db_client, email, "password", "Original")
    payload = {
        "email": email,
        "full_name": "Duplicate",
        "password": "supersecret",
    }
    response = await db_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400


async def test_login_and_me(db_client):
    email = "me@example.com"
    token = await _register_and_login(
        db_client, email, "password", "Me User"
    )

    me = await db_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == email


async def test_me_unauthorized(client):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_logout_requires_auth(client):
    response = await client.post("/api/v1/auth/logout")
    assert response.status_code == 401


async def test_logout_revokes_token(db_client):
    token = await _register_and_login(
        db_client, "logout@example.com", "password", "Logout User"
    )
    headers = {"Authorization": f"Bearer {token}"}

    me = await db_client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200

    logout = await db_client.post("/api/v1/auth/logout", headers=headers)
    assert logout.status_code == 200

    me_after = await db_client.get("/api/v1/auth/me", headers=headers)
    assert me_after.status_code == 401


async def test_logout_revokes_only_the_presented_token(db_client):
    email = "two-sessions@example.com"
    await db_client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "full_name": "Two Sessions",
            "password": "password",
        },
    )
    login1 = await db_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password"},
    )
    login2 = await db_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password"},
    )
    token1 = login1.json()["access_token"]
    token2 = login2.json()["access_token"]

    await db_client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token1}"},
    )

    still_valid = await db_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert still_valid.status_code == 200


async def test_job_description_ownership(db_client):
    owner_token = await _register_and_login(
        db_client, "owner@example.com", "password", "Owner"
    )
    other_token = await _register_and_login(
        db_client, "other@example.com", "password", "Other"
    )

    job = await db_client.post(
        "/api/v1/job-descriptions",
        json={"title": "Test", "description": "desc"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert job.status_code == 200
    job_id = job.json()["id"]

    other_get = await db_client.get(
        f"/api/v1/job-descriptions/{job_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert other_get.status_code == 404
