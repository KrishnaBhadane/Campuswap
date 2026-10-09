# CampusSwap

CampusSwap is a campus-only marketplace where verified students can buy and sell second-hand products, academic resources and campus essentials within their own college community.

## Features

- **Student Authentication**: Secure registration and login with email verification.
- **Email OTP Verification**: Cryptographically secure 6-digit one-time password verification on registration.
- **College ID Verification**: Private student college ID upload and admin verification workflow.
- **Campus Isolation**: Multi-campus architecture where listings, searches, and activities are strictly isolated to the student's campus.
- **Dynamic Campus Management**: Admin tools to register, review, and toggle active college campuses.
- **Listing Management**: Create, edit, and delete marketplace listings across study material, electronics, hostel essentials, stationery, chairs & tables, and other items.
- **Product Images**: Up to 2 high-resolution product photos processed with Sharp and hosted securely on Cloudinary.
- **Marketplace Discovery**: Instant campus search and category filtering with responsive pagination.
- **Favorites & Saved Items**: Save and track items of interest with a single click.
- **My Listings**: Dedicated dashboard for sellers to manage active inventory and mark items as Sold.
- **Direct WhatsApp Contact**: Seamless one-tap WhatsApp integration connecting buyers and sellers for campus physical handovers.
- **Safety & Moderation**: Separate reporting flows for listings and sellers with custom categories.
- **Automatic Seller Protection**: Automatic account blocking when a seller accumulates 5 distinct verified open reports from campus peers.
- **Admin Dashboard**: Comprehensive management interface for student verification, listings moderation, user status, and report reviews.
- **Dynamic Homepage Content**: Admin-managed announcement banners with automatic rotation and responsive highlighted promotional content.
- **Responsive Interface**: Polished, mobile-first design optimized for mobile (375px+), tablet, and desktop viewports.

## Tech Stack

- **Frontend**: HTML5, Vanilla CSS3, Vanilla JavaScript (ES Modules)
- **Backend**: Node.js (v24+), Express.js
- **Database**: MongoDB Atlas, Mongoose ODM
- **Authentication**: JWT stored in HttpOnly cookies, Argon2 password hashing, Email OTP
- **Email**: Nodemailer, Brevo (Sendinblue) SMTP relay
- **Media Processing & Storage**: Cloudinary, Sharp, Multer
- **Security & Headers**: Helmet, express-rate-limit, CORS validation

## Architecture

```
Frontend (HTML / CSS / Vanilla JS)
       │
       ▼
Express Routes
       │
       ▼
Security & Auth Middleware (Helmet, CORS, RateLimiter, requireAuth, requireRole)
       │
       ▼
Controllers (Business Logic & Validation)
       │
       ▼
Mongoose Models (Schema & Compound Indexes)
       │
       ▼
MongoDB Atlas
```

### Project Structure

```
Campuswap/
├── backend/
│   ├── src/
│   │   ├── config/          # Campus seed data
│   │   ├── controllers/     # Route logic (auth, listings, admin, reports, etc.)
│   │   ├── middleware/      # Auth, upload, rate limiters, error handling
│   │   ├── routes/          # Express API route modules
│   │   ├── utils/           # Cloudinary, email delivery helpers
│   │   ├── app.js           # Express app setup and middleware chain
│   │   └── server.js        # Server boot and database connection
│   └── tests/               # Maintained automated integration and unit test suites
├── database/
│   ├── models/              # Mongoose schemas (User, Listing, Report, Campus, etc.)
│   ├── db.js                # MongoDB connection handler
│   └── initCampuses.js      # Campus database initializer
├── frontend/
│   ├── assets/              # Logo and favicon brand assets
│   ├── css/                 # Vanilla stylesheets
│   ├── html/                # Production HTML pages
│   └── js/                  # ES module frontend scripts and admin controllers
├── .gitignore
├── package.json
└── README.md
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and supply your actual configuration. **Never commit real credentials to version control.**

```env
NODE_ENV=
PORT=
MONGODB_URI=
JWT_SECRET=
FRONTEND_URL=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
```

## Local Setup

1. **Clone the repository**:
   ```sh
   git clone https://github.com/KrishnaBhadane/Campuswap.git
   cd Campuswap
   ```

2. **Install dependencies**:
   ```sh
   npm install
   ```

3. **Configure environment variables**:
   ```sh
   cp backend/.env.example backend/.env
   # Edit backend/.env with your local or Atlas credentials
   ```

4. **Run development server**:
   ```sh
   npm run dev
   ```

5. **Run production server**:
   ```sh
   npm run server
   ```

6. **Verify health check**:
   Open `http://localhost:5001/api/health` in your browser. Expected response:
   ```json
   { "success": true, "message": "CampusSwap API running" }
   ```

7. **Run test suites**:
   ```sh
   node --test backend/tests/report-controller.test.js backend/tests/auto-block-flow.test.js
   ```

## Security Note

- **HttpOnly Cookies**: Session tokens are stored exclusively in HttpOnly cookies to prevent XSS credential theft.
- **Server-Side Campus Isolation**: All listing views, searches, and interactions enforce campus isolation at the database query level.
- **Ownership Verification**: All listing edits and deletions require server-side ownership checks matching `req.user._id`.
- **Abuse Prevention & Rate Limiting**: Dedicated rate limiters on authentication, OTP generation, reports, and file uploads.
- **Secure File Uploads**: Uploaded images are decompressed, sanitized, stripped of EXIF metadata, and converted to WebP format using Sharp.
- **Report & Auto-Block Protections**: Automated blocking requires 5 distinct peer reports, preventing self-reporting and spam manipulation.
