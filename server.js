/**
 * DEEP WORK CITY — PRODUCTION BACKEND
 * Node.js + Express + MongoDB + Redis
 * Features: Phone OTP, Google OAuth, Admin Panel, Promo Codes, Subscriptions
 */
'use strict';

require('dotenv').config();
const express      = require('express');
const mongoose     = require('mongoose');
const Redis        = require('ioredis');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const jwt          = require('jsonwebtoken');
const axios        = require('axios');
const cron         = require('node-cron');
const path         = require('path');
const { OAuth2Client } = require('google-auth-library');

const app = express();

// ─── MIDDLEWARE ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '10kb' }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiters
const globalLimit = rateLimit({ windowMs: 15*60*1000, max: 300, standardHeaders: true });
const authLimit   = rateLimit({ windowMs: 60*1000, max: 8, message: { error: 'Too many attempts. Wait 1 minute.' } });
const strictLimit = rateLimit({ windowMs: 60*1000, max: 3, message: { error: 'Too many OTP requests.' } });

app.use('/api/', globalLimit);

// ─── DATABASE ──────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/deepworkcity', {
  maxPoolSize: 50,
  serverSelectionTimeoutMS: 5000,
}).then(() => console.log('✅ MongoDB connected'))
  .catch(e => console.error('❌ MongoDB:', e.message));

// ─── REDIS ─────────────────────────────────────────────────────
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASS || undefined,
  retryStrategy: t => Math.min(t * 100, 3000),
  lazyConnect: true,
});
redis.connect().catch(() => console.warn('⚠️ Redis unavailable — using in-memory fallback'));

// In-memory fallback for Redis (single-server)
const memCache = new Map();
const cache = {
  async get(k) {
    try { const v = await redis.get(k); return v; }
    catch { return memCache.get(k) || null; }
  },
  async set(k, ttl, v) {
    try { await redis.setex(k, ttl, v); }
    catch { memCache.set(k, v); setTimeout(() => memCache.delete(k), ttl * 1000); }
  },
  async del(k) {
    try { await redis.del(k); } catch { memCache.delete(k); }
  },
};

// ─── GOOGLE OAUTH CLIENT ───────────────────────────────────────
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ═══════════════════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════════════════

const UserSchema = new mongoose.Schema({
  // Auth
  phone:        { type: String, sparse: true, index: true },
  googleId:     { type: String, sparse: true, index: true },
  email:        { type: String, sparse: true, lowercase: true },
  authMethod:   { type: String, enum: ['phone','google'], default: 'phone' },

  // Profile
  displayName:  { type: String, default: '', maxlength: 60 },
  username:     { type: String, unique: true, sparse: true, lowercase: true, maxlength: 30 },
  avatarUrl:    { type: String, default: '' },
  age:          { type: Number, min: 5, max: 80 },
  school:       { type: String, default: '', maxlength: 100 },
  city:         { type: String, default: '', maxlength: 60 },
  bio:          { type: String, default: '', maxlength: 200 },
  country:      { type: String, default: 'UZ', maxlength: 3 },

  // Focus stats
  totalMinutes:  { type: Number, default: 0 },
  todayMinutes:  { type: Number, default: 0 },
  weekMinutes:   { type: Number, default: 0 },
  monthMinutes:  { type: Number, default: 0 },
  longestSession:{ type: Number, default: 0 },
  sessionsCount: { type: Number, default: 0 },

  // Streak
  streak:          { type: Number, default: 0 },
  longestStreak:   { type: Number, default: 0 },
  lastFocusDate:   { type: Date },
  streakHistory:   [{ type: Date }],

  // City
  cityName:     { type: String, default: 'My City', maxlength: 50 },
  cityLevel:    { type: Number, default: 1 },
  buildings:    [String],

  // Subscription
  plan:         { type: String, enum: ['free','pro'], default: 'free' },
  planExpiry:   { type: Date },
  promoUsed:    { type: Boolean, default: false },
  promoCode:    { type: String },
  lifetimePaid: { type: Number, default: 0 }, // total UZS paid

  // System
  rank:         { type: Number, default: 9999 },
  isAdmin:      { type: Boolean, default: false },
  isActive:     { type: Boolean, default: true },
  isBanned:     { type: Boolean, default: false },
  banReason:    { type: String },
  lastActive:   { type: Date, default: Date.now },
  loginCount:   { type: Number, default: 0 },
  ipHistory:    [{ ip: String, at: Date }],
}, { timestamps: true });

UserSchema.index({ totalMinutes: -1 });
UserSchema.index({ weekMinutes: -1 });
UserSchema.index({ country: 1, weekMinutes: -1 });
UserSchema.index({ createdAt: -1 });

const SessionSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  duration:  { type: Number, required: true },
  type:      { type: String, enum: ['pomodoro','deep','flow','custom'], default: 'pomodoro' },
  completed: { type: Boolean, default: false },
  startTime: { type: Date, required: true },
  endTime:   { type: Date },
  cityLevel: { type: Number },
  newBuilding: { type: String },
}, { timestamps: true });

SessionSchema.index({ userId: 1, createdAt: -1 });
SessionSchema.index({ createdAt: -1 });

const PaymentSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider:   { type: String, enum: ['payme','click','paynet','promo'], required: true },
  amount:     { type: Number, required: true },
  currency:   { type: String, default: 'UZS' },
  plan:       { type: String, required: true },
  months:     { type: Number, default: 1 },
  status:     { type: String, enum: ['pending','completed','failed','refunded'], default: 'pending', index: true },
  externalId: { type: String, index: true },
  promoCode:  { type: String },
  discountPct:{ type: Number, default: 0 },
  metadata:   Object,
}, { timestamps: true });

const PromoCodeSchema = new mongoose.Schema({
  code:       { type: String, required: true, unique: true, uppercase: true },
  discountPct:{ type: Number, required: true, min: 1, max: 100 },
  maxUses:    { type: Number, default: 100 },
  usedCount:  { type: Number, default: 0 },
  usedBy:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  validUntil: { type: Date },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive:   { type: Boolean, default: true },
  note:       { type: String, maxlength: 200 },
}, { timestamps: true });

const SiteStatSchema = new mongoose.Schema({
  date:          { type: String, required: true, unique: true }, // YYYY-MM-DD
  visits:        { type: Number, default: 0 },
  newUsers:      { type: Number, default: 0 },
  activeSessions:{ type: Number, default: 0 },
  totalFocusMins:{ type: Number, default: 0 },
  revenue:       { type: Number, default: 0 },
}, { timestamps: true });

const User       = mongoose.model('User', UserSchema);
const Session    = mongoose.model('Session', SessionSchema);
const Payment    = mongoose.model('Payment', PaymentSchema);
const PromoCode  = mongoose.model('PromoCode', PromoCodeSchema);
const SiteStat   = mongoose.model('SiteStat', SiteStatSchema);

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }
function generateToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'dwc_secret_dev', { expiresIn: '30d' });
}
function generateUsername(base) {
  return base.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) + '_' + Math.floor(Math.random()*9999);
}
function isPromoActive() {
  const launch = new Date(process.env.LAUNCH_DATE || '2026-03-17T07:00:00+05:00');
  const diff = (Date.now() - launch.getTime()) / 3600000;
  return diff >= 0 && diff < 48;
}
async function trackVisit(date) {
  const d = date || new Date().toISOString().slice(0, 10);
  await SiteStat.findOneAndUpdate({ date: d }, { $inc: { visits: 1 } }, { upsert: true });
}

// Auth middleware
async function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(h.slice(7), process.env.JWT_SECRET || 'dwc_secret_dev');
    const user = await User.findById(decoded.id).lean();
    if (!user || !user.isActive || user.isBanned) return res.status(401).json({ error: 'Account unavailable' });
    req.user = user;
    // Track last active (non-blocking)
    User.findByIdAndUpdate(user._id, { lastActive: new Date() }).exec();
    next();
  } catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

async function adminAuth(req, res, next) {
  await auth(req, res, () => {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
  });
}

