import express from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { calculateCoins, calculateLevel } from '../lib/levelUtils.js';

const router = express.Router();

const startSchema = z.object({
  subject: z.enum(['Math', 'Science', 'Language', 'History', 'Coding', 'Other']).default('Other'),
});

const endSchema = z.object({
  sessionId: z.string().min(1),
  focusScore: z.number().min(0).max(100).default(100),
});

// POST /api/sessions/start
router.post('/start', authenticate, async (req, res) => {
  try {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    // Check if user already has an active session
    const activeSession = await prisma.studySession.findFirst({
      where: { userId: req.user.id, endTime: null },
    });

    if (activeSession) {
      return res.status(409).json({ error: 'You already have an active session', session: activeSession });
    }

    const session = await prisma.studySession.create({
      data: {
        userId: req.user.id,
        startTime: new Date(),
        subject: parsed.data.subject,
      },
    });

    res.status(201).json({ session });
  } catch (err) {
    console.error('Session start error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sessions/end
router.post('/end', authenticate, async (req, res) => {
  try {
    const parsed = endSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { sessionId, focusScore } = parsed.data;

    const session = await prisma.studySession.findFirst({
      where: { id: sessionId, userId: req.user.id, endTime: null },
    });

    if (!session) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - session.startTime.getTime();
    const durationMinutes = Math.max(1, Math.round(durationMs / 60000));
    const coinsEarned = calculateCoins(durationMinutes, focusScore);

    // Update session and user atomically
    const [updatedSession, updatedUser] = await prisma.$transaction(async (tx) => {
      const s = await tx.studySession.update({
        where: { id: sessionId },
        data: {
          endTime,
          durationMinutes,
          focusScore,
          coinsEarned,
        },
      });

      const user = await tx.user.update({
        where: { id: req.user.id },
        data: {
          totalCoins: { increment: coinsEarned },
        },
      });

      const newLevel = calculateLevel(user.totalCoins);
      let finalUser = user;
      if (newLevel !== user.level) {
        finalUser = await tx.user.update({
          where: { id: req.user.id },
          data: { level: newLevel },
        });
      }

      await tx.transaction.create({
        data: {
          userId: req.user.id,
          amount: coinsEarned,
          type: 'EARNED',
          description: `Study session: ${s.subject} (${durationMinutes} min, ${Math.round(focusScore)}% focus)`,
        },
      });

      return [s, finalUser];
    });

    const leveledUp = updatedUser.level > req.user.level;

    res.json({
      session: updatedSession,
      coinsEarned,
      newTotal: updatedUser.totalCoins,
      newLevel: updatedUser.level,
      leveledUp,
    });
  } catch (err) {
    console.error('Session end error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sessions/history
router.get('/history', authenticate, async (req, res) => {
  try {
    const sessions = await prisma.studySession.findMany({
      where: { userId: req.user.id, endTime: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json({ sessions });
  } catch (err) {
    console.error('Session history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sessions/active
router.get('/active', authenticate, async (req, res) => {
  try {
    const session = await prisma.studySession.findFirst({
      where: { userId: req.user.id, endTime: null },
    });

    res.json({ session });
  } catch (err) {
    console.error('Active session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
