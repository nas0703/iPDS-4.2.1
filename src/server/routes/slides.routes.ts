import express from 'express';
import { getScopedSupabase, isMissingTableError } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getSafeErrorMessage } from '../utils/errorUtils.js';

const router = express.Router();

export interface PresentationDeckRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  slides: unknown[];
  author: string;
  pptx_base64?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  created_at: string;
  updated_at: string;
  estate_id: string;
  [key: string]: unknown;
}

// In-memory fallback for presentation decks
let inMemoryDecks: PresentationDeckRecord[] = [];

/**
 * GET /api/slides/decks
 * Fetch all saved slide presentation decks
 */
router.get('/slides/decks', requireAuth, async (req, res) => {
  try {
    const estateId = String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      let deckQuery = supabase
        .from('presentation_decks')
        .select('*');
      if (estateId !== 'ALL') {
        deckQuery = deckQuery.eq('estate_id', estateId);
      }
      const { data, error } = await deckQuery.order('updated_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return res.json(data);
      }

      if (error && !isMissingTableError(error)) {
        console.warn('[API Slides] Error fetching decks from Supabase:', error.message);
      }
    }
  } catch (err) {
    console.warn('[API Slides] Error fetching decks:', err);
  }

  const estateId = String(req.estateId || 'FPM_TUNGGAL').trim().toUpperCase();
  const localDecks = estateId === 'ALL' ? inMemoryDecks : inMemoryDecks.filter((d: PresentationDeckRecord) => !d.estate_id || d.estate_id === estateId);
  return res.json(localDecks);
});

/**
 * POST /api/slides/decks
 * Save or update a slide presentation deck
 */
router.post('/slides/decks', requireRole(['staff', 'mandur', 'pf', 'fc', 'afc', 'fs', 'eqi']), async (req, res) => {
  try {
    const deck = req.body;
    if (!deck || !deck.title) {
      return res.status(400).json({ error: 'Data slaid tidak sah' });
    }

    const deckId = deck.id || `deck_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const formattedDeck: PresentationDeckRecord = {
      id: deckId,
      title: deck.title,
      description: deck.description || '',
      category: deck.category || 'Umum',
      slides: Array.isArray(deck.slides) ? deck.slides : [],
      author: deck.author || 'Penceramah',
      pptx_base64: deck.pptx_base64 || null,
      file_name: deck.file_name || null,
      file_size: typeof deck.file_size === 'number' ? deck.file_size : null,
      created_at: deck.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      estate_id: req.estateId || 'FPM_TUNGGAL'
    };

    // Update in-memory fallback
    const existingIndex = inMemoryDecks.findIndex(d => d.id === deckId);
    if (existingIndex >= 0) {
      inMemoryDecks[existingIndex] = formattedDeck;
    } else {
      inMemoryDecks.unshift(formattedDeck);
    }

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      const { error } = await supabase
        .from('presentation_decks')
        .upsert(formattedDeck, { onConflict: 'id' });

      if (error) {
        if (isMissingTableError(error)) {
          console.info('[API Slides] presentation_decks table not found in Supabase schema. Operating seamlessly with in-memory storage.');
        } else {
          console.warn('[API Slides] Error upserting deck to Supabase:', error.message);
        }
      }
    }

    return res.json({ success: true, deck: formattedDeck });
  } catch (err: unknown) {
    console.error('[API Slides] Save error:', err);
    return res.status(500).json({ error: getSafeErrorMessage(err, 'Gagal menyimpan slaid') });
  }
});

/**
 * DELETE /api/slides/decks/:id
 * Delete a presentation deck
 */
router.delete('/slides/decks/:id', requireRole(['pf', 'fc']), async (req, res) => {
  try {
    const { id } = req.params;
    inMemoryDecks = inMemoryDecks.filter(d => d.id !== id);

    const supabase = req.supabase || getScopedSupabase(req.rawToken);
    if (supabase) {
      const { error } = await supabase
        .from('presentation_decks')
        .delete()
        .eq('id', id);

      if (error && !isMissingTableError(error)) {
        console.warn('[API Slides] Error deleting deck from Supabase:', error.message);
      }
    }

    return res.json({ success: true, id });
  } catch (err: unknown) {
    return res.status(500).json({ error: getSafeErrorMessage(err, 'Gagal memadam slaid') });
  }
});

export default router;
