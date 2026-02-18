                         Construction Manager
Full-Stack Construction Timecard & Job Site Management System
A production-style full-stack web application that allows construction crews to create weekly timecards, apply templates, submit with signature capture, and allow foremen to approve submitted timecards.
This project demonstrates authentication, protected routes, role-based access control, database modeling, and real-world workflow logic. 

Features
JWT Authentication (Register / Login)
Role-Based Access Control (Foreman, Journeyman, Apprentice)
Create and Manage Job Sites
Weekly Timecard System (Mon–Sun)
Quick Fill Template (Apply times to selected days)
Edit Selected Days (Recalculate hours automatically)
Remove Selected Days (Draft only)
Signature Capture on Submission
Foreman Approval Workflow
Automatic Hour Calculation (AM/PM conversion logic)
MongoDB Data Persistence

Tech Stack
     Frontend
HTML5
CSS3
Vanilla JavaScript (Fetch API)
     Backend
Node.js
Express.js
MongoDB
Mongoose
JSON Web Tokens (jsonwebtoken)
bcryptjs
dotenv.

Clone the repository

git clone https://github.com/jayjay1010/construction-manager.git
cd construction-manager

2. Install backend dependencies

cd Server
npm install

3. Create a .env file inside Server folder

MONGO_URI=mongodb://127.0.0.1:27017/construction_manager
JWT_SECRET=your_secret_key_here
PORT=3000

4. Start the backend server

node app.js

5. Open the frontend

Open Client/index.html using Live Server.