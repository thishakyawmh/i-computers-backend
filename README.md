# I-Computers Backend

Express 5 API for the I-Computers e-commerce application. It provides user authentication, product browsing, orders, reviews, and email-based password reset.

## Stack

- Node.js (ES modules)
- Express 5
- MongoDB / Mongoose
- bcrypt password hashing
- JWT authentication
- Nodemailer for password-reset codes

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` and fill in the values.
3. Generate a unique JWT secret:

   ```bash
   openssl rand -base64 48
   ```

4. Start the API:

   ```bash
   npm start
   ```

The API requires `MONGO_URL` and a `JWT_SECRET` containing at least 32 characters. Orders use MongoDB transactions, so use MongoDB Atlas or a local replica-set deployment. Configure `CORS_ORIGINS` with the exact frontend origins; the default is the local Vite origin.

## Security changes

- JWTs use HS256 with a fixed issuer and are rejected if invalid or expired. Public endpoints may omit a token; protected controllers still enforce authentication and roles.
- User password hashes are hidden by default from Mongoose queries and removed from API responses.
- Signup and password reset enforce minimum password length and bcrypt hashing.
- Password-reset OTPs are hashed, expire after 10 minutes, and allow at most five verification attempts. A new code cannot be requested more than once per minute for the same email.
- Customer password-reset responses do not reveal whether an email address exists.
- Order line items are validated against server-side product prices and stock. Stock reservation and order creation happen in a single MongoDB transaction.
- CORS origins are configurable.

## API areas

- `/api/users` — signup, login, Google login, profile, password reset
- `/api/products` — product listing and admin management
- `/api/orders` — customer orders and admin status updates
- `/api/reviews` — product reviews and admin moderation

## Tests and checks

```bash
npm test
npm run check
```

## Deployment notes

Keep `.env` out of source control. Store the MongoDB URI, JWT secret, and SMTP credentials in your deployment platform's secret manager. Use HTTPS in production and rotate any credentials that have ever been committed to the repository.
