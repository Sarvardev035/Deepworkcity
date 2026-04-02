import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const subjects = ['Math', 'Science', 'Language', 'History', 'Coding', 'Other'];

const fakeUsers = [
  { username: 'alex_studyking', email: 'alex@educoin.dev', coins: 1850 },
  { username: 'maya_learns', email: 'maya@educoin.dev', coins: 1420 },
  { username: 'code_ninja_raj', email: 'raj@educoin.dev', coins: 1100 },
  { username: 'science_sara', email: 'sara@educoin.dev', coins: 980 },
  { username: 'math_wizard_lee', email: 'lee@educoin.dev', coins: 750 },
  { username: 'historian_bob', email: 'bob@educoin.dev', coins: 620 },
  { username: 'poly_lang_jane', email: 'jane@educoin.dev', coins: 480 },
  { username: 'deep_focus_dan', email: 'dan@educoin.dev', coins: 310 },
  { username: 'cram_queen_ana', email: 'ana@educoin.dev', coins: 190 },
  { username: 'new_studier_tom', email: 'tom@educoin.dev', coins: 80 },
];

const calculateLevel = (coins) => {
  const thresholds = [0, 100, 300, 600, 1000, 1800, 3240, 5832, 10498, 18896];
  let level = 1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (coins >= thresholds[i]) { level = i + 1; break; }
  }
  return level;
};

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.transaction.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 12);

  for (const userData of fakeUsers) {
    const level = calculateLevel(userData.coins);
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        password: hashedPassword,
        totalCoins: userData.coins,
        level,
      },
    });

    // Create some fake study sessions
    const sessionCount = Math.floor(Math.random() * 8) + 3;
    for (let i = 0; i < sessionCount; i++) {
      const daysAgo = Math.floor(Math.random() * 7);
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - daysAgo);
      startTime.setHours(Math.floor(Math.random() * 12) + 8);

      const durationMinutes = Math.floor(Math.random() * 90) + 15;
      const focusScore = Math.random() * 40 + 60;
      const coinsEarned = Math.round(durationMinutes * 1 + durationMinutes * (focusScore / 100));
      const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
      const subject = subjects[Math.floor(Math.random() * subjects.length)];

      await prisma.studySession.create({
        data: {
          userId: user.id,
          startTime,
          endTime,
          durationMinutes,
          focusScore: Math.round(focusScore * 10) / 10,
          coinsEarned,
          subject,
        },
      });

      await prisma.transaction.create({
        data: {
          userId: user.id,
          amount: coinsEarned,
          type: 'EARNED',
          description: `Study session: ${subject} (${durationMinutes} min, ${Math.round(focusScore)}% focus)`,
          createdAt: endTime,
        },
      });
    }

    console.log(`✅ Created user: ${userData.username} (${userData.coins} coins, Level ${level})`);
  }

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
