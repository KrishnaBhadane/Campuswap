For SY Project <br>
Author: Krishna Bhadane, Aditya Jadhav, Roshan Patil, Dipak Kadam.

## Backend setup (Step 1)

Requires Node.js 24+ and access to a MongoDB Atlas database.

1. Run `npm install` from the repository root.
2. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` to your Atlas connection string. Keep this file private.
3. Allow your IP in Atlas Network Access and use a database user with access to the application database.
4. Run `npm run server`, or `npm run dev` for Node's built-in watch mode.
5. After `MongoDB connected` appears, open `http://localhost:5000/api/health`.

Expected response: `{"success":true,"message":"CampusSwap API running"}`.
The server starts only after connecting to MongoDB. Frontend files remain unchanged and are not served by this backend yet.
