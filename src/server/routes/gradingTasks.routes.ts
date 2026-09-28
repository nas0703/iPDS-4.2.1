import express, { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getScopedSupabase } from '../db.js';
import { gradingTaskService, getMalaysiaDate } from '../services/gradingTask.service.js';
import { AppError, getSafeErrorMessage, getErrorStatusCode } from '../utils/errorUtils.js';

const router = express.Router();

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TaskIdSchema = z.string().uuid();
const SessionSchema = z.object({
  id: z.string().min(1),
  tajuk: z.string().optional(),
  program: z.string().optional(),
  jenis_grading: z.string().optional(),
  tarikh: z.string().regex(/^\d{2}\/\d{2}\/\d{2}$/),
  ladang: z.string().optional(),
  peringkat_blok: z.string().min(1),
  no_lori: z.string().min(1),
  nama_penggred: z.string().optional(),
  platforms: z.array(z.record(z.string(), z.unknown())).min(1),
  total_di_gred: z.number().int().positive(),
  total_di_tinggal: z.number().int().nonnegative(),
  total_di_bawa: z.number().int().nonnegative(),
  created_at: z.string().optional()
}).strict();

function sendError(req: Request, res: Response, error: unknown, fallback: string) {
  const status = getErrorStatusCode(error, 500);
  const appError = error instanceof AppError ? error : null;
  return res.status(status).json({
    success: false,
    error: getSafeErrorMessage(error, fallback),
    code: appError?.code || 'GRADING_TASK_ERROR',
    correlationId: req.requestId
  });
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const estateId = String(req.estateId || '').trim().toUpperCase();
    const taskDateInput = req.query.task_date ? String(req.query.task_date) : getMalaysiaDate();
    const parsedDate = DateSchema.safeParse(taskDateInput);
    if (!parsedDate.success) throw new AppError('Tarikh tugasan tidak sah.', 400, 'INVALID_TASK_DATE');

    const supabase = req.supabase || getScopedSupabase(req.rawToken, { mode: 'read' });
    if (!supabase) throw new AppError('Sesi pangkalan data tidak sah.', 401, 'SCOPED_DATABASE_REQUIRED');

    let tasks = await gradingTaskService.listTasks(supabase, estateId, parsedDate.data);
    if (tasks.length === 0 && parsedDate.data === getMalaysiaDate()) {
      try {
        const generated = await gradingTaskService.generateDailyTasks(estateId, parsedDate.data);
        tasks = generated.tasks;
      } catch (genErr) {
        console.warn('[GRADING_TASK] Auto generation fallback notice:', genErr);
      }
    }
    return res.json({ success: true, estate_id: estateId, task_date: parsedDate.data, data: tasks });
  } catch (error) {
    return sendError(req, res, error, 'Gagal mendapatkan Grading Task.');
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const taskId = TaskIdSchema.safeParse(req.params.id);
    if (!taskId.success) throw new AppError('ID tugasan tidak sah.', 400, 'INVALID_TASK_ID');

    const estateId = String(req.estateId || '').trim().toUpperCase();
    const supabase = req.supabase || getScopedSupabase(req.rawToken, { mode: 'read' });
    if (!supabase) throw new AppError('Sesi pangkalan data tidak sah.', 401, 'SCOPED_DATABASE_REQUIRED');

    const task = await gradingTaskService.getTask(supabase, estateId, taskId.data);
    if (!task) throw new AppError('Grading Task tidak ditemui.', 404, 'GRADING_TASK_NOT_FOUND');
    return res.json({ success: true, data: task });
  } catch (error) {
    return sendError(req, res, error, 'Gagal mendapatkan Grading Task.');
  }
});

router.post(
  '/:id/field-complete',
  requireRole(['eqi', 'fc', 'pf', 'afc', 'fs', 'oc', 'rc']),
  async (req, res) => {
    try {
      const taskId = TaskIdSchema.safeParse(req.params.id);
      if (!taskId.success) throw new AppError('ID tugasan tidak sah.', 400, 'INVALID_TASK_ID');

      const session = SessionSchema.safeParse(req.body?.session);
      if (!session.success) {
        throw new AppError('Maklumat penggredan tugasan tidak lengkap.', 400, 'INVALID_GRADING_SESSION');
      }

      const estateId = String(req.estateId || '').trim().toUpperCase();
      const supabase = req.supabase || getScopedSupabase(req.rawToken, { mode: 'write' });
      if (!supabase) throw new AppError('Sesi pangkalan data tidak sah.', 401, 'SCOPED_DATABASE_REQUIRED');

      const task = await gradingTaskService.resolveFieldTask(
        supabase,
        estateId,
        taskId.data,
        session.data,
        {
          userId: req.user?.app_metadata.operator_id || req.user?.sub,
          userName: req.user?.user_metadata.operator_name,
          role: req.authRole,
          requestId: req.requestId
        }
      );

      return res.json({
        success: true,
        message: 'Grading Task selesai di lapangan dan sedang menunggu keputusan kilang.',
        data: task
      });
    } catch (error) {
      return sendError(req, res, error, 'Gagal menyelesaikan Grading Task.');
    }
  }
);

export default router;
