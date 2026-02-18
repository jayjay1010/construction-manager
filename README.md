# Construction Manager  
### Full-Stack Construction Timecard & Job Site Management System

A production-style full-stack web application designed for construction crews to manage weekly timecards and job sites.

This system allows workers to:
- Create weekly timecards
- Apply time templates
- Submit with signature capture
- Allow foremen to approve submitted timecards

The project demonstrates authentication, protected routes, role-based access control, database modeling, and real-world workflow logic.

---

## 🚀 Features

- JWT Authentication (Register / Login)
- Role-Based Access Control (Foreman, Journeyman, Apprentice)
- Create and Manage Job Sites
- Weekly Timecard System (Mon–Sun)
- Quick Fill Template (Apply times to selected days)
- Edit Selected Days (Automatic hour recalculation)
- Remove Selected Days (Draft only)
- Signature Capture on Submission
- Foreman Approval Workflow
- Automatic Hour Calculation (AM/PM conversion logic)
- MongoDB Data Persistence

---

## 🛠 Tech Stack

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript (Fetch API)

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JSON Web Tokens (jsonwebtoken)
- bcryptjs
- dotenv

---

## 📦 Installation (Run Locally)

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/jayjay1010/construction-manager.git
cd construction-manager

Install Backend Dependencies
cd Server
npm install

Create Environment File
MONGO_URI=mongodb://127.0.0.1:27017/construction_manager
JWT_SECRET=your_secret_key_here
PORT=3000

Start the Backend Server
node app.js

Mongo connected
Server running on 3000

Run the Frontend
Open:
Client/index.html 