import { safeFetch } from '../../../utils/safeFetch';
import { getTodayDateString } from '../../../utils/formatters';
import type { BlockGradingSession } from '../types/penggredan';
import type { GradingTask } from '../types/gradingTask';

function toSessionPayload(session: BlockGradingSession) {
  return {
    id: session.id,
    tajuk: session.tajuk,
    program: session.program,
    jenis_grading: session.jenisGrading,
    tarikh: session.tarikh,
    ladang: session.ladang,
    peringkat_blok: session.peringkatBlok,
    no_lori: session.noLori,
    nama_penggred: session.namaPenggred,
    platforms: session.platforms,
    total_di_gred: session.platforms.reduce((sum, item) => sum + Number(item.tandanDiGred || 0), 0),
    total_di_tinggal: session.platforms.reduce((sum, item) => sum + Number(item.tandanDiTinggal || 0), 0),
    total_di_bawa: session.platforms.reduce((sum, item) => sum + Number(item.tandanDiBawa || 0), 0),
    created_at: session.createdAt
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.error || 'Permintaan Grading Task gagal.');
  }
  return body as T;
}

export const gradingTaskService = {
  async listToday(taskDate: string = getTodayDateString()): Promise<GradingTask[]> {
    const response = await safeFetch(`/api/grading-tasks?task_date=${encodeURIComponent(taskDate)}`);
    const body = await parseResponse<{ success: true; data: GradingTask[] }>(response);
    return body.data || [];
  },

  async getTask(taskId: string): Promise<GradingTask> {
    const response = await safeFetch(`/api/grading-tasks/${encodeURIComponent(taskId)}`);
    const body = await parseResponse<{ success: true; data: GradingTask }>(response);
    return body.data;
  },

  async completeFieldTask(taskId: string, session: BlockGradingSession): Promise<GradingTask> {
    const response = await safeFetch(`/api/grading-tasks/${encodeURIComponent(taskId)}/field-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: toSessionPayload(session) })
    });
    const body = await parseResponse<{ success: true; data: GradingTask }>(response);
    return body.data;
  }
};
