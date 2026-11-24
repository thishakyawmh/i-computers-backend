import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
    const authorizationHeader = req.get("Authorization");
    if (!authorizationHeader) return next();

    const [scheme, token, ...extra] = authorizationHeader.trim().split(/\s+/);
    if (scheme !== "Bearer" || !token || extra.length > 0) {
        return res.status(401).json({ message: "Invalid Authorization header" });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: process.env.JWT_ISSUER || "i-computers-api"
        });
        return next();
    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}
