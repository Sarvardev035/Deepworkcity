import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { getNextLevelThreshold, getLevelThreshold } from '../lib/levelUtils.js';

const router = express.Router();

// GET /api/user/stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user data with aggregate sessions
    const [user, sessionStats, rankResult] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, avatar: true, level: true, totalCoins: true },
      }),
      prisma.studySession.aggregate({
        where: { userId, endTime: { not: null } },
        _sum: { durationMinutes: true },
        _count: { id: true },
      }),
      prisma.user.count({ where: { totalCoins: { gt: (await prisma.user.findUnique({ where: { id: userId }, select: { totalCoins: true } }))?.totalCoins ?? 0 } } }),
    ]);

    const totalHours = Math.round((sessionStats._sum.durationMinutes ?? 0) / 60 * 10) / 10;
    const rank = rankResult + 1;
    const nextThreshold = getNextLevelThreshold(user.level);
    const currentThreshold = getLevelThreshold(user.level);

    res.json({
      coins: user.totalCoins,
      level: user.level,
      rank,
      totalStudyHours: totalHours,
      totalSessions: sessionStats._count.id,
      nextLevelThreshold: nextThreshold,
      currentLevelThreshold: currentThreshold,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/wallet
router.get('/wallet', authenticate, async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { totalCoins: true },
    });

    res.json({ transactions, balance: user.totalCoins });
  } catch (err) {
    console.error('Wallet error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/weekly-stats (for bar chart)
router.get('/weekly-stats', authenticate, async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const sessions = await prisma.studySession.findMany({
      where: {
        userId: req.user.id,
        startTime: { gte: sevenDaysAgo },
        endTime: { not: null },
      },
      select: { startTime: true, durationMinutes: true },
    });

    // Group by day
    const dayMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = 0;
    }

    sessions.forEach((s) => {
      const key = s.startTime.toISOString().split('T')[0];
      if (dayMap[key] !== undefined) {
        dayMap[key] += s.durationMinutes ?? 0;
      }
    });

    const weeklyData = Object.entries(dayMap).map(([date, minutes]) => ({ date, minutes }));
    res.json({ weeklyData });
  } catch (err) {
    console.error('Weekly stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