// SMS via Playmobile (Uzbekistan)
async function sendSMS(phone, code) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📱 OTP [DEV] ${phone}: ${code}`);
    return { success: true, dev: true };
  }
  try {
    const res = await axios.post(
      'https://send.smsxabar.uz/broker-api/send',
      {
        messages: [{
          recipient: phone.replace('+', ''),
          'message-id': `dwc_${Date.now()}`,
          sms: {
            originator: 'DeepWork',
            content: { text: `Deep Work City: ${code} — tasdiqlash kodi. 5 daqiqa amal qiladi.` }
          }
        }]
      },
      { auth: { username: process.env.SMS_LOGIN, password: process.env.SMS_PASS }, timeout: 8000 }
    );
    return { success: true };
  } catch (e) {
    console.error('SMS error:', e.message);
    return { success: false, error: e.message };
  }
}

function formatUserPublic(u) {
  return {
    id: u._id,
    displayName: u.displayName || 'Builder',
    username: u.username,
    avatarUrl: u.avatarUrl,
    age: u.age,
    school: u.school,
    city: u.city,
    bio: u.bio,
    country: u.country,
    totalHours: Math.round(u.totalMinutes / 60 * 10) / 10,
    todayMinutes: u.todayMinutes,
    weekMinutes: u.weekMinutes,
    streak: u.streak,
    longestStreak: u.longestStreak,
    sessionsCount: u.sessionsCount,
    cityName: u.cityName,
    cityLevel: u.cityLevel,
    buildings: u.buildings,
    plan: u.plan,
    planExpiry: u.planExpiry,
    rank: u.rank,
    authMethod: u.authMethod,
    phone: u.phone ? u.phone.replace(/(\+998)(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 *** ** **') : null,
  };
}

// ═══════════════════════════════════════════════════════════════
// ROUTES — AUTH
// ═══════════════════════════════════════════════════════════════

// Track visits
app.use('/api/', (req, res, next) => {
  if (req.method === 'GET' && req.path === '/ping') trackVisit();
  next();
});
app.get('/api/ping', (req, res) => { trackVisit(); res.json({ ok: true, ts: Date.now() }); });

// ── Phone: Send OTP ──
app.post('/api/auth/send-otp', strictLimit, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !/^\+998\d{9}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter valid UZ phone number (+998XXXXXXXXX)' });
    }
    // Check attempts
    const attKey = `otp_att:${phone}`;
    const att = await cache.get(attKey);
    if (att && parseInt(att) >= 5) {
      return res.status(429).json({ error: 'Too many OTP requests. Try in 1 hour.' });
    }
    const code = generateOTP();
    await cache.set(`otp:${phone}`, 300, code);
    const curAtt = parseInt(att || '0') + 1;
    await cache.set(attKey, 3600, String(curAtt));

    const smsResult = await sendSMS(phone, code);
    if (!smsResult.success && process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'SMS send failed. Try again.' });
    }
    res.json({ success: true, dev: smsResult.dev || false });
  } catch (e) {
    console.error('sendOTP:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Phone: Verify OTP ──
app.post('/api/auth/verify-otp', authLimit, async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'Phone and code required' });

    const stored = await cache.get(`otp:${phone}`);
    if (!stored || stored !== String(code)) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    await cache.del(`otp:${phone}`);

    let user = await User.findOne({ phone });
    let isNew = false;

    if (!user) {
      isNew = true;
      const username = generateUsername('user');
      user = await User.create({
        phone,
        authMethod: 'phone',
        displayName: '',
        username,
        plan: isPromoActive() ? 'pro' : 'free',
        planExpiry: isPromoActive() ? new Date(Date.now() + 30*24*3600000) : null,
        promoUsed: isPromoActive(),
        loginCount: 1,
        ipHistory: [{ ip: req.ip, at: new Date() }],
      });
      // Track new user stat
      const d = new Date().toISOString().slice(0, 10);
      await SiteStat.findOneAndUpdate({ date: d }, { $inc: { newUsers: 1 } }, { upsert: true });
    } else {
      await User.findByIdAndUpdate(user._id, {
        $inc: { loginCount: 1 },
        $push: { ipHistory: { $each: [{ ip: req.ip, at: new Date() }], $slice: -20 } },
        lastActive: new Date(),
      });
    }

    const token = generateToken(user._id);
    const u = await User.findById(user._id).lean();
    res.json({
      success: true, token, isNew,
      needsProfile: isNew || !u.displayName,
      promoApplied: isNew && isPromoActive(),
      user: formatUserPublic(u),
    });
  } catch (e) {
    console.error('verifyOTP:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Google OAuth ──
app.post('/api/auth/google', authLimit, async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Google credential required' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    let isNew = false;

    if (!user) {
      isNew = true;
      const username = generateUsername(name || email.split('@')[0]);
      user = await User.create({
        googleId,
        email,
        authMethod: 'google',
        displayName: name || '',
        avatarUrl: picture || '',
        username,
        plan: isPromoActive() ? 'pro' : 'free',
        planExpiry: isPromoActive() ? new Date(Date.now() + 30*24*3600000) : null,
        promoUsed: isPromoActive(),
        loginCount: 1,
        ipHistory: [{ ip: req.ip, at: new Date() }],
      });
      const d = new Date().toISOString().slice(0, 10);
      await SiteStat.findOneAndUpdate({ date: d }, { $inc: { newUsers: 1 } }, { upsert: true });
    } else {
      // Update Google info if changed
      await User.findByIdAndUpdate(user._id, {
        googleId,
        $set: { avatarUrl: picture || user.avatarUrl, lastActive: new Date() },
        $inc: { loginCount: 1 },
        $push: { ipHistory: { $each: [{ ip: req.ip, at: new Date() }], $slice: -20 } },
      });
    }

    const token = generateToken(user._id);
    const u = await User.findById(user._id).lean();
    res.json({
      success: true, token, isNew,
      needsProfile: isNew || !u.displayName,
      promoApplied: isNew && isPromoActive(),
      user: formatUserPublic(u),
    });
  } catch (e) {
    console.error('Google auth:', e.message);
    res.status(400).json({ error: 'Google authentication failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — USER / PROFILE
// ═══════════════════════════════════════════════════════════════

app.get('/api/user/me', auth, async (req, res) => {
  const u = await User.findById(req.user._id).lean();
  res.json(formatUserPublic(u));
});

app.patch('/api/user/profile', auth, async (req, res) => {
  try {
    const { displayName, username, cityName, age, school, city, bio, country } = req.body;
    const upd = {};
    if (displayName !== undefined) upd.displayName = String(displayName).slice(0, 60).trim();
    if (cityName !== undefined)    upd.cityName    = String(cityName).slice(0, 50).trim();
    if (age !== undefined)         upd.age         = Math.max(5, Math.min(80, parseInt(age)));
    if (school !== undefined)      upd.school      = String(school).slice(0, 100).trim();
    if (city !== undefined)        upd.city        = String(city).slice(0, 60).trim();
    if (bio !== undefined)         upd.bio         = String(bio).slice(0, 200).trim();
    if (country !== undefined)     upd.country     = String(country).slice(0, 3).toUpperCase();

    if (username !== undefined) {
      const clean = String(username).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
      if (clean.length < 3) return res.status(400).json({ error: 'Username min 3 characters' });
      const exists = await User.findOne({ username: clean, _id: { $ne: req.user._id } });
      if (exists) return res.status(400).json({ error: 'Username taken' });
      upd.username = clean;
    }

    const u = await User.findByIdAndUpdate(req.user._id, upd, { new: true }).lean();
    res.json({ success: true, user: formatUserPublic(u) });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public profile by username
app.get('/api/profile/:username', async (req, res) => {
  const u = await User.findOne({ username: req.params.username, isActive: true }).lean();
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({
    displayName: u.displayName,
    username: u.username,
    avatarUrl: u.avatarUrl,
    age: u.age,
    school: u.school,
    city: u.city,
    bio: u.bio,
    country: u.country,
    totalHours: Math.round(u.totalMinutes / 60 * 10) / 10,
    streak: u.streak,
    longestStreak: u.longestStreak,
    cityName: u.cityName,
    cityLevel: u.cityLevel,
    buildings: u.buildings,
    rank: u.rank,
    sessionsCount: u.sessionsCount,
  });
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — SESSIONS
// ═══════════════════════════════════════════════════════════════

app.post('/api/sessions/start', auth, async (req, res) => {
  try {
    const { duration, type } = req.body;
    if (!duration || duration < 1 || duration > 240) {
      return res.status(400).json({ error: 'Duration must be 1–240 minutes' });
    }
    const sess = await Session.create({
      userId: req.user._id,
      duration: parseInt(duration),
      type: type || 'pomodoro',
      startTime: new Date(),
      completed: false,
    });
    res.json({ success: true, sessionId: sess._id });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/sessions/:id/complete', auth, async (req, res) => {
  try {
    const sess = await Session.findOne({ _id: req.params.id, userId: req.user._id });
    if (!sess) return res.status(404).json({ error: 'Session not found' });
    if (sess.completed) return res.status(400).json({ error: 'Already completed' });

    sess.completed = true;
    sess.endTime = new Date();
    await sess.save();

    const user = await User.findById(req.user._id);
    const addMins = sess.duration;
    const prevH = user.totalMinutes / 60;
    const newH  = (user.totalMinutes + addMins) / 60;

    // Streak logic
    const todayStr = new Date().toDateString();
    const lastStr  = user.lastFocusDate ? new Date(user.lastFocusDate).toDateString() : null;
    const yestStr  = new Date(Date.now() - 86400000).toDateString();
    let newStreak = user.streak;
    if (lastStr !== todayStr) {
      if (lastStr === yestStr) newStreak = user.streak + 1;
      else newStreak = 1;
      user.streakHistory.push(new Date());
    }

    user.totalMinutes  += addMins;
    user.todayMinutes  += addMins;
    user.weekMinutes   += addMins;
    user.monthMinutes  += addMins;
    user.sessionsCount += 1;
    user.streak         = newStreak;
    user.longestStreak  = Math.max(user.longestStreak, newStreak);
    user.lastFocusDate  = new Date();
    if (addMins > user.longestSession) user.longestSession = addMins;

    // City level
    const ths = [0,1,5,20,50,100,300,500,1000];
    let lvl = 1;
    ths.forEach((t, i) => { if (newH >= t) lvl = i + 1; });
    user.cityLevel = Math.min(lvl, 9);

    // Unlock buildings
    const bMilestones = [
      {h:1,b:'house'},{h:2,b:'house2'},{h:5,b:'park'},{h:8,b:'school'},
      {h:10,b:'road'},{h:15,b:'hospital'},{h:20,b:'library'},{h:30,b:'market'},
      {h:50,b:'office'},{h:75,b:'university'},{h:100,b:'stadium'},
      {h:150,b:'skyscraper'},{h:200,b:'research_lab'},{h:300,b:'space_tower'},{h:500,b:'megacity'},
    ];
    let newBuilding = null;
    for (const m of bMilestones) {
      if (newH >= m.h && !user.buildings.includes(m.b)) {
        user.buildings.push(m.b);
        newBuilding = m.b;
      }
    }

    sess.newBuilding = newBuilding;
    sess.cityLevel   = user.cityLevel;
    await sess.save();
    await user.save();

    // Stats
    const d = new Date().toISOString().slice(0, 10);
    await SiteStat.findOneAndUpdate({ date: d },
      { $inc: { activeSessions: 1, totalFocusMins: addMins } }, { upsert: true });

    // Invalidate LB cache
    await cache.del('lb:global');
    await cache.del(`lb:country:${user.country}`);

    res.json({
      success: true,
      addedMinutes: addMins,
      totalHours: Math.round(user.totalMinutes / 60 * 10) / 10,
      streak: user.streak,
      cityLevel: user.cityLevel,
      newBuilding,
    });
  } catch (e) {
    console.error('completeSession:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/sessions/history', auth, async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const sessions = await Session.find({ userId: req.user._id, completed: true })
    .sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit).lean();
  const total = await Session.countDocuments({ userId: req.user._id, completed: true });
  res.json({ sessions, total, page, pages: Math.ceil(total/limit) });
});

app.get('/api/sessions/stats', auth, async (req, res) => {
  const weekAgo = new Date(Date.now() - 7*24*3600000);
  const sessions = await Session.find({ userId: req.user._id, completed: true, createdAt: { $gte: weekAgo } }).lean();
  const byDay = {};
  sessions.forEach(s => {
    const d = new Date(s.createdAt).toDateString();
    byDay[d] = (byDay[d] || 0) + s.duration;
  });
  res.json({
    weekTotal: sessions.reduce((a,s) => a+s.duration, 0),
    sessionCount: sessions.length,
    byDay,
    avgDuration: sessions.length ? Math.round(sessions.reduce((a,s) => a+s.duration, 0) / sessions.length) : 0,
  });
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — LEADERBOARD
// ═══════════════════════════════════════════════════════════════

app.get('/api/leaderboard/global', async (req, res) => {
  const cached = await cache.get('lb:global');
  if (cached) return res.json(JSON.parse(cached));

  const users = await User.find({ isActive: true, isBanned: false })
    .sort({ weekMinutes: -1 }).limit(100)
    .select('displayName username avatarUrl cityLevel cityName weekMinutes streak country age school').lean();

  const data = users.map((u, i) => ({
    rank: i+1,
    displayName: u.displayName || 'Builder',
    username: u.username,
    avatarUrl: u.avatarUrl,
    cityLevel: u.cityLevel,
    cityName: u.cityName,
    weekHours: Math.round(u.weekMinutes / 60 * 10) / 10,
    streak: u.streak,
    country: u.country,
    age: u.age,
    school: u.school,
  }));

  await cache.set('lb:global', 300, JSON.stringify(data));
  res.json(data);
});

app.get('/api/leaderboard/country/:code', async (req, res) => {
  const code = req.params.code.toUpperCase().slice(0, 3);
  const cKey = `lb:country:${code}`;
  const cached = await cache.get(cKey);
  if (cached) return res.json(JSON.parse(cached));

  const users = await User.find({ isActive: true, isBanned: false, country: code })
    .sort({ weekMinutes: -1 }).limit(50)
    .select('displayName username avatarUrl cityLevel cityName weekMinutes streak age school').lean();

  const data = users.map((u, i) => ({
    rank: i+1,
    displayName: u.displayName || 'Builder',
    username: u.username,
    avatarUrl: u.avatarUrl,
    cityLevel: u.cityLevel,
    cityName: u.cityName,
    weekHours: Math.round(u.weekMinutes / 60 * 10) / 10,
    streak: u.streak,
    age: u.age,
    school: u.school,
  }));

  await cache.set(cKey, 300, JSON.stringify(data));
  res.json(data);
});

app.get('/api/leaderboard/my-rank', auth, async (req, res) => {
  const rank = await User.countDocuments({ weekMinutes: { $gt: req.user.weekMinutes }, isActive: true, isBanned: false });
  res.json({ rank: rank + 1 });
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — PROMO CODES
// ═══════════════════════════════════════════════════════════════

app.post('/api/promo/check', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });

    const promo = await PromoCode.findOne({ code: code.toUpperCase().trim(), isActive: true });
    if (!promo) return res.status(404).json({ error: 'Invalid promo code' });
    if (promo.validUntil && promo.validUntil < new Date()) {
      return res.status(400).json({ error: 'Promo code expired' });
    }
    if (promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ error: 'Promo code limit reached' });
    }
    if (promo.usedBy.some(id => id.toString() === req.user._id.toString())) {
      return res.status(400).json({ error: 'Already used this promo code' });
    }

    res.json({
      valid: true,
      discountPct: promo.discountPct,
      code: promo.code,
      originalPrice: 14999,
      discountedPrice: Math.round(14999 * (1 - promo.discountPct / 100)),
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — PAYMENT
// ═══════════════════════════════════════════════════════════════

const PLANS = {
  pro_monthly: { price: 1499900, months: 1, label: 'Pro Monthly' }, // tiyin
};

app.post('/api/payment/create', auth, async (req, res) => {
  try {
    const { plan = 'pro_monthly', provider, promoCode } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });
    if (!['payme','click','paynet'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid payment provider' });
    }

    let finalPrice = PLANS[plan].price;
    let discountPct = 0;
    let promoDoc = null;

    // Apply promo code if provided
    if (promoCode) {
      promoDoc = await PromoCode.findOne({ code: promoCode.toUpperCase(), isActive: true });
      if (promoDoc && promoDoc.usedCount < promoDoc.maxUses &&
          !promoDoc.usedBy.some(id => id.toString() === req.user._id.toString())) {
        discountPct = promoDoc.discountPct;
        finalPrice  = Math.round(finalPrice * (1 - discountPct / 100));
      }
    }

    const payment = await Payment.create({
      userId: req.user._id,
      provider,
      amount: finalPrice,
      plan,
      months: PLANS[plan].months,
      status: 'pending',
      promoCode: promoDoc?.code,
      discountPct,
    });

    const returnUrl = `${process.env.FRONTEND_URL || 'https://deepwork.city'}/payment/success?pid=${payment._id}`;
    let paymentUrl = '';

    if (provider === 'payme') {
      const params = Buffer.from(JSON.stringify({
        m: process.env.PAYME_MERCHANT_ID,
        ac: { order_id: payment._id.toString() },
        a: finalPrice,
        l: 'uz',
        c: returnUrl,
      })).toString('base64');
      paymentUrl = `https://checkout.paycom.uz/${params}`;
    } else if (provider === 'click') {
      paymentUrl = `https://my.click.uz/services/pay?service_id=${process.env.CLICK_SERVICE_ID}&merchant_id=${process.env.CLICK_MERCHANT_ID}&amount=${finalPrice/100}&transaction_param=${payment._id}&return_url=${encodeURIComponent(returnUrl)}`;
    } else if (provider === 'paynet') {
      paymentUrl = `https://paynet.uz/processing/checkout?shop_id=${process.env.PAYNET_SHOP_ID}&amount=${finalPrice}&order_id=${payment._id}&return_url=${encodeURIComponent(returnUrl)}`;
    }

    res.json({ success: true, paymentId: payment._id, paymentUrl, finalPrice, discountPct });
  } catch (e) {
    console.error('createPayment:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Payme webhook
app.post('/api/payment/payme/webhook', async (req, res) => {
  const { method, params, id } = req.body;
  const authH = req.headers.authorization;
  const expected = 'Basic ' + Buffer.from(`Paycom:${process.env.PAYME_KEY}`).toString('base64');
  if (authH !== expected) return res.json({ error: { code: -32504, message: 'Forbidden' }, id });

  if (method === 'CheckPerformTransaction') {
    const p = await Payment.findById(params?.account?.order_id);
    if (!p) return res.json({ error: { code: -31050, message: 'Order not found' }, id });
    if (p.amount !== params.amount) return res.json({ error: { code: -31001, message: 'Wrong amount' }, id });
    return res.json({ result: { allow: true }, id });
  }
  if (method === 'PerformTransaction') {
    const p = await Payment.findById(params?.account?.order_id);
    if (p && p.status === 'pending') {
      p.status = 'completed'; p.externalId = params.id; await p.save();
      await activateSub(p);
    }
    return res.json({ result: { transaction: params.id, perform_time: Date.now(), state: 2 }, id });
  }
  res.json({ result: {}, id });
});

// Click webhook
app.post('/api/payment/click/webhook', async (req, res) => {
  const { click_trans_id, merchant_trans_id, amount, action, error } = req.body;
  if (action === 1) {
    const p = await Payment.findById(merchant_trans_id);
    if (!p) return res.json({ error: -5, error_note: 'Order not found' });
    return res.json({ click_trans_id, merchant_trans_id, merchant_prepare_id: merchant_trans_id, error: 0 });
  }
  if (action === 2 && error === 0) {
    const p = await Payment.findByIdAndUpdate(merchant_trans_id, { status: 'completed', externalId: click_trans_id }, { new: true });
    if (p) await activateSub(p);
  }
  res.json({ click_trans_id, merchant_trans_id, error: 0 });
});

// Paynet webhook
app.post('/api/payment/paynet/webhook', async (req, res) => {
  const { order_id, status } = req.body;
  if (status === 'completed') {
    const p = await Payment.findByIdAndUpdate(order_id, { status: 'completed' }, { new: true });
    if (p) await activateSub(p);
  }
  res.json({ success: true });
});

async function activateSub(payment) {
  const months = payment.months || 1;
  const expiry = new Date(Date.now() + months * 30 * 24 * 3600000);
  await User.findByIdAndUpdate(payment.userId, { plan: 'pro', planExpiry: expiry, $inc: { lifetimePaid: payment.amount } });

  // Mark promo code as used
  if (payment.promoCode) {
    await PromoCode.findOneAndUpdate(
      { code: payment.promoCode },
      { $inc: { usedCount: 1 }, $push: { usedBy: payment.userId } }
    );
  }

  // Revenue stat
  const d = new Date().toISOString().slice(0, 10);
  await SiteStat.findOneAndUpdate({ date: d }, { $inc: { revenue: payment.amount } }, { upsert: true });
  console.log(`✅ Sub activated: user ${payment.userId}, plan: ${payment.plan}`);
}

app.get('/api/payment/:id/status', auth, async (req, res) => {
  const p = await Payment.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ status: p.status, plan: p.plan });
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — ADMIN PANEL
// ═══════════════════════════════════════════════════════════════

// Admin: Overview stats
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const [totalUsers, proUsers, totalSessions] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ plan: 'pro', isActive: true }),
      Session.countDocuments({ completed: true }),
    ]);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayStat = await SiteStat.findOne({ date: todayStr }).lean();

    // Last 7 days stats
    const days7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      days7.push(d);
    }
    const weekStats = await SiteStat.find({ date: { $in: days7 } }).lean();

    // New users last 7 days
    const newUsers7 = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7*86400000) }
    });

    // Total revenue
    const revResult = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revResult[0]?.total || 0;

    // Active users today (logged in)
    const activeToday = await User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 24*3600000) }
    });

    // Total focus minutes
    const focusResult = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalMinutes' } } }
    ]);
    const totalFocusMins = focusResult[0]?.total || 0;

    res.json({
      overview: {
        totalUsers,
        proUsers,
        freeUsers: totalUsers - proUsers,
        totalSessions,
        totalRevenue: Math.round(totalRevenue / 100), // soum
        activeToday,
        newUsers7,
        totalFocusMins,
        totalFocusHours: Math.round(totalFocusMins / 60),
      },
      today: todayStat || { visits: 0, newUsers: 0, activeSessions: 0, revenue: 0 },
      weekChart: days7.map(d => {
        const s = weekStats.find(w => w.date === d) || {};
        return { date: d, visits: s.visits||0, newUsers: s.newUsers||0, sessions: s.activeSessions||0, revenue: Math.round((s.revenue||0)/100) };
      }),
    });
  } catch (e) {
    console.error('adminStats:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Users list
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page) || 1);
    const limit   = Math.min(100, parseInt(req.query.limit) || 20);
    const search  = req.query.search || '';
    const filter  = req.query.filter || 'all';

    const query = { isActive: true };
    if (search) {
      query.$or = [
        { displayName: new RegExp(search, 'i') },
        { username: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }
    if (filter === 'pro')    query.plan = 'pro';
    if (filter === 'free')   query.plan = 'free';
    if (filter === 'banned') query.isBanned = true;

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit)
        .select('displayName username phone email plan streak totalMinutes createdAt lastActive isBanned country age school rank loginCount')
        .lean(),
      User.countDocuments(query),
    ]);

    res.json({
      users: users.map(u => ({
        ...u,
        totalHours: Math.round(u.totalMinutes / 60 * 10) / 10,
        phone: u.phone,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Ban/unban user
app.post('/api/admin/users/:id/ban', adminAuth, async (req, res) => {
  const { reason } = req.body;
  const u = await User.findByIdAndUpdate(req.params.id,
    { isBanned: true, banReason: reason || 'Admin ban' }, { new: true }).lean();
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, user: { id: u._id, displayName: u.displayName, isBanned: u.isBanned } });
});

app.post('/api/admin/users/:id/unban', adminAuth, async (req, res) => {
  const u = await User.findByIdAndUpdate(req.params.id, { isBanned: false, banReason: '' }, { new: true }).lean();
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true });
});

// Admin: Grant/revoke pro
app.post('/api/admin/users/:id/pro', adminAuth, async (req, res) => {
  const { months = 1 } = req.body;
  const expiry = new Date(Date.now() + months * 30 * 24 * 3600000);
  const u = await User.findByIdAndUpdate(req.params.id, { plan: 'pro', planExpiry: expiry }, { new: true }).lean();
  res.json({ success: true, planExpiry: expiry });
});

app.post('/api/admin/users/:id/revoke-pro', adminAuth, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { plan: 'free', planExpiry: null });
  res.json({ success: true });
});

