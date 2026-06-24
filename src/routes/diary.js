const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// All diary routes require a logged-in user — guests get a client-side-only
// diary in the browser (see public/index.html) that isn't persisted.
router.use(requireAuth);

router.get('/', (req, res) => {
  const date = (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) ? req.query.date : todayKey();
  const diary = db.getDiary(req.user.id, date);
  res.json({ date, goal: req.user.goal, meals: diary.meals });
});

router.post('/meals', (req, res) => {
  const { name, calories, protein, carbs, fat } = req.body || {};
  if (!name || !(Number(calories) > 0)) {
    return res.status(400).json({ error: 'A meal needs a name and a positive calorie amount.' });
  }
  const meal = db.addMeal(req.user.id, todayKey(), { name, calories, protein, carbs, fat });
  res.status(201).json({ meal });
});

router.delete('/meals/:id', (req, res) => {
  const removed = db.removeMeal(req.user.id, todayKey(), req.params.id);
  if (!removed) return res.status(404).json({ error: 'Meal not found.' });
  res.json({ ok: true });
});

router.put('/goal', (req, res) => {
  const goal = Number(req.body && req.body.goal);
  if (!goal || goal <= 0) {
    return res.status(400).json({ error: 'Goal must be a positive number.' });
  }
  const user = db.updateUserGoal(req.user.id, Math.round(goal));
  res.json({ goal: user.goal });
});

module.exports = router;
