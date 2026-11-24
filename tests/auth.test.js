import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { authenticateToken } from "../middleware/auth.js";

const previousSecret = process.env.JWT_SECRET;
const previousIssuer = process.env.JWT_ISSUER;

function makeRequest(authorization) {
    return { get: (name) => name === "Authorization" ? authorization : undefined };
}

function makeResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

test.before(() => {
    process.env.JWT_SECRET = "test-secret-with-at-least-32-characters-long";
    process.env.JWT_ISSUER = "i-computers-api-test";
});

test.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousIssuer === undefined) delete process.env.JWT_ISSUER;
    else process.env.JWT_ISSUER = previousIssuer;
});

test("allows requests without a token to reach public routes", () => {
    const req = makeRequest(undefined);
    const res = makeResponse();
    let nextCalled = false;
    authenticateToken(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
});

test("rejects malformed authorization headers", () => {
    const req = makeRequest("Basic abc");
    const res = makeResponse();
    authenticateToken(req, res, () => assert.fail("next must not be called"));
    assert.equal(res.statusCode, 401);
});

test("accepts a valid HS256 token with the expected issuer", () => {
    const token = jwt.sign(
        { email: "user@example.test", role: "customer" },
        process.env.JWT_SECRET,
        { algorithm: "HS256", issuer: process.env.JWT_ISSUER, expiresIn: "5m" }
    );
    const req = makeRequest(`Bearer ${token}`);
    const res = makeResponse();
    let nextCalled = false;
    authenticateToken(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.email, "user@example.test");
});

test("rejects tokens signed with another secret", () => {
    const token = jwt.sign({ email: "admin@example.test", role: "admin" }, "attacker-secret");
    const req = makeRequest(`Bearer ${token}`);
    const res = makeResponse();
    authenticateToken(req, res, () => assert.fail("next must not be called"));
    assert.equal(res.statusCode, 401);
});

test("rejects tokens issued by another application", () => {
    const token = jwt.sign(
        { email: "user@example.test", role: "customer" },
        process.env.JWT_SECRET,
        { algorithm: "HS256", issuer: "wrong-issuer" }
    );
    const req = makeRequest(`Bearer ${token}`);
    const res = makeResponse();
    authenticateToken(req, res, () => assert.fail("next must not be called"));
    assert.equal(res.statusCode, 401);
});