// Admin: Promo codes
app.get('/api/admin/promo', adminAuth, async (req, res) => {
  const promos = await PromoCode.find().sort({ createdAt: -1 }).lean();
  res.json(promos);
});

app.post('/api/admin/promo', adminAuth, async (req, res) => {
  try {
    const { code, discountPct, maxUses, validUntil, note } = req.body;
    if (!code || !discountPct) return res.status(400).json({ error: 'Code and discountPct required' });

    const promo = await PromoCode.create({
      code: code.toUpperCase().trim(),
      discountPct: parseInt(discountPct),
      maxUses: parseInt(maxUses) || 100,
      validUntil: validUntil ? new Date(validUntil) : null,
      createdBy: req.user._id,
      note: note || '',
    });
    res.json({ success: true, promo });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ error: 'Code already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/promo/:id', adminAuth, async (req, res) => {
  await PromoCode.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true });
});

// Admin: Payments list
app.get('/api/admin/payments', adminAuth, async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const payments = await Payment.find().sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit)
    .populate('userId', 'displayName username phone email').lean();
  const total = await Payment.countDocuments();
  res.json({ payments, total, page, pages: Math.ceil(total/limit) });
});

// ═══════════════════════════════════════════════════════════════
// CRON JOBS
// ═══════════════════════════════════════════════════════════════

