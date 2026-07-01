# 🍽️ NutriSnap — AI-Powered Food Calorie & Nutrition Tracker

NutriSnap is a full-stack web application that helps users make healthier, informed food choices by analyzing meals instantly from a photo. Users simply capture or upload an image of their meal and receive an accurate calorie estimate along with a complete nutrition breakdown.

**🔗 Live Demo:** [https://spectacular-mousse-253b6d.netlify.app/]
**💻 Repository:** [github.com/your-username/nutrisnap](#)

---

## ✨ Features

- 📸 **AI Food Recognition** — Identify meals directly from photos
- 🔥 **Instant Calorie Estimation** — Get calorie counts in real time
- 🥗 **Nutrition Breakdown** — Protein, Carbs, Fat, Fiber, Sugar, Sodium
- 📊 **Meal History & Progress Tracking** — Daily and historical logs
- 💧 **Water Intake Tracker**
- ⏱️ **Fasting Tracker**
- 🔐 **Secure Authentication** — JWT-based login/signup
- 📱 **Responsive UI** — Optimized for desktop and mobile
- 💳 **Payment Integration** — Razorpay / Cashfree support

---

## 🛠️ Tech Stack

| Layer          | Technology              |
|----------------|--------------------------|
| Frontend       | React.js                |
| Backend        | Node.js, Express.js     |
| Database       | MongoDB                 |
| AI Integration | AI Vision API            |
| Auth           | JWT (JSON Web Tokens)    |
| Payments       | Razorpay / Cashfree      |

---

## 📸 Screenshots

> _Add screenshots or a demo GIF here to showcase the UI._

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- MongoDB instance (local or Atlas)
- API keys for AI Vision provider and payment gateway (if used)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/nutrisnap.git
cd nutrisnap

# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
AI_VISION_API_KEY=your_ai_vision_api_key
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

### Run Locally

```bash
node server.js
```

The backend API will serve requests from the configured `PORT`. The frontend (`src/`) can be run separately during development, then built and served via `index.html` in production.

### Deployment

The frontend is deployed on **Netlify**: [nutrisnap.netlify.app](#)
The backend can be deployed on any Node-compatible hosting service (Render, Railway, etc.), with environment variables configured accordingly.

---

## 📂 Project Structure

```
nutrisnap/
├── data/              # Static/reference data (e.g. nutrition datasets)
├── public/            # Public assets
├── src/               # Frontend source code
├── .gitignore
├── README.md
├── index.html
├── package.json
├── package-lock.json
├── payments.js         # Razorpay/Cashfree payment integration
├── server.js           # Express server entry point
└── test-key.js          # API key testing utility
```


## 🗺️ Roadmap

- [ ] Barcode scanning for packaged foods
- [ ] Personalized nutrition goals & recommendations
- [ ] Integration with wearables (Fitbit, Apple Health)
- [ ] Multi-language support

## 🤝 Contributi

---
Author:Sajal jain
