// Minimal JSON-file database.
//
// This is intentionally simple (good for a demo / small number of users).
// Reads/writes the whole file on every change, with no concurrent-write
// protection. For real production traffic, swap this module out for
// Postgres, MySQL, MongoDB, etc. — every other file in this project talks
// to the data layer only through the functions exported below, so that's
// the only file you'd need to rewrite.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function loadRaw() {
  try {
    const text = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(text);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { users: {}, diaries: {} };
    }
    throw err;
  }
}

function saveRaw(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ---------- Users ----------

function findUserByEmail(email) {
  const data = loadRaw();
  return data.users[email.toLowerCase()] || null;
}

function findUserById(id) {
  const data = loadRaw();
  return Object.values(data.users).find(u => u.id === id) || null;
}

function createUser({ name, email, passwordHash }) {
  const data = loadRaw();
  const key = email.toLowerCase();
  if (data.users[key]) {
    throw new Error('EMAIL_TAKEN');
  }
  const user = {
    id: crypto.randomUUID(),
    name,
    email: key,
    passwordHash,
    goal: 2000,
    plan: 'free',
    payments: [],
    joined: new Date().toISOString()
  };
  data.users[key] = user;
  saveRaw(data);
  return user;
}

function updateUserGoal(userId, goal) {
  const data = loadRaw();
  const user = Object.values(data.users).find(u => u.id === userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  user.goal = goal;
  saveRaw(data);
  return user;
}

// Records a successful payment and upgrades the user's plan. Idempotent on
// paymentId, so it's safe to call this from both the frontend's post-payment
// verification AND the Razorpay webhook without double-applying a payment
// that arrives through both paths.
function applyPlanPayment(userId, paymentMeta) {
  const data = loadRaw();
  const user = Object.values(data.users).find(u => u.id === userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  if (!user.payments) user.payments = [];
  const alreadyApplied = user.payments.some(p => p.paymentId === paymentMeta.paymentId);
  if (!alreadyApplied) {
    user.payments.push({ ...paymentMeta, at: new Date().toISOString() });
    user.plan = paymentMeta.plan;
  }
  saveRaw(data);
  return user;
}

// ---------- Diary ----------
// Diary entries are keyed by "<userId>:<YYYY-MM-DD>".

function diaryKey(userId, date) {
  return `${userId}:${date}`;
}

function getDiary(userId, date) {
  const data = loadRaw();
  return data.diaries[diaryKey(userId, date)] || { date, meals: [] };
}

function addMeal(userId, date, meal) {
  const data = loadRaw();
  const key = diaryKey(userId, date);
  if (!data.diaries[key]) {
    data.diaries[key] = { date, meals: [] };
  }
  const entry = {
    id: crypto.randomUUID(),
    name: meal.name,
    calories: Number(meal.calories) || 0,
    protein: Number(meal.protein) || 0,
    carbs: Number(meal.carbs) || 0,
    fat: Number(meal.fat) || 0,
    time: new Date().toISOString()
  };
  data.diaries[key].meals.push(entry);
  saveRaw(data);
  return entry;
}

function removeMeal(userId, date, mealId) {
  const data = loadRaw();
  const key = diaryKey(userId, date);
  if (!data.diaries[key]) return false;
  const before = data.diaries[key].meals.length;
  data.diaries[key].meals = data.diaries[key].meals.filter(m => m.id !== mealId);
  saveRaw(data);
  return data.diaries[key].meals.length < before;
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserGoal,
  applyPlanPayment,
  getDiary,
  addMeal,
  removeMeal
};