// Reset today's minutes at midnight UTC+5
cron.schedule('0 19 * * *', async () => { // 19:00 UTC = 00:00 UTC+5
  console.log('🕐 Daily reset: todayMinutes');
  await User.updateMany({}, { todayMinutes: 0 });
  await cache.del('lb:global');
}, { timezone: 'UTC' });

// Reset week minutes every Monday 00:00 UTC+5
cron.schedule('0 19 * * 0', async () => {
  console.log('📅 Weekly reset: weekMinutes');
  await User.updateMany({}, { weekMinutes: 0 });
  await cache.del('lb:global');
}, { timezone: 'UTC' });

// Update global ranks every 5 min
cron.schedule('*/5 * * * *', async () => {
  const users = await User.find({ isActive: true }).sort({ totalMinutes: -1 }).select('_id').lean();
  const ops = users.map((u, i) => ({ updateOne: { filter: { _id: u._id }, update: { rank: i+1 } } }));
  if (ops.length) await User.bulkWrite(ops, { ordered: false });
});

// Check expired subscriptions daily at 02:00 UTC
cron.schedule('0 2 * * *', async () => {
  const result = await User.updateMany(
    { plan: 'pro', planExpiry: { $lt: new Date() } },
    { plan: 'free', planExpiry: null }
  );
  if (result.modifiedCount > 0) console.log(`✅ Expired ${result.modifiedCount} subscriptions`);
});

// ═══════════════════════════════════════════════════════════════
// HEALTH + SPA FALLBACK
// ═══════════════════════════════════════════════════════════════

app.get('/health', async (req, res) => {
  const db   = mongoose.connection.readyState === 1 ? 'ok' : 'error';
  let redisSt = 'ok';
  try { await redis.ping(); } catch { redisSt = 'degraded'; }
  res.json({ status: db === 'ok' ? 'ok' : 'degraded', db, redis: redisSt, uptime: Math.round(process.uptime()), ts: new Date().toISOString() });
});

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── START ─────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Deep Work City backend running on port ${PORT}`);
  console.log(`   ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Admin: set ADMIN_PHONE or create user with isAdmin:true`);
});

module.exports = app;
