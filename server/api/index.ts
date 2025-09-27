import { Router } from 'express';
import authRouter from './auth.js';
import roomsRouter from './rooms.js';
import boxesRouter from './boxes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/rooms', roomsRouter);
router.use('/boxes', boxesRouter);

export default router;