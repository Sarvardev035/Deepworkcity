import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/leaderboard
router.get('/', authenticate, async (req, res) => {
  try {
    const leaders = await prisma.user.findMany({
      orderBy: { totalCoins: 'desc' },
      take: 20,
      select: {
        id: true,
        username: true,
        avatar: true,
        level: true,
        totalCoins: true,
      },
    });

    const ranked = leaders.map((user, index) => ({
      ...user,
      rank: index + 1,
    }));

    res.json({ leaders: ranked, currentUserId: req.user.id });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
